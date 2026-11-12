# 🗺️ CodeDuel — Complete Master Map

> **Purpose:** This document is a single-source-of-truth specification of the entire CodeDuel prototype codebase. Every page, API route, database schema, library module, challenge, algorithm, and design decision is documented here with exact details from the source code. Any AI or engineer reading this document should fully understand the product, its architecture, and every byte of its behaviour.

---

## 1. Executive Summary / Product Mission

**CodeDuel** is a real-time, 1-versus-1 competitive **debugging** platform. Unlike LeetCode/HackerRank which ask you to write algorithms from an empty file, CodeDuel drops you into multi-file production codebases with intentional bugs and an incident ticket — and you race against an opponent (human or AI bot) to fix it first.

| Tagline | "Don't write it. Fix it." |
|---|---|
| Season | Season 1 — Private Alpha |
| Core loop | Queue → Get buggy codebase + incident ticket → Edit in Monaco IDE → Run tests → Win match → ELO changes |
| Target users | College CS/ECE students, individual developers targeting product/embedded roles, university departments |
| Current status | Prototype, fully functional on Vercel + Neon PostgreSQL |

**The problem CodeDuel solves:** 80%+ of real engineering is debugging existing code (not writing from scratch). Current platforms train the wrong skill. CodeDuel trains the actual skill: navigating unfamiliar multi-file repos, diagnosing root causes, writing surgical patches.

---

## 2. Technology Stack (Exact Versions)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router + Turbopack) | 16.2.9 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Auth | NextAuth.js | ^4.24.14 |
| Database (Primary) | Neon Serverless PostgreSQL | via `postgres` ^3.4.9 |
| Database (Optional) | AWS DynamoDB | @aws-sdk ^3.1070.0 |
| ORM/Adapter | Universal Adapter (custom `lib/dynamo.ts`) | — |
| Code Execution | Piston API (remote sandboxed) | v2 (emkc.org) |
| AI Coach | Google Gemini Flash API | gemini-3.5-flash-lite, gemini-flash-lite-latest, gemini-3.8-flash (cascade) |
| Monaco Editor | @monaco-editor/react | ^4.7.0 |
| Charts | Recharts | ^3.8.1 |
| UUID | uuid | ^14.0.0 |
| CSS Fonts | Geist, Geist Mono (Google), JetBrains Mono (Google) | — |
| Dev tooling | ESLint, tsx (ts-node), dotenv | — |

---

## 3. Repository & Deployment

| Item | Value |
|---|---|
| Git Remote | `git@github.com:Rishabh9877/codeduel.git` |
| Default Branch | `main` |
| Vercel URL | Deployed (user must set `DATABASE_URL` in Vercel dashboard) |
| Local Dev | `npm run dev` → `http://localhost:3000` |
| DB (Live) | Neon PostgreSQL: `ep-young-hill-b76v0xjw-pooler.c-13.us-east-1.aws.neon.tech/neondb` |

---

## 4. Site Map — Every Page

### 4.1 Public / Landing

#### `GET /` — Landing Page (`app/page.tsx`)
- **Auth required:** No (redirects to `/dashboard` if already authenticated)
- **Purpose:** Marketing + product demo page
- **Sections:**
  - Sticky navbar with: Brand, The Problem, How It Works, Two Tracks, For Colleges, Pricing, Leaderboard links
  - **Hero:** "Don't write it. Fix it." + persona selector pills (College Student / Faculty / Individual Dev) → triggers GitHub OAuth with `preferred_role` stored in `localStorage`
  - **Arena Demo Card:** Interactive code preview switcher — shows Embedded C (`ring_buffer.c`) OR Cloud SWE (`rateLimiter.ts`) with syntax highlighting, test badges (PASS/FAIL/PENDING), opponent progress bar (CodeSentinel AI BOT 2/3 passed)
  - **The Problem section:** 3 cards — "Traditional Trap", "Engineering Reality", "Codeduel Standard"
  - **How It Works:** 5 steps — Match or Practice → Get Buggy Code → Triage & Fix → Run Tests → Win + ELO
  - **Two Tracks:** EMBEDDED_SYSTEMS (C, amber) and PRODUCTION_SWE (TS/Python, cyan) cards with tag lists
  - **For Colleges / Campus:** Campus edition callout linking to `/campus`
  - **Pricing Teaser:** 3-tier summary (FREE / PRO / CAMPUS) with CTAs
  - **Live Feed Table:** Mock activity table showing recent duels
  - **Footer:** 4-column grid — Brand description, Product links, Developers links, Company links; copyright
- **Fonts:** JetBrains Mono (code), Geist (prose)
- **Custom CSS:** All inlined `<style>` tags — no external CSS imports
- **Role Modal:** `RoleSwitcherModal` component shown on Sign In click

---

#### `GET /pricing` — Pricing Page (`app/pricing/page.tsx`)
- **Auth required:** No
- **Purpose:** Show all 3 plans, FAQs
- **Displays:** `PRICING_PLANS` from `lib/pricing.ts` — FREE / PRO / CAMPUS
- **Uses:** `AppNavbar` with `activePage="pricing"`
- **FAQ section:** 4 items from `PRICING_FAQS`

---

#### `GET /leaderboard` — Global Leaderboard (`app/leaderboard/page.tsx`)
- **Auth required:** No (optional session for "you" highlight)
- **Purpose:** Top 50 engineers sorted by ELO descending
- **Calls:** `GET /api/leaderboard`
- **Shows:** Rank #, Avatar, Username, ELO, Tier badge, Track specialty, W/L
- **Uses:** `AppNavbar` with `activePage="leaderboard"`
- **ELO badge colors:** Bronze / Silver / Gold / Platinum / Diamond / Master

---

#### `GET /campus` — Campus Portal (`app/campus/page.tsx`)
- **Auth required:** No for view, yes for create/join
- **Purpose:** Faculty portal + student cohort hub
- **Features:**
  - Browse available cohorts (seeded demo cohorts shown if no user cohorts)
  - Create new cohort (Faculty/Admin only) — 6-character uppercase code, title, department, institution, description
  - Join cohort by 6-character code
  - Leave cohort
  - View cohort details: assignments, student roster (sorted by ELO), stats panel (avgTime, passRate, totalSubmissions)
  - Faculty: create assignments (pick challenge, due date, points)
  - Faculty: view gradebook with per-student completion and submission times
  - Faculty: plagiarism telemetry callout (PRO/CAMPUS feature)
- **Calls:** `/api/campus/cohorts`, `/api/campus/create`, `/api/campus/join`, `/api/campus/leave`, `/api/campus/cohort/[code]`, `/api/campus/assignment/create`

