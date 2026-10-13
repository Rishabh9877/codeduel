import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { joinCohort } from "@/lib/campus";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please log in to join a course cohort." }, { status: 401 });
    }

    const userId = ((session.user as any).id || (session.user as any).sub) as string;
    const body = await req.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Join code is required." }, { status: 400 });
    }

    // Get user's current ELO from their profile if possible
    let userElo = 1200;
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

    const cohort = await joinCohort(code, {
      id: userId,
      name: session.user.name || "Student Engineer",
      avatar: session.user.image || null,
      elo: userElo,
    });

    return NextResponse.json({ success: true, cohort });
  } catch (err: any) {
    console.error("Failed to join course cohort:", err);
    return NextResponse.json(
      { error: err.message || "Failed to join cohort." },
      { status: 400 }
    );
  }
}
