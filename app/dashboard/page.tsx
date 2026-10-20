"use client";

import Link from "next/link";
import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import RoleBadgeSwitcher from "@/components/RoleBadgeSwitcher";
import AppNavbar from "@/components/AppNavbar";
import { useUserRole } from "@/lib/useUserRole";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  userId: string;
  username: string;
  avatar?: string;
  elo: number;
  role?: "INDIVIDUAL" | "STUDENT" | "FACULTY" | "ADMIN";
  isAdmin?: boolean;
  wins: number;
  losses: number;
}



// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateEloHistory(currentElo: number) {
  const points = 20;
  let elo = currentElo;
  const history = [elo];
  for (let i = 1; i < points; i++) {
    const change = Math.round((Math.random() - 0.52) * 28);
    elo = Math.max(800, elo - change);
    history.unshift(elo);
  }
  const months = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun"];
  return history.map((e, i) => ({ label: months[Math.floor(i * months.length / points)], elo: e }));
}

function generateActivityData(): Record<string, number> {
  const data: Record<string, number> = {};
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const recency = 1 - i / 365;
    data[key] = Math.random() < recency * 0.38 ? Math.floor(Math.random() * 5) + 1 : 0;
  }
  return data;
}

function ActivityCalendar({ data, joinedDate }: { data: Record<string, number>, joinedDate?: string | null }) {
  const [hoveredDay, setHoveredDay] = useState<{ x: number; y: number; text: React.ReactNode } | null>(null);

  const weeks: { date: string; count: number }[][] = [];
  
  // Generate the last 365 days (ending today)
  const fullKeys: string[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    fullKeys.push(d.toISOString().split("T")[0]);
  }

  // pad to start on Sunday
  const firstDay = new Date(fullKeys[0]).getDay();
  let week: { date: string; count: number }[] = [];
  for (let p = 0; p < firstDay; p++) week.push({ date: "", count: -1 });
  
  for (const key of fullKeys) {
    week.push({ date: key, count: data[key] || 0 });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) weeks.push(week);

  const cellColor = (count: number) => {
    if (count < 0) return "transparent";
    if (count === 0) return "rgba(255,255,255,0.04)";
    if (count === 1) return "rgba(139,142,255,0.18)";
    if (count === 2) return "rgba(139,142,255,0.36)";
    if (count === 3) return "rgba(139,142,255,0.55)";
    return "rgba(139,142,255,0.85)";
  };

  const monthLabels: { label: string; col: number }[] = [];
  weeks.forEach((w, i) => {
    const first = w.find(d => d.date);
    if (first?.date) {
      const m = new Date(first.date);
      if (m.getDate() <= 7) {
        monthLabels.push({
          label: m.toLocaleString("default", { month: "short" }),
          col: i
        });
      }
    }
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ position: "relative", paddingTop: 20, minWidth: weeks.length * 14, paddingBottom: 10 }}>
        {/* Custom Tooltip */}
        {hoveredDay && (
          <div style={{
            position: "fixed",
            left: hoveredDay.x,
            top: hoveredDay.y - 8,
            transform: "translate(-50%, -100%)",
            background: "#0d0d14",
            border: "1px solid #8b8eff",
            borderRadius: 6,
            padding: "6px 10px",
            color: "#fff",
            fontSize: 11,
            fontFamily: "JetBrains Mono, monospace",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5), 0 0 10px rgba(139,142,255,0.25)"
          }}>
            {hoveredDay.text}
            <div style={{
              position: "absolute",
              bottom: -5,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 8,
              height: 8,
              background: "#0d0d14",
              borderRight: "1px solid #8b8eff",
              borderBottom: "1px solid #8b8eff",
            }} />
          </div>
        )}

        {/* Month labels */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 18, display: "flex" }}>
          {monthLabels.map((m, i) => (
            <span key={i} style={{
              position: "absolute", left: m.col * 14,
              fontSize: 10, fontFamily: "JetBrains Mono, monospace",
              color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap"
            }}>{m.label}</span>
          ))}
        </div>
        {/* Grid */}
        <div style={{ display: "flex", gap: 2 }} onMouseLeave={() => setHoveredDay(null)}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {week.map((day, di) => {
                const isJoinedDay = joinedDate === day.date;
                const rawCount = day.count;
                const displayCount = isJoinedDay ? Math.max(1, rawCount) : rawCount;
                const isValid = day.date !== "";
                
                let text: React.ReactNode = "";
                if (isValid) {
                  const dateStr = new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  if (isJoinedDay) {
                    text = (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        <span style={{ color: "#7cff6b", fontWeight: 700 }}>You joined Codeduel! 🎉</span>
                        <span style={{ color: "rgba(255,255,255,0.7)" }}>
                          {rawCount > 0 ? `${rawCount} submission${rawCount !== 1 ? "s" : ""} · ${dateStr}` : `No submissions · ${dateStr}`}
                        </span>
                      </div>
                    );
                  } else if (displayCount > 0) {
                    text = `${displayCount} submission${displayCount !== 1 ? "s" : ""} · ${dateStr}`;
                  } else {
                    text = `No submissions · ${dateStr}`;
                  }
                }
                
                return (
                  <div key={di} 
                    onMouseEnter={(e) => {
                      if (!isValid) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredDay({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        text
                      });
                    }}
                    style={{
                      width: 11, height: 11, borderRadius: 2,
                      background: cellColor(displayCount),
                      border: displayCount > 0 ? "1px solid rgba(139,142,255,0.15)" : "none",
                      cursor: isValid ? "pointer" : "default",
                      transition: "opacity .15s",
                    }} 
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.25)" }}>Less</span>
          {[0,1,2,3,4].map(l => (
            <div key={l} style={{ width: 11, height: 11, borderRadius: 2, background: cellColor(l), border: l > 0 ? "1px solid rgba(139,142,255,0.15)" : "none" }} />
          ))}
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.25)" }}>More</span>
        </div>
      </div>
    </div>
  );
}

