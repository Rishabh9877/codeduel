import { NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

const FALLBACK_LEADERBOARD = [
  { rank: 1, userId: "eng_101", username: "Linus_KernelDev", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Linus", elo: 2420, track: "EMBEDDED_SYSTEMS", wins: 88, losses: 12 },
  { rank: 2, userId: "eng_102", username: "CloudNative_Ace",  avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Cloud", elo: 2315, track: "PRODUCTION_SWE", wins: 76, losses: 14 },
  { rank: 3, userId: "eng_103", username: "Silicon_Carmack",  avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=John", elo: 2280, track: "EMBEDDED_SYSTEMS", wins: 69, losses: 15 },
  { rank: 4, userId: "eng_104", username: "Tokio_AsyncMaster", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Tokio", elo: 2190, track: "PRODUCTION_SWE", wins: 54, losses: 18 },
  { rank: 5, userId: "eng_105", username: "Firmware_Ghost",    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Ghost", elo: 2105, track: "EMBEDDED_SYSTEMS", wins: 48, losses: 20 },
  { rank: 6, userId: "eng_106", username: "K8s_ControllerDev", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=K8s", elo: 1980, track: "PRODUCTION_SWE", wins: 41, losses: 22 },
  { rank: 7, userId: "eng_107", username: "UART_ProtocolHero", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=UART", elo: 1890, track: "EMBEDDED_SYSTEMS", wins: 35, losses: 19 },
  { rank: 8, userId: "guest_1", username: "Guest_Alpha",       avatar: null, elo: 1245, track: "PRODUCTION_SWE", wins: 2, losses: 0 },
];

export async function GET() {
  try {
    // Query the GSI — sorted by ELO (GSI1SK) descending
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "LEADERBOARD#GLOBAL",
        },
        ScanIndexForward: false, // descending ELO
        Limit: 50,
      })
    );

    let entries = (result.Items ?? []).map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      username: item.username,
      avatar: item.avatar ?? null,
      elo: item.GSI1SK, // GSI1SK stores the ELO as a number for sorting
      track: item.track ?? (index % 2 === 0 ? "EMBEDDED_SYSTEMS" : "PRODUCTION_SWE"),
      wins: item.wins ?? 0,
      losses: item.losses ?? 0,
    }));

    if (entries.length === 0) {
      entries = FALLBACK_LEADERBOARD;
    }

    return NextResponse.json({ entries });
  } catch (err) {
    console.warn("Leaderboard DynamoDB fetch fallback:", err);
    return NextResponse.json({ entries: FALLBACK_LEADERBOARD });
  }
}
