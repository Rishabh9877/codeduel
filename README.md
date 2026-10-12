# CodeDuel — Real-Time 1v1 Engineering Battleground

CodeDuel is a real-time competitive engineering platform where developers race 1v1 to triage and resolve real-world production tickets across multi-file codebases. 

We have completely eliminated textbook DSA puzzles (e.g., Two Sum, Tree Inversions). Instead, CodeDuel simulates authentic engineering challenges across two distinct competitive tracks:

1. **Track `PRODUCTION_SWE` (Open Source & Cloud Microservices):**
   - Multi-file TypeScript & Node.js architectures.
   - Developers inspect bug reports (race conditions, token bucket drift, leaky state), navigate modular codebases, patch the bug in an editable file, and satisfy automated unit test suites.
2. **Track `EMBEDDED_SYSTEMS` (Firmware & Core Electronics):**
   - Multi-file C/C++ embedded codebases.
   - Developers inspect hardware driver alerts (UART ring buffer wrap-around, register mask corruptions, volatile synchronization), fix memory and pointer operations, and satisfy bare-metal assertion test runners.

---

## Tech Stack & Architecture

- **Frontend & API** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Code Editor** — Monaco Editor (`@monaco-editor/react`) with tabbed workspace, `Record<string, string>` state preservation, and dynamic read-only file enforcement.
- **Database** — AWS DynamoDB (Single-Table Design with GSI for leaderboards).
- **Code Execution** — [Piston API](https://github.com/engineer-man/piston) (`POST https://emkc.org/api/v2/piston/execute`) — keyless, sandboxed multi-file container execution.
- **AI Socratic Coach** — Google Gemini 2.0 Flash (`gemini-2.0-flash`) providing 3-tier progressive hints without spoiling code solutions.
- **Auth & Local Testing** — NextAuth.js with GitHub OAuth + lightweight Dual Guest Dev Bypass (`?guest=1` / `?guest=2` or one-click buttons).
- **Networking** — Deterministic 1.5s short-polling backed by DynamoDB (zero external WebSocket servers).

```
Player A (Tab 1 / Guest 1) ──┐
                             ├── Next.js Route Handlers ── AWS DynamoDB (Single-Table: CodeDuelTable)
Player B (Tab 2 / Guest 2) ──┘        │
                                      ├── Piston API (Multi-file bundle execution — TypeScript / C)
                                      └── Gemini 2.0 Flash (3-tier Socratic debugging coach)
```

---

## Seed Production Challenges (`lib/challenges.ts`)

| Challenge ID | Track | Language | Repository | Issue Summary |
|---|---|---|---|---|
| `swe-token-bucket` | `PRODUCTION_SWE` | TypeScript | `oss-gateway/rate-limiter` | **PR #108: Fix Sub-Second Token Starvation in RateLimiter**<br>Integer truncation dropped fractional millisecond token replenishments between high-frequency bursts. |
| `embedded-ring-buffer` | `EMBEDDED_SYSTEMS` | C | `embedded-os/drivers/serial` | **Issue #44: UART ISR Dropping Bytes on Ring Buffer Wrap-Around**<br>Head/tail collision confused full vs empty states; missing modulo wrap-around corrupted FIFO stream. |

---

## Local Development & 2-Tab Testing

1. Clone repository and install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env.local` (or run with defaults in development):
   ```bash
   AWS_REGION=eu-north-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   NEXTAUTH_SECRET=codeduel-development-secret-key-12345
   NEXTAUTH_URL=http://localhost:3000
   GEMINI_API_KEY=...
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. **Dual-Tab Match Testing without GitHub credentials:**
   - Open Tab A: `http://localhost:3000/?guest=1` (Auto-logs in as `Guest_Alpha`, 1200 ELO)
   - Open Tab B (or incognito): `http://localhost:3000/?guest=2` (Auto-logs in as `Guest_Beta`, 1200 ELO)
   - Click **Find Match** in both tabs to test real-time 1v1 duels!
5. **Instant Demo vs AI Bot:**
   - Click **Instant Match vs Mock Bot** or queue for > 10 seconds to duel `CodeSentinel AI [BOT]`, which simulates progressive test passing over 40 seconds.

---

## DynamoDB Single-Table Schema (`CodeDuelTable`)

- `USER#<id>` / `PROFILE`: Player rating, win/loss record, avatar.
- `USER#<id>` / `LEADERBOARD`: GSI1PK=`LEADERBOARD#GLOBAL`, GSI1SK=`elo` (sorts highest ELO first).
- `QUEUE#<userId>` / `WAITING`: Active matchmaking queue with track filter and 5-min TTL.
- `MATCH#<matchId>` / `META`: Live match session, track, challenge ID, player slots, real-time tests passed (`0/3`), and 2-hr TTL.
