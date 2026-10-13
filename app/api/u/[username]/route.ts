import { NextResponse } from "next/server";
import { dynamo, TABLE } from "@/lib/dynamo";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const cleanUsername = decodeURIComponent(username).trim();

    // 1. Scan for user profile matching username (case-insensitive)
    const scanRes = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "PROFILE" },
      })
    );

    const allProfiles = scanRes.Items || [];
    const userProfile = allProfiles.find(
      (p) => (p.username || "").toLowerCase() === cleanUsername.toLowerCase()
    );

    if (!userProfile) {
      return NextResponse.json({ error: "Developer profile not found" }, { status: 404 });
    }

    // 2. Check privacy settings
    const isPublic = userProfile.isPublic !== false; // default true
    const showMatchHistory = userProfile.showMatchHistory !== false; // default true

    if (!isPublic) {
      return NextResponse.json({
        isPrivate: true,
        username: userProfile.username,
        avatar: userProfile.avatar ?? null,
      });
    }

    const userId = userProfile.userId;
    const currentElo = Number(userProfile.elo ?? 1200);
    const wins = Number(userProfile.wins ?? 0);
    const losses = Number(userProfile.losses ?? 0);
    const totalMatches = wins + losses;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // 3. Global Rank calculation
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

    // 4. Matches & Track Breakdown
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

    // Track Breakdown
    let sweWins = 0, sweTotal = 0;
    let eceWins = 0, eceTotal = 0;

    for (const m of userMatches) {
      const isWin = m.winnerId === userId;
      const isSwe = m.track === "PRODUCTION_SWE" || (m.challengeId && m.challengeId.startsWith("swe-"));
      if (isSwe) {
        sweTotal++;
        if (isWin) sweWins++;
      } else {
        eceTotal++;
        if (isWin) eceWins++;
      }
    }

    const recentMatches = showMatchHistory
      ? userMatches.slice(0, 8).map((m) => {
          const isPlayer1 = m.player1?.userId === userId;
          const oppSlot = isPlayer1 ? m.player2 : m.player1;
          const isWin = m.winnerId === userId;

          return {
            matchId: m.matchId,
            problem: m.challengeId ? m.challengeId.replace(/-/g, " ").toUpperCase() : "1v1 Duel Challenge",
            track: m.track || (m.challengeId?.startsWith("embedded-") ? "EMBEDDED_SYSTEMS" : "PRODUCTION_SWE"),
            opponent: oppSlot?.username ?? "Anonymous",
            opponentAvatar: oppSlot?.avatar ?? null,
            result: (isWin ? "WIN" : "LOSS") as "WIN" | "LOSS",
            playedAt: new Date(m.finishedAt ?? m.startedAt ?? Date.now()).toISOString(),
          };
        })
      : [];

    // Verification Hash (deterministic string for recruiter verification)
    const verificationSlug = `CD-VERIFY-${Buffer.from(`${userId}-${userProfile.username}`).toString("hex").slice(0, 12).toUpperCase()}`;

    return NextResponse.json({
      isPrivate: false,
      userId,
      username: userProfile.username,
      avatar: userProfile.avatar ?? null,
      githubUrl: `https://github.com/${userProfile.username}`,
      elo: currentElo,
      globalRank,
      wins,
      losses,
      totalMatches,
      winRate,
      streak: Number(userProfile.streak ?? 0),
      skillsPracticed: Array.isArray(userProfile.skillsPracticed) ? userProfile.skillsPracticed : [],
      trackBreakdown: {
        swe: {
          wins: sweWins,
          total: sweTotal,
          winRate: sweTotal > 0 ? Math.round((sweWins / sweTotal) * 100) : 0,
        },
        ece: {
          wins: eceWins,
          total: eceTotal,
          winRate: eceTotal > 0 ? Math.round((eceWins / eceTotal) * 100) : 0,
        },
      },
      recentMatches,
      joinedAt: new Date(userProfile.createdAt ?? Date.now()).toISOString(),
      verificationSlug,
    });
  } catch (err: any) {
    console.error("Public profile fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch profile: " + err.message }, { status: 500 });
  }
}
