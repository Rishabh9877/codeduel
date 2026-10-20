import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/postgres";
import { dynamo, TABLE } from "@/lib/dynamo";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ensurePostgresTables, getOrSyncUser } from "@/lib/postgres-sync";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ users: [] });
  }

  const cleanQuery = query.trim().toLowerCase();
  const currentUserId = ((session.user as any).id || (session.user as any).sub) as string;

  try {
    await ensurePostgresTables();

    // Ensure current user is in Postgres
    const currentPgUser = await getOrSyncUser({
      id: currentUserId,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    });

    const currentPgId = currentPgUser?.id;

    // Search in PostgreSQL
    let pgUsers: Array<{ username: string; avatar: string | null }> = [];
    try {
      const rows = currentPgId
        ? await sql`
            SELECT github_username as username, avatar_url as avatar
            FROM users
            WHERE github_username ILIKE ${'%' + cleanQuery + '%'}
              AND id != ${currentPgId}
            LIMIT 5
          `
        : await sql`
            SELECT github_username as username, avatar_url as avatar
            FROM users
            WHERE github_username ILIKE ${'%' + cleanQuery + '%'}
            LIMIT 5
          `;

      pgUsers = rows.map((r) => ({
        username: r.username,
        avatar: r.avatar ?? "https://github.com/identicons/1.png",
      }));
    } catch (pgErr) {
      console.warn("[users/search] Postgres search warning:", pgErr);
    }

    // If fewer than 5, supplement from DynamoDB / codeduel_store profiles
    if (pgUsers.length < 5) {
      try {
        const scanRes = await dynamo.send(
          new ScanCommand({
            TableName: TABLE,
            FilterExpression: "SK = :sk",
            ExpressionAttributeValues: { ":sk": "PROFILE" },
          })
        );

        const items = scanRes.Items || [];
        const seenUsernames = new Set(pgUsers.map((u) => u.username.toLowerCase()));
        const myUsername = (session.user.name || "").toLowerCase();

        for (const item of items) {
          const uname = item.username || "";
          const lower = uname.toLowerCase();

          if (
            lower.includes(cleanQuery) &&
            lower !== myUsername &&
            item.userId !== currentUserId &&
            !seenUsernames.has(lower)
          ) {
            pgUsers.push({
              username: uname,
              avatar: item.avatar || "https://github.com/identicons/1.png",
            });
            seenUsernames.add(lower);
            if (pgUsers.length >= 5) break;
          }
        }
      } catch (dErr) {
        console.warn("[users/search] DynamoDB supplemental search warning:", dErr);
      }
    }

    return NextResponse.json({ users: pgUsers });
  } catch (err: any) {
    console.error("[users/search] Search failed:", err);
    return NextResponse.json({ users: [] });
  }
}