const PROBLEMS = [
  { id: "swe-token-bucket", title: "RateLimiter Sub-Second Refill", diff: "medium", track: "PRODUCTION_SWE", lang: "TypeScript", repo: "oss-gateway/rate-limiter" },
  { id: "embedded-ring-buffer", title: "UART FIFO Wrap-Around Glitch", diff: "hard", track: "EMBEDDED_SYSTEMS", lang: "C", repo: "embedded-os/drivers/serial" },
  { id: "swe-retry-backoff", title: "Exponential Backoff Jitter Drift", diff: "medium", track: "PRODUCTION_SWE", lang: "TypeScript", repo: "open-mesh/rpc-gateway" },
  { id: "embedded-gpio-debounce", title: "Mechanical Switch Contact Bounce", diff: "hard", track: "EMBEDDED_SYSTEMS", lang: "C", repo: "zephyr-rtos/drivers/gpio" },
  { id: "swe-jwt-alg-confusion", title: 'JWT "none" Signature Bypass', diff: "hard", track: "PRODUCTION_SWE", lang: "TypeScript", repo: "open-auth/jwt-verify" },
  { id: "swe-connection-pool-leak", title: "DB Connection Pool Starvation", diff: "medium", track: "PRODUCTION_SWE", lang: "TypeScript", repo: "hyper-db/pool-manager" },
  { id: "swe-cache-stampede", title: "SingleFlight Cache Stampede", diff: "hard", track: "PRODUCTION_SWE", lang: "TypeScript", repo: "cache-mesh/in-memory-lru" },
  { id: "embedded-spi-endianness", title: "16-Bit IMU Sensor Endianness", diff: "medium", track: "EMBEDDED_SYSTEMS", lang: "C", repo: "aerospace-rtos/drivers/imu" },
  { id: "embedded-pwm-prescaler", title: "PWM Motor Prescaler Drift", diff: "medium", track: "EMBEDDED_SYSTEMS", lang: "C", repo: "bldc-firmware/hal/pwm" },
  { id: "swe-async-worker-leak", title: "Async Stream Connection Leak", diff: "medium", track: "PRODUCTION_SWE", lang: "Python", repo: "fast-stream/worker-queue" },
];
const MOCK_MATCHES = [
  { opponent: "CodeSentinel AI", problem: "RateLimiter Sub-Second Refill", result: "Win",  elo: "+16", ago: "15m ago"  },
  { opponent: "KernelPanic_9",   problem: "UART FIFO Wrap-Around Glitch",  result: "Loss", elo: "-14", ago: "2h ago"   },
  { opponent: "CloudDev_42",     problem: "RateLimiter Sub-Second Refill", result: "Win",  elo: "+18", ago: "1d ago"   },
];