---

#### `GET /practice` — Solo Practice Listing (`app/practice/page.tsx`)
- **Auth required:** No (guests can practice)
- **Purpose:** Browse all challenges and launch solo practice sessions
- **Features:**
  - Filter by track (ALL / PRODUCTION_SWE / EMBEDDED_SYSTEMS)
  - Filter by difficulty (ALL / easy / medium / hard)
  - Filter by language (ALL / TypeScript / C / Python)
  - Daily Practice Challenge card (auto-selected challenge for the day)
  - Problem cards with: title, difficulty badge, language tag, estimated minutes, skills list, start button
- **Calls:** `GET /api/practice/daily`, `GET /api/challenges`

---

#### `GET /practice/[id]` — Solo Practice Arena (`app/practice/[id]/page.tsx`)
- **Auth required:** No
- **Purpose:** Full solo debugging session
- **Features:**
  - Monaco Editor (multi-file tabs — editable files have ✏️, read-only have 🔒)
  - Incident ticket display (`ticketMarkdown` rendered as markdown)
  - Repo context badge
  - Hardware Panel for Embedded challenges (SimulatedHardwarePanel component)
  - Run Tests button → calls `/api/practice/submit`
  - Hint button (3 tiers) → calls `/api/hint`
  - Walkthrough reveal after solving
  - Timer (countdown from 15 minutes)
  - Test results panel with PASS/FAIL per test
- **Calls:** `GET /api/challenges/[id]`, `POST /api/practice/submit`, `POST /api/hint`

---

#### `GET /match/[id]` — 1v1 Duel Arena (`app/match/[id]/page.tsx`)
- **Auth required:** Yes
- **Purpose:** Live competitive 1v1 match
- **Features:**
  - Monaco Editor (same multi-file tabbed UI)
  - Opponent status panel: username, ELO, testsPassed, submitted, timer
  - CodeSentinel AI BOT animation (when matched with bot — progress bar fills at ELO-calibrated speed)
  - 15-minute countdown timer (server-authoritative deadline enforcement)
  - Submit button → calls `POST /api/match/submit`
  - Forfeit button → calls `POST /api/match/forfeit`
  - Hint coach (up to 3 tiers, subscription-gated beyond tier 1)
  - Match over modal: WIN/LOSS, ELO delta, walkthrough reveal, canonical git diff
  - Polls `GET /api/match/[id]` every 2–3 seconds for opponent updates
- **Calls:** `GET /api/match/[id]`, `POST /api/match/submit`, `POST /api/match/forfeit`, `POST /api/hint`

---

### 4.2 Authenticated Pages

#### `GET /dashboard` — Main Dashboard (`app/dashboard/page.tsx`)
- **Auth required:** Yes (shows sign-in card for unauthenticated)
- **Purpose:** User home — ELO chart, activity, stats, recent matches, problem catalog
- **Features:**
  - **ELO Sparkline chart:** Recharts `LineChart` with real match history from `/api/user/dashboard`; falls back to flat line if no history; unique `fullDate` key prevents Recharts point merging
  - **Activity Calendar (GitHub-style):** 365-day heatmap; cell colors 4 levels of indigo opacity; hover tooltip with submission count + "Joined Codeduel! 🎉" on join day
  - **Stats Row:** Total Duels, Win Rate %, Wins, Losses
  - **Recent Matches Table:** Opponent, Problem, Result (WIN/LOSS), ELO delta, Time ago
  - **Problem Catalog:** 10 problems filterable by track (ALL/PRODUCTION_SWE/EMBEDDED_SYSTEMS), each card shows diff color, name, quick-duel button
  - **Find Match button:** Opens track selection modal → calls `POST /api/match/queue`; shows "Searching…" state with queue duration; auto-redirects to `/match/[id]` on match
  - **Queue banner:** Animated pulsing border when in queue; shows wait duration; Cancel button
  - **Role Switcher:** `RoleBadgeSwitcher` → `useUserRole` hook
- **Data sources:** `GET /api/user/me`, `GET /api/user/dashboard`, `GET /api/friends`
- **Local storage caching:** `dash_profile`, `dash_eloHistory`, `dash_activityData`, `dash_recentMatches`, `dash_joinedDate` (cache-then-revalidate pattern)
- **ELO bracket logic:** `elo < 1100` → bracket-1, `1100-1399` → bracket-2, `≥1400` → bracket-3

---

#### `GET /profile` — User Profile (`app/profile/page.tsx`)
- **Auth required:** Yes
- **Purpose:** User's own profile with settings
- **Features:** ELO, tier, stats, settings (username, preferred track, subscription status)
- **Calls:** `GET /api/user/me`, `POST /api/user/settings`

---

#### `GET /friends` — Friends System (`app/friends/page.tsx`)
- **Auth required:** Yes
- **Purpose:** Add/view/challenge friends
- **Features:** Search by username, friend requests (pending/accepted), challenge friend to duel
- **Calls:** `GET /api/friends`, `POST /api/friends`, `GET /api/users/search`

---

#### `GET /admin/metrics` — Admin Metrics (`app/admin/metrics/page.tsx`)
- **Auth required:** Yes + `isAdmin === true`
- **Purpose:** Platform-wide analytics for founder/admin
- **Features:** Total users, total matches, active matches, ELO distribution, recent matches list
- **Calls:** `GET /api/admin/metrics`

---

#### `GET /admin` — Admin Panel (`app/admin/page.tsx`)
- **Auth required:** Yes + `isAdmin === true`
- **Purpose:** Admin management UI

---

### 4.3 Public Info Pages

| Route | File | Purpose |
|---|---|---|
| `/about` | `app/about/page.tsx` | Company/product description |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/terms` | `app/terms/page.tsx` | Terms of service |
| `/contact` | `app/contact/page.tsx` | Contact form |
| `/verify` | `app/verify/page.tsx` | Portfolio credential verification landing |
| `/verify/[slug]` | `app/verify/[slug]/page.tsx` | Verify specific credential by slug |
| `/u/[username]` | `app/u/[username]/page.tsx` | Public recruiter-visible profile: ELO, rank, solved challenges, competency radar |

---

## 5. API Route Map — Every Endpoint

### Auth

| Method | Route | Auth | Purpose |
|---|---|---|---|
| ANY | `/api/auth/[...nextauth]` | — | NextAuth.js handler (GitHub OAuth + Credentials provider) |

---

### Leaderboard

| Method | Route | Auth | Returns |
|---|---|---|---|
| GET | `/api/leaderboard` | Optional | Top 50 by ELO; filters guests in production; merges current user if not in top 50 |

**DB:** Queries `codeduel_store` via `GSI1PK = 'LEADERBOARD#GLOBAL'` sorted by `gsi1sk DESC LIMIT 50`

---

### Match System

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/match/queue` | Yes | Enter/poll matchmaking queue |
| GET | `/api/match/queue` | Yes | Poll for active match; auto-triggers bot if wait ≥ 10s |
| POST | `/api/match/create` | Yes | Create match directly (admin/special) |
| GET | `/api/match/[id]` | Yes | Poll match state (opponent progress, status, testsPassed) |
| POST | `/api/match/submit` | Yes | Submit code → execute → update ELO if won |
| POST | `/api/match/forfeit` | Yes | Forfeit match → opponent wins + ELO update |
| POST | `/api/match/timeout` | Yes | Server timeout trigger (15 min deadline) |
| GET | `/api/match/challenge` | Yes | Get challenge for a match |
| GET | `/api/match/find` | Yes | Find if user has active match |

