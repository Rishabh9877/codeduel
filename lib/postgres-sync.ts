import sql from "@/lib/postgres";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

let tablesInitialized = false;
let initPromise: Promise<void> | null = null;

// Validate if a string is a standard UUID
export function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// Convert any userId (numeric GitHub ID, guest_1, guest_2, or arbitrary string) into a safe bigint
export function toBigIntGhId(userId: string): number {
  if (userId === "guest_1") return -1;
  if (userId === "guest_2") return -2;
  const parsed = parseInt(userId, 10);
  if (!isNaN(parsed) && parsed !== 0) return parsed;

  // Deterministic 31-bit negative hash for arbitrary string IDs
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return -Math.abs(hash || 99999);
}

// Fixed UUIDs for guest bypass accounts
const GUEST_UUIDS: Record<string, string> = {
  "-1": "00000000-0000-0000-0000-000000000001",
  "-2": "00000000-0000-0000-0000-000000000002",
};

/**
 * Ensures required PostgreSQL relational tables and indexes exist.
 * Safe to run multiple times (cached across serverless lifecycle).
 */
export async function ensurePostgresTables() {
  if (tablesInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
        tablesInitialized = true;
        return;
      }

      try {
        await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;

        await sql`
          CREATE TABLE IF NOT EXISTS users (
              id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
              github_id        BIGINT       NOT NULL UNIQUE,
              github_username  VARCHAR(39)  NOT NULL UNIQUE,
              email            VARCHAR(255) UNIQUE,
              avatar_url       TEXT,
              created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
              last_login_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
          );
        `;

        await sql`CREATE INDEX IF NOT EXISTS idx_users_github_id ON users (github_id);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_users_github_username ON users (github_username);`;

        await sql`
          CREATE TABLE IF NOT EXISTS friendships (
              id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id_1    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              user_id_2    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              status       VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted')),
              created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `;

        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_users 
          ON friendships (LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2));
        `;

        await sql`CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON friendships(user_id_1);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON friendships(user_id_2);`;

        // Pre-seed local dev / guest slots
        await sql`
          INSERT INTO users (id, github_id, github_username, email, avatar_url, last_login_at)
          VALUES 
            (${GUEST_UUIDS["-1"]}, -1, 'Guest_Alpha', 'guest_1@local.dev', 'https://api.dicebear.com/7.x/bottts/svg?seed=guest1', NOW()),
            (${GUEST_UUIDS["-2"]}, -2, 'Guest_Beta', 'guest_2@local.dev', 'https://api.dicebear.com/7.x/bottts/svg?seed=guest2', NOW())
          ON CONFLICT (github_id) DO UPDATE SET
            github_username = EXCLUDED.github_username,
            avatar_url = EXCLUDED.avatar_url;
        `;

        tablesInitialized = true;
      } catch (err) {
        console.warn("[postgres-sync] ensurePostgresTables warning:", err);
      }
    })();
  }
  await initPromise;
}

export interface PgUser {
  id: string;
  github_id: string;
  github_username: string;
  avatar_url: string | null;
  email: string | null;
}

/**
 * Upserts a user from their active NextAuth session into PostgreSQL `users` table.
 * Returns the PostgreSQL user record including UUID id.
 */
export async function getOrSyncUser(sessionUser: {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}): Promise<PgUser | null> {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
    return null;
  }

  await ensurePostgresTables();

  const userId = sessionUser.id;
  const ghId = toBigIntGhId(userId);
  const username = sessionUser.name?.trim() || `User_${userId.slice(-6)}`;
  const avatar = sessionUser.image || null;
  const email = sessionUser.email || null;

  try {
    const fixedId = GUEST_UUIDS[String(ghId)];
    let rows: any[];

    if (fixedId) {
      rows = await sql`
        INSERT INTO users (id, github_id, github_username, email, avatar_url, last_login_at)
        VALUES (${fixedId}, ${ghId}, ${username}, ${email}, ${avatar}, NOW())
        ON CONFLICT (github_id) DO UPDATE SET
          github_username = EXCLUDED.github_username,
          avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
          last_login_at = NOW()
        RETURNING id, github_id, github_username, avatar_url, email;
      `;
    } else {
      rows = await sql`
        INSERT INTO users (github_id, github_username, email, avatar_url, last_login_at)
        VALUES (${ghId}, ${username}, ${email}, ${avatar}, NOW())
        ON CONFLICT (github_id) DO UPDATE SET
          github_username = EXCLUDED.github_username,
          avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
          email = COALESCE(EXCLUDED.email, users.email),
          last_login_at = NOW()
        RETURNING id, github_id, github_username, avatar_url, email;
      `;
    }

    if (rows && rows.length > 0) {
      return rows[0] as PgUser;
    }
  } catch (err) {
    console.error("[postgres-sync] getOrSyncUser error:", err);
  }

  return null;
}

/**
 * Finds a target user by username (case-insensitive).
 * Checks PostgreSQL first; if missing, falls back to DynamoDB/codeduel_store and auto-syncs.
 */
export async function findUserByUsername(targetUsername: string): Promise<PgUser | null> {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
    return null;
  }

  await ensurePostgresTables();
  const clean = targetUsername.trim();
  if (!clean) return null;

  try {
    // 1. Search in Postgres users
    const rows = await sql`
      SELECT id, github_id, github_username, avatar_url, email
      FROM users
      WHERE LOWER(github_username) = LOWER(${clean})
      LIMIT 1
    `;

    if (rows.length > 0) {
      return rows[0] as PgUser;
    }

    // 2. Fallback: Check DynamoDB / codeduel_store for user profile
    const scanRes = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "PROFILE" },
      })
    );

    const match = (scanRes.Items || []).find(
      (item) => (item.username || "").toLowerCase() === clean.toLowerCase()
    );

    if (match) {
      return await getOrSyncUser({
        id: match.userId,
        name: match.username,
        email: match.email,
        image: match.avatar,
      });
    }
  } catch (err) {
    console.error("[postgres-sync] findUserByUsername error:", err);
  }

  return null;
}

/**
 * Resolves any user target ID (UUID, numeric GitHub ID, guest_1, guest_2) to a Postgres UUID.
 */
export async function resolveTargetPgId(targetId: string): Promise<string | null> {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
    return null;
  }

  await ensurePostgresTables();
  const clean = targetId.trim();

  // If already a valid UUID, verify it exists in users
  if (isUUID(clean)) {
    return clean;
  }

  // If guest shortcut
  if (clean === "guest_1") return GUEST_UUIDS["-1"];
  if (clean === "guest_2") return GUEST_UUIDS["-2"];

  // Try looking up by numeric github_id
  const ghId = parseInt(clean, 10);
  if (!isNaN(ghId)) {
    try {
      const rows = await sql`SELECT id FROM users WHERE github_id = ${ghId} LIMIT 1`;
      if (rows.length > 0) return rows[0].id;
    } catch (_) {}
  }

  // Try looking up by username
  const user = await findUserByUsername(clean);
  return user ? user.id : null;
}
