import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { joinCohort, getCohortByCode } from "@/lib/campus";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { STARTING_ELO } from "@/lib/elo";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please log in to join course cohorts." }, { status: 401 });
    }

    const userId = ((session.user as any).id || (session.user as any).sub) as string;
    const body = await req.json();

    // Support single code string, comma/space-separated string, or an array of codes
    let requestedCodes: string[] = [];
    if (Array.isArray(body.codes)) {
      requestedCodes = body.codes;
    } else if (typeof body.code === "string") {
      requestedCodes = body.code
        .split(/[\s,;]+/)
        .map((c: string) => c.trim())
        .filter(Boolean);
    }

    // Deduplicate and uppercase
    const cleanCodes = Array.from(new Set(requestedCodes.map((c) => c.toUpperCase().trim()))).filter(Boolean);

    if (cleanCodes.length === 0) {
      return NextResponse.json({ error: "At least one course code is required." }, { status: 400 });
    }

    // Get user's current ELO from profile
    let userElo = STARTING_ELO;
    try {
      const pRes = await dynamo.send(
        new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
      );
      if (pRes.Item?.elo) {
        userElo = Number(pRes.Item.elo);
      }
    } catch (e) {
      console.warn("Could not fetch user ELO for enrollment:", e);
    }

    const userInfo = {
      id: userId,
      name: session.user.name || "Student Engineer",
      avatar: session.user.image || null,
      elo: userElo,
    };

    const joinedCohorts = [];
    const errors = [];

    for (const code of cleanCodes) {
      try {
        const cohort = await joinCohort(code, userInfo);
        joinedCohorts.push(cohort);
      } catch (err: any) {
        console.warn(`Could not join cohort ${code}:`, err.message);
        errors.push(`Cohort "${code}": ${err.message || "Failed to join."}`);
      }
    }

    if (joinedCohorts.length === 0) {
      return NextResponse.json(
        { error: errors.join(" ") || "No valid course cohorts could be joined." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      cohort: joinedCohorts[0],
      cohorts: joinedCohorts,
      count: joinedCohorts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("Failed to join course cohorts:", err);
    return NextResponse.json(
      { error: err.message || "Failed to join course cohorts." },
      { status: 400 }
    );
  }
}
