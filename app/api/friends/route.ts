import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/postgres";
import { dynamo, TABLE } from "@/lib/dynamo";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

// Fetch Friends & Pending Requests
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const ghId = parseInt(userId);

  try {
    let friends: any[] = [];
    let pendingSent: any[] = [];
    let pendingReceived: any[] = [];

    if (!isNaN(ghId) && process.env.DATABASE_URL) {
      try {
        const userRows = await sql`SELECT id FROM users WHERE github_id = ${ghId}`;
        if (userRows.length > 0) {
          const pgUserId = userRows[0].id;
          const friendships = await sql`
            SELECT 
              f.id as friendship_id,
              f.status,
              f.created_at,
              CASE WHEN f.user_id_1 = ${pgUserId} THEN f.user_id_2 ELSE f.user_id_1 END as friend_id,
              CASE WHEN f.user_id_1 = ${pgUserId} THEN 'sent' ELSE 'received' END as direction,
              u.github_username as friend_username,
              u.avatar_url as friend_avatar,
              u.github_id as friend_github_id
            FROM friendships f
            JOIN users u ON u.id = CASE WHEN f.user_id_1 = ${pgUserId} THEN f.user_id_2 ELSE f.user_id_1 END
            WHERE f.user_id_1 = ${pgUserId} OR f.user_id_2 = ${pgUserId}
            ORDER BY f.updated_at DESC
          `;
          friends = friendships.filter(f => f.status === 'accepted');
          pendingSent = friendships.filter(f => f.status === 'pending' && f.direction === 'sent');
          pendingReceived = friendships.filter(f => f.status === 'pending' && f.direction === 'received');
        }
      } catch (pgErr) {
        console.warn("Postgres friends read fallback:", pgErr);
      }
    }

    // Seamless Local Dev & Guest Dual-Tab Testing Support
    if (userId === "guest_1" && friends.length === 0) {
      friends = [{
        friendship_id: "fs-guest-peer",
        friend_id: "guest_2",
        friend_username: "Guest_Beta",
        friend_avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=GuestBeta",
        friend_github_id: "guest_2",
        status: "accepted",
      }];
    } else if (userId === "guest_2" && friends.length === 0) {
      friends = [{
        friendship_id: "fs-guest-peer",
        friend_id: "guest_1",
        friend_username: "Guest_Alpha",
        friend_avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=GuestAlpha",
        friend_github_id: "guest_1",
        status: "accepted",
      }];
    }

    // Fetch incoming direct match challenges from DynamoDB
    let incomingChallenges: any[] = [];
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const challengesQuery = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        FilterExpression: "#ttl > :now",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: { 
          ":pk": `CHALLENGE#${userId}`, 
          ":sk": "CHALLENGE#",
          ":now": nowSec
        }
      }));
      incomingChallenges = challengesQuery.Items || [];
    } catch (dErr) {
      console.warn("DynamoDB friends challenge lookup fallback:", dErr);
    }

    return NextResponse.json({ friends, pendingSent, pendingReceived, incomingChallenges });
  } catch (err) {
    console.error("Failed to fetch friends:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// Add, Accept, or Remove Friend
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ghId = parseInt((session.user as any).id as string);

  try {
    const { action, targetUsername, targetId } = await req.json();

    const userRows = await sql`SELECT id FROM users WHERE github_id = ${ghId}`;
    if (userRows.length === 0) return NextResponse.json({ error: "User not synced" }, { status: 404 });
    const pgUserId = userRows[0].id;

    if (action === "add" && targetUsername) {
      // Find the target user by username
      const targetRows = await sql`SELECT id FROM users WHERE github_username = ${targetUsername}`;
      if (targetRows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const targetPgId = targetRows[0].id;

      if (targetPgId === pgUserId) return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });

      // Insert pending friendship
      await sql`
        INSERT INTO friendships (user_id_1, user_id_2, status)
        VALUES (${pgUserId}, ${targetPgId}, 'pending')
        ON CONFLICT (LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2)) DO NOTHING
      `;
      return NextResponse.json({ success: true, message: "Friend request sent" });
    }

    if (action === "accept" && targetId) {
      // Update pending request to accepted
      await sql`
        UPDATE friendships 
        SET status = 'accepted', updated_at = NOW()
        WHERE status = 'pending' 
          AND ( (user_id_1 = ${pgUserId} AND user_id_2 = ${targetId}) OR (user_id_1 = ${targetId} AND user_id_2 = ${pgUserId}) )
      `;
      return NextResponse.json({ success: true, message: "Friend request accepted" });
    }

    if (action === "remove" && targetId) {
      await sql`
        DELETE FROM friendships 
        WHERE (user_id_1 = ${pgUserId} AND user_id_2 = ${targetId}) 
           OR (user_id_1 = ${targetId} AND user_id_2 = ${pgUserId})
      `;
      return NextResponse.json({ success: true, message: "Friend removed" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Friend action failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
