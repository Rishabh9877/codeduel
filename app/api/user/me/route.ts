import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = ((session?.user as any)?.id || (session?.user as any)?.sub) as string | undefined;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUsername = (session.user?.name || "").toLowerCase();
  const isAdminUser =
    rawUsername === "rishabh9877" ||
    userId === "Rishabh9877" ||
    (session.user?.email && session.user.email === process.env.ADMIN_EMAIL);

  try {
    let result = await dynamo.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      })
    );

    // Auto-provision profile on first read if not yet in database
    if (!result.Item) {
      const username = session.user?.name ?? "Developer";
      const avatar = session.user?.image ?? null;
      const initialItem = {
        PK: `USER#${userId}`,
        SK: "PROFILE",
        userId,
        username,
        email: session.user?.email ?? null,
        avatar,
        elo: 1000,
        role: isAdminUser ? "ADMIN" : "INDIVIDUAL",
        isAdmin: isAdminUser,
        wins: 0,
        losses: 0,
        createdAt: Date.now(),
      };

      await dynamo.send(new PutCommand({ TableName: TABLE, Item: initialItem }));

      await dynamo.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: `USER#${userId}`,
            SK: "LEADERBOARD",
            GSI1PK: "LEADERBOARD#GLOBAL",
            GSI1SK: 1000,
            userId,
            username,
            avatar,
            wins: 0,
            losses: 0,
          },
        })
      );

      result = { Item: initialItem };
    } else if (isAdminUser && !result.Item.isAdmin) {
      result.Item.isAdmin = true;
      try {
        await dynamo.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { PK: `USER#${userId}`, SK: "PROFILE" },
            UpdateExpression: "SET isAdmin = :ia",
            ExpressionAttributeValues: { ":ia": true },
          })
        );
      } catch (upErr) {
        console.warn("Could not set isAdmin in DB:", upErr);
      }
    }

    const item = result.Item;
    const wins = item.wins ?? 0;
    const losses = item.losses ?? 0;

    return Response.json({
      userId,
      username: item.username ?? session.user?.name ?? "Coder",
      avatar: item.avatar ?? session.user?.image ?? null,
      elo: item.elo ?? 1000,
      role: item.role ?? (isAdminUser ? "ADMIN" : "INDIVIDUAL"),
      isAdmin: item.role === "ADMIN",
      canBeAdmin: Boolean(isAdminUser),
      isPlatformAdmin: Boolean(isAdminUser),
      wins,
      losses,
      totalMatches: wins + losses,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err) {
    console.error("User fetch error:", err);
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
