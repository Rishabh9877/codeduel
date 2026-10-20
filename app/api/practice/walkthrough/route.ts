import { NextResponse } from "next/server";
import { getChallengeById } from "@/lib/challenges";

const walkthroughRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    const now = Date.now();
    const entry = walkthroughRateLimit.get(clientIp);
    if (!entry || now > entry.resetAt) {
      walkthroughRateLimit.set(clientIp, { count: 1, resetAt: now + 60000 });
    } else if (entry.count >= 10) {
      return NextResponse.json(
        { error: "Too many walkthrough unlock requests. Please wait a minute." },
        { status: 429 }
      );
    } else {
      entry.count++;
    }

    const body = await req.json();
    const { challengeId, attemptsCount = 0, secondsSpent = 0 } = body;

    if (!challengeId) {
      return NextResponse.json({ error: "challengeId is required" }, { status: 400 });
    }

    const challenge = getChallengeById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Guardrail: must have attempted at least twice or spent 3 minutes (180 seconds)
    const canUnlock = attemptsCount >= 2 || secondsSpent >= 180;
    if (!canUnlock) {
      return NextResponse.json(
        {
          error: "Walkthrough is locked. Run tests at least 2 times or spend at least 3 minutes inspecting the codebase before unlocking.",
          canUnlock: false,
          attemptsRemaining: Math.max(0, 2 - attemptsCount),
          secondsRemaining: Math.max(0, 180 - secondsSpent),
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      unlocked: true,
      walkthrough: challenge.walkthrough,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to unlock walkthrough: " + err.message },
      { status: 500 }
    );
  }
}