const DIFF_COLORS: Record<string, string> = {
  easy:   "#4ade80",
  medium: "#fbbf24",
  hard:   "#f87171",
};

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "#0d0d14", border: "1px solid rgba(139,142,255,0.2)",
      borderRadius: 6, padding: "8px 12px",
      fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#e8e6f0",
      zIndex: 1000,
      position: "relative",
    }}>
      <div style={{ color: "#8b8eff", fontWeight: "bold" }}>{payload[0].value} ELO</div>
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 2 }}>{payload[0].payload?.label || label || ""}</div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("dash_profile") || "null"); } catch(e){}
    }
    return null;
  });
  const { role: selectedRole, setRole: setSelectedRole } = useUserRole();
  const { matchState, queueDuration, showMatchModal, setShowMatchModal, handleFindMatch, handleCancel } = useMatchmaking();
  const userElo = profile?.elo ?? 1200;
  const activeBracketId =
    userElo < 1100 ? "bracket-1" : userElo < 1400 ? "bracket-2" : "bracket-3";
  const [eloHistory, setEloHistory] = useState<{ label: string; elo: number }[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("dash_eloHistory") || "[]"); } catch(e){}
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("action") === "find_match") {
        const trackParam = urlParams.get("track");
        if (trackParam === "EMBEDDED_SYSTEMS" || trackParam === "PRODUCTION_SWE") {
          handleFindMatch({ track: trackParam });
        } else {
          setShowMatchModal(true);
        }
        window.history.replaceState(null, "", "/dashboard");
      }
    }
  }, [setShowMatchModal, handleFindMatch]);

  const [activityData, setActivityData] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("dash_activityData") || "{}"); } catch(e){}
    }
    return {};
  });
  const [recentMatches, setRecentMatches] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("dash_recentMatches") || "[]"); } catch(e){}
    }
    return [];
  });
  const [joinedDate, setJoinedDate] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("dash_joinedDate");
    return null;
  });
  const [isLoaded, setIsLoaded] = useState(() => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("dash_profile");
    }
    return false;
  });
  const [selectedProblem, setSelectedProblem] = useState<{id: string, title: string, track?: string} | null>(null);
  const [problemTrackFilter, setProblemTrackFilter] = useState<"ALL" | "PRODUCTION_SWE" | "EMBEDDED_SYSTEMS">("ALL");

  useEffect(() => {
    if (status !== "authenticated") return;
    
    Promise.all([
      fetch("/api/user/me").then(r => r.ok ? r.json() : null),
      fetch("/api/user/dashboard").then(r => r.ok ? r.json() : null)
    ])
    .then(([meData, dashData]) => {
      if (meData) {
        setProfile(meData);
        if (meData.role) {
          setSelectedRole(meData.role);
          localStorage.setItem("preferred_role", meData.role);
        }
        localStorage.setItem("dash_profile", JSON.stringify(meData));
      }
      if (dashData && !dashData.error) {
        // Map postgres history to Recharts format
        // FIX: Recharts groups points if dataKey is identical. Use a unique string (fullDate) to prevent merging.
        const history = dashData.eloHistory.map((h: any, i: number) => {
          const d = new Date(h.played_at);
          return {
            label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fullDate: d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) + `-${i}`, // Guaranteed unique
            elo: h.elo
          };
        });
        
        // If they have no history, set a flat line of their current ELO
        if (history.length === 0 && meData) {
          history.push({ label: "Start", fullDate: "Start", elo: meData.elo });
          history.push({ label: "Today", fullDate: "Today", elo: meData.elo });
        }
        
        setEloHistory(history);
        localStorage.setItem("dash_eloHistory", JSON.stringify(history));

        setActivityData(dashData.activityMap || {});
        localStorage.setItem("dash_activityData", JSON.stringify(dashData.activityMap || {}));

        setRecentMatches(dashData.recentMatches || []);
        localStorage.setItem("dash_recentMatches", JSON.stringify(dashData.recentMatches || []));

        if (dashData.joinedAt) {
          const dateStr = dashData.joinedAt.split('T')[0];
          setJoinedDate(dateStr);
          localStorage.setItem("dash_joinedDate", dateStr);
        }
      } else if (meData) {
        // Fallback if Postgres user record isn't fully synced yet
        const history = [
          { label: "Start", fullDate: "Start", elo: meData.elo },
          { label: "Today", fullDate: "Today", elo: meData.elo }
        ];
        setEloHistory(history);
        localStorage.setItem("dash_eloHistory", JSON.stringify(history));
      }
      setIsLoaded(true);
    })
    .catch(() => setIsLoaded(true));
  }, [status]);



  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(255,255,255,0.08)", borderTop: "2px solid #8b8eff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (status === "unauthenticated") {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#e8e6f0", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Navigation */}
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: "15px" }}>
              Codeduel
            </Link>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "100px", background: "rgba(139,142,255,0.12)", color: "#8b8eff", border: "1px solid rgba(139,142,255,0.25)", fontFamily: "'JetBrains Mono', monospace" }}>
              1v1 Ranked Arena
            </span>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "13px" }}>
            <Link href="/practice" style={{ color: "#8a8898", textDecoration: "none" }}>Practice Solo</Link>
            <Link href="/campus" style={{ color: "#8a8898", textDecoration: "none" }}>For Colleges</Link>
            <Link href="/pricing" style={{ color: "#8a8898", textDecoration: "none" }}>Pricing</Link>
            <button
              onClick={() => signIn("github")}
              style={{
                background: "#8b8eff",
                color: "#000",
                fontWeight: 700,
                fontSize: "12px",
                padding: "7px 16px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Sign In
            </button>
          </div>
        </header>

        {/* Hero Card */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ maxWidth: "540px", width: "100%", background: "#0a0a10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "36px 32px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(139,142,255,0.12)", border: "1px solid rgba(139,142,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", margin: "0 auto 20px" }}>
              ⚔️
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "10px", color: "#fff" }}>
              Enter the Codeduel Platform
            </h1>
            <p style={{ fontSize: "13.5px", color: "#8a8898", lineHeight: 1.5, marginBottom: "20px" }}>
              Choose your role to customize your workspace, course assignments, and matchmaking.
            </p>

            {/* Persona Selector for Sign-in */}
            <div style={{ marginBottom: "20px", textAlign: "left" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#8b8eff", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", fontFamily: "'JetBrains Mono', monospace" }}>
                1. Select Workspace Mode:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {[
                  { id: "STUDENT", label: "Student", icon: "🎓", desc: "Course Labs" },
                  { id: "FACULTY", label: "Faculty", icon: "🏛️", desc: "Cohort Hub" },
                  { id: "INDIVIDUAL", label: "Individual", icon: "💻", desc: "Ranked Arena" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(opt.id as any);
                      localStorage.setItem("preferred_role", opt.id);
                    }}
                    style={{
                      background: selectedRole === opt.id ? "rgba(139,142,255,0.18)" : "rgba(255,255,255,0.03)",
                      border: selectedRole === opt.id ? "1px solid #8b8eff" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      padding: "10px 6px",
                      color: selectedRole === opt.id ? "#fff" : "#8a8898",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "18px", marginBottom: "3px" }}>{opt.icon}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "2px" }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => {
                  localStorage.setItem("preferred_role", selectedRole);
                  signIn("github");
                }}
                style={{
                  background: "#8b8eff",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "14px",
                  padding: "12px 20px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Sign In as {selectedRole === "STUDENT" ? "College Student" : selectedRole === "FACULTY" ? "Faculty / Instructor" : "Individual Dev"} ⚡
              </button>
              <Link
                href="/practice"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e8e6f0",
                  fontWeight: 600,
                  fontSize: "13px",
                  padding: "11px 20px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                Practice Solo Without Account →
              </Link>
            </div>
            {/* Features preview */}
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", textAlign: "left" }}>
              <div style={{ fontSize: "12px", color: "#8a8898", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⚡</span> 12 Production Incidents
              </div>
              <div style={{ fontSize: "12px", color: "#8a8898", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🎯</span> ECE &amp; Cloud SWE Tracks
              </div>
              <div style={{ fontSize: "12px", color: "#8a8898", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📈</span> Calibrated ELO Rating
              </div>
              <div style={{ fontSize: "12px", color: "#8a8898", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🤖</span> Gemini Socratic AI Coach
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const elo = profile?.elo ?? 1200;
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg:     #000;
          --bg2:    #060608;
          --bg3:    #0d0d14;
          --border: rgba(255,255,255,0.06);
          --border2:rgba(255,255,255,0.10);
          --indigo: #8b8eff;
          --text:   #e8e6f0;
          --muted:  #4a4860;
          --muted2: #8a8898;
          --green:  #4ade80;
          --red:    #f87171;
          --gold:   #fbbf24;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          background-image: radial-gradient(rgba(255,255,255,0.018) 1px, transparent 1px);
          background-size: 26px 26px;
        }

        /* ── NAV ── */
        .db-nav {
          position: sticky; top: 0; z-index: 50;
          height: 52px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .db-brand { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; }
        .db-nav-links { display: flex; gap: 4px; }
        .db-nav-link {
          font-size: 13px; color: var(--muted2); padding: 6px 12px; border-radius: 6px;
          text-decoration: none; transition: color .15s, background .15s;
        }
        .db-nav-link:hover { color: var(--text); background: rgba(255,255,255,0.04); }
        .db-nav-link.active { color: var(--text); font-weight: 600; }
        .db-nav-right { display: flex; align-items: center; gap: 10px; }

        /* Find Match button states */
        .find-btn {
          font-size: 13px; font-weight: 700;
          padding: 8px 18px; border-radius: 7px; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 7px;
          transition: opacity .15s, transform .1s;
        }
        .find-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .find-btn:active { transform: scale(0.97) translateY(0); }
        .find-btn-idle    { background: var(--text); color: #000; }
        .find-btn-queued  { background: rgba(139,142,255,0.12); color: var(--indigo); border: 1px solid rgba(139,142,255,0.25); }
        .find-btn-cancel  {
          background: none; border: 1px solid var(--border2); color: var(--muted2);
          font-size: 12px; font-weight: 500; padding: 6px 12px;
        }
        .find-btn-cancel:hover { color: var(--red); border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.04); }

        .avatar-btn {
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(139,142,255,0.12); border: 1px solid rgba(139,142,255,0.2);
          overflow: hidden; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: var(--indigo);
          font-family: 'JetBrains Mono', monospace;
        }

        /* ── LAYOUT ── */
        .db-main { max-width: 960px; margin: 0 auto; padding: 40px 24px 80px; }

        /* ── HEADER ROW ── */
        .db-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 32px; flex-wrap: wrap; gap: 16px;
        }
        .db-welcome { font-size: clamp(22px, 3vw, 28px); font-weight: 700; letter-spacing: -0.03em; }
        .db-sub { font-size: 13px; color: var(--muted2); margin-top: 4px; }
        .elo-pill {
          display: flex; align-items: center; gap: 10px;
          background: var(--bg3); border: 1px solid rgba(139,142,255,0.2);
          border-radius: 10px; padding: 10px 18px;
          box-shadow: 0 0 20px rgba(139,142,255,0.05);
        }
        .elo-label {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          color: var(--indigo); letter-spacing: 0.12em; text-transform: uppercase;
        }
        .elo-val { font-size: 26px; font-weight: 800; letter-spacing: -0.04em; }

        /* ── CARD ── */
        .card {
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: 10px; overflow: hidden;
          margin-bottom: 12px;
        }
        .card-hdr {
          padding: 16px 20px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(0,0,0,0.2);
        }
        .card-title { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
        .card-body { padding: 20px; }

        /* ── CHART ── */
        .chart-period {
          font-size: 10.5px; font-family: 'JetBrains Mono', monospace;
          color: var(--muted2); background: rgba(255,255,255,0.04);
          border: 1px solid var(--border2); border-radius: 5px;
          padding: 3px 9px; cursor: default;
        }

        /* ── STATS ROW ── */
        .stats-row {
          display: grid; grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid var(--border);
        }
        @media(max-width:640px){ .stats-row { grid-template-columns: repeat(2,1fr); } }
        .stat-cell {
          padding: 18px 20px;
          border-right: 1px solid var(--border);
          text-align: center;
        }
        .stat-cell:last-child { border-right: none; }
        .stat-label {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.09em; text-transform: uppercase;
          color: var(--muted2); margin-bottom: 8px;
        }
        .stat-val {
          font-size: 22px; font-weight: 800; letter-spacing: -0.03em;
        }

        /* ── RECENT MATCHES ── */
        .match-table { width: 100%; border-collapse: collapse; }
        .match-table th {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.09em; text-transform: uppercase;
          color: var(--muted); padding: 10px 16px;
          border-bottom: 1px solid var(--border); text-align: left;
          background: rgba(0,0,0,0.12);
        }
        .match-table td { padding: 13px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .match-table tr:last-child td { border-bottom: none; }
        .match-table tr:hover td { background: rgba(255,255,255,0.015); }
        .opp-name { font-weight: 500; }
        .vs-text { font-size: 11px; color: var(--muted); font-family: 'JetBrains Mono', monospace; margin-right: 4px; }
        .result-win  { color: var(--green); font-weight: 700; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
        .result-loss { color: var(--red);   font-weight: 700; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
        .elo-pos { color: var(--green); font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-weight: 600; }
        .elo-neg { color: var(--red);   font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-weight: 600; }
        .time-cell { color: var(--muted2); font-size: 12px; font-family: 'JetBrains Mono', monospace; }

        /* ── PROBLEMS ── */
        .problems-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 16px 20px; }
        @media(max-width:640px){ .problems-grid { grid-template-columns: 1fr; } }
        .prob-card {
          padding: 16px; border-radius: 8px;
          border: 1px solid var(--border2);
          background: rgba(255,255,255,0.02);
          transition: border-color .2s, background .2s;
          cursor: pointer;
        }
        .prob-card:hover { border-color: rgba(139,142,255,0.25); background: rgba(139,142,255,0.03); }
        .prob-diff {
          font-size: 9.5px; font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.1em; text-transform: uppercase;
          font-weight: 700; margin-bottom: 8px;
        }
        .prob-name { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 10px; }
        .prob-action {
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          color: var(--indigo); background: rgba(139,142,255,0.06);
          border: 1px solid rgba(139,142,255,0.15);
          padding: 4px 10px; border-radius: 4px; display: inline-block;
          transition: background .15s;
        }
        .prob-card:hover .prob-action { background: rgba(139,142,255,0.12); }

        /* ── QUEUED OVERLAY ── */
        .queue-banner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px; border-radius: 8px; margin-bottom: 20px;
          background: rgba(139,142,255,0.06); border: 1px solid rgba(139,142,255,0.2);
          animation: pulse-border 2.5s ease-in-out infinite;
        }
        @keyframes pulse-border {
          0%,100%{ border-color: rgba(139,142,255,0.2); }
          50%{ border-color: rgba(139,142,255,0.5); }
        }
        .queue-text {
          font-size: 13px; color: var(--indigo); font-weight: 600;
          display: flex; align-items: center; gap: 10px;
        }
        .queue-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(139,142,255,0.2);
          border-top-color: var(--indigo);
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .skeleton {
          animation: shimmer 2s infinite linear;
          background: linear-gradient(to right, rgba(255,255,255,0.05) 4%, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.05) 36%);
          background-size: 1000px 100%;
          border-radius: 4px;
        }

        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical   line { stroke: rgba(255,255,255,0.05) !important; }
        .recharts-xAxis .recharts-text,
        .recharts-yAxis .recharts-text { fill: rgba(255,255,255,0.3) !important; font-size: 11px !important; }
      `}</style>

      {/* NAVBAR */}
      <AppNavbar
        activePage="dashboard"
        onFindMatch={() => {
          setShowMatchModal(true);
          setSelectedProblem(null);
        }}
        matchState={matchState}
        onCancelMatch={handleCancel}
      />

      {/* MATCH MODAL */}
      {showMatchModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "var(--bg3)", border: "1px solid var(--border2)",
            borderRadius: 14, padding: "26px 26px", width: "100%", maxWidth: 490,
            boxShadow: "0 24px 50px rgba(0,0,0,0.6)"
          }}>
            <h2 style={{ fontSize: 20, marginBottom: 6, fontWeight: 700 }}>
              {selectedProblem ? `Practice: ${selectedProblem.title}` : "1v1 Matchmaking & Track Selection"}
            </h2>
            <p style={{ color: "var(--muted2)", fontSize: 13, marginBottom: 16, lineHeight: 1.4 }}>
              Race 1v1 against opponents to diagnose tickets, patch multi-file codebases, and pass unit tests under pressure.
            </p>

            {/* ELO BRACKET & DIFFICULTY — AUTOMATICALLY DECIDED BASED ON ELO */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Difficulty & ELO Bracket:
                </span>
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 700, 
                  color: "#8b8eff", 
                  background: "rgba(139,142,255,0.12)", 
                  border: "1px solid rgba(139,142,255,0.25)",
                  padding: "2px 8px", 
                  borderRadius: 100,
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <span>🔒</span> AUTO-DECIDED BY ELO
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
                {[
                  {
                    id: "bracket-1" as const,
                    name: "Bracket I — Junior / Intern",
                    range: "800–1099 ELO",
                    difficulty: "Beginner",
                    desc: "Ring buffers & token refresh",
                    isActive: activeBracketId === "bracket-1",
                    badge: activeBracketId === "bracket-1" ? "ACTIVE TIER" : "✓ PASSED",
                  },
                  {
                    id: "bracket-2" as const,
                    name: "Bracket II — Systems Engineer",
                    range: "1100–1399 ELO",
                    difficulty: "Intermediate",
                    desc: "SPI endianness & token bucket limiters",
                    isActive: activeBracketId === "bracket-2",
                    badge: activeBracketId === "bracket-2" ? "ACTIVE TIER" : userElo < 1100 ? "REQ 1100+ ELO" : "✓ PASSED",
                  },
                  {
                    id: "bracket-3" as const,
                    name: "Bracket III — Staff / Principal Triage",
                    range: "1400+ ELO",
                    difficulty: "Advanced",
                    desc: "ARM alignment & deadlock graph retries",
                    isActive: activeBracketId === "bracket-3",
                    badge: activeBracketId === "bracket-3" ? "ACTIVE TIER" : "REQ 1400+ ELO",
                  },
                ].map((b) => (
                  <div
                    key={b.id}
                    style={{
                      background: b.isActive ? "linear-gradient(135deg, rgba(139,142,255,0.18) 0%, rgba(139,142,255,0.06) 100%)" : "rgba(255,255,255,0.02)",
                      border: b.isActive ? "1px solid #8b8eff" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      opacity: b.isActive ? 1 : 0.45,
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: b.isActive ? "#fff" : "var(--muted)", whiteSpace: "nowrap" }}>
                        {b.name}
                      </span>
                      <span style={{ 
                        fontSize: 9.5, 
                        color: b.isActive ? "#8b8eff" : "var(--muted2)", 
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        whiteSpace: "nowrap",
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: b.isActive ? "rgba(139,142,255,0.15)" : "transparent",
                        border: b.isActive ? "1px solid rgba(139,142,255,0.3)" : "none",
                        flexShrink: 0,
                      }}>
                        {b.badge}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--muted2)" }}>
                        {b.range} {b.isActive ? `· Current: ${userElo} ELO` : ""}
                      </span>
                      <span style={{ 
                        fontSize: 9.5, 
                        padding: "1px 6px", 
                        borderRadius: 4, 
                        background: b.isActive ? "rgba(139,142,255,0.25)" : "rgba(255,255,255,0.05)", 
                        color: b.isActive ? "#c4b5fd" : "var(--muted2)", 
                        fontWeight: 600, 
                        whiteSpace: "nowrap" 
                      }}>
                        {b.difficulty}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10.5, color: "var(--muted2)", marginTop: 8, lineHeight: 1.35, display: "flex", alignItems: "center", gap: 5 }}>
                <span>ℹ️</span> Difficulty is locked to your rating ({userElo} ELO) to prevent smurfing and ensure fair matchmaking.
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Option 1: Cloud SWE Track */}
              <button 
                onClick={() => { 
                  setShowMatchModal(false); 
                  handleFindMatch({ track: 'PRODUCTION_SWE', challengeId: selectedProblem?.id }); 
                  setSelectedProblem(null); 
                }}
                style={{
                  background: "rgba(139,142,255,0.12)", color: "#fff", border: "1px solid rgba(139,142,255,0.3)",
                  padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 18 }}>🌩️</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, color: "var(--indigo)" }}>Queue Track: Cloud SWE</div>
                    <div style={{ fontSize: 11, color: "var(--muted2)" }}>TypeScript / Node · Race conditions, rate limiters</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--indigo)", fontFamily: "'JetBrains Mono', monospace" }}>Play →</span>
              </button>

              {/* Option 2: Embedded Systems Track */}
              <button 
                onClick={() => { 
                  setShowMatchModal(false); 
                  handleFindMatch({ track: 'EMBEDDED_SYSTEMS', challengeId: selectedProblem?.id }); 
                  setSelectedProblem(null); 
                }}
                style={{
                  background: "rgba(251,191,36,0.1)", color: "#fff", border: "1px solid rgba(251,191,36,0.3)",
                  padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, color: "#fbbf24" }}>Queue Track: Embedded Systems</div>
                    <div style={{ fontSize: 11, color: "var(--muted2)" }}>C/C++ · UART ring buffers, ISR wrap-around</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace" }}>Play →</span>
              </button>

              {/* Option 3: Instant Demo / Sentinel AI */}
              <button 
                onClick={() => { 
                  setShowMatchModal(false); 
                  handleFindMatch({ demo: true, challengeId: selectedProblem?.id, track: selectedProblem?.track as any }); 
                  setSelectedProblem(null); 
                }}
                style={{
                  background: "rgba(74,222,128,0.1)", color: "#fff", border: "1px solid rgba(74,222,128,0.3)",
                  padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 18 }}>🤖</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, color: "var(--green)" }}>Instant Match vs CodeSentinel AI</div>
                    <div style={{ fontSize: 11, color: "var(--muted2)" }}>Simulates opponent passing tests over 40s (Demo Safe)</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--green)", fontFamily: "'JetBrains Mono', monospace" }}>Instant →</span>
              </button>

              {/* Option 4: Friend Challenge */}
              <button 
                onClick={() => { 
                  setShowMatchModal(false); 
                  const url = selectedProblem ? `/friends?challengeId=${selectedProblem.id}` : "/friends";
                  router.push(url); 
                  setSelectedProblem(null);
                }}
                style={{
                  background: "rgba(255,255,255,0.04)", color: "var(--text)", border: "1px solid var(--border)",
                  padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  transition: "background 0.2s"
                }}
              >
                <span style={{ fontSize: 14 }}>👥</span>
                Challenge a Friend Directly
              </button>
            </div>

            <button 
              onClick={() => { setShowMatchModal(false); setSelectedProblem(null); }}
              style={{
                width: "100%", background: "transparent", border: "none", color: "var(--muted2)",
                marginTop: 16, cursor: "pointer", fontSize: 12, padding: 6
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <main className="db-main">

        {/* Searching banner with 10s Bot Fallback info */}
        {matchState === "queued" && (
          <div className="queue-banner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="queue-text">
              <span className="queue-spinner" />
              <span>
                Searching for opponent near your ELO ({elo})... 
                <strong style={{ marginLeft: 6, color: "#fff" }}>{queueDuration}s elapsed</strong>
                <span style={{ fontSize: 11, color: "var(--muted2)", marginLeft: 8 }}>
                  (Auto-fallback to Mock Bot in {Math.max(0, 10 - queueDuration)}s)
                </span>
              </span>
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => handleFindMatch({ demo: true })}
                style={{
                  background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)",
                  color: "var(--green)", padding: "5px 10px", borderRadius: 4, fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", fontWeight: 600
                }}
              >
                ⚡ Match Bot Now
              </button>
              <button className="find-btn find-btn-cancel" onClick={handleCancel} style={{ padding: "5px 12px", fontSize: 11 }}>
                Cancel
              </button>
            </div>
          </div>
        )}


        {/* Header */}
        <div className="db-header">
          <div>
            {!isLoaded ? (
              <>
                <div className="skeleton" style={{ width: 250, height: 28, marginBottom: 8, borderRadius: 6 }}></div>
                <div className="skeleton" style={{ width: 180, height: 16, borderRadius: 4 }}></div>
              </>
            ) : (
              <>
                <h1 className="db-welcome">Welcome back, {profile?.username ?? session?.user?.name ?? "developer"}</h1>
                <p className="db-sub">Your coding arena is ready.</p>
              </>
            )}
          </div>
          <div className="elo-pill">
            <span className="elo-label">ELO</span>
            {!isLoaded ? <div className="skeleton" style={{ width: 40, height: 24 }}></div> : <span className="elo-val">{elo}</span>}
          </div>
        </div>

        {/* Role-tailored action banner */}
        {selectedRole === "ADMIN" ? (
          <div style={{
            background: "linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(225,29,72,0.04) 100%)",
            border: "1px solid rgba(244,63,94,0.35)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            boxShadow: "0 0 24px rgba(244,63,94,0.08)",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>⚡</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>
                  Platform Administrator / Root Mode Active
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#e8e6f0", fontWeight: 600 }}>
                Root operator privileges active: monitor database cluster telemetry, inspect all cohorts, or test features from any persona.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href="/admin/metrics"
                style={{
                  background: "linear-gradient(135deg, #f43f5e, #e11d48)",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 0 12px rgba(244,63,94,0.3)",
                }}
              >
                <span>📊</span> Live Telemetry &amp; Metrics →
              </Link>
              <Link
                href="/campus"
                style={{
                  background: "rgba(56,189,248,0.15)",
                  border: "1px solid rgba(56,189,248,0.35)",
                  color: "#38bdf8",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>🏛️</span> Global Campus Hub
              </Link>
              <Link
                href="/practice"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>⚡</span> Solo Practice
              </Link>
            </div>
          </div>
        ) : selectedRole === "STUDENT" ? (
          <div style={{
            background: "linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(139,142,255,0.05) 100%)",
            border: "1px solid rgba(74,222,128,0.25)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>🎓</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>
                  College Student Mode Active
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#e8e6f0", fontWeight: 600 }}>
                Practice dedicated solo bug triage tickets, enter peer duels, or submit university labs.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href="/practice"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>⚡</span> Solo Practice
              </Link>
              <button
                onClick={() => { setShowMatchModal(true); setSelectedProblem(null); }}
                style={{
                  background: "#8b8eff",
                  border: "none",
                  color: "#000",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 7,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>⚔️</span> 1v1 Peer Duel
              </button>
              <Link
                href="/campus"
                style={{
                  background: "rgba(74,222,128,0.15)",
                  border: "1px solid rgba(74,222,128,0.35)",
                  color: "#4ade80",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>🏫</span> Campus Cohorts & Labs →
              </Link>
            </div>
          </div>
        ) : selectedRole === "FACULTY" ? (
          <div style={{
            background: "linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(139,142,255,0.05) 100%)",
            border: "1px solid rgba(56,189,248,0.25)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>🏛️</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>
                  Faculty &amp; Instructor Command Center
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#e8e6f0", fontWeight: 600 }}>
                Manage student cohorts, schedule incident lab assignments, and export autograded gradebooks.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href="/campus"
                style={{
                  background: "#38bdf8",
                  border: "none",
                  color: "#000",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>🏛️</span> Open Campus Command Center →
              </Link>
              <Link
                href="/practice"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>📋</span> Problem Sandbox
              </Link>
            </div>
          </div>
        ) : (
          <div style={{
            background: "linear-gradient(135deg, rgba(139,142,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid rgba(139,142,255,0.2)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>💻</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#8b8eff", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>
                  Individual Developer Arena
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#e8e6f0", fontWeight: 600 }}>
                Ranked 1v1 matchmaking with calibrated ELO brackets, solo incident practice, and friends.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href="/practice"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>⚡</span> Solo Practice
              </Link>
              <button
                onClick={() => { setShowMatchModal(true); setSelectedProblem(null); }}
                style={{
                  background: "#8b8eff",
                  border: "none",
                  color: "#000",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 7,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>⚔️</span> Find Match
              </button>
              <Link
                href="/leaderboard"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>🏆</span> Leaderboard
              </Link>
            </div>
          </div>
        )}

        {/* ELO History Chart */}
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">ELO History</span>
            <span className="chart-period">Last 12 months</span>
          </div>
          <div style={{ padding: "16px 12px 4px", position: "relative" }}>
            {!isLoaded && <div className="skeleton" style={{ position: "absolute", top: 16, left: 12, right: 12, bottom: 4, zIndex: 10, borderRadius: 8 }}></div>}
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={eloHistory} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fullDate" tickFormatter={(val) => val.split(',')[0]} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} width={36} domain={["auto","auto"]} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone" dataKey="elo"
                  stroke="#8b8eff" strokeWidth={2}
                  dot={{ fill: "#8b8eff", r: 3, strokeWidth: 0 }}
                  activeDot={{ fill: "#8b8eff", r: 5, strokeWidth: 0, stroke: "rgba(139,142,255,0.3)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Row */}
          <div className="stats-row">
            <div className="stat-cell">
              <div className="stat-label">Win Rate</div>
              <div className="stat-val" style={{ color: winRate > 50 ? "var(--green)" : winRate > 0 ? "var(--gold)" : "var(--muted2)" }}>
                {!isLoaded ? <div className="skeleton" style={{ width: 60, height: 24 }}></div> : `${winRate}%`}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Current Streak</div>
              <div className="stat-val" style={{ color: "var(--indigo)" }}>
                {!isLoaded ? <div className="skeleton" style={{ width: 80, height: 24 }}></div> : (wins > 0 ? `${wins} Wins` : "0 Wins")}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Total Matches</div>
              <div className="stat-val">
                {!isLoaded ? <div className="skeleton" style={{ width: 40, height: 24 }}></div> : total}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Avg. Duel Time</div>
              <div className="stat-val" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 20 }}>
                {!isLoaded ? <div className="skeleton" style={{ width: 70, height: 24 }}></div> : "12:45"}
              </div>
            </div>
          </div>
        </div>

        {/* Activity Calendar */}
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">Your Duel Activity</span>
            <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--muted2)" }}>
              {!isLoaded ? <div className="skeleton" style={{ width: 100, height: 14, display: "inline-block" }}></div> : `${Object.values(activityData).filter(v => v > 0).length} active days`}
            </span>
          </div>
          <div className="card-body" style={{ position: "relative" }}>
            {!isLoaded && <div className="skeleton" style={{ position: "absolute", inset: 0, zIndex: 10, borderRadius: 8 }}></div>}
            <ActivityCalendar data={activityData} joinedDate={joinedDate} />
          </div>
        </div>

        {/* Recent Matches */}
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">Recent Matches</span>
            <Link href="/leaderboard" style={{ fontSize: 12, color: "var(--indigo)", textDecoration: "none", fontFamily: "JetBrains Mono, monospace" }}>
              View All →
            </Link>
          </div>
          <table className="match-table">
            <thead>
              <tr>
                <th>Opponent</th>
                <th>Problem</th>
                <th>Result</th>
                <th>ELO Change</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {!isLoaded ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i}>
                    <td><div className="skeleton" style={{ width: "100%", height: 16 }}></div></td>
                    <td><div className="skeleton" style={{ width: "100%", height: 16 }}></div></td>
                    <td><div className="skeleton" style={{ width: "100%", height: 16 }}></div></td>
                    <td><div className="skeleton" style={{ width: "100%", height: 16 }}></div></td>
                    <td><div className="skeleton" style={{ width: "100%", height: 16 }}></div></td>
                  </tr>
                ))
              ) : recentMatches.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--muted2)", padding: "20px" }}>
                    No matches played yet.
                  </td>
                </tr>
              ) : (
                recentMatches.map((m, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span>
                          <span className="vs-text">vs.</span>
                        </span>
                        {m.opponentAvatar ? (
                          <img src={m.opponentAvatar} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }} />
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", color: "var(--muted2)" }}>
                            {m.opponent?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        <span>
                          <span className="opp-name">{m.opponent}</span>
                        </span>
                      </div>
                    </td>
                    <td style={{ color: "var(--muted2)" }}>{m.problem}</td>
                    <td>
                      <span className={m.result === "Win" ? "result-win" : "result-loss"}>{m.result}</span>
                    </td>
                    <td>
                      <span className={m.elo.startsWith("+") ? "elo-pos" : "elo-neg"}>{m.elo} ELO</span>
                    </td>
                    <td className="time-cell">{new Date(m.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Production Engineering Challenges */}
        <div className="card">
          <div className="card-hdr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="card-title">Production Engineering Battleground</span>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--muted2)", marginTop: 2 }}>
                10 Real-world incidents · Multi-file bug triage & automated test verification
              </div>
            </div>

            {/* Track Filter Pills */}
            <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
              {[
                { id: "ALL", label: `All (${PROBLEMS.length})` },
                { id: "PRODUCTION_SWE", label: `Cloud SWE (${PROBLEMS.filter(p => p.track === "PRODUCTION_SWE").length})` },
                { id: "EMBEDDED_SYSTEMS", label: `Embedded (${PROBLEMS.filter(p => p.track === "EMBEDDED_SYSTEMS").length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setProblemTrackFilter(f.id as any)}
                  style={{
                    background: problemTrackFilter === f.id ? "rgba(139,142,255,0.2)" : "transparent",
                    color: problemTrackFilter === f.id ? "#fff" : "var(--muted2)",
                    border: problemTrackFilter === f.id ? "1px solid rgba(139,142,255,0.4)" : "1px solid transparent",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="problems-grid">
            {PROBLEMS.filter(p => problemTrackFilter === "ALL" || p.track === problemTrackFilter).map((p: any, i: number) => (
              <div className="prob-card" key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div className="prob-diff" style={{ color: DIFF_COLORS[p.diff], margin: 0 }}>
                    {p.diff}
                  </div>
                  <span style={{
                    fontSize: 9.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: p.track === "PRODUCTION_SWE" ? "rgba(139,142,255,0.15)" : "rgba(251,191,36,0.15)",
                    color: p.track === "PRODUCTION_SWE" ? "var(--indigo)" : "#fbbf24",
                    border: `1px solid ${p.track === "PRODUCTION_SWE" ? "rgba(139,142,255,0.3)" : "rgba(251,191,36,0.3)"}`
                  }}>
                    {p.track === "PRODUCTION_SWE" ? "Cloud SWE" : "Embedded"} · {p.lang}
                  </span>
                </div>
                <div className="prob-name" style={{ marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted2)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>
                  repo: {p.repo}
                </div>
                <button 
                  className="prob-action" 
                  onClick={() => { setSelectedProblem({ id: p.id, title: p.title, track: p.track }); setShowMatchModal(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  Inspect & Duel →
                </button>
              </div>
            ))}
          </div>
        </div>


      </main>
    </>
  );
}
