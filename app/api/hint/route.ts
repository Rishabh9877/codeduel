import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE } from "@/lib/dynamo";
import { getChallengeById } from "@/lib/challenges";
import { getUserSubscriptionTier } from "@/lib/subscription";

const MAX_HINTS = 3;

// Tier-specific prompts sent as the user message — each one explicitly names
// the tier so Gemini can't conflate them. Temperature is raised to 0.7 so
// successive hints feel meaningfully different.
const TIER_INSTRUCTIONS = [
  // Tier 1 — conceptual, no code
  `Give a TIER 1 hint: a single conceptual nudge pointing the player toward the root cause or mechanism behind this bug. 
   Be very brief (1-2 sentences). Do NOT provide the code solution.`,

  // Tier 2 — approach
  `Give a TIER 2 hint: describe the high-level fixing approach in plain language. 
   Explain what needs to be changed in the logic step-by-step without writing exact code. 2-3 sentences.`,

  // Tier 3 — concrete insight
  `Give a TIER 3 hint: provide a concrete implementation insight, mathematical formula, or pointer manipulation insight that shows the key idea. 
   Still do NOT write the entire patched file, but give precise directional guidance.`,
];

const SYSTEM_PROMPT = `You are a Senior Engineering Lead acting as a Socratic coding coach in a competitive production bug-fixing duel.
Help the developer diagnose and resolve the bug without giving away the full answer.
CRITICAL RULE: NEVER provide full code solutions or complete code blocks.
Be concise, technical, warm, and encouraging.
Respond with plain text only — no markdown headers, no bullet points, and at most short inline code keywords if strictly necessary.`;

// Hard guardrail: Coach NEVER gives code solutions.
// If the LLM generates a codeblock longer than 6 lines, the server replaces it.
function sanitizeHint(text: string): string {
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;
  let hasLongCodeBlock = false;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const lines = match[0].split("\n");
    if (lines.length > 6) {
      hasLongCodeBlock = true;
      break;
    }
  }
  if (hasLongCodeBlock) {
    return "The coach nudges you in the right direction, but won't write the code for you: focus on understanding how state updates between calls, and trace the edge case step by step.";
  }
  return text;
}

// Per-tier fallbacks used only when the Gemini API is unavailable
const FALLBACK_HINTS = [
  "Check how elapsed time or pointer offsets are calculated between state updates.",
  "Consider edge conditions like fractional sub-second intervals or circular buffer head/tail collision.",
  "Verify boundary wrap-around masking and state clamping before decrementing or incrementing pointers.",
];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ((session.user as any).id || (session.user as any).sub) as string;
  const body = await req.json();
  const { matchId, challengeId, currentCode, language, activeFileName, practice, practiceTier } = body;

  const isSoloPractice = practice || matchId === "practice" || matchId?.startsWith("practice-");

  let tierIndex = 0;
  let tierNumber = 1;
  let hintsUsed = 0;
  let match: any = null;
  let myRole: "player1" | "player2" = "player1";

  if (isSoloPractice) {
    tierIndex = Math.min(2, Math.max(0, typeof practiceTier === "number" ? practiceTier - 1 : 0));
    tierNumber = tierIndex + 1;
    hintsUsed = tierIndex;
  } else {
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    // Fetch match to verify auth + get current hint count
    const matchResult = await dynamo.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `MATCH#${matchId}`, SK: "META" },
      })
    );

    match = matchResult.Item;
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    const isPlayer1 = match.player1.userId === userId;
    const isPlayer2 = match.player2.userId === userId;
    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (match.status !== "active") {
      return NextResponse.json({ error: "Match is not active" }, { status: 409 });
    }

    myRole = isPlayer1 ? "player1" : "player2";
    hintsUsed = (match[myRole].hintsUsed ?? 0) as number;

    if (hintsUsed >= MAX_HINTS) {
      return NextResponse.json(
        { error: "No hints remaining", hintsUsed },
        { status: 429 }
      );
    }

    tierIndex = hintsUsed;
    tierNumber = hintsUsed + 1;
  }

  // Check subscription tier for hints beyond Tier 1
  if (tierIndex > 0) {
    const subTier = await getUserSubscriptionTier(userId);
    if (subTier === "FREE") {
      return NextResponse.json(
        {
          error: "Free Student accounts include 1 AI coach hint per challenge. Upgrade to Pro Competitor for deep Tier 2 and Tier 3 architectural guidance.",
          requiresPro: true,
          hintsUsed,
        },
        { status: 403 }
      );
    }
  }

  const challenge = getChallengeById(match?.challengeId || challengeId);
  const title = challenge?.title || body.problemTitle || "Production Bug";
  const description = challenge?.ticketMarkdown || body.problemDescription || "Fix the bug";

  const userMessage = `Challenge: ${title}
Track: ${challenge?.track || "PRODUCTION_SWE"}
Repository: ${challenge?.repoContext || "production"}
File Being Edited: ${activeFileName || "main"}

Bug Ticket Description:
${description}

Developer's Current Patch (${language || "code"}):
\`\`\`${language || "text"}
${currentCode?.trim() || "(empty — player hasn't edited anything yet)"}
\`\`\`

${TIER_INSTRUCTIONS[tierIndex]}`;

  let hint = FALLBACK_HINTS[tierIndex];

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      console.error("[hint] GEMINI_API_KEY is not set — using fallback hint");
    } else {
      const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.7,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error("[hint] Gemini API error:", JSON.stringify(data));
      } else {
        const generated = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generated?.trim()) {
          hint = sanitizeHint(generated.trim());
        } else {
          console.warn("[hint] Gemini returned empty candidates — using fallback.");
        }
      }
    }
  } catch (err) {
    console.error("[hint] Network/parse error calling Gemini:", err);
  }

  hint = sanitizeHint(hint);

  // If match mode, increment hintsUsed in DynamoDB
  const newHintsUsed = hintsUsed + 1;
  if (!isSoloPractice && match) {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `MATCH#${matchId}`, SK: "META" },
        UpdateExpression: `SET ${myRole}.hintsUsed = :h`,
        ExpressionAttributeValues: { ":h": newHintsUsed },
      })
    );
  }

  return NextResponse.json({
    hint,
    hintsUsed: newHintsUsed,
    hintsRemaining: Math.max(0, MAX_HINTS - newHintsUsed),
    tier: tierNumber,
  });
}