**Queue Logic (POST `/api/match/queue`):**
1. Auth check
2. Daily duel quota check (Free tier: 5/day — NOTE: code says limit 5 but `pricing.ts` says unlimited; quota check is from `lib/subscription.ts`)
3. Get user ELO from DynamoDB profile
4. Scan for existing active match (non-expired within 15 min)
5. Check existing queue entry
6. If `forceDemo=true` OR wait ≥ 30s → create bot match instantly
7. Scan queue for human opponents: ELO tolerance = 200 (expand to 400 after 30s, 800 after 60s); filter by track
8. If opponent found → atomically claim (DeleteCommand with `attribute_exists` condition), create match
9. If race condition (opponent claimed by another) → re-queue self
10. If no opponent → `PutCommand` self to queue with 5-min TTL

**Bot fallback:** `bot_sentinel_ai` user, ELO = humanElo ± 15, `isBotMatch: true`. Bot speed controlled by `getBotSimulationParams(humanElo)` from `lib/elo.ts`.

**Submit Logic (POST `/api/match/submit`):**
1. Auth + match ownership check
2. Server-authoritative 15-min deadline check (marks `timed_out` if exceeded)
3. Get challenge definition from `lib/challenges.ts`
4. Execute via `executeChallenge(challenge, files)` → Piston API
5. Write submission record `MATCH#id / SUB#userId#timestamp`
6. Update player's testsPassed on match META
7. If `allPassed` → 5-way TransactWrite: mark match finished, update winner profile+leaderboard, update loser profile+leaderboard
8. Handle ConditionalCheckFailed (concurrent submission already resolved) → idempotent response
9. Return walkthrough + canonical diff + ELO delta on win

---

### Practice

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/practice/submit` | Optional | Execute solo practice code via Piston |
| GET | `/api/practice/daily` | No | Get today's daily challenge (deterministic by date) |
| GET | `/api/practice/walkthrough` | No | Get challenge walkthrough |

---

### AI Hint Coach

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/hint` | Optional | Generate Socratic hint (Tier 1/2/3) |

**Hint Logic:**
1. Extract IP, matchId, challengeId, currentCode, language, activeFileName, practice flag
2. Session → userId (falls back to `guest_practice` for anonymous)
3. IP-based DB-backed rate limit: 15 hints/60s (5x in DEMO_MODE) via `checkRateLimitDb`
4. Per-user in-memory rate limit: 5 requests/60s
5. For match hints: fetch match, verify player, check `hintsUsed < MAX_HINTS (3)`, atomic increment with `if_not_exists + conditional`
6. For practice hints: `practiceTier` parameter directly sets tier
7. FREE tier gate: hints >Tier 1 require PRO subscription in match mode
8. Build Gemini prompt: system prompt + challenge title/ticket/code/tier instruction
9. Try 3 Gemini model cascade: `gemini-3.5-flash-lite` → `gemini-flash-lite-latest` → `gemini-3.8-flash`
10. `sanitizeHint()`: strips multi-line code blocks, long inline code (>50 chars), compound statements
11. If Gemini fails → refund hint reservation, serve curated walkthrough-derived fallback
12. Return `{ hint, hintsUsed, hintsRemaining, tier }`

**Hint Tiers:**
- Tier 1: Conceptual nudge (1–2 sentences, no code)
- Tier 2: High-level fixing approach in plain language (2–3 sentences, no code)
- Tier 3: Concrete implementation insight/formula/pointer guidance (no full solution)

---

### Challenges

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/challenges` | No | List all challenges (id, title, difficulty, track, language) |
| GET | `/api/challenges/[id]` | No | Get full challenge definition |

---

### Campus

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/campus/cohorts` | Yes | Get cohorts for current user |
| GET | `/api/campus/cohort/[code]` | Yes | Get full cohort detail (students, assignments, stats) |
| POST | `/api/campus/create` | Yes + Faculty/Admin | Create new cohort |
| POST | `/api/campus/join` | Yes | Join cohort by code |
| POST | `/api/campus/leave` | Yes | Leave cohort |
| POST | `/api/campus/assignment/create` | Yes + Faculty | Create assignment in cohort |
| POST | `/api/campus/assignment/submit` | Yes | Submit assignment solution |
| POST | `/api/campus/verify-faculty` | Yes | Verify faculty status (rate-limited, never elevated in DEMO_MODE) |

---

### Friends

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/friends` | Yes | Get friend list + pending requests |
| POST | `/api/friends` | Yes | Send/accept friend request |

---

### Users

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/user/me` | Yes | Current user profile (ELO, role, wins, losses) |
| GET | `/api/user/dashboard` | Yes | Dashboard data: eloHistory, activityMap, recentMatches, joinedAt |
| GET | `/api/user/profile` | Yes | Full profile |
| POST | `/api/user/settings` | Yes | Update settings |
| GET | `/api/user/subscription` | Yes | Current subscription tier |
| GET | `/api/users/search` | Yes | Search users by username |
| GET | `/api/u/[username]` | No | Public profile by username |

---

### Admin

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/metrics` | Yes + Admin | Platform metrics |

---

### Misc

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/runtimes` | No | List available Piston runtimes |
| POST | `/api/waitlist` | No | Join waitlist (email capture) |

---

## 6. Database Architecture

### 6.1 Universal Adapter (`lib/dynamo.ts`)

**Three-tier fallback:**
1. If `USE_AWS_DYNAMODB=true` AND real AWS keys present (not on Vercel/Lambda) → routes to AWS DynamoDB
2. If `DATABASE_URL` starts with `postgres` → routes to Neon PostgreSQL (`pgSql`)
3. Otherwise → in-memory `Map<string, any>` + disk JSON file (`.next/codeduel_db.json` local, `/tmp/codeduel_db.json` serverless)

