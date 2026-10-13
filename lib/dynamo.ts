// =============================================================================
// UNIVERSAL DATABASE ADAPTER FOR CODEDUEL (AWS DYNAMODB / NEON POSTGRES / LOCAL)
// =============================================================================
//
// 1. If real AWS credentials exist -> routes directly to AWS DynamoDB.
// 2. If DATABASE_URL (Neon / Supabase Postgres) exists -> persists to PostgreSQL.
// 3. Otherwise -> persists to in-memory/local JSON disk (100% free, zero accounts).
// =============================================================================

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import fs from "fs";
import path from "path";
import postgres from "postgres";

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

// ── Neon Serverless PostgreSQL Client ─────────────────────────────────────────
let pgSql: any = null;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")) {
  try {
    pgSql = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      max: 10,
      idle_timeout: 20,
    });
  } catch (err) {
    console.warn("[dynamo.ts] Could not initialize Postgres client:", err);
  }
}

// ── Local / In-Memory Persistent Store ─────────────────────────────────────────
const DB_FILE_PATH = path.join(process.cwd(), ".next", "codeduel_db.json");
const memoryStore = new Map<string, any>();

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
  } catch (err) {}
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

  let expr = expression;
  for (const [placeholder, realName] of Object.entries(names)) {
    expr = expr.replace(new RegExp(placeholder + "\\b", "g"), realName);
  }

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

  let expr = filterExpr;
  for (const [placeholder, realName] of Object.entries(names)) {
    expr = expr.replace(new RegExp(placeholder + "\\b", "g"), realName);
  }

  const beginsMatch = expr.match(/begins_with\(PK,\s*(:[a-zA-Z0-9_]+)\)/);
  if (beginsMatch) {
    const prefix = values[beginsMatch[1]];
    if (typeof prefix === "string" && !item.PK?.startsWith(prefix)) return false;
  }

  const skMatch = expr.match(/\bSK\s*=\s*(:[a-zA-Z0-9_]+)/);
  if (skMatch) {
    const expected = values[skMatch[1]];
    if (item.SK !== expected) return false;
  }

  const statusMatch = expr.match(/\bstatus\s*=\s*(:[a-zA-Z0-9_]+)/);
  if (statusMatch) {
    const expected = values[statusMatch[1]];
    if (item.status !== expected) return false;
  }

  const notMeMatch = expr.match(/\buserId\s*<>\s*(:[a-zA-Z0-9_]+)/);
  if (notMeMatch) {
    const notId = values[notMeMatch[1]];
    if (item.userId === notId) return false;
  }

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
      if (pgSql) {
        try {
          const rows = await pgSql`SELECT item FROM codeduel_store WHERE pk = ${pk} AND sk = ${sk}`;
          if (rows.length > 0) return { Item: rows[0].item };
          return { Item: undefined };
        } catch (e) {}
      }
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

      if (pgSql) {
        try {
          await pgSql`
            INSERT INTO codeduel_store (pk, sk, gsi1pk, gsi1sk, item)
            VALUES (${item.PK}, ${item.SK}, ${item.GSI1PK ?? null}, ${item.GSI1SK ?? null}, ${item})
            ON CONFLICT (pk, sk) DO UPDATE SET item = EXCLUDED.item, gsi1pk = EXCLUDED.gsi1pk, gsi1sk = EXCLUDED.gsi1sk, updated_at = NOW()
          `;
        } catch (e) {}
      }
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
      if (pgSql) {
        try {
          await pgSql`DELETE FROM codeduel_store WHERE pk = ${pk} AND sk = ${sk}`;
        } catch (e) {}
      }
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
      if (!item && pgSql) {
        try {
          const rows = await pgSql`SELECT item FROM codeduel_store WHERE pk = ${pk} AND sk = ${sk}`;
          if (rows.length > 0) item = rows[0].item;
        } catch (e) {}
      }
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

      if (pgSql) {
        try {
          await pgSql`
            INSERT INTO codeduel_store (pk, sk, gsi1pk, gsi1sk, item)
            VALUES (${pk}, ${sk}, ${item.GSI1PK ?? null}, ${item.GSI1SK ?? null}, ${item})
            ON CONFLICT (pk, sk) DO UPDATE SET item = EXCLUDED.item, gsi1pk = EXCLUDED.gsi1pk, gsi1sk = EXCLUDED.gsi1sk, updated_at = NOW()
          `;
        } catch (e) {}
      }
      return { Attributes: item };
    }
  }

  // 5. QueryCommand (GSI1 Leaderboard query)
  if (command.constructor?.name === "QueryCommand") {
    const targetPk = input.ExpressionAttributeValues?.[":pk"] ?? "LEADERBOARD#GLOBAL";
    const limit = input.Limit ?? 50;

    if (pgSql) {
      try {
        const rows = await pgSql`
          SELECT item FROM codeduel_store
          WHERE gsi1pk = ${targetPk}
          ORDER BY gsi1sk DESC
          LIMIT ${limit}
        `;
        if (rows.length > 0) {
          return { Items: rows.map((r: any) => r.item), Count: rows.length };
        }
      } catch (e) {}
    }

    const items: any[] = [];
    for (const item of memoryStore.values()) {
      if (item.GSI1PK === targetPk) {
        items.push(JSON.parse(JSON.stringify(item)));
      }
    }
    items.sort((a, b) => Number(b.GSI1SK ?? 0) - Number(a.GSI1SK ?? 0));
    return { Items: items.slice(0, limit), Count: items.length };
  }

  // 6. ScanCommand
  if (command.constructor?.name === "ScanCommand") {
    let allItems: any[] = [];
    if (pgSql) {
      try {
        const rows = await pgSql`SELECT item FROM codeduel_store`;
        allItems = rows.map((r: any) => r.item);
      } catch (e) {}
    }
    if (allItems.length === 0) {
      allItems = Array.from(memoryStore.values());
    }

    const matched: any[] = [];
    for (const item of allItems) {
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
        if (pgSql) {
          try {
            await pgSql`
              INSERT INTO codeduel_store (pk, sk, gsi1pk, gsi1sk, item)
              VALUES (${item.PK}, ${item.SK}, ${item.GSI1PK ?? null}, ${item.GSI1SK ?? null}, ${item})
              ON CONFLICT (pk, sk) DO UPDATE SET item = EXCLUDED.item, gsi1pk = EXCLUDED.gsi1pk, gsi1sk = EXCLUDED.gsi1sk, updated_at = NOW()
            `;
          } catch (e) {}
        }
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
          if (pgSql) {
            try {
              await pgSql`
                INSERT INTO codeduel_store (pk, sk, gsi1pk, gsi1sk, item)
                VALUES (${pk}, ${sk}, ${item.GSI1PK ?? null}, ${item.GSI1SK ?? null}, ${item})
                ON CONFLICT (pk, sk) DO UPDATE SET item = EXCLUDED.item, gsi1pk = EXCLUDED.gsi1pk, gsi1sk = EXCLUDED.gsi1sk, updated_at = NOW()
              `;
            } catch (e) {}
          }
        }
      } else if (step.Delete) {
        const pk = step.Delete.Key?.PK;
        const sk = step.Delete.Key?.SK;
        if (pk && sk) {
          memoryStore.delete(`${pk}###${sk}`);
          if (pgSql) {
            try {
              await pgSql`DELETE FROM codeduel_store WHERE pk = ${pk} AND sk = ${sk}`;
            } catch (e) {}
          }
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
