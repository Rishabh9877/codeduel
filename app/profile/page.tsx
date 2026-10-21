"use client";

import Link from "next/link";
import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import RoleBadgeSwitcher from "@/components/RoleBadgeSwitcher";
import AppNavbar from "@/components/AppNavbar";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface ProfileData {
  username: string; avatar: string | null; githubUrl: string;
  elo: number; peakElo: number; globalRank: number | null;
  wins: number; losses: number; totalMatches: number; winRate: number;
  joinedAt: string | null;
  skillsPracticed?: string[];
  streak?: number;
  lastDailyCompleted?: string | null;
  isPublic?: boolean;
  showMatchHistory?: boolean;
  eloHistory: { label: string; elo: number }[];
  recentMatches: { matchId: string; problem: string; opponent: string; opponentAvatar: string | null; result: "WIN" | "LOSS"; eloChange: string; playedAt: string }[];
  activityMap: Record<string, number>;
  subscriptionTier?: "FREE" | "PRO" | "CAMPUS";
  isPro?: boolean;
  isCampus?: boolean;
}

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

// ── Activity Calendar ───────────────────────────────────────────────────────
function ActivityCalendar({ data }: { data: Record<string, number> }) {
  const weeks = useMemo(() => {
    const today = new Date();
    const days: { date: string; count: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const k = d.toISOString().split("T")[0];
      days.push({ date: k, count: data[k] ?? 0 });
    }
    const pad = new Date(days[0].date).getDay();
    const cells: ({ date: string; count: number } | null)[] = [...Array(pad).fill(null), ...days];
    const grid: (typeof cells[0])[][] = [];
    for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));
    return grid;
  }, [data]);

  const color = (n: number) => {
    if (n === 0) return "rgba(255,255,255,0.05)";
    if (n <= 1) return "rgba(139,142,255,0.25)";
    if (n <= 3) return "rgba(139,142,255,0.5)";
    if (n <= 5) return "rgba(139,142,255,0.7)";
    return "rgba(139,142,255,0.95)";
  };

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {week.map((day, di) => (
              <div key={di} title={day ? `${day.date}: ${day.count} duels` : ""} style={{
                width: 11, height: 11, borderRadius: 2,
                background: day ? color(day.count) : "transparent",
                cursor: day ? "default" : "default",
              }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trophy logic ────────────────────────────────────────────────────────────
function computeTrophies(wins: number, elo: number, totalMatches: number) {
  const all = [
    { id: "first_patch",     name: "First PR Merged",        desc: "Win your first production duel",            icon: "🚀",  earned: wins >= 1 },
    { id: "oss_maintainer",  name: "OSS Maintainer",         desc: "Win 10 production duels",                   icon: "🌐",  earned: wins >= 10 },
    { id: "firmware_wizard", name: "Silicon Sorcerer",       desc: "Win 50 contest battles",                    icon: "⚡",  earned: wins >= 50 },
    { id: "staff_eng",       name: "Staff Engineer",         desc: "Reach 1400 ELO",                             icon: "💎",  earned: elo >= 1400 },
    { id: "principal_eng",   name: "Principal Architect",    desc: "Reach 1800 ELO",                             icon: "👑",  earned: elo >= 1800 },
    { id: "fellow_eng",      name: "Distinguished Fellow",   desc: "Reach 2200 ELO",                             icon: "🏆",  earned: elo >= 2200 },
    { id: "oncall_hero",     name: "On-Call Hero",           desc: "Triage 25 production incidents",             icon: "🎯",  earned: totalMatches >= 25 },
    { id: "zero_downtime",   name: "Zero Downtime Legend",   desc: "Play 100 contest duels",                     icon: "💯",  earned: totalMatches >= 100 },
  ];
  return all;
}

// ── Rank label ──────────────────────────────────────────────────────────────
function eloRank(elo: number) {
  if (elo >= 1800) return { label: "MASTER",      color: "#f43f5e" };
  if (elo >= 1600) return { label: "DIAMOND",     color: "#a855f7" };
  if (elo >= 1400) return { label: "PLATINUM",    color: "#38bdf8" };
  if (elo >= 1200) return { label: "GOLD",        color: "#fbbf24" };
  if (elo >= 1000) return { label: "SILVER",      color: "#94a3b8" };
  return               { label: "BRONZE",      color: "#cd7f32" };
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { matchState, handleCancel } = useMatchmaking();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [showMatchHistory, setShowMatchHistory] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/profile").then(r => r.json()).then(d => {
      if (!d.error) {
        setProfile(d);
        setIsPublic(d.isPublic !== false);
        setShowMatchHistory(d.showMatchHistory !== false);
      }
    }).finally(() => setLoading(false));
  }, [status]);

  const handleUpdateSettings = async (newPublic: boolean, newShowHistory: boolean) => {
    setIsPublic(newPublic);
    setShowMatchHistory(newShowHistory);
    setSavingSettings(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newPublic, showMatchHistory: newShowHistory }),
      });
      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } catch (e) {
      console.error("Failed to update settings", e);
    } finally {
      setSavingSettings(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && loading)) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0c0e", color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: 14 }}>
      Loading profile…
    </div>
  );

  if (status === "unauthenticated") {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0c0e", color: "#f5f3ec", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <header style={{ height: 56, borderBottom: "1px solid #2a2c30", background: "#0b0c0e", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: "15px" }}>
              Codeduel
            </Link>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "100px", background: "rgba(139,142,255,0.12)", color: "#8b8eff", border: "1px solid rgba(139,142,255,0.25)", fontFamily: "'JetBrains Mono', monospace" }}>
              Profile
            </span>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "13px" }}>
            <Link href="/practice" style={{ color: "#8a8c82", textDecoration: "none" }}>Practice Solo</Link>
            <Link href="/leaderboard" style={{ color: "#8a8c82", textDecoration: "none" }}>Leaderboard</Link>
            <Link href="/pricing" style={{ color: "#8a8c82", textDecoration: "none" }}>Pricing</Link>
          </div>
        </header>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ maxWidth: "520px", width: "100%", background: "#111317", border: "1px solid #2a2c30", borderRadius: "16px", padding: "36px 32px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(139,142,255,0.12)", border: "1px solid rgba(139,142,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", margin: "0 auto 20px" }}>
              👤
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "10px", color: "#fff" }}>
              Your Developer Profile
            </h1>
            <p style={{ fontSize: "14px", color: "#8a8c82", lineHeight: 1.6, marginBottom: "28px" }}>
              Sign in with GitHub to view your calibrated ELO rating, duel match history, earned trophy badges, and public portfolio share link.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => signIn("github")}
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
                Sign In with GitHub ⚡
              </button>
              <Link
                href="/practice"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#f5f3ec",
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
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const rank = eloRank(profile.elo);
  const trophies = computeTrophies(profile.wins, profile.elo, profile.totalMatches);
  const earnedTrophies = trophies.filter(t => t.earned);
  const lockedTrophies = trophies.filter(t => !t.earned);
  const winRate = profile.winRate;

  const eloChartData = profile.eloHistory.length >= 2
    ? profile.eloHistory
    : [{ label: "Start", fullDate: "Start", elo: 1000 }, { label: "Now", fullDate: "Now", elo: profile.elo }];

  const S: Record<string, React.CSSProperties> = {
    page:      { minHeight: "100vh", background: "#0b0c0e", color: "#f5f3ec", fontFamily: "'JetBrains Mono', monospace" },
    nav:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 56, borderBottom: "1px solid #2a2c30", position: "sticky", top: 0, background: "#0b0c0e", zIndex: 40 },
    brand:     { fontWeight: 700, fontSize: 16, color: "#f5f3ec", textDecoration: "none", letterSpacing: -0.5 },
    navLinks:  { display: "flex", gap: 28 },
    navLink:   { color: "#8a8c82", textDecoration: "none", fontSize: 13, fontWeight: 500 },
    navLinkAct:{ color: "#f5f3ec", textDecoration: "none", fontSize: 13, fontWeight: 600 },
    main:      { maxWidth: 960, margin: "0 auto", padding: "36px 24px 64px" },
    card:      { background: "#111317", border: "1px solid #2a2c30", borderRadius: 12, padding: 24 },
    grid2:     { display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, marginTop: 24 },
    sectionHdr:{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    sectionTtl:{ fontSize: 13, fontWeight: 600, color: "#f5f3ec", letterSpacing: 0.5, textTransform: "uppercase" as const },
    muted:     { color: "#8a8c82", fontSize: 12 },
    sk:        { background: "linear-gradient(90deg,#1e2025 25%,#2a2c30 50%,#1e2025 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 6 },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        a:hover { opacity: 0.8; }
        .trophy-card:hover { border-color: rgba(139,142,255,0.3) !important; transform: translateY(-1px); }
        .match-row:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>

      <div style={S.page}>
        {/* NAV */}
        <AppNavbar
          activePage="profile"
          matchState={matchState}
          onCancelMatch={handleCancel}
        />

        <main style={S.main}>
          {/* PROFILE HEADER */}
          <div style={{ ...S.card, display: "flex", gap: 28, alignItems: "flex-start" }}>
            <div style={{ width: 100, height: 100, borderRadius: 14, overflow: "hidden", border: "2px solid #2a2c30", flexShrink: 0, background: "#1a1c20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 700, color: "#8a8c82" }}>
              {profile.avatar ? <img src={profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : profile.username[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ background: "rgba(139,142,255,0.12)", color: rank.color, border: `1px solid ${rank.color}40`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{rank.label}</span>
                {profile.globalRank && <span style={S.muted}>#{profile.globalRank} globally</span>}
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 2 }}>{profile.username}</h1>
              <p style={{ ...S.muted, marginBottom: 14 }}>@{profile.username.toLowerCase()}</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href={profile.githubUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid #2a2c30", borderRadius: 6, padding: "5px 12px", color: "#f5f3ec", textDecoration: "none", fontSize: 12 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub
                </a>
                <Link href={`/u/${encodeURIComponent(profile.username)}`} target="_blank" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(139,142,255,0.12)", border: "1px solid rgba(139,142,255,0.35)", borderRadius: 6, padding: "5px 12px", color: "#8b8eff", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                  🔗 Public Portfolio (/u/{profile.username})
                </Link>
              </div>
            </div>
          </div>

          {/* STATS ROW */}
          <div style={{ ...S.card, marginTop: 16, display: "flex", alignItems: "center" }}>
            {[
              { label: "ELO",          value: profile.elo.toString() },
              { label: "Peak ELO",     value: profile.peakElo.toString() },
              { label: "Daily Streak", value: `${profile.streak || 0}d 🔥` },
              { label: "Win Rate",     value: `${winRate}%` },
              { label: "Total Duels",  value: profile.totalMatches.toString() },
              { label: "Wins",         value: profile.wins.toString() },
              { label: "Losses",       value: profile.losses.toString() },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ width: 1, height: 40, background: "#2a2c30", marginRight: 20 }} />}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#f5f3ec" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#8a8c82", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* MAIN 2-COL GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, marginTop: 20, alignItems: "start" }}>

            {/* LEFT COL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* ELO CHART */}
              <div style={S.card}>
                <div style={S.sectionHdr}>
                  <span style={S.sectionTtl}>ELO Progression</span>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#8a8c82" }}>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#8b8eff", marginRight: 4 }} />Current: {profile.elo}</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#4a4860", marginRight: 4 }} />Peak: {profile.peakElo}</span>
                  </div>
                </div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={eloChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2025" vertical={false} />
                      <XAxis dataKey="fullDate" tickFormatter={(val) => val ? val.split(',')[0] : ""} axisLine={false} tickLine={false} tick={{ fill: "#4a4860", fontSize: 10, fontFamily: "JetBrains Mono" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#4a4860", fontSize: 10, fontFamily: "JetBrains Mono" }} domain={["dataMin - 100", "dataMax + 100"]} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#7c3aed", strokeWidth: 1, strokeDasharray: "4 4" }} />
                      <Area type="monotone" dataKey="elo" stroke="#8b8eff" strokeWidth={2} fill="url(#eloGrad)" dot={false} activeDot={{ r: 4, fill: "#8b8eff", stroke: "#0b0c0e", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* RECENT MATCHES */}
              <div style={S.card}>
                <div style={S.sectionHdr}>
                  <span style={S.sectionTtl}>Recent Duels</span>
                </div>
                {profile.recentMatches.length === 0 ? (
                  <div style={{ ...S.muted, textAlign: "center", padding: "24px 0" }}>No matches played yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {profile.recentMatches.map(m => (
                      <div key={m.matchId} className="match-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 8, borderLeft: `2px solid ${m.result === "WIN" ? "#4ade80" : "#f87171"}`, background: "rgba(255,255,255,0.01)", transition: "background 0.15s" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f3ec" }}>{m.problem}</div>
                          <div style={{ fontSize: 11, color: "#8a8c82", marginTop: 2 }}>vs @{m.opponent} · {new Date(m.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: m.result === "WIN" ? "#4ade80" : "#f87171" }}>{m.eloChange} ELO</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: m.result === "WIN" ? "#4ade80" : "#f87171", letterSpacing: 1, marginTop: 2 }}>{m.result}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TROPHY CABINET */}
              <div style={S.card}>
                <div style={S.sectionHdr}>
                  <span style={S.sectionTtl}>Trophy Cabinet</span>
                  <span style={S.muted}>{earnedTrophies.length}/{trophies.length} earned</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {trophies.map(t => (
                    <div key={t.id} className="trophy-card" style={{ background: t.earned ? "rgba(139,142,255,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${t.earned ? "rgba(139,142,255,0.2)" : "#1e2025"}`, borderRadius: 10, padding: "14px 10px", textAlign: "center", opacity: t.earned ? 1 : 0.4, transition: "all 0.2s", cursor: "default" }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#f5f3ec", marginBottom: 2 }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: "#8a8c82" }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* SUBSCRIPTION & PRO STATUS CARD */}
              <div
                style={{
                  ...S.card,
                  background: profile.isPro
                    ? "linear-gradient(135deg, rgba(139,142,255,0.12) 0%, rgba(139,142,255,0.03) 100%)"
                    : "#111317",
                  border: profile.isPro
                    ? "1px solid rgba(139,142,255,0.35)"
                    : "1px solid #2a2c30",
                }}
              >
                <div style={S.sectionHdr}>
                  <span style={S.sectionTtl}>Subscription Plan</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: profile.isPro
                        ? "rgba(139,142,255,0.2)"
                        : profile.isCampus
                        ? "rgba(56,189,248,0.2)"
                        : "rgba(255,255,255,0.08)",
                      color: profile.isPro
                        ? "#8b8eff"
                        : profile.isCampus
                        ? "#38bdf8"
                        : "#8a8c82",
                      border: `1px solid ${
                        profile.isPro
                          ? "rgba(139,142,255,0.4)"
                          : profile.isCampus
                          ? "rgba(56,189,248,0.4)"
                          : "rgba(255,255,255,0.15)"
                      }`,
                    }}
                  >
                    {profile.isPro
                      ? "👑 PRO ENGINEER"
                      : profile.isCampus
                      ? "🏛️ CAMPUS LICENSE"
                      : "FREE STUDENT"}
                  </span>
                </div>

                <p style={{ ...S.muted, marginBottom: 14, lineHeight: 1.5 }}>
                  {profile.isPro
                    ? "Active Pro membership with unrestricted AI coaching, priority multi-file compilation, and oscilloscope telemetry."
                    : profile.isCampus
                    ? "Enrolled under university department license with automated lab grading and cohort telemetry."
                    : "Basic free tier. Upgrade to unlock full 3-tier AI hints, oscilloscope simulation, and verified portfolio badge."}
                </p>

                {profile.isPro ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link
                      href="/pricing"
                      style={{
                        flex: 1,
                        textAlign: "center",
                        background: "rgba(139,142,255,0.12)",
                        border: "1px solid rgba(139,142,255,0.3)",
                        color: "#8b8eff",
                        fontWeight: 700,
                        fontSize: 12,
                        padding: "8px 12px",
                        borderRadius: 6,
                        textDecoration: "none",
                      }}
                    >
                      Manage Plan Details →
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/pricing"
                    style={{
                      display: "block",
                      textAlign: "center",
                      background: "linear-gradient(135deg, #8b8eff, #6366f1)",
                      color: "#0b0c0e",
                      fontWeight: 800,
                      fontSize: 12,
                      padding: "9px 14px",
                      borderRadius: 6,
                      textDecoration: "none",
                      boxShadow: "0 4px 14px rgba(139,142,255,0.25)",
                    }}
                  >
                    ⚡ Upgrade to Pro (₹100/mo) →
                  </Link>
                )}
              </div>

              {/* PUBLIC PORTFOLIO & PRIVACY CARD */}
              <div style={S.card}>
                <div style={S.sectionHdr}>
                  <span style={S.sectionTtl}>Public Portfolio</span>
                  {savingSettings ? (
                    <span style={{ fontSize: 11, color: "#8b8eff" }}>Saving...</span>
                  ) : settingsSaved ? (
                    <span style={{ fontSize: 11, color: "#4ade80" }}>✓ Saved</span>
                  ) : null}
                </div>
                <p style={{ ...S.muted, marginBottom: 14, lineHeight: 1.5 }}>
                  Share your verified debugging track record, ELO rating, and embedded skills with technical recruiters.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontSize: 12, color: "#f5f3ec" }}>
                    <span>Public Profile (<span style={{ color: "#8b8eff" }}>/u/{profile.username}</span>)</span>
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => handleUpdateSettings(e.target.checked, showMatchHistory)}
                      style={{ cursor: "pointer", accentColor: "#8b8eff", width: 16, height: 16 }}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontSize: 12, color: "#f5f3ec" }}>
                    <span>Show Duel History Publicly</span>
                    <input
                      type="checkbox"
                      checked={showMatchHistory}
                      onChange={(e) => handleUpdateSettings(isPublic, e.target.checked)}
                      style={{ cursor: "pointer", accentColor: "#8b8eff", width: 16, height: 16 }}
                    />
                  </label>
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <Link
                    href={`/u/${encodeURIComponent(profile.username)}`}
                    target="_blank"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      background: "#8b8eff",
                      color: "#0b0c0e",
                      fontWeight: 700,
                      fontSize: 12,
                      padding: "8px 12px",
                      borderRadius: 6,
                      textDecoration: "none",
                    }}
                  >
                    View Portfolio ↗
                  </Link>
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard.writeText(`${window.location.origin}/u/${encodeURIComponent(profile.username)}`);
                        alert("Portfolio link copied to clipboard!");
                      }
                    }}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid #2a2c30",
                      color: "#f5f3ec",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              {/* ACTIVITY CALENDAR */}
              <div style={S.card}>
                <div style={S.sectionHdr}>
                  <span style={S.sectionTtl}>Activity</span>
                  <span style={S.muted}>{Object.values(profile.activityMap).filter(v => v > 0).length} active days</span>
                </div>
                <ActivityCalendar data={profile.activityMap} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <span style={{ fontSize: 9, color: "#4a4860", textTransform: "uppercase", letterSpacing: 1 }}>Less</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {["rgba(255,255,255,0.05)", "rgba(139,142,255,0.25)", "rgba(139,142,255,0.5)", "rgba(139,142,255,0.7)", "rgba(139,142,255,0.95)"].map((c, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 9, color: "#4a4860", textTransform: "uppercase", letterSpacing: 1 }}>More</span>
                </div>
              </div>

              {/* SKILLS PRACTICED */}
              <div style={S.card}>
                <div style={S.sectionHdr}>
                  <span style={S.sectionTtl}>Skills Practiced</span>
                  <span style={S.muted}>{(profile.skillsPracticed || []).length} mastered</span>
                </div>
                {(profile.skillsPracticed && profile.skillsPracticed.length > 0) ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {profile.skillsPracticed.map((skill) => (
                      <span
                        key={skill}
                        style={{
                          background: "rgba(139,142,255,0.08)",
                          border: "1px solid rgba(139,142,255,0.22)",
                          color: "#c4b5fd",
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        ✓ {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ ...S.muted, fontSize: 12 }}>
                    No solo skills recorded yet. Complete challenges in{" "}
                    <Link href="/practice" style={{ color: "#8b8eff", textDecoration: "underline" }}>
                      Practice Mode
                    </Link>{" "}
                    to build your portfolio.
                  </div>
                )}
              </div>

              {/* JOURNEY TIMELINE */}
              <div style={S.card}>
                <div style={{ ...S.sectionHdr, marginBottom: 20 }}>
                  <span style={S.sectionTtl}>Journey</span>
                </div>
                <div style={{ position: "relative", paddingLeft: 24 }}>
                  <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 1, background: "#2a2c30" }} />
                  {[
                    profile.elo >= 2200 && { label: "Reached Distinguished Fellow",   date: "Milestone" },
                    profile.elo >= 1800 && { label: "Reached Principal Architect",    date: "Milestone" },
                    profile.elo >= 1400 && { label: "Reached Staff Engineer",          date: "Milestone" },
                    profile.wins >= 50  && { label: "50 Production Tickets Patched",   date: "Achievement" },
                    profile.wins >= 10  && { label: "10 Production Tickets Patched",   date: "Achievement" },
                    profile.wins >= 1   && { label: "First Production PR Merged",      date: "Achievement" },
                    profile.joinedAt    && { label: "Joined Codeduel Battleground",     date: new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) },
                  ].filter(Boolean).slice(0, 5).map((m: any, i) => (
                    <div key={i} style={{ position: "relative", marginBottom: 20 }}>
                      <div style={{ position: "absolute", left: -20, top: 4, width: 8, height: 8, borderRadius: "50%", background: i === 0 ? "#8b8eff" : "#2a2c30", border: `2px solid ${i === 0 ? "#8b8eff" : "#3a3c40"}` }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f3ec" }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: "#8a8c82", marginTop: 2 }}>{m.date}</div>
                    </div>
                  ))}
                  {[profile.elo >= 2200, profile.elo >= 1800, profile.elo >= 1400, profile.wins >= 50, profile.wins >= 10, profile.wins >= 1, profile.joinedAt].filter(Boolean).length === 0 && (
                    <div style={{ ...S.muted, fontSize: 12 }}>Play your first match to start your journey!</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
