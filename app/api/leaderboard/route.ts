import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = ((session?.user as any)?.id || (session?.user as any)?.sub) as string | undefined;

    // Query GSI1 sorted by ELO descending
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "LEADERBOARD#GLOBAL",
        },
        ScanIndexForward: false, // highest ELO first
        Limit: 50,
      })
    );

    const rawItems: any[] = result.Items ?? [];

    // If current logged-in user is not in the list, fetch their profile and merge them in
    if (currentUserId && !rawItems.some((i) => i.userId === currentUserId)) {
      const userProf = await dynamo.send(
        new GetCommand({ TableName: TABLE, Key: { PK: `USER#${currentUserId}`, SK: "PROFILE" } })
      );
      if (userProf.Item) {
        rawItems.push({
          userId: currentUserId,
          username: userProf.Item.username ?? session?.user?.name ?? "Developer",
          avatar: userProf.Item.avatar ?? session?.user?.image ?? null,
          GSI1SK: Number(userProf.Item.elo ?? 1200),
          track: "PRODUCTION_SWE",
          wins: Number(userProf.Item.wins ?? 0),
          losses: Number(userProf.Item.losses ?? 0),
        });
      }
    }

    // Sort descending by ELO
    rawItems.sort((a, b) => Number(b.GSI1SK ?? b.elo ?? 0) - Number(a.GSI1SK ?? a.elo ?? 0));

    const entries = rawItems.map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      username: item.username,
      avatar: item.avatar ?? null,
      elo: Number(item.GSI1SK ?? item.elo ?? 1200),
      track: item.track ?? (index % 2 === 0 ? "EMBEDDED_SYSTEMS" : "PRODUCTION_SWE"),
      wins: Number(item.wins ?? 0),
      losses: Number(item.losses ?? 0),
    }));

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    return NextResponse.json({ entries: [] });
  }
}
