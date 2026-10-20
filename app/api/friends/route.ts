import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/postgres";
import { dynamo, TABLE } from "@/lib/dynamo";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  getOrSyncUser,
  findUserByUsername,
  resolveTargetPgId,
  ensurePostgresTables,
  isUUID,
} from "@/lib/postgres-sync";

export const dynamic = "force-dynamic";

// Fetch Friends & Pending Requests
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = ((session.user as any).id || (session.user as any).sub) as string;

  try {
    let friends: any[] = [];
    let pendingSent: any[] = [];
    let pendingReceived: any[] = [];

    // Ensure PostgreSQL user record exists
    const pgUser = await getOrSyncUser({
      id: userId,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    });

    if (pgUser) {
      try {
        const friendships = await sql`
          SELECT 
            f.id as friendship_id,
            f.status,
            f.created_at,
            CASE WHEN f.user_id_1 = ${pgUser.id} THEN f.user_id_2 ELSE f.user_id_1 END as friend_id,
            CASE WHEN f.user_id_1 = ${pgUser.id} THEN 'sent' ELSE 'received' END as direction,
            u.github_username as friend_username,
            u.avatar_url as friend_avatar,
            u.github_id as friend_github_id
          FROM friendships f
          JOIN users u ON u.id = CASE WHEN f.user_id_1 = ${pgUser.id} THEN f.user_id_2 ELSE f.user_id_1 END
          WHERE f.user_id_1 = ${pgUser.id} OR f.user_id_2 = ${pgUser.id}
          ORDER BY f.updated_at DESC
        `;

        friends = friendships.filter((f) => f.status === "accepted");
        pendingSent = friendships.filter((f) => f.status === "pending" && f.direction === "sent");
        pendingReceived = friendships.filter((f) => f.status === "pending" && f.direction === "received");
      } catch (pgErr) {
        console.warn("[friends/GET] Postgres query warning:", pgErr);
      }
    }

    // Fetch incoming direct match challenges from DynamoDB
    let incomingChallenges: any[] = [];
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const challengesQuery = await dynamo.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          FilterExpression: "#ttl > :now",
          ExpressionAttributeNames: { "#ttl": "ttl" },
          ExpressionAttributeValues: {
            ":pk": `CHALLENGE#${userId}`,
            ":sk": "CHALLENGE#",
            ":now": nowSec,
          },
        })
      );
      incomingChallenges = challengesQuery.Items || [];
    } catch (dErr) {
      console.warn("[friends/GET] DynamoDB challenge lookup warning:", dErr);
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

  const userId = ((session.user as any).id || (session.user as any).sub) as string;

  try {
    const pgUser = await getOrSyncUser({
      id: userId,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    });

    if (!pgUser) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    const body = await req.json();
    const { action, targetUsername, targetId } = body;

    // ── 1. ADD FRIEND ──────────────────────────────────────────────────────────
    if (action === "add") {
      if (!targetUsername || typeof targetUsername !== "string") {
        return NextResponse.json({ error: "Please enter a valid GitHub username." }, { status: 400 });
      }

      const cleanUsername = targetUsername.trim();
      const targetUser = await findUserByUsername(cleanUsername);

      if (!targetUser) {
        return NextResponse.json(
          {
            error: `User "${cleanUsername}" not found. Ensure they have signed in to CodeDuel.`,
          },
          { status: 404 }
        );
      }

      if (targetUser.id === pgUser.id) {
        return NextResponse.json({ error: "You cannot add yourself as a friend." }, { status: 400 });
      }

      // Check existing relationship between these two users
      const existing = await sql`
        SELECT id, status, user_id_1, user_id_2 FROM friendships
        WHERE (user_id_1 = ${pgUser.id} AND user_id_2 = ${targetUser.id})
           OR (user_id_1 = ${targetUser.id} AND user_id_2 = ${pgUser.id})
        LIMIT 1
      `;

      if (existing.length > 0) {
        const row = existing[0];
        if (row.status === "accepted") {
          return NextResponse.json(
            { error: `You are already friends with ${targetUser.github_username}.` },
            { status: 400 }
          );
        }

        // If current user already sent the request
        if (row.user_id_1 === pgUser.id) {
          return NextResponse.json(
            { error: `Friend request to ${targetUser.github_username} is already pending.` },
            { status: 400 }
          );
        }

        // If target user already sent a pending request to current user, auto-accept it!
        await sql`
          UPDATE friendships
          SET status = 'accepted', updated_at = NOW()
          WHERE id = ${row.id}
        `;
        return NextResponse.json({
          success: true,
          message: `Accepted incoming friend request from ${targetUser.github_username}! You are now friends.`,
        });
      }

      // Insert new pending friend request
      await sql`
        INSERT INTO friendships (user_id_1, user_id_2, status, created_at, updated_at)
        VALUES (${pgUser.id}, ${targetUser.id}, 'pending', NOW(), NOW())
        ON CONFLICT (LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2)) DO NOTHING
      `;

      return NextResponse.json({
        success: true,
        message: `Friend request sent to ${targetUser.github_username}!`,
      });
    }

    // ── 2. ACCEPT FRIEND REQUEST ───────────────────────────────────────────────
    if (action === "accept") {
      if (!targetId) {
        return NextResponse.json({ error: "Target ID is required." }, { status: 400 });
      }

      const resolvedTarget = await resolveTargetPgId(String(targetId));
      if (!resolvedTarget) {
        return NextResponse.json({ error: "Target user not found." }, { status: 404 });
      }

      // Accept pending friendship where the other user is the sender (user_id_1) or matching friendship id
      const updated = await sql`
        UPDATE friendships 
        SET status = 'accepted', updated_at = NOW()
        WHERE status = 'pending' 
          AND (
            (user_id_1 = ${resolvedTarget} AND user_id_2 = ${pgUser.id})
            OR (user_id_1 = ${pgUser.id} AND user_id_2 = ${resolvedTarget})
            OR (id = ${resolvedTarget} AND (user_id_1 = ${pgUser.id} OR user_id_2 = ${pgUser.id}))
          )
        RETURNING id
      `;

      if (updated.length === 0) {
        return NextResponse.json({ error: "Pending friend request not found." }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: "Friend request accepted!" });
    }

    // ── 3. REMOVE / REJECT FRIEND ──────────────────────────────────────────────
    if (action === "remove") {
      if (!targetId) {
        return NextResponse.json({ error: "Target ID is required." }, { status: 400 });
      }

      const resolvedTarget = await resolveTargetPgId(String(targetId));
      if (!resolvedTarget) {
        return NextResponse.json({ error: "Target user not found." }, { status: 404 });
      }

      await sql`
        DELETE FROM friendships 
        WHERE (
          (user_id_1 = ${pgUser.id} AND user_id_2 = ${resolvedTarget})
          OR (user_id_1 = ${resolvedTarget} AND user_id_2 = ${pgUser.id})
          OR (id = ${resolvedTarget} AND (user_id_1 = ${pgUser.id} OR user_id_2 = ${pgUser.id}))
        )
      `;

      return NextResponse.json({ success: true, message: "Friend removed." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: any) {
    console.error("[friends/POST] Friend action failed:", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