**Key safety rules:**
- Production throws `FATAL` if neither DB is configured (prevents silent data loss)
- Vercel env always skips AWS (`process.env.VERCEL` check) unless `USE_AWS_DYNAMODB=true`
- Neon pooler detection: if `DATABASE_URL` contains `-pooler` → `prepare: false` (prevents PgBouncer prepared statement errors)

---

### 6.2 PostgreSQL Schema (`codeduel_store`)

Auto-bootstrapped by `ensureDbReady()` on first request:

```sql
CREATE TABLE IF NOT EXISTS codeduel_store (
  pk          TEXT         NOT NULL,
  sk          TEXT         NOT NULL,
  gsi1pk      TEXT,
  gsi1sk      NUMERIC,
  item        JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ  DEFAULT NOW(),
  PRIMARY KEY (pk, sk)
);

CREATE INDEX IF NOT EXISTS idx_codeduel_store_gsi1
  ON codeduel_store (gsi1pk, gsi1sk DESC);

CREATE TABLE IF NOT EXISTS users (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id        BIGINT       NOT NULL UNIQUE,
  github_username  VARCHAR(39)  NOT NULL UNIQUE,
  email            VARCHAR(255) UNIQUE,
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friendships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_2    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ON friendships (LEAST(user_id_1,user_id_2), GREATEST(user_id_1,user_id_2));
```

---

### 6.3 PK / SK Design (DynamoDB single-table / PostgreSQL mimic)

| Entity | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| User profile | `USER#{userId}` | `PROFILE` | — | — |
| User leaderboard entry | `USER#{userId}` | `LEADERBOARD` | `LEADERBOARD#GLOBAL` | ELO (numeric) |
| Match metadata | `MATCH#{matchId}` | `META` | — | — |
| Match submission | `MATCH#{matchId}` | `SUB#{userId}#{timestamp}` | — | — |
| Queue entry | `QUEUE#{userId}` | `WAITING` | — | — |
| Rate limit bucket | `RATELIMIT#{action}#{id}` | `BUCKET#{windowBucket}` | — | — |
| Cohort metadata | `COHORT#{code}` | `METADATA` | — | — |
| Cohort student | `COHORT#{code}` | `STUDENT#{userId}` | — | — |
| Cohort assignment | `COHORT#{code}` | `ASSIGNMENT#{assignmentId}` | — | — |
| Cohort submission | `COHORT#{code}` | `SUBMISSION#{...}` | — | — |
| User enrollment | `USER#{userId}` | `ENROLLED#{code}` | — | — |

---

### 6.4 Auto-Seeded Leaderboard Baseline

If `codeduel_store` is empty, 5 baseline engineers are auto-seeded:

| Username | ELO | Track |
|---|---|---|
| Linus_KernelDev | 2420 | EMBEDDED_SYSTEMS |
| CloudNative_Ace | 2315 | PRODUCTION_SWE |
| Silicon_Carmack | 2280 | EMBEDDED_SYSTEMS |
| Tokio_AsyncMaster | 2190 | PRODUCTION_SWE |
| Firmware_Ghost | 2105 | EMBEDDED_SYSTEMS |

---

### 6.5 User Profile Object Structure

```jsonc
{
  "PK": "USER#github_12345678",
  "SK": "PROFILE",
  "userId": "github_12345678",
  "username": "rishabh9877",
  "email": "user@example.com",
  "avatar": "https://avatars.githubusercontent.com/...",
  "elo": 1024,
  "role": "INDIVIDUAL", // INDIVIDUAL | STUDENT | FACULTY | ADMIN
  "isAdmin": false,
  "isGuest": false,
  "wins": 5,
  "losses": 3,
  "createdAt": 1700000000000
}
```

---

### 6.6 Match META Object Structure

```jsonc
{
  "PK": "MATCH#uuid",
  "SK": "META",
  "matchId": "uuid",
  "status": "active", // active | finished | timed_out | forfeited
  "challengeId": "swe-token-bucket",
  "track": "PRODUCTION_SWE",
  "player1": {
    "userId": "...",
    "username": "...",
    "avatar": "...",
    "elo": 1024,
    "submitted": false,
    "passed": false,
    "testsPassed": 0,
    "hintsUsed": 0,
    "lastPingAt": 1700000000000
  },
  "player2": { /* same structure */ },
  "startedAt": 1700000000000,
  "finishedAt": null,
  "winnerId": null,
  "endedBy": null, // "submission" | "forfeit" | "server_deadline"
  "isBotMatch": true,
  "newWinnerElo": null,
  "newLoserElo": null,
  "ttl": 1700007200 // 2h epoch seconds
}
```

---

## 7. ELO & Matchmaking System (`lib/elo.ts`)

### ELO Formula

$$E_A = \frac{1}{1 + 10^{(R_B - R_A)/400}}$$

$$\Delta_{ELO} = K \cdot (S - E_A)$$

Where:
- K-factor: **32** (DEFAULT_K_FACTOR)
- S: 1 for win, 0 for loss
- Floor: **800** (DEFAULT_RATING_FLOOR)
- Starting ELO: **1000** (STARTING_ELO)

### Rank Tiers

| Tier Name | Badge | ELO Range | Color |
|---|---|---|---|
| Junior Apprentice | BRONZE | 0 – 999 | `#cd7f32` |
| SWE I | SILVER | 1000 – 1199 | `#94a3b8` |
| SWE II | GOLD | 1200 – 1399 | `#facc15` |
| Senior Engineer | PLATINUM | 1400 – 1599 | `#38bdf8` |
| Staff Engineer | DIAMOND | 1600 – 1799 | `#a855f7` |
| Principal / Fellow | MASTER | 1800+ | `#f43f5e` |

### Bot Difficulty Scaling (`getBotSimulationParams`)

| Human ELO | Bot Solve Time | Test Interval | Auto-Win |
|---|---|---|---|
| < 1050 (Beginner) | 260s (~4.3 min) | 75s | ❌ |
| 1050–1249 (SWE I) | 180s (3 min) | 50s | ✅ |
| 1250–1449 (SWE II) | 110s (~1.8 min) | 32s | ✅ |
| 1450+ (Senior+) | 58s | 17s | ✅ |

### ELO Tolerance in Matchmaking

| Wait Time | ELO Tolerance |
|---|---|
| 0–29s | ±200 |
| 30–59s | ±400 |
| 60s+ | ±800 |

**Bot fallback trigger:** 30s wait (or `?demo=true` / `forceDemo: true` in body)

