import { NextResponse } from "next/server";
import { dynamo, TABLE } from "@/lib/dynamo";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const waitlistRateLimit = new Map<string, { count: number; resetAt: number }>();
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function POST(req: Request) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    // Rate limit: 5 submissions per minute per IP
    const now = Date.now();
    const entry = waitlistRateLimit.get(clientIp);
    if (!entry || now > entry.resetAt) {
      waitlistRateLimit.set(clientIp, { count: 1, resetAt: now + 60000 });
    } else if (entry.count >= 5) {
      return NextResponse.json(
        { error: "Too many waitlist submissions from this IP. Please try again in 1 minute." },
        { status: 429 }
      );
    } else {
      entry.count++;
    }

    const body = await req.json();
    const { email, institution, role, tier } = body;

    if (!email || typeof email !== "string" || email.length > 254 || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: "A valid email address is required (max 254 characters)." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const timestamp = new Date().toISOString();

    const waitlistRecord = {
      PK: `WAITLIST#${cleanEmail}`,
      SK: "PILOT_ENTRY",
      item: {
        email: cleanEmail,
        institution: institution || (cleanEmail.includes(".edu") || cleanEmail.includes(".ac.") ? "Academic Engineering University" : "Technical Institution"),
        role: role || "STUDENT",
        tier: tier || "PRO",
        status: "PILOT_UNLOCKED",
        registeredAt: timestamp,
      },
      gsi1pk: "WAITLIST#ALL",
      gsi1sk: timestamp,
    };

    try {
      await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: waitlistRecord,
      }));
    } catch (dbErr) {
      console.warn("[/api/waitlist] Failed to persist to dynamo/postgres:", dbErr);
    }

    return NextResponse.json({
      success: true,
      message: "Pro / Faculty Pilot Sandbox Unlocked! You now have full access to all Codeduel premium simulation features.",
      pilotBadge: "PILOT_UNLOCKED",
      email: cleanEmail,
    });
  } catch (err: any) {
    console.error("[/api/waitlist] Error:", err);
    return NextResponse.json({ error: "Failed to process pilot waitlist request" }, { status: 500 });
  }
}
