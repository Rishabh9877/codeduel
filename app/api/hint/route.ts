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
// Strips accidental multi-line code blocks and multi-statement inline code from Gemini responses to enforce Socratic pedagogy.
function sanitizeHint(text: string, fallback?: string): string {
  if (!text) return fallback || "";

  // 1. Strip all multi-line fenced code blocks
  let cleaned = text.replace(/```[a-zA-Z0-9_-]*\n[\s\S]*?\n```/g, () => {
    return "[Socratic Lead Guidance: Trace the state transitions and pointer arithmetic directly in your logic rather than copying pre-written blocks.]";
  });

  // 2. Also strip any remaining triple backtick blocks containing newlines
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
    if (match.includes("\n")) {
      return "[Focus on isolating the root-cause assertion failure.]";
    }
    return match;
  });

  // 3. Strip inline code snippets that contain more than one statement, compound constructs, or lengthy code
  cleaned = cleaned.replace(/`([^`]+)`/g, (match, innerCode) => {
    const trimmed = innerCode.trim();
    const semicolonCount = (trimmed.match(/;/g) || []).length;
    const hasBraces = /[{}]/.test(trimmed);
    const hasMultiStatement =
      semicolonCount > 1 || (semicolonCount >= 1 && (hasBraces || /\b(if|for|while|return)\b/.test(trimmed)));
    if (hasMultiStatement || trimmed.length > 50) {
      return "[code statement stripped for Socratic evaluation]";
    }
    return match;
  });

  // 4. Fallback if the response was entirely a code block
  if (cleaned.trim().length < 15 && fallback) {
    return fallback;
  }

  return cleaned.trim();
}

// Per-tier fallbacks used only when the Gemini API is unavailable
const FALLBACK_HINTS = [
  "Check how elapsed time or pointer offsets are calculated between state updates.",
  "Consider edge conditions like fractional sub-second intervals or circular buffer head/tail collision.",
  "Verify boundary wrap-around masking and state clamping before decrementing or incrementing pointers.",
];

import { checkRateLimitDb, getClientIp, getActionRateLimit } from "@/lib/rateLimit";

const userRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(map: Map<string, { count: number; resetAt: number }>, key: string, limit = 12, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now > entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  const clientIp = getClientIp(req);

  const body = await req.json();
  const { matchId, challengeId, currentCode, language, activeFileName, practice, practiceTier } = body;

  const session = await getServerSession(authOptions);
  const userId = session?.user
    ? ((session.user as any).id || (session.user as any).userId || (session.user as any).sub)
    : "guest_practice";

  const isSoloPractice = practice || matchId === "practice" || matchId?.startsWith("practice-");

  // Distributed database-backed rate limit by IP (works across serverless lambdas), configurable & elevated in DEMO_MODE
  const maxHintsRate = getActionRateLimit(isSoloPractice ? "hint_solo" : "hint_match", 15);
  const ipRl = await checkRateLimitDb(isSoloPractice ? "hint_solo_ip" : "hint_match_ip", clientIp, maxHintsRate, 60);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded: You are requesting hints too rapidly from this IP. Please pause for 60 seconds." },
      { status: 429 }
    );
  }

  if (userId && !checkRateLimit(userRateLimitMap, `user_${userId}`, 5, 60000)) {
    return NextResponse.json(
      { error: "Per-user rate limit exceeded: Maximum 5 hint requests per minute allowed." },
      { status: 429 }
    );
  }

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

    // Fetch match to verify auth + role
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
    const currentHints = (match[myRole].hintsUsed ?? 0) as number;

    if (currentHints >= MAX_HINTS) {
      return NextResponse.json(
        { error: "No hints remaining: You have reached the maximum 3-hint quota for this match.", hintsUsed: MAX_HINTS },
        { status: 429 }
      );
    }

    // Atomic server-side increment with conditional check: guarantees parallel requests cannot exceed quota
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `MATCH#${matchId}`, SK: "META" },
          UpdateExpression: `SET ${myRole}.hintsUsed = if_not_exists(${myRole}.hintsUsed, :zero) + :one`,
          ConditionExpression: `attribute_not_exists(${myRole}.hintsUsed) OR ${myRole}.hintsUsed < :maxHints`,
          ExpressionAttributeValues: {
            ":zero": 0,
            ":one": 1,
            ":maxHints": MAX_HINTS,
          },
        })
      );
    } catch (condErr: any) {
      if (
        condErr?.name === "ConditionalCheckFailedException" ||
        condErr?.message?.includes("conditional") ||
        condErr?.message?.includes("ConditionalCheckFailed")
      ) {
        return NextResponse.json(
          { error: "No hints remaining: You have reached the maximum 3-hint quota for this match.", hintsUsed: MAX_HINTS },
          { status: 429 }
        );
      }
      throw condErr;
    }

    tierIndex = currentHints;
    tierNumber = currentHints + 1;
    hintsUsed = currentHints + 1;
  }

  // Check subscription tier for hints beyond Tier 1 (only for authenticated competitive matches)
  if (tierIndex > 0 && !isSoloPractice && userId !== "guest_practice") {
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

  const safeFileName = typeof activeFileName === "string" ? activeFileName.slice(0, 100).replace(/[^\w.-]/g, "") : "main";
  const safeCurrentCode = typeof currentCode === "string" ? currentCode.slice(0, 12000).trim() : "";

  // Canonical solutions and complete test harnesses must NEVER be included in the model prompt.
  // The model only receives the problem description, developer's current diff, and tier instruction.
  const userMessage = `Challenge: ${title}
Track: ${challenge?.track || "PRODUCTION_SWE"}
Repository: ${challenge?.repoContext || "production"}
File Being Edited: ${safeFileName}

Bug Ticket Description:
${description}

Developer's Current Patch (${language || "code"}):
\`\`\`${language || "text"}
${safeCurrentCode || "(empty — player hasn't edited anything yet)"}
\`\`\`

${TIER_INSTRUCTIONS[tierIndex]}`;

  // Smart Socratic fallback derived directly from the challenge's walkthrough (conceptual only, never canonical code)
  let hint = FALLBACK_HINTS[tierIndex];
  if (challenge?.walkthrough) {
    if (tierIndex === 0 && challenge.walkthrough.rootCause) {
      const firstSentence = challenge.walkthrough.rootCause.split(". ")[0];
      hint = `Conceptual Nudge: Pay close attention to the core state boundary. In particular, consider: ${firstSentence}. How does this affect edge-case behavior?`;
    } else if (tierIndex === 1 && challenge.walkthrough.commonMistakes?.length) {
      hint = `Architectural Approach: Verify your calculation sequence step-by-step. Be careful to avoid: ${challenge.walkthrough.commonMistakes.slice(0, 2).join(", and ")}.`;
    } else if (tierIndex === 2 && challenge.walkthrough.whyItMatters) {
      hint = `Deep Insight: ${challenge.walkthrough.whyItMatters} Ensure pointer wrap-around and state updates maintain strict boundary conditions before returning.`;
    }
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      console.log("[hint] GEMINI_API_KEY not set — using curated Socratic hint");
    } else {
      // Current live Google Gemini Flash API model IDs verified via live API response
      const candidateModels = [
        "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash",
      ];
      let succeeded = false;

      for (const model of candidateModels) {
        try {
          const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
          const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: "user", parts: [{ text: userMessage }] }],
              generationConfig: {
                maxOutputTokens: 400,
                temperature: 0.7,
              },
            }),
            signal: AbortSignal.timeout(6000),
          });

          const data = await response.json();
          if (response.ok && !data.error && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            hint = sanitizeHint(data.candidates[0].content.parts[0].text.trim(), hint);
            succeeded = true;
            break;
          }
        } catch (callErr) {
          console.warn(`[hint] Model ${model} call error:`, (callErr as any)?.message || callErr);
        }
      }

      if (!succeeded) {
        console.warn("[hint] Gemini API call unsuccessful; refunding hint reservation and serving curated fallback.");
        // Refund the reservation if the Gemini call fails in match mode
        if (!isSoloPractice && match) {
          try {
            // Refund the reservation with condition so hintsUsed never goes below 0
            await dynamo.send(
              new UpdateCommand({
                TableName: TABLE,
                Key: { PK: `MATCH#${matchId}`, SK: "META" },
                UpdateExpression: `SET ${myRole}.hintsUsed = ${myRole}.hintsUsed - :one`,
                ConditionExpression: `attribute_exists(${myRole}.hintsUsed) AND ${myRole}.hintsUsed > :zero`,
                ExpressionAttributeValues: { ":one": 1, ":zero": 0 },
              })
            );
            hintsUsed = Math.max(0, hintsUsed - 1);
          } catch (refundErr) {
            console.warn("[hint] Could not refund hint reservation:", refundErr);
          }
        }
      }
    }
  } catch (err) {
    console.error("[hint] Network error calling Gemini:", err);
  }

  hint = sanitizeHint(hint, FALLBACK_HINTS[tierIndex]);

  const finalHintsUsed = isSoloPractice ? tierNumber : hintsUsed;

  return NextResponse.json({
    hint,
    hintsUsed: finalHintsUsed,
    hintsRemaining: Math.max(0, MAX_HINTS - finalHintsUsed),
    tier: tierNumber,
  });
}