### Concurrency Safety
`TransactWriteCommand` with `ConditionExpression: "elo = :oldElo"` (optimistic locking). If concurrent modification detected → returns `CONCURRENCY_CONFLICT` error.

---

## 8. Challenge Catalog — All 13 Challenges

### 8.1 PRODUCTION_SWE Track (TypeScript/Python)

| ID | Title | Difficulty | Language | Estimated | Skills | Tests |
|---|---|---|---|---|---|---|
| `swe-url-query-sanitizer` | SEC #104: Prevent Query Param Splitting in Edge Redirect Gateway | easy | TypeScript | 8 min | URL Encoding, Web Security, Input Sanitization, API Gateway | 3 |
| `swe-token-bucket` | PR #108: Fix Sub-Second Token Starvation in RateLimiter | medium | TypeScript | 15 min | Rate Limiting, Token Bucket, Time Truncation, Concurrency | 3 |
| `swe-retry-backoff` | PR #242: Fix Exponential Backoff Jitter Clamping in RPC Gateway | easy | TypeScript | 10 min | Exponential Backoff, Jitter, Network Resilience, Microservices | 3 |
| `swe-jwt-alg-confusion` | CVE-2024-8812: Fix Signature Bypass on "none" Algorithm in Auth Middleware | hard | TypeScript | 20 min | JWT Security, Cryptographic Verification, Algorithm Confusion, Auth | 3 |
| `swe-connection-pool-leak` | DB Connection Pool Starvation | medium | TypeScript | — | Connection Pools, Resource Leaks, DB | — |
| `swe-cache-stampede` | SingleFlight Cache Stampede | hard | TypeScript | — | Caching, Race Conditions, Mutex | — |
| `swe-async-worker-leak` | Async Stream Connection Leak | medium | Python | — | Async, Worker Queues, Stream Management | — |

### 8.2 EMBEDDED_SYSTEMS Track (C)

| ID | Title | Difficulty | Language | Estimated | Skills | Tests | Hardware |
|---|---|---|---|---|---|---|---|
| `embedded-ring-buffer` | Issue #44: UART ISR Dropping Bytes on Ring Buffer Wrap-Around | medium | C | 15 min | Circular Buffer, Pointer Arithmetic, UART Telemetry, Embedded Drivers | 3 | STM32F401RE ARM Cortex-M4 @ 84MHz, USART2 @ 115200 Baud |
| `embedded-gpio-debounce` | Issue #92: Mechanical Contact Bounce Glitch on Pin ISR | medium | C | 15 min | GPIO, Debouncing, Interrupts, Bitmasking | 3 | Nordic nRF52840 Cortex-M4F @ 64MHz, GPIOTE |
| `embedded-spi-endianness` | 16-Bit IMU Sensor Endianness | medium | C | — | SPI, Endianness, Sensor Drivers | — | Aerospace RTOS IMU |
| `embedded-pwm-prescaler` | PWM Motor Prescaler Drift | medium | C | — | PWM, Timer Prescaler, BLDC | — | BLDC firmware HAL |
| `embedded-interrupt-race` | (Interrupt Race Condition) | — | C | — | IRQ, Race Conditions | — | — |
| `embedded-packed-alignment` | (Struct Packing/Alignment) | — | C | — | Struct alignment, padding | — | — |

### 8.3 Challenge File Structure

Each challenge contains:
- **`files[]`**: Array of `{ name, content, readOnly }`. Read-only files = locked headers/tests (🔒). Editable file = the buggy implementation (✏️)
- **`entrypoint`**: File executed by Piston (e.g. `runner.ts`, `test_runner.c`)
- **`ticketMarkdown`**: The incident/bug report shown to player
- **`walkthrough`**: `{ rootCause, buggyVsFixedDiff, whyItMatters, commonMistakes[] }`
- **`hardwareContext`**: For embedded: `{ mcu, clockSpeed, busProtocol, observedFailure, registers[], memoryMap[], waveformSvg }`

### 8.4 Known Bug Patterns

| Challenge | Bug | Fix |
|---|---|---|
| swe-token-bucket | `Math.floor(elapsed/1000)` truncates sub-second intervals to 0 | Use float division `elapsed/1000`, remove floor |
| swe-url-query-sanitizer | No `encodeURIComponent` on params | Wrap each key+value with `encodeURIComponent` |
| swe-retry-backoff | `exponentialCap - Math.random()*1000` can be negative | Full jitter: `Math.floor(Math.random() * rawDelay)` |
| swe-jwt-alg-confusion | Trusts user-supplied `alg` header; allows `"none"` | Whitelist `RS256` only; reject all others |
| embedded-ring-buffer | `rb_is_full` returns `head==tail` (same as empty); head not modulo-wrapped | `(head+1)%capacity == tail`; `head = (head+1)%capacity` |
| embedded-gpio-debounce | No debounce threshold check; immediate state transition | Only commit if same raw_sample held for `DEBOUNCE_THRESHOLD_MS (20ms)` |

---

## 9. Code Execution Engine (`lib/piston.ts`, `lib/challengeExecutor.ts`)

### Piston API
- **Default URL:** `https://emkc.org/api/v2/piston` (configurable via `PISTON_URL`)
- **Timeout:** 15,000ms per request (AbortController)
- **Max code size:** 100,000 bytes
- **Auth header:** `X-Piston-Key` if `PISTON_KEY` env set
- **Runtimes cache:** 5-minute in-memory cache

### Execution Flow
1. Validate language (supported list from `lib/languages.ts`)
2. Check code size ≤ 100KB
3. For multi-file challenges: build complete file set (read-only files from challenge definition + user-submitted editable file)
4. POST to `${PISTON_URL}/execute` with `{ language, version, files[], stdin, compile_timeout:10000, run_timeout:3000 }`
5. Parse `data.run.stdout` and `data.run.stderr`
6. For challenge test harnesses: scan stdout for `SUMMARY: X/Y PASSED` line
7. Return `{ allPassed, passed, total, firstFailure, runtimeMs, testResults[], stdout, stderr }`

### Language Config (`lib/languages.ts`)
- TypeScript → piston language `typescript`, version pinned
- C → piston language `c`, clang/gcc fallback
- Python → piston language `python`, version pinned
- Supported: `typescript`, `c`, `python`, `javascript`, `cpp`, `java`

### Language Wrappers (`lib/wrappers.ts`)
- Python challenges get `generatePythonWrapper(code, problemId)` to inject test harness
- JavaScript: `generateJavascriptWrapper`
- C++: `generateCppWrapper`
- Java: `generateJavaWrapper`
- TypeScript and C: submitted as-is (test runner is part of challenge files)

> **SECURITY:** User code is **never** executed locally. All execution happens in remote Piston sandboxed containers.

