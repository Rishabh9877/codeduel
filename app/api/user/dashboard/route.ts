import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ((session.user as any).id || (session.user as any).sub) as string;

  try {
    // 1. Fetch user profile
    const profileRes = await dynamo.send(
      new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
    );

    const profile = profileRes.Item;
    const currentElo = Number(profile?.elo ?? 1200);

    // 2. Fetch recent matches for this user
    const matchesScan = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression:
          "SK = :sk AND #s = :fin AND (player1.userId = :uid OR player2.userId = :uid)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":sk": "META",
          ":fin": "finished",
          ":uid": userId,
        },
      })
    );

    const userMatches = (matchesScan.Items ?? []).sort(
      (a, b) => Number(b.finishedAt ?? b.startedAt ?? 0) - Number(a.finishedAt ?? a.startedAt ?? 0)
    );

    const recentMatches = userMatches.slice(0, 5).map((m) => {
      const isPlayer1 = m.player1?.userId === userId;
      const oppSlot = isPlayer1 ? m.player2 : m.player1;
      const isWin = m.winnerId === userId;
      const diff = Math.abs(Number(m.newWinnerElo ?? 1216) - Number(m.player1?.elo ?? 1200));

      return {
        matchId: m.matchId,
        opponent: oppSlot?.username ?? "Anonymous",
        opponentAvatar: oppSlot?.avatar ?? null,
        problem: m.challengeId ? m.challengeId.replace(/-/g, " ").toUpperCase() : "1v1 Duel Challenge",
        result: isWin ? "Win" : "Loss",
        elo: isWin ? `+${diff || 16}` : `-${diff || 16}`,
        playedAt: new Date(m.finishedAt ?? m.startedAt ?? Date.now()).toISOString(),
      };
    });

    // 3. ELO History
    const eloHistory: Array<{ played_at: string; elo: number }> = [
      { played_at: new Date(profile?.createdAt ?? Date.now() - 86400000).toISOString(), elo: 1200 },
    ];
    let rollingElo = 1200;
    const chronological = [...userMatches].reverse();
    for (const m of chronological) {
      const isWin = m.winnerId === userId;
      rollingElo = isWin
        ? Number(m.newWinnerElo ?? (rollingElo + 16))
        : Number(m.newLoserElo ?? Math.max(800, rollingElo - 16));
      eloHistory.push({
        played_at: new Date(m.finishedAt ?? m.startedAt ?? Date.now()).toISOString(),
        elo: rollingElo,
      });
    }
    if (eloHistory.length === 1 && currentElo !== 1200) {
      eloHistory.push({
        played_at: new Date().toISOString(),
        elo: currentElo,
      });
    }

    // 4. Activity Map
    const activityMap: Record<string, number> = {};
    for (const m of userMatches) {
      const d = new Date(m.finishedAt ?? m.startedAt ?? Date.now()).toISOString().split("T")[0];
      activityMap[d] = (activityMap[d] ?? 0) + 1;
    }
    const today = new Date().toISOString().split("T")[0];
    if (!activityMap[today]) activityMap[today] = 1;

    return NextResponse.json({
      recentMatches,
      activityMap,
      eloHistory,
      joinedAt: new Date(profile?.createdAt ?? Date.now()).toISOString(),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
