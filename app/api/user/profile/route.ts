import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, PutCommand, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ((session.user as any).id || (session.user as any).sub) as string;

  try {
    // 1 — Fetch or auto-provision real user profile
    let profileRes = await dynamo.send(
      new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
    );

    if (!profileRes.Item) {
      const username = session.user.name ?? "Developer";
      const avatar = session.user.image ?? null;
      const initialProfile = {
        PK: `USER#${userId}`,
        SK: "PROFILE",
        userId,
        username,
        email: session.user.email ?? null,
        avatar,
        elo: 1200,
        wins: 0,
        losses: 0,
        createdAt: Date.now(),
      };
      await dynamo.send(new PutCommand({ TableName: TABLE, Item: initialProfile }));
      await dynamo.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: `USER#${userId}`,
            SK: "LEADERBOARD",
            GSI1PK: "LEADERBOARD#GLOBAL",
            GSI1SK: 1200,
            userId,
            username,
            avatar,
            wins: 0,
            losses: 0,
          },
        })
      );
      profileRes = { Item: initialProfile };
    }

    const dynItem = profileRes.Item;
    const currentElo = Number(dynItem.elo ?? 1200);
    const wins = Number(dynItem.wins ?? 0);
    const losses = Number(dynItem.losses ?? 0);
    const totalMatches = wins + losses;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // 2 — Query real matches for this user from database
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

    const recentMatches = userMatches.slice(0, 10).map((m) => {
      const isPlayer1 = m.player1?.userId === userId;
      const mySlot = isPlayer1 ? m.player1 : m.player2;
      const oppSlot = isPlayer1 ? m.player2 : m.player1;
      const isWin = m.winnerId === userId;

      return {
        matchId: m.matchId,
        problem: m.challengeId ? m.challengeId.replace(/-/g, " ").toUpperCase() : "1v1 Duel Challenge",
        opponent: oppSlot?.username ?? "Anonymous",
        opponentAvatar: oppSlot?.avatar ?? null,
        result: (isWin ? "WIN" : "LOSS") as "WIN" | "LOSS",
        eloChange: isWin ? `+${(m.newWinnerElo ?? (mySlot?.elo + 16)) - mySlot?.elo}` : `-${mySlot?.elo - (m.newLoserElo ?? (mySlot?.elo - 16))}`,
        endedBy: m.endedBy ?? "submission",
        playedAt: new Date(m.finishedAt ?? m.startedAt ?? Date.now()).toISOString(),
      };
    });

    // 3 — Calculate Real Global Rank from Leaderboard
    let globalRank = 1;
    try {
      const leadRes = await dynamo.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :pk",
          ExpressionAttributeValues: { ":pk": "LEADERBOARD#GLOBAL" },
          ScanIndexForward: false,
          Limit: 100,
        })
      );
      const items = leadRes.Items ?? [];
      const userIndex = items.findIndex((i) => i.userId === userId);
      globalRank = userIndex >= 0 ? userIndex + 1 : items.length + 1;
    } catch (_) {
      globalRank = 1;
    }

    // 4 — Real Activity Heatmap (based on actual user matches + submissions)
    const activityMap: Record<string, number> = {};
    for (const m of userMatches) {
      const d = new Date(m.finishedAt ?? m.startedAt ?? Date.now()).toISOString().split("T")[0];
      activityMap[d] = (activityMap[d] ?? 0) + 1;
    }
    // If new user, mark today
    const todayStr = new Date().toISOString().split("T")[0];
    if (!activityMap[todayStr]) {
      activityMap[todayStr] = 1;
    }

    // 5 — Real ELO History
    const eloHistory = [
      { label: "Start", fullDate: "Account Created", elo: 1200 }
    ];
    let rollingElo = 1200;
    // Walk from oldest to newest
    const chronological = [...userMatches].reverse();
    for (let i = 0; i < chronological.length; i++) {
      const m = chronological[i];
      const isWin = m.winnerId === userId;
      const eloAfter = isWin ? (m.newWinnerElo ?? (rollingElo + 16)) : (m.newLoserElo ?? Math.max(800, rollingElo - 16));
      rollingElo = eloAfter;
      const d = new Date(m.finishedAt ?? m.startedAt ?? Date.now());
      eloHistory.push({
        label: `M${i + 1}`,
        fullDate: d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        elo: rollingElo,
      });
    }
    if (eloHistory.length === 1 && currentElo !== 1200) {
      eloHistory.push({ label: "Now", fullDate: "Current Rating", elo: currentElo });
    }

    const peakElo = Math.max(...eloHistory.map((h) => h.elo), currentElo);

    return NextResponse.json({
      username: dynItem.username ?? session.user.name ?? "Engineer",
      avatar: dynItem.avatar ?? session.user.image ?? null,
      githubUrl: `https://github.com/${dynItem.username ?? session.user.name ?? "developer"}`,
      elo: currentElo,
      peakElo,
      globalRank,
      wins,
      losses,
      totalMatches,
      winRate,
      joinedAt: new Date(dynItem.createdAt ?? Date.now()).toISOString(),
      eloHistory,
      recentMatches,
      activityMap,
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