---

## 10. AI Hint Coach Details (`app/api/hint/route.ts`)

### System Prompt
```
You are a Senior Engineering Lead acting as a Socratic coding coach in a competitive production bug-fixing duel.
Help the developer diagnose and resolve the bug without giving away the full answer.
CRITICAL RULE: NEVER provide full code solutions or complete code blocks.
Be concise, technical, warm, and encouraging.
Respond with plain text only — no markdown headers, no bullet points, and at most short inline code keywords if strictly necessary.
```

### `sanitizeHint()` Function
Strips from Gemini output:
1. All multi-line fenced code blocks (` ``` ``` `) → replaced with generic Socratic redirect message
2. Triple-backtick blocks containing newlines → replaced
3. Inline code > 50 chars or with compound statements (`;`, `{}`, control flow) → stripped
4. If result < 15 chars → use fallback

### Gemini Model Cascade
Tries in order (first success wins):
1. `gemini-3.5-flash-lite`
2. `gemini-flash-lite-latest`
3. `gemini-3.8-flash`

### Rate Limiting (Hint)
- **IP-based DB-backed:** 15 hints/60s (default), 5× in `DEMO_MODE` = 75 hints/60s
- **Per-user in-memory:** 5 requests/60s
- **Per-match atomic quota:** Max 3 total hints per match (server-enforced via conditional DynamoDB update)
- **Subscription gate:** FREE = Tier 1 only in match mode; PRO = all 3 tiers

---

## 11. Auth System (`lib/auth.ts`)

### Providers
1. **GitHub OAuth** (`GithubProvider`)
   - `clientId`: `GITHUB_CLIENT_ID`
   - `clientSecret`: `GITHUB_CLIENT_SECRET`
   - `prompt: "consent"` forces re-consent on sign-in
2. **Credentials** (Guest Dev Bypass)
   - Enabled when `ALLOW_GUEST_LOGIN=true` or in development
   - `guestId: "1" | "2" | "faculty"` → creates `guest_1`, `guest_2`, `faculty_vikram_malhotra`
   - Faculty demo disabled in production unless `DEMO_MODE=true`
   - Guest avatars from DiceBear Bottts/Identicon

### Callbacks
**`signIn`:** On first login → creates `USER#id / PROFILE` + `USER#id / LEADERBOARD` in DynamoDB + syncs to PostgreSQL `users` table via `getOrSyncUser()`. Guests excluded from leaderboard in production.

**`session`:** Attaches `user.id = token.sub`, `user.username = token.ghLogin`, `user.role`, `user.isAdmin`

**`jwt`:** Hardcodes admin detection: GitHub login `rishabh9877` OR userId `rishabh9877` → `role: ADMIN, isAdmin: true`. Faculty demo account `faculty_vikram_malhotra` → `role: FACULTY`. Admin can also be set via `ADMIN_GITHUB_ID` or `ADMIN_EMAIL` env vars.

### Role System
| Role | Access |
|---|---|
| `INDIVIDUAL` | Default; full arena access; campus hidden in navbar |
| `STUDENT` | Campus Labs visible; assigned to cohorts |
| `FACULTY` | Cohort management, assignment creation, gradebook |
| `ADMIN` | Everything + `/admin/metrics`, platform settings |

### `useUserRole` Hook (`lib/useUserRole.ts`)
Client-side role management with `localStorage` persistence. Provides `role`, `setRole`, `isIndividual`, `isStudent`, `isFaculty`, `isAdmin`, `canAccessCampus`.

---

## 12. Campus / Faculty System (`lib/campus.ts`, `lib/campus-data.ts`)

### Cohort Lifecycle
1. Faculty creates cohort → 6-character uppercase code (e.g. `CS301`, `ECE-B1`)
2. Cohort metadata written: `COHORT#CODE / METADATA`
3. Faculty auto-enrolled as `STUDENT#instructorId` with role `FACULTY`
4. Students join via code → `COHORT#CODE / STUDENT#userId`; `USER#userId / ENROLLED#CODE`
5. Faculty creates assignments: `COHORT#CODE / ASSIGNMENT#id`
6. Students submit: `COHORT#CODE / SUBMISSION#...`
7. Faculty views gradebook: per-student completion count, avg time, pass rate

### Seeded Demo Cohorts (`lib/campus-data.ts`)
Pre-populated cohorts shown to users with no real cohorts (for onboarding). Includes mock students, assignments, and submission data.

### Statistics Computed on Fetch
- `avgTimeSeconds = totalTime / totalSubmissions`
- `passRate = min(100, (totalSubmissions / (students × assignments)) × 100)`
- Student list sorted by ELO descending

### Assignment Features
- `challengeId` → maps to a challenge from `lib/challenges.ts`
- `dueDate`, `points` (default 100)
- Campus submission tracked at `COHORT#code / SUBMISSION#...`

---

## 13. Pricing & Subscription (`lib/pricing.ts`, `lib/subscription.ts`)

### Plans

| Tier | Name | Price (INR) | Price (USD) | Duels | Hints | Hardware Panel | Verified Badge | Faculty Dashboard |
|---|---|---|---|---|---|---|---|---|
| `FREE` | Student Free | ₹0 | $0 | Unlimited | 1/duel | ❌ | ❌ | ❌ |
| `PRO` | Pro Engineer | ₹100/mo | $19/mo ($15 annual) | Unlimited | 3/duel | ✅ | ✅ | ❌ |
| `CAMPUS` | Campus Department License | ₹40,000/term or ₹1,00,000/year | $499/term | Unlimited | 3/duel | ✅ | ✅ | ✅ |

### PRO Features (Full List)
- Unlimited 1v1 duels
- Full 3-Tier Socratic AI Coach
- Interactive Digital Oscilloscope & Logic Analyzer test bench
- Live ARM Cortex-M MMIO register fault telemetry (CFSR/HFSR/PRIMASK)
- Post-Mortem Root-Cause analysis & canonical git diffs
- Verified Recruiter Portfolio Badge with cryptographic audit link
- Priority Piston multi-file sandbox execution (<500ms)

### CAMPUS Features (Full List)
- Unlimited student seats
- Turnkey Faculty Portal with 6-character cohort join codes
- Automated lab grading (incident pass rates & latency tracking)
- LMS-Ready CSV Gradebook Export
- Plagiarism telemetry & code diff inspection
- Department-wide leaderboard & cohort-specific analytics
- SSO Integration (Roadmap)

### `lib/subscription.ts`
- `getUserSubscriptionTier(userId)` → reads from DynamoDB profile, defaults to `FREE`
- `checkUserDuelQuota(userId)` → checks daily duel count vs plan limit

