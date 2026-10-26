import { NextResponse } from "next/server";
import { checkRateLimitDb, getClientIp, getActionRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // Distributed rate-limiting: configurable via RATE_LIMIT_VERIFY_FACULTY, elevated in DEMO_MODE
    const maxAttempts = getActionRateLimit("verify_faculty", 5);
    const rl = await checkRateLimitDb("faculty_verify", clientIp, maxAttempts, 900);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many faculty verification attempts. Please wait 15 minutes before trying again." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const passcode = (body.passcode || "").trim().toUpperCase();

    // Passcode MUST come from environment variable with NO hardcoded default
    const expected = process.env.FACULTY_SECRET ? process.env.FACULTY_SECRET.trim().toUpperCase() : null;

    if (!expected) {
      return NextResponse.json(
        { error: "Faculty passcode verification is not configured on this server." },
        { status: 503 }
      );
    }

    if (passcode === expected) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json(
      { error: "Invalid faculty verification key. Please enter the official faculty license key provided by your department administrator." },
      { status: 403 }
    );
  } catch (err) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
