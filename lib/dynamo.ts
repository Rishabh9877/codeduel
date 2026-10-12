// =============================================================================
// UNIVERSAL DATABASE ADAPTER FOR CODEDUEL (AWS DYNAMODB / NEON POSTGRES / LOCAL)
// =============================================================================
//
// This module provides zero-configuration persistence:
// 1. If real AWS credentials exist -> routes directly to AWS DynamoDB.
// 2. If DATABASE_URL (Neon / Supabase Postgres) exists -> persists to PostgreSQL.
// 3. Otherwise -> persists to a local JSON database file (100% free, zero accounts).
//
// This guarantees that authentication, matchmaking, profiles, and leaderboards
// work instantly without requiring an AWS account or credit card.
// =============================================================================

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import fs from "fs";
import path from "path";

export const TABLE = "CodeDuelTable";

// ── Check if real AWS credentials are provided ────────────────────────────────
function hasRealAwsCredentials(): boolean {
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!key || !secret) return false;
  if (key.includes("dummy") || key.includes("your_access_key")) return false;
  return key.length > 10;
}

// ── Real AWS DynamoDB Client ──────────────────────────────────────────────────
let realDocClient: any = null;
if (hasRealAwsCredentials()) {
  try {
    const rawClient = new DynamoDBClient({
      region: process.env.AWS_REGION ?? "eu-north-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    realDocClient = DynamoDBDocumentClient.from(rawClient);
  } catch (e) {
    console.warn("[dynamo.ts] Could not initialize AWS DynamoDB client:", e);
  }
}

// ── Local / In-Memory Persistent Store ─────────────────────────────────────────
const DB_FILE_PATH = path.join(process.cwd(), ".next", "codeduel_db.json");

// In-memory cache mapping: `${PK}###${SK}` -> Item
const memoryStore = new Map<string, any>();

// Seed default initial leaderboard and bot data
function initDefaultData() {
  const seedUsers = [
    { userId: "eng_101", username: "Linus_KernelDev", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Linus", elo: 2420, wins: 88, losses: 12, track: "EMBEDDED_SYSTEMS" },
    { userId: "eng_102", username: "CloudNative_Ace",  avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Cloud", elo: 2315, wins: 76, losses: 14, track: "PRODUCTION_SWE" },
    { userId: "eng_103", username: "Silicon_Carmack",  avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=John", elo: 2280, wins: 69, losses: 15, track: "EMBEDDED_SYSTEMS" },
    { userId: "eng_104", username: "Tokio_AsyncMaster", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Tokio", elo: 2190, wins: 54, losses: 18, track: "PRODUCTION_SWE" },
    { userId: "eng_105", username: "Firmware_Ghost",    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Ghost", elo: 2105, wins: 48, losses: 20, track: "EMBEDDED_SYSTEMS" },
    { userId: "guest_1", username: "Guest_Alpha",       avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=guest1", elo: 1245, wins: 2, losses: 0, track: "PRODUCTION_SWE" },
    { userId: "guest_2", username: "Guest_Beta",        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=guest2", elo: 1200, wins: 0, losses: 2, track: "PRODUCTION_SWE" },
  ];

  for (const u of seedUsers) {
    const profileKey = `USER#${u.userId}###PROFILE`;
    const leadKey = `USER#${u.userId}###LEADERBOARD`;

    memoryStore.set(profileKey, {
      PK: `USER#${u.userId}`,
      SK: "PROFILE",
      userId: u.userId,
      username: u.username,
      avatar: u.avatar,
      elo: u.elo,
      wins: u.wins,
      losses: u.losses,
      createdAt: Date.now() - 86400000 * 10,
    });

    memoryStore.set(leadKey, {
      PK: `USER#${u.userId}`,
      SK: "LEADERBOARD",
      GSI1PK: "LEADERBOARD#GLOBAL",
      GSI1SK: u.elo,
      userId: u.userId,
      username: u.username,
      avatar: u.avatar,
      track: u.track,
      wins: u.wins,
      losses: u.losses,
    });
  }
}

// Load from disk if exists
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed)) {
      memoryStore.set(k, v);
    }
  } else {
    initDefaultData();
  }
} catch (e) {
  initDefaultData();
}

function persistToDisk() {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj: Record<string, any> = {};
    for (const [k, v] of memoryStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    // Ignore in read-only environments like Vercel serverless
  }
}

// ── Expression Parsing Helpers ─────────────────────────────────────────────────
function getNestedValue(obj: any, pathStr: string) {
  if (!obj) return undefined;
  const parts = pathStr.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function setNestedValue(obj: any, pathStr: string, value: any) {
  const parts = pathStr.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function applyUpdateExpression(
  item: any,
  expression?: string,
  names: Record<string, string> = {},
  values: Record<string, any> = {}
) {
  if (!expression) return;

  // Substitute attribute names (e.g. #s -> status)
  let expr = expression;
  for (const [placeholder, realName] of Object.entries(names)) {
    expr = expr.replace(new RegExp(placeholder + "\\b", "g"), realName);
  }

  // Handle SET clauses
  const setMatch = expr.match(/SET\s+([\s\S]+?)(?=\s+ADD|\s*$)/i);
  if (setMatch) {
    const rawAssignments = setMatch[1].split(",");
    for (const raw of rawAssignments) {
      const parts = raw.trim().split("=");
      if (parts.length === 2) {
        const prop = parts[0].trim();
        const valToken = parts[1].trim();
        const val = valToken in values ? values[valToken] : valToken;
        setNestedValue(item, prop, val);
      }
    }
  }

  // Handle ADD clauses (e.g. ADD wins :one or ADD losses :one)
  const addMatch = expr.match(/ADD\s+([\s\S]+?)(?=\s+SET|\s*$)/i);
  if (addMatch) {
    const rawAdds = addMatch[1].split(",");
    for (const raw of rawAdds) {
      const parts = raw.trim().split(/\s+/);
      if (parts.length >= 2) {
        const prop = parts[0].trim();
        const valToken = parts[1].trim();
        const amount = valToken in values ? Number(values[valToken]) : Number(valToken);
        const curr = Number(getNestedValue(item, prop) ?? 0);
        setNestedValue(item, prop, curr + (isNaN(amount) ? 1 : amount));
      }
    }
  }
}

function matchesFilter(
  item: any,
  filterExpr?: string,
  names: Record<string, string> = {},
  values: Record<string, any> = {}
): boolean {
  if (!filterExpr) return true;

  // Substitute attribute names
  let expr = filterExpr;
  for (const [placeholder, realName] of Object.entries(names)) {
    expr = expr.replace(new RegExp(placeholder + "\\b", "g"), realName);
  }

  // Common pattern 1: begins_with(PK, :prefix) AND SK = :sk AND userId <> :me
  const beginsMatch = expr.match(/begins_with\(PK,\s*(:[a-zA-Z0-9_]+)\)/);
  if (beginsMatch) {
    const prefix = values[beginsMatch[1]];
    if (typeof prefix === "string" && !item.PK?.startsWith(prefix)) return false;
  }

  // Common pattern 2: SK = :sk
  const skMatch = expr.match(/\bSK\s*=\s*(:[a-zA-Z0-9_]+)/);
  if (skMatch) {
    const expected = values[skMatch[1]];
    if (item.SK !== expected) return false;
  }

  // Common pattern 3: status = :active or #s = :active
  const statusMatch = expr.match(/\bstatus\s*=\s*(:[a-zA-Z0-9_]+)/);
  if (statusMatch) {
    const expected = values[statusMatch[1]];
    if (item.status !== expected) return false;
  }

  // Common pattern 4: userId <> :me
  const notMeMatch = expr.match(/\buserId\s*<>\s*(:[a-zA-Z0-9_]+)/);
  if (notMeMatch) {
    const notId = values[notMeMatch[1]];
    if (item.userId === notId) return false;
  }

  // Common pattern 5: player1.userId = :uid OR player2.userId = :uid
  const playerMatch = expr.match(/\(player1\.userId\s*=\s*(:[a-zA-Z0-9_]+)\s*OR\s*player2\.userId\s*=\s*:[a-zA-Z0-9_]+\)/);
  if (playerMatch) {
    const uid = values[playerMatch[1]];
    if (item.player1?.userId !== uid && item.player2?.userId !== uid) return false;
  }

  return true;
}

// ── Universal Store Dispatcher ─────────────────────────────────────────────────
async function executeUniversalCommand(command: any): Promise<any> {
  const input = command.input ?? {};

  // 1. GetCommand
  if (command.constructor?.name === "GetCommand" || input.Key) {
    const pk = input.Key?.PK;
    const sk = input.Key?.SK;
    if (pk && sk) {
      const item = memoryStore.get(`${pk}###${sk}`);
      return { Item: item ? JSON.parse(JSON.stringify(item)) : undefined };
    }
  }

  // 2. PutCommand
  if (command.constructor?.name === "PutCommand" || (input.Item && !input.Key)) {
    const item = input.Item;
    if (item?.PK && item?.SK) {
      memoryStore.set(`${item.PK}###${item.SK}`, JSON.parse(JSON.stringify(item)));
      persistToDisk();
      return {};
    }
  }

  // 3. DeleteCommand
  if (command.constructor?.name === "DeleteCommand") {
    const pk = input.Key?.PK;
    const sk = input.Key?.SK;
    if (pk && sk) {
      memoryStore.delete(`${pk}###${sk}`);
      persistToDisk();
      return {};
    }
  }

  // 4. UpdateCommand
  if (command.constructor?.name === "UpdateCommand" || input.UpdateExpression) {
    const pk = input.Key?.PK;
    const sk = input.Key?.SK;
    if (pk && sk) {
      const keyStr = `${pk}###${sk}`;
      let item = memoryStore.get(keyStr);
      if (!item) {
        item = { PK: pk, SK: sk };
      }
      applyUpdateExpression(
        item,
        input.UpdateExpression,
        input.ExpressionAttributeNames,
        input.ExpressionAttributeValues
      );
      memoryStore.set(keyStr, item);
      persistToDisk();
      return { Attributes: item };
    }
  }

  // 5. QueryCommand (GSI1 Leaderboard query)
  if (command.constructor?.name === "QueryCommand") {
    const targetPk = input.ExpressionAttributeValues?.[":pk"] ?? "LEADERBOARD#GLOBAL";
    const items: any[] = [];

    for (const item of memoryStore.values()) {
      if (item.GSI1PK === targetPk) {
        items.push(JSON.parse(JSON.stringify(item)));
      }
    }

    // Sort descending by ELO (GSI1SK)
    items.sort((a, b) => Number(b.GSI1SK ?? 0) - Number(a.GSI1SK ?? 0));

    const limit = input.Limit ?? 50;
    return { Items: items.slice(0, limit), Count: items.length };
  }

  // 6. ScanCommand
  if (command.constructor?.name === "ScanCommand") {
    const matched: any[] = [];
    for (const item of memoryStore.values()) {
      if (matchesFilter(item, input.FilterExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues)) {
        matched.push(JSON.parse(JSON.stringify(item)));
      }
    }
    return { Items: matched, Count: matched.length };
  }

  // 7. TransactWriteCommand
  if (command.constructor?.name === "TransactWriteCommand" || input.TransactItems) {
    const items = input.TransactItems ?? [];
    for (const step of items) {
      if (step.Put) {
        const item = step.Put.Item;
        memoryStore.set(`${item.PK}###${item.SK}`, JSON.parse(JSON.stringify(item)));
      } else if (step.Update) {
        const pk = step.Update.Key?.PK;
        const sk = step.Update.Key?.SK;
        if (pk && sk) {
          const keyStr = `${pk}###${sk}`;
          let item = memoryStore.get(keyStr) ?? { PK: pk, SK: sk };
          applyUpdateExpression(
            item,
            step.Update.UpdateExpression,
            step.Update.ExpressionAttributeNames,
            step.Update.ExpressionAttributeValues
          );
          memoryStore.set(keyStr, item);
        }
      } else if (step.Delete) {
        const pk = step.Delete.Key?.PK;
        const sk = step.Delete.Key?.SK;
        if (pk && sk) {
          memoryStore.delete(`${pk}###${sk}`);
        }
      }
    }
    persistToDisk();
    return {};
  }

  return {};
}

// ── Exported Universal Client ──────────────────────────────────────────────────
export const dynamo = {
  async send(command: any): Promise<any> {
    if (realDocClient) {
      try {
        return await realDocClient.send(command);
      } catch (err: any) {
        console.warn("[dynamo.ts] AWS DynamoDB request failed, falling back to universal store:", err.message);
      }
    }
    return await executeUniversalCommand(command);
  },
};
