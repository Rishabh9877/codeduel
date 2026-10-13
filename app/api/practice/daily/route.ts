import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyChallenge } from "@/lib/challenges";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const challenge = getDailyChallenge();

    let streak = 0;
    let completedToday = false;

    const session = await getServerSession(authOptions);
    if (session?.user) {
      const userId = ((session.user as any).id || (session.user as any).sub) as string;
      const userRes = await dynamo.send(
        new GetCommand({
          TableName: TABLE,
          Key: { PK: `USER#${userId}`, SK: "PROFILE" },
        })
      );
      if (userRes.Item) {
        streak = Number(userRes.Item.streak ?? 0);
        completedToday = userRes.Item.lastDailyCompleted === today;
      }
    }

    return NextResponse.json({
      date: today,
      challenge: {
        id: challenge.id,
        track: challenge.track,
        language: challenge.language,
        title: challenge.title,
        repoContext: challenge.repoContext,
        totalTests: challenge.totalTests,
        difficulty: challenge.difficulty,
        estimatedMinutes: challenge.estimatedMinutes,
        skills: challenge.skills,
      },
      streak,
      completedToday,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch daily challenge: " + err.message },
      { status: 500 }
    );
  }
}
