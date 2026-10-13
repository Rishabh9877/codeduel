# CodeDuel — 1v1 Dynamic Software & ECE Engineering Duels

> *"We train students and developers through 1v1 dynamic software and ECE duels."*

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.9-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2.4-blue?logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20DynamoDB-336791?logo=postgresql)](https://neon.tech/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**CodeDuel** is a competitive engineering platform that bridges the massive gap between textbook algorithm memorization (LeetCode/DSA) and real-world production engineering. 

Instead of inverting binary trees, engineers race head-to-head in real time to diagnose, trace, and patch authentic bugs across production multi-file codebases in **Cloud Systems (TypeScript / Python)** and **Embedded Firmware (C / Bare-Metal Hardware)**.

---

## ⚡ The CodeDuel Advantage

| Metric | Traditional DSA Platforms | CodeDuel Battleground |
|---|---|---|
| **Problem Domain** | Textbook arrays, graph traversal, dynamic programming | Production systems, race conditions, memory leaks, register flags |
| **Code Structure** | Single-function sandbox with synthetic inputs | Multi-file modular architecture (`.h`, `.c`, `.ts`, types, test runner) |
| **Feedback Loop** | Hidden test cases pass/fail | Live assertion telemetry, oscilloscope & simulated hardware registers |
| **Competitive Pressure** | Asynchronous leaderboard or solo timer | Real-time 1v1 matchmaking with dynamic ELO delta |
| **Educational Depth**| Memorized algorithmic patterns | Socratic AI hints (Gemini 2.0) + Root cause architecture walkthroughs |
| **Institutional Use**| Not designed for universities or lab assignments | **Campus Mode** cohorts, join codes, faculty telemetry, assignment grading |

---

## 🛠️ Two Specialized Engineering Tracks

### 1. Embedded Systems & Firmware (`EMBEDDED_SYSTEMS`)
Tackle realistic driver and hardware anomalies on simulated ARM Cortex-M microcontrollers and RTOS environments:
- **Cortex-M0 Unaligned Memory HardFault**: Automotive CAN packet parser throwing hardware faults on odd-byte address reads.
- **Atomic Interrupt Concurrency & Telemetry Races**: Race condition between high-speed timer ISR and background task corrupting 64-bit timestamps (`PRIMASK` / `__disable_irq()`).
- **UART Ring Buffer Wrap-Around**: Head/tail pointer collision causing silent buffer overflow and dropped serial telemetry.
- **GPIO Contact Bounce Filter**: Mechanical switch glitches triggering spurious interrupts without a sustained debounce window.
- **16-Bit IMU Endianness Decoding**: Swapped byte order and missing two's complement sign-extension in 3-axis accelerometer packets.
- **Timer PWM Prescaler Off-by-One**: Missing register offset (+1) and unchecked duty cycle overflow driving BLDC motor RPM oscillation.

### 2. Cloud & Production SWE (`PRODUCTION_SWE`)
Diagnose high-throughput distributed systems failures and security vulnerabilities:
- **Sub-Second Token Starvation in RateLimiter**: Integer truncation dropping fractional millisecond tokens between high-frequency bursts.
- **Exponential Backoff Jitter Clamping**: RPC gateway stampeding downstreams due to negative delay subtractions.
- **JWT Algorithm Confusion (CVE-2024-8812)**: Forged authentication tokens bypassing signature checks via case-variant `none` headers.
- **Database Connection Pool Exhaustion**: Unhandled error paths failing to release borrowed connections until total service starvation.
- **SingleFlight Cache Stampede**: Thundering herd overwhelming database on cold cache hits instead of coalescing into an in-flight promise.
- **Async Stream Consumer Connection Leak**: Streaming worker queue failing to release connection handles on record validation rejections.

---

## 🌟 Core Features & Modules

### 1. Real-Time 1v1 Battleground (`/match/[id]`)
- **Deterministic Matchmaking**: Queue against real engineers with track filtering or instant-duel against `CodeSentinel AI [BOT]` with dynamic skill scaling.
- **Monaco Multi-File IDE**: Full tabbed editor with read-only architecture files and editable source files.
- **Simulated Hardware Panel**: Interactive digital oscilloscope, real-time logic analyzer, register monitor (`PRIMASK`, `CFSR`, `HFSR`, `MMFAR`), and bus frame inspector.
- **Competitive ELO Engine**: Standardized Elo rating calculation with $K=32$ factor and rating floor protection ($800$ minimum).

### 2. Solo Practice & Socratic Learning (`/practice`)
- **Daily Challenge Loop**: Dedicated daily practice tickets with streak tracking.
- **Socratic AI Hints**: Google Gemini 2.0 Flash integration offering progressive 3-tier hints without spoiling code solutions.
- **Architectural Post-Mortems**: Comprehensive breakdowns with root causes, buggy-vs-fixed diffs, and real-world failure analyses.

### 3. Campus & Academy Mode (`/campus`)
- **Faculty Dashboard**: Create academic cohorts with unique 6-character join codes (e.g., `ECE-301-EMBEDDED`, `CS-210-SYSTEMS`).
- **Lab Assignments**: Set deadlines, assign challenge tracks, and monitor student completion rates.
- **Institutional Telemetry**: Track class average pass rates, time-to-fix metrics, and student ELO distribution.

### 4. Verified Public Portfolios (`/u/[username]`)
- **Recruiter-Ready Profiles**: Publicly shareable engineering cards with verified track badges.
- **Skill Proficiency Breakdown**: Granular scoring across Memory Safety, Concurrency, Protocol Decoding, and System Architecture.
- **Cryptographic Credential Verification (`/verify/[slug]`)**: Instant credential verification for completed track certifications.

### 5. SaaS Pricing & Admin Metrics (`/pricing` & `/admin/metrics`)
- **Tiered Model**: Free Student Tier, Campus Pro Tier ($19/mo or $15/seat/term), and Enterprise Department Tier.
- **Usage Metrics Dashboard**: Live monitoring of active duels, daily submissions, API latency, and quota consumption.

---

## 🏗️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (Next.js 16)                   │
│   Monaco Editor • Hardware Visualizer • Real-Time Duel Polling  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON
┌──────────────────────────────▼──────────────────────────────┐
│                   Next.js App Router API                    │
│   /api/match • /api/campus • /api/practice • /api/challenges │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
┌──────────────▼─────────────┐ ┌───────────▼──────────────────┐
│  Universal Storage Adapter │ │   Isolated Execution Engine  │
│  • AWS DynamoDB (Single-T) │ │   • Sandboxed Piston API     │
│  • Neon Serverless Postgres│ │   • Multi-File Container Run │
│  • Local Persistent Cache  │ └──────────────────────────────┘
└────────────────────────────┘
```

- **Frontend & App Router**: Next.js 16.2.9 (Turbopack), React 19.2.4, Tailwind CSS 4
- **Code Editor**: Monaco Editor (`@monaco-editor/react`)
- **Database Engine**: Neon Serverless PostgreSQL (`postgres` driver) with AWS DynamoDB adapter fallback
- **Code Execution**: Piston Sandboxed Multi-File Engine (`C` with `gcc`, `TypeScript` with `tsx`, `Python` with `python3`)
- **AI Intelligence**: Google Gemini 2.0 Flash (`@google/genai`)
- **Authentication**: NextAuth.js with GitHub OAuth

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20+ installed
- PostgreSQL database URL (Neon, Supabase, or local) **OR** AWS DynamoDB credentials

### 1. Clone & Install
```bash
git clone https://github.com/your-username/codeduel.git
cd codeduel
npm install
```

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env.local
```

Configure your `.env.local`:
```bash
# Database (Neon Serverless PostgreSQL or local Postgres)
DATABASE_URL=postgresql://user:password@ep-young-hill.pooler.aws.neon.tech/neondb?sslmode=require

# NextAuth
NEXTAUTH_SECRET=codeduel-super-secure-production-secret-key-32ch
NEXTAUTH_URL=http://localhost:3000

# Optional: GitHub OAuth (for public login)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Optional: Google Gemini API (for AI Socratic hint coach)
GEMINI_API_KEY=your_gemini_api_key

# Optional: Dedicated Piston Execution Node (defaults to public Piston mirror)
PISTON_URL=https://emkc.org/api/v2/piston
```

### 3. Run Automated Test Suites
CodeDuel includes built-in verification scripts for all game logic:

```bash
# Run ELO algorithm unit tests (7 test cases, floor protection, probability symmetry)
npm run test:elo

# Verify all 12 challenge reference solutions (100% test pass rate)
npm run test:solutions
```

### 4. Seed Demo Data
Populate the database with verified engineers, active cohorts, and leaderboard records:
```bash
npm run seed:demo
```

### 5. Launch the Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Production Verification

Run the full Next.js production build and TypeScript check:
```bash
npm run typecheck
npm run build
```

Expected output:
```
✓ Compiled successfully
✓ Finished TypeScript
✓ Generating static pages (29/29)
Finalizing page optimization ...
```

---

## 📜 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
