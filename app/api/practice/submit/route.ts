import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChallengeById, getDailyChallenge } from "@/lib/challenges";
import { executeChallenge } from "@/lib/challengeExecutor";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { challengeId, files, isDaily } = body;

    if (!challengeId || !files || typeof files !== "object") {
      return NextResponse.json(
        { error: "challengeId and files are required" },
        { status: 400 }
      );
    }

    const challenge = getChallengeById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Run execution via Piston or local sandbox
    const result = await executeChallenge(challenge, files);

    let streak = 0;
    let newSkills: string[] = [];

    // If all tests passed, persist skill badges and streak
    if (result.allPassed) {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        const userId = ((session.user as any).id || (session.user as any).sub) as string;
        try {
          const userRes = await dynamo.send(
            new GetCommand({
              TableName: TABLE,
              Key: { PK: `USER#${userId}`, SK: "PROFILE" },
            })
          );

          if (userRes.Item) {
            const currentSkills: string[] = userRes.Item.skillsPracticed || [];
            const updatedSkillsSet = new Set([...currentSkills, ...(challenge.skills || [])]);
            newSkills = Array.from(updatedSkillsSet);

            const today = new Date().toISOString().slice(0, 10);
            const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            let currentStreak = Number(userRes.Item.streak || 0);
            const lastDaily = userRes.Item.lastDailyCompleted;

            let updatedStreak = currentStreak;
            let updatedLastDaily = lastDaily;

            if (isDaily) {
              if (lastDaily === today) {
                // Already completed today
                updatedStreak = currentStreak;
              } else if (lastDaily === yesterdayDate) {
                updatedStreak = currentStreak + 1;
                updatedLastDaily = today;
              } else {
                updatedStreak = 1;
                updatedLastDaily = today;
              }
            }
            streak = updatedStreak;

            await dynamo.send(
              new UpdateCommand({
                TableName: TABLE,
                Key: { PK: `USER#${userId}`, SK: "PROFILE" },
                UpdateExpression:
                  "SET skillsPracticed = :s, streak = :st, lastDailyCompleted = :ld",
                ExpressionAttributeValues: {
                  ":s": newSkills,
                  ":st": updatedStreak,
                  ":ld": updatedLastDaily || null,
                },
              })
            );
          }
        } catch (dbErr) {
          console.error("[practice-submit] DB update error:", dbErr);
        }
      }

      return NextResponse.json({
        ...result,
        solved: true,
        walkthrough: challenge.walkthrough,
        skillsPracticed: newSkills.length > 0 ? newSkills : challenge.skills,
        streak,
      });
    }

    return NextResponse.json({
      ...result,
      solved: false,
    });
  } catch (err: any) {
    console.error("[practice-submit] Error:", err);
    return NextResponse.json(
      { error: "Submission failed: " + err.message },
      { status: 500 }
    );
  }
}