---

## 14. Rate Limiting (`lib/rateLimit.ts`)

### IP Detection Priority
1. `x-vercel-ip` (Vercel CDN, unforgeable)
2. `x-real-ip` (Nginx proxy)
3. `cf-connecting-ip` (Cloudflare)
4. `x-forwarded-for` (first IP, standard reverse proxy)
5. Fallback: `127.0.0.1`

### `checkRateLimitDb(action, identifier, maxRequests, windowSeconds)`
- Key: `RATELIMIT#{action}#{identifier} / BUCKET#{windowBucket}`
- Atomic `ADD count :one` with TTL = window × 2
- If `count > maxRequests` → `{ allowed: false }`
- On DB error → fail open (`{ allowed: true, remaining: 1 }`) to avoid service outage

### `getActionRateLimit(action, default)`
- Reads `RATE_LIMIT_{ACTION}` env var if set
- `verify_faculty` NEVER scaled by `DEMO_MODE` (brute-force protection)
- Other actions 5× in `DEMO_MODE`

### Applied Rate Limits
| Action | Default Limit | Window |
|---|---|---|
| `hint_solo` | 15 | 60s |
| `hint_match` | 15 | 60s |
| `practice_submit` | configurable | 60s |
| `verify_faculty` | configurable (never 5×) | 60s |
| Per-user hints (in-memory) | 5 | 60s |

---

## 15. Component Inventory

### `AppNavbar` (`components/AppNavbar.tsx`)
**Props:** `activePage`, `onFindMatch`, `matchState ("idle"|"queued"|"matched")`, `onCancelMatch`, `customRightContent`

**Role-based nav links:**
- ADMIN: Dashboard, Solo Practice, Leaderboard, Campus Hub, ⚡ Metrics, Pricing, Friends, Profile
- FACULTY: Faculty Hub, Problem Sandbox, Leaderboard, Pricing, Profile + "🏛️ Manage Cohorts" button
- STUDENT: Dashboard, Campus Labs, Solo Practice, 1v1 Duel, Leaderboard, Pricing, Friends, Profile
- INDIVIDUAL: Dashboard, Solo Practice, 1v1 Arena, Leaderboard, Pricing, Friends, Profile (Campus HIDDEN)

**Right controls:** `RoleBadgeSwitcher` → role pill; Find Match / Cancel button (state-aware); Avatar dropdown (Profile, Pricing, [Admin Metrics], Sign Out)

---

### `RoleBadgeSwitcher` (`components/RoleBadgeSwitcher.tsx`)
**Purpose:** Role pill displayed in navbar showing current role (Individual Dev / Student / Faculty / Admin). Click opens dropdown to switch role (dev/testing tool — in production only real role from auth is used).

---

### `SimulatedHardwarePanel` (`components/SimulatedHardwarePanel.tsx`)
**Purpose:** PRO feature for Embedded Systems challenges. Shows:
- MCU info (chip, clock speed, bus protocol)
- Observed failure description
- Hardware registers table (address, name, hex value, description)
- Memory map table (region, start/end addresses, description)
- Waveform SVG (simulated oscilloscope trace)
Rendered in `/practice/[id]` and `/match/[id]` when `challenge.hardwareContext` present.

---

### `GlobalToaster` (`components/GlobalToaster.tsx`)
Wrapper around toast notification system (react-hot-toast or similar).

### `CursorGlow` (`components/CursorGlow.tsx`)
Radial gradient that follows mouse cursor for visual effect.

### `SubtleInteractiveBackground` (`components/SubtleInteractiveBackground.tsx`)
Animated dot-grid background that reacts to mouse movement.

### `RoleSwitcherModal` (`components/RoleSwitcherModal.tsx`)
Modal shown on landing page Sign In click. Lets user pick role (Student / Faculty / Individual) before GitHub OAuth. Sets `localStorage.preferred_role`.

---

## 16. Library / Module Map (`lib/`)

| File | Purpose | Key Exports |
|---|---|---|
| `auth.ts` | NextAuth config, GitHub OAuth, credentials provider, signIn/session/jwt callbacks | `authOptions` |
| `dynamo.ts` | Universal DB adapter (AWS DynamoDB / Neon Postgres / local JSON) | `dynamo.send()`, `TABLE`, `ensureDbReady()` |
| `elo.ts` | ELO calculation, rank tiers, bot simulation params | `calcElo`, `calculateMatchRatings`, `getEloDelta`, `getExpectedScore`, `getRankTier`, `RANK_TIERS`, `getBotSimulationParams`, `STARTING_ELO`, `DEFAULT_K_FACTOR`, `DEFAULT_RATING_FLOOR` |
| `challenges.ts` | Complete challenge catalog (all 13), type definitions | `SEED_CHALLENGES`, `getChallengeById()`, `getRandomChallenge()`, `Challenge`, `ChallengeFile`, `HardwareContext` |
| `challengeExecutor.ts` | Multi-file challenge execution orchestration | `executeChallenge(challenge, files)` |
| `piston.ts` | Piston API client (execute, runtimes) | `getRuntimes()`, `runAllTestCases()`, `ExecutionResult` |
| `campus.ts` | Campus CRUD (get/create/join/leave cohorts, assignments, submissions) | `getCohortsForUser()`, `getCohortByCode()`, `createCohort()`, `joinCohort()`, `leaveCohort()` |
| `campus-data.ts` | Seeded demo cohorts + type definitions | `SEEDED_COHORTS`, `Cohort`, `CohortAssignment`, `CohortStudent`, `CohortSubmission` |
| `pricing.ts` | Pricing plans, FAQs | `PRICING_PLANS`, `PRICING_FAQS`, `PricingPlan`, `SubscriptionTier` |
| `rateLimit.ts` | IP detection, DB-backed rate limiter, action limit resolver | `getClientIp()`, `checkRateLimitDb()`, `getActionRateLimit()` |
| `subscription.ts` | User subscription tier resolver, duel quota checker | `getUserSubscriptionTier()`, `checkUserDuelQuota()` |
| `matchEngine.ts` | Low-level match finalization (ELO update + atomic transact) | `processMatchEnd(winnerId, loserId)` |
| `languages.ts` | Supported language configs for Piston | `LANGUAGE_CONFIG`, `SUPPORTED_LANGUAGES`, `isSupportedLanguage()` |
| `wrappers.ts` | Code wrappers for Python/JS/C++/Java test harnesses | `generatePythonWrapper()`, `generateJavascriptWrapper()`, etc. |
| `types.ts` | Shared TypeScript types | Various interfaces |
| `postgres.ts` | Direct Neon postgres client for user/match history queries | `sql`, `getDb()` |
| `postgres-sync.ts` | Sync users from DynamoDB/auth to PostgreSQL `users` table | `getOrSyncUser()` |
| `useUserRole.ts` | Client-side React hook for role state | `useUserRole()` → `{role, setRole, isIndividual, isStudent, isFaculty, isAdmin, canAccessCampus}` |

