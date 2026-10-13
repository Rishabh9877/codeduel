"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    serverTime: string;
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
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchMetrics = () => {
    setLoading(true);
    fetch("/api/admin/metrics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load telemetry");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLastRefreshed(new Date());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090c",
        color: "#e8e6f0",
        fontFamily: "'JetBrains Mono', -apple-system, monospace",
      }}
    >
      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 60,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(8,9,12,0.9)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#fff",
              textDecoration: "none",
              letterSpacing: -0.5,
            }}
          >
            Code<span style={{ color: "#8b8eff" }}>Duel</span>
          </Link>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 4,
              background: "rgba(239,68,68,0.15)",
              color: "#f87171",
              fontWeight: 700,
              letterSpacing: 0.5,
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            ADMIN TELEMETRY
          </span>
        </div>

        <div style={{ display: "flex", gap: 20, fontSize: 13, alignItems: "center" }}>
          <Link href="/campus" style={{ color: "#8a8898", textDecoration: "none" }}>
            Campus Hub
          </Link>
          <Link href="/pricing" style={{ color: "#8a8898", textDecoration: "none" }}>
            Pricing
          </Link>
          <Link href="/dashboard" style={{ color: "#8a8898", textDecoration: "none" }}>
            User Dashboard
          </Link>
          <button
            onClick={fetchMetrics}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ⟳ Refresh
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "36px 24px 64px" }}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
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

        {loading && !data ? (
          <div style={{ padding: "64px 0", textAlign: "center", color: "#8b8eff" }}>
            Aggregating cluster telemetry...
          </div>
        ) : error || !data ? (
          <div style={{ padding: "32px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 12, color: "#f43f5e" }}>
            Error loading metrics: {error}
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
                    <span style={{ color: "#6e6d7a" }}>Telemetry Latency:</span>
                    <span style={{ color: "#fff", fontWeight: 700 }}>{data.systemHealth.queryLatencyMs} ms</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#6e6d7a" }}>Cluster Node Time:</span>
                    <span style={{ color: "#8a8898", fontSize: 11 }}>{data.systemHealth.serverTime}</span>
                  </div>
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
