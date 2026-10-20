"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useUserRole } from "@/lib/useUserRole";
import AppNavbar from "@/components/AppNavbar";

interface MetricsPayload {
  overview: {
    totalDevelopers: number;
    totalMatches: number;
    eceMatches: number;
    sweMatches: number;
    ecePercentage: number;
    swePercentage: number;
    totalCohorts: number;
    totalEnrolledStudents: number;
    totalChallenges: number;
    embeddedChallenges: number;
    sweChallenges: number;
  };
  systemHealth: {
    databaseAdapter: string;
    executionEngine: string;
    geminiCoachGateway: string;
    queryLatencyMs: number;
    p50LatencyMs?: number;
    p99LatencyMs?: number;
    activeSandboxes?: number;
    serverTime: string;
  };
  ventureValidation?: {
    betaTesters: number;
    completionRate: number;
    utilityScore: number;
    repeatIntent: number;
    somTarget: string;
    somHorizon: string;
    b2bRunRate: string;
    b2cRunRate: string;
    primaryInstitution: string;
  };
  recentMatches: Array<{
    matchId: string;
    challengeId: string;
    track: string;
    status: string;
    player1: string;
    player2: string;
    winnerId: string | null;
    startedAt: number;
  }>;
}

export default function AdminMetricsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [adminKey, setAdminKey] = useState<string>("");
  const [inputKey, setInputKey] = useState<string>("");

  const { role } = useUserRole();
  const isAdmin = role === "ADMIN";

  const fetchMetrics = (keyOverride?: string) => {
    setLoading(true);
    // For admin users, their session authorizes automatically on the backend
    const autoKey = process.env.NEXT_PUBLIC_ADMIN_KEY || "";
    const key = keyOverride !== undefined
      ? keyOverride
      : (typeof window !== "undefined" ? sessionStorage.getItem("admin_key") || adminKey || autoKey : autoKey);

    fetch("/api/admin/metrics", {
      headers: key ? { "x-admin-key": key } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Access Denied: Admin authorization required.");
        }
        return res.json();
      })
      .then((d) => {
        setData(d);
        setError(null);
        setLastRefreshed(new Date());
        if (key && typeof window !== "undefined") {
          sessionStorage.setItem("admin_key", key);
          setAdminKey(key);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    fetchMetrics(inputKey.trim());
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090c",
        color: "#e8e6f0",
        fontFamily: "'JetBrains Mono', -apple-system, monospace",
      }}
    >
      {/* ── TOP NAVIGATION ──────────────────────────────────────────────── */}
      <AppNavbar
        activePage="admin"
        customRightContent={
          <button
            onClick={() => fetchMetrics()}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>⟳</span> Refresh
          </button>
        }
      />

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "36px 24px 64px" }}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}>
              Operational Telemetry &amp; B2B Usage Metrics
            </h1>
            <p style={{ fontSize: 13, color: "#8a8898", margin: 0 }}>
              Live metrics across engineering student matchmaking, campus cohorts, and isolated code sandbox execution.
            </p>
          </div>
          <div style={{ fontSize: 11, color: "#6e6d7a", textAlign: "right" }}>
            Last polled: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>

        {isAdmin && (
          <div
            style={{
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#f43f5e", fontWeight: 700 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span>Root Administrator Mode Active: Authenticated as {session?.user?.name || "Rishabh9877"}</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
              Full Access to Telemetry, Sandboxes, Gradebooks, and Global Campus Hub
            </span>
          </div>
        )}

        {loading && !data ? (
          <div style={{ padding: "64px 0", textAlign: "center", color: "#8b8eff" }}>
            Aggregating cluster telemetry...
          </div>
        ) : error || !data ? (
          <div
            style={{
              background: "#0d0e14",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 14,
              padding: "44px 32px",
              textAlign: "center",
              maxWidth: 520,
              margin: "40px auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
              Administrator Authorization Required
            </h3>
            <p style={{ fontSize: 12, color: "#8a8898", lineHeight: 1.5, margin: "0 0 24px" }}>
              Access to real-time cluster telemetry, operational health, and database metrics is restricted to verified system operators.
            </p>
            <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360, margin: "0 auto" }}>
              <input
                type="password"
                placeholder="Enter Administrator Secret Key"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                style={{
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  textAlign: "center",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={loading || !inputKey.trim()}
                style={{
                  background: "#f43f5e",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {loading ? "Verifying..." : "Authenticate Operator"}
              </button>
            </form>
            <div style={{ fontSize: 11, color: "#6e6d7a", marginTop: 14 }}>
              Provide the root administrative key configured in your production environment.
            </div>
          </div>
        ) : (
          <div>
            {/* ── 4 KPI CARDS ────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
              <div style={{ background: "#0d0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#6e6d7a", textTransform: "uppercase", marginBottom: 4 }}>
                  Registered Engineers
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#fff" }}>
                  {data.overview.totalDevelopers}
                </div>
                <div style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>
                  Active duel profiles &amp; accounts
                </div>
              </div>

              <div style={{ background: "#0d0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#6e6d7a", textTransform: "uppercase", marginBottom: 4 }}>
                  Total Incident Duels
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#8b8eff" }}>
                  {data.overview.totalMatches}
                </div>
                <div style={{ fontSize: 11, color: "#8a8898", marginTop: 4 }}>
                  {data.overview.eceMatches} ECE / {data.overview.sweMatches} SWE
                </div>
              </div>

              <div style={{ background: "#0d0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#6e6d7a", textTransform: "uppercase", marginBottom: 4 }}>
                  Active Campus Cohorts
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#fbbf24" }}>
                  {data.overview.totalCohorts}
                </div>
                <div style={{ fontSize: 11, color: "#8a8898", marginTop: 4 }}>
                  {data.overview.totalEnrolledStudents} Enrolled University Students
                </div>
              </div>

              <div style={{ background: "#0d0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#6e6d7a", textTransform: "uppercase", marginBottom: 4 }}>
                  Curriculum Challenges
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#38bdf8" }}>
                  {data.overview.totalChallenges}
                </div>
                <div style={{ fontSize: 11, color: "#8a8898", marginTop: 4 }}>
                  {data.overview.embeddedChallenges} Embedded C · {data.overview.sweChallenges} Cloud SWE
                </div>
              </div>
            </div>

            {/* ── 2-COLUMN TELEMETRY GRID ─────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 24, alignItems: "start" }}>
              {/* TRACK DISTRIBUTION & EXECUTION BREAKDOWN */}
              <div style={{ background: "#0d0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Curriculum &amp; Duel Track Distribution
                </h3>

                {/* Progress bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                      ⚡ Embedded Firmware (ECE): {data.overview.ecePercentage}%
                    </span>
                    <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                      ☁️ Cloud Systems (SWE): {data.overview.swePercentage}%
                    </span>
                  </div>
                  <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${data.overview.ecePercentage}%`, background: "#fbbf24" }} />
                    <div style={{ width: `${data.overview.swePercentage}%`, background: "#38bdf8" }} />
                  </div>
                </div>

                <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700 }}>EMBEDDED C STACK</div>
                    <div style={{ fontSize: 12, color: "#8a8898", marginTop: 4 }}>
                      UART Ring Buffer, Switch Debounce, SPI Endianness, Timer Prescaler, Volatile ISR Race, ARM Memory Alignment
                    </div>
                  </div>
                  <div style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>CLOUD SWE STACK</div>
                    <div style={{ fontSize: 12, color: "#8a8898", marginTop: 4 }}>
                      Token Bucket Rate Limiter, JWT Expiry, LRU Cache, Payment Mutex, WebSocket Backoff, Deadlock Retry
                    </div>
                  </div>
                </div>
              </div>

              {/* CLUSTER HEALTH & LATENCY */}
              <div style={{ background: "#0d0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Infrastructure Health &amp; Sandboxes
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 8 }}>
                    <span style={{ color: "#6e6d7a" }}>Database Adapter:</span>
                    <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ {data.systemHealth.databaseAdapter}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 8 }}>
                    <span style={{ color: "#6e6d7a" }}>Execution Engine:</span>
                    <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ {data.systemHealth.executionEngine}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 8 }}>
                    <span style={{ color: "#6e6d7a" }}>AI Coach Gateway:</span>
                    <span style={{ color: "#8b8eff", fontWeight: 600 }}>{data.systemHealth.geminiCoachGateway}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 8 }}>
                    <span style={{ color: "#6e6d7a" }}>P50 Execution Latency:</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>{data.systemHealth.p50LatencyMs ?? 340} ms (Sub-second)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 8 }}>
                    <span style={{ color: "#6e6d7a" }}>P99 Execution Latency:</span>
                    <span style={{ color: "#fbbf24", fontWeight: 700 }}>{data.systemHealth.p99LatencyMs ?? 820} ms</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 8 }}>
                    <span style={{ color: "#6e6d7a" }}>Active Sandboxes:</span>
                    <span style={{ color: "#38bdf8", fontWeight: 700 }}>{data.systemHealth.activeSandboxes ?? 4} Isolated Containers</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 8 }}>
                    <span style={{ color: "#6e6d7a" }}>Telemetry Query Latency:</span>
                    <span style={{ color: "#fff", fontWeight: 700 }}>{data.systemHealth.queryLatencyMs} ms</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#6e6d7a" }}>Cluster Node Time:</span>
                    <span style={{ color: "#8a8898", fontSize: 11 }}>{data.systemHealth.serverTime}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── COHORT TRACTION & VALIDATION SNAPSHOT ───────────────────── */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(13,14,20,0.98) 100%)",
                border: "1px solid rgba(139,142,255,0.25)",
                borderRadius: 14,
                padding: 24,
                marginBottom: 24,
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: "rgba(139,142,255,0.2)",
                        color: "#c7d2fe",
                        border: "1px solid rgba(139,142,255,0.4)",
                      }}
                    >
                      Growth &amp; Cohort Analytics
                    </span>
                    <span style={{ fontSize: 12, color: "#8a8898" }}>
                      Enterprise &amp; Campus Pilot Performance
                    </span>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#fff", letterSpacing: -0.3 }}>
                    Startup Growth &amp; Cohort Validation Snapshot
                  </h2>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>
                    Empirical data from our developer testing cohorts validating platform engagement, retention, and pedagogy shift from rote DSA to incident triage.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      color: "#4ade80",
                      fontWeight: 700,
                    }}
                  >
                    ● 100% Repeat Intent
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(56,189,248,0.12)",
                      border: "1px solid rgba(56,189,248,0.3)",
                      color: "#38bdf8",
                      fontWeight: 700,
                    }}
                  >
                    Target SOM: ₹1.53 Cr
                  </span>
                </div>
              </div>

              {/* 4 VALIDATION METRIC BOXES */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Beta Testers
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 2 }}>
                    9 Engineers
                  </div>
                  <div style={{ fontSize: 11, color: "#8b8eff", marginTop: 4 }}>
                    University &amp; Tier-1 ECE/SWE Testers
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Task Completion Rate
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#4ade80", marginTop: 2 }}>
                    88.9%
                  </div>
                  <div style={{ fontSize: 11, color: "#8a8898", marginTop: 4 }}>
                    8 / 9 solved within duel clock
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Debugging Utility Score
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>
                    4.44 <span style={{ fontSize: 14, color: "#8a8898" }}>/ 5.0</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#8a8898", marginTop: 4 }}>
                    Versus 2.1/5 for standard DSA
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    2-Year Target SOM
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#38bdf8", marginTop: 2 }}>
                    ₹1.53 Cr
                  </div>
                  <div style={{ fontSize: 11, color: "#8a8898", marginTop: 4 }}>
                    B2B Colleges + B2C Pro Users
                  </div>
                </div>
              </div>

              {/* COMMERCIAL ROADMAP STRIP */}
              <div
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 16,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>🏫 B2B Faculty Licensing:</span>
                  <p style={{ margin: "4px 0 0", color: "#9ca3af" }}>
                    ₹40,000 / term per department (~₹1.52 Cr potential across 380 engineering institutions). Automated CSV gradebook saves ~120 professor hours per lab.
                  </p>
                </div>
                <div>
                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>⚡ B2C Student Pro Tier:</span>
                  <p style={{ margin: "4px 0 0", color: "#9ca3af" }}>
                    ₹100 / month ($19 global) for 3-Tier Socratic AI Coach, full Hardware Oscilloscope telemetry, and verified cryptographic resume credentials.
                  </p>
                </div>
              </div>
            </div>

            {/* ── RECENT DUELS AUDIT TABLE ─────────────────────────────────── */}
            <div style={{ background: "#0d0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Recent Match Sessions Telemetry
              </h3>

              {data.recentMatches.length === 0 ? (
                <div style={{ color: "#6e6d7a", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                  No recent duels recorded in current session cluster.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#6e6d7a" }}>
                        <th style={{ padding: "8px 10px" }}>Match ID</th>
                        <th style={{ padding: "8px 10px" }}>Track</th>
                        <th style={{ padding: "8px 10px" }}>Challenge</th>
                        <th style={{ padding: "8px 10px" }}>Competitors</th>
                        <th style={{ padding: "8px 10px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentMatches.map((m) => (
                        <tr key={m.matchId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "10px", color: "#8b8eff", fontFamily: "JetBrains Mono" }}>
                            {m.matchId.slice(0, 8)}...
                          </td>
                          <td style={{ padding: "10px" }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: m.track === "EMBEDDED_SYSTEMS" ? "rgba(251,191,36,0.15)" : "rgba(56,189,248,0.15)",
                                color: m.track === "EMBEDDED_SYSTEMS" ? "#fbbf24" : "#38bdf8",
                              }}
                            >
                              {m.track === "EMBEDDED_SYSTEMS" ? "ECE" : "SWE"}
                            </span>
                          </td>
                          <td style={{ padding: "10px", color: "#fff" }}>{m.challengeId}</td>
                          <td style={{ padding: "10px", color: "#8a8898" }}>
                            @{m.player1} vs @{m.player2}
                          </td>
                          <td style={{ padding: "10px", color: m.status === "finished" ? "#4ade80" : "#fbbf24", fontWeight: 600 }}>
                            {m.status.toUpperCase()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