---

## 17. Scripts & Tooling (`scripts/`)

| Script | Command | Purpose |
|---|---|---|
| `test-elo.ts` | `npm run test:elo` | Tests ELO math: 7 assertions — K-factor, floor protection, expected score formula, win/loss deltas, concurrent match scenarios |
| `test-phase1-security.ts` | `npm run test:security` | 23 security tests: auth checks, rate limiting, hint quota, submission validation, admin routes |
| `test-phase2-concurrency.ts` | `npm run test:concurrency` | 3 concurrency tests: simultaneous submissions, race condition in queue, optimistic locking |
| `test-solutions.ts` | `npm run test:solutions` | 13 solution tests: verifies canonical solutions pass all test cases via Piston |
| `seed-demo.ts` | `npm run seed:demo` | Seeds demo data into DB |
| `wipe-db.ts` | `npm run wipe-db` | Clears all data from DB (DEV ONLY) |
| `sync-users.ts` | `npm run sync-users` | Syncs users between DynamoDB and PostgreSQL |

---

## 18. Deployment Guide

### Required Environment Variables

```bash
# Auth
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://your-vercel-url.vercel.app

# GitHub OAuth
GITHUB_CLIENT_ID=<from-github-oauth-app>
GITHUB_CLIENT_SECRET=<from-github-oauth-app>

# Database (Neon PostgreSQL — required for Vercel)
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb

# AI Coach
GEMINI_API_KEY=<google-ai-studio-key>

# Admin
ADMIN_GITHUB_ID=<your-github-numeric-id>
ADMIN_EMAIL=<your-email>

# Optional
PISTON_URL=https://emkc.org/api/v2/piston  # or self-hosted
PISTON_KEY=<if-using-authenticated-piston>
ALLOW_GUEST_LOGIN=false         # true for dev
DEMO_MODE=false                 # true for investor demos
USE_AWS_DYNAMODB=false          # true to force AWS DynamoDB
AWS_ACCESS_KEY_ID=<if-using-dynamodb>
AWS_SECRET_ACCESS_KEY=<if-using-dynamodb>
AWS_REGION=eu-north-1
```

### Neon PostgreSQL Setup
1. Create Neon project → get connection string
2. Use pooler URL (contains `-pooler`) for serverless deployments
3. Table auto-created on first request (`ensureDbReady()`)
4. Leaderboard auto-seeded with 5 baseline engineers

### Vercel Setup
1. `vercel --prod` or connect GitHub repo
2. Add all env vars in Vercel Dashboard → Settings → Environment Variables
3. `DATABASE_URL` is CRITICAL — without it, production will throw `FATAL` error
4. `NEXTAUTH_URL` = Vercel deployment URL

---

## 19. Known Issues & Limitations

| Issue | Status | Details |
|---|---|---|
| Vercel leaderboard AWS collision | ✅ Fixed (commit `fe7f9ca`) | Lambda IAM creds inject fake AWS keys; now checks `VERCEL` env to skip AWS |
| Neon PgBouncer prepared statements | ✅ Fixed | `prepare: !isPooled` added in `dynamo.ts` and `postgres.ts` |
| Free tier duel quota discrepancy | ⚠️ | `pricing.ts` says unlimited; `subscription.ts` / queue route says 5/day — need alignment |
| Bot ELO not saved | ⚠️ | Bot matches don't persist ELO changes for the bot (intentional — bot is ephemeral) |
| Activity calendar is simulated | ⚠️ | `activityMap` from `/api/user/dashboard` currently returns random data; real submission tracking not yet wired |
| Payment integration | ❌ Not implemented | PRO/CAMPUS plans show UI but no Stripe/Razorpay integration yet |
| SSO for CAMPUS | ❌ Roadmap | Listed as "Roadmap" in feature list |
| Real-time opponent updates | ⚠️ Polling | Uses 2-3s polling intervals, not WebSockets |
| `embedded-interrupt-race` / `embedded-packed-alignment` | ⚠️ | Listed in dashboard but full implementation in `lib/challenges.ts` may be incomplete |

---

## 20. Root Layout & Global Providers

### `app/layout.tsx`
- Wraps everything in `<Providers>` (NextAuth `SessionProvider`)
- Global: `SubtleInteractiveBackground`, `CursorGlow`, `GlobalToaster`
- Fonts: Geist Sans (`--font-geist-sans`), Geist Mono (`--font-geist-mono`) from Google
- JetBrains Mono loaded via `<link>` in `<head>` for code display
- SEO: title `"Codeduel — Real-time Competitive Coding"`, description set

### `app/globals.css`
- Tailwind CSS v4 directives
- Base reset + dark background defaults

### `app/providers.tsx`
- `SessionProvider` from NextAuth wrapping all pages

---

## 21. Data Flow Diagrams

### Match Flow
```
User clicks "Find Match"
  → POST /api/match/queue
    → Check daily quota (subscription.ts)
    → Check if already in active match
    → Scan queue for human opponent
      → Found: Atomic claim → Create MATCH#id/META → Return { status: "matched", matchId }
      → Not found: Wait < 30s → Enqueue self → Return { status: "waiting" }
      → Wait ≥ 30s / demo mode → Create BOT match → Return { status: "matched", matchId, isBot: true }
  → Frontend redirects to /match/[matchId]
  → User edits code in Monaco
  → POST /api/match/submit
    → 15-min deadline check
    → executeChallenge() → Piston API
    → allPassed? → TransactWrite (5 items) → Update ELO + leaderboard
    → Return { result, testsPassed, eloChange, walkthrough }
  → Match over modal shown
```

### Hint Flow
```
User clicks "Get Hint"
  → POST /api/hint { matchId, challengeId, currentCode, language }
    → IP rate limit check (DB-backed)
    → Per-user rate limit (in-memory)
    → Atomic hint counter increment (conditional, server-enforced)
    → Subscription check for Tier 2/3
    → Build Gemini prompt
    → Try 3 Gemini models in cascade
    → sanitizeHint() strips code blocks
    → Return { hint, hintsUsed, hintsRemaining, tier }
```

---

*Document generated from live source code at `/Users/rishabh07/Downloads/codeduel-main 4` — commit `fe7f9ca`, branch `main`. All details sourced directly from actual TypeScript/CSS/JSON files with zero hallucination.*
