"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface PublicProfileData {
  isPrivate: boolean;
  userId?: string;
  username: string;
  avatar: string | null;
  githubUrl?: string;
  elo?: number;
  globalRank?: number;
  wins?: number;
  losses?: number;
  totalMatches?: number;
  winRate?: number;
  streak?: number;
  skillsPracticed?: string[];
  trackBreakdown?: {
    swe: { wins: number; total: number; winRate: number };
    ece: { wins: number; total: number; winRate: number };
  };
  recentMatches?: Array<{
    matchId: string;
    problem: string;
    track: string;
    opponent: string;
    opponentAvatar: string | null;
    result: "WIN" | "LOSS";
    playedAt: string;
  }>;
  joinedAt?: string;
  verificationSlug?: string;
}

export default function PublicProfileView({ username }: { username: string }) {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/u/${encodeURIComponent(username)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Developer profile not found");
        return res.json();
      })
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTwitter = () => {
    if (!profile) return;
    const text = `I'm ranked #${profile.globalRank || 1} on @CodeDuel with ${profile.elo || 1200} ELO in software & embedded debugging! Think you can out-debug me? Duel me:`;
    const url = typeof window !== "undefined" ? window.location.href : `https://codeduel.dev/u/${username}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
  };

  const handleShareLinkedIn = () => {
    const url = typeof window !== "undefined" ? window.location.href : `https://codeduel.dev/u/${username}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank");
  };

  const rankTier = (elo: number) => {
    if (elo >= 2200) return { label: "Distinguished Fellow", color: "#f43f5e" };
    if (elo >= 1800) return { label: "Principal Architect",  color: "#c084fc" };
    if (elo >= 1400) return { label: "Staff Engineer",       color: "#38bdf8" };
    if (elo >= 1200) return { label: "Senior Debugger",      color: "#4ade80" };
    return { label: "Apprentice", color: "#8a8898" };
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", color: "#8b8eff" }}>
        Loading Developer Portfolio...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#000", color: "#e8e6f0", textAlign: "center", padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Profile Not Found</h1>
        <p style={{ color: "#8a8898", maxWidth: 400, marginBottom: 20 }}>
          No public developer portfolio exists for @{username}. They may not have created an account yet.
        </p>
        <Link href="/" style={{ background: "#8b8eff", color: "#000", padding: "10px 20px", borderRadius: 6, fontWeight: 700, textDecoration: "none" }}>
          Back to CodeDuel
        </Link>
      </div>
    );
  }

  if (profile.isPrivate) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#000", color: "#e8e6f0", textAlign: "center", padding: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: 14, background: "#1a1c24", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, marginBottom: 16 }}>
          🔒
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Private Portfolio</h1>
        <p style={{ color: "#8a8898", maxWidth: 420, marginBottom: 24, lineHeight: 1.5 }}>
          @{profile.username} has configured their CodeDuel debugging portfolio to private.
        </p>
        <Link href="/" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "8px 18px", borderRadius: 6, textDecoration: "none", fontSize: 13 }}>
          Return Home
        </Link>
      </div>
    );
  }

  const tier = rankTier(profile.elo || 1200);

  return (
    <div style={{ minHeight: "100vh", background: "#07070b", color: "#e8e6f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* ── TOP NAV ──────────────────────────────────────────────────────── */}
      <nav
        style={{
          height: 54,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fff", fontWeight: 700, fontSize: 14 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #8b8eff 0%, #7c3aed 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 800, fontSize: 12 }}>
            ⚡
          </div>
          <span>CodeDuel</span>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 4, color: "#8b8eff", fontWeight: 600 }}>
            VERIFIED
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href={`/dashboard?challenge=${profile.username}`}
            style={{
              background: "#8b8eff",
              color: "#000",
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ⚔️ Challenge @{profile.username}
          </Link>
          <Link
            href="/practice"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            Practice Arena
          </Link>
        </div>
      </nav>

      {/* ── MAIN PORTFOLIO BODY ───────────────────────────────────────────── */}
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "36px 24px 80px" }}>
        {/* PROFILE HERO CARD */}
        <div
          style={{
            background: "#0c0d14",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 28,
            display: "flex",
            gap: 28,
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: 24,
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              overflow: "hidden",
              border: "2px solid rgba(139,142,255,0.3)",
              background: "#161722",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "#8b8eff",
              flexShrink: 0,
            }}
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              profile.username[0]?.toUpperCase()
            )}
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  background: `${tier.color}15`,
                  color: tier.color,
                  border: `1px solid ${tier.color}35`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                {tier.label}
              </span>
              <span style={{ fontSize: 12, color: "#8a8898", fontFamily: "JetBrains Mono" }}>
                #{profile.globalRank} Globally
              </span>
              <span
                style={{
                  background: "rgba(74,222,128,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.3)",
                  borderRadius: 100,
                  padding: "2px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                ✓ VERIFIED PROFILE
              </span>
            </div>

            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px", color: "#fff" }}>
              {profile.username}
            </h1>
            <p style={{ color: "#8a8898", fontSize: 13, margin: "0 0 16px" }}>
              Member since {new Date(profile.joinedAt || Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </p>

            {/* Social Share Buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={handleShareTwitter}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>𝕏</span> Share on X
              </button>
              <button
                onClick={handleShareLinkedIn}
                style={{
                  background: "rgba(56,189,248,0.1)",
                  border: "1px solid rgba(56,189,248,0.25)",
                  color: "#38bdf8",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>in</span> LinkedIn
              </button>
              <button
                onClick={handleCopyLink}
                style={{
                  background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.12)"}`,
                  color: copied ? "#4ade80" : "#8a8898",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ Link Copied" : "🔗 Copy Link"}
              </button>
            </div>
          </div>

          {/* Verification Badge Box */}
          <div
            style={{
              background: "rgba(139,142,255,0.05)",
              border: "1px solid rgba(139,142,255,0.2)",
              borderRadius: 12,
              padding: "16px 20px",
              textAlign: "right",
              minWidth: 200,
            }}
          >
            <div style={{ fontSize: 10, color: "#8a8898", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Credential Hash
            </div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#c4b5fd", marginBottom: 8 }}>
              {profile.verificationSlug}
            </div>
            <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 600 }}>
              ● Tamper-Proof Verified
            </div>
          </div>
        </div>

        {/* STATS STRIP */}
        <div
          style={{
            background: "#0c0d14",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "18px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{profile.elo}</div>
            <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>ELO Rating</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{profile.winRate}%</div>
            <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Win Rate</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{profile.totalMatches}</div>
            <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Duels Fought</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#4ade80" }}>{profile.wins}W / {profile.losses}L</div>
            <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Record</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fbbf24" }}>🔥 {profile.streak}d</div>
            <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Daily Streak</div>
          </div>
        </div>

        {/* 2-COL LAYOUT: Track Breakdown & Verified Skills */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 24 }}>
          {/* TRACK BREAKDOWN */}
          <div style={{ background: "#0c0d14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#fff" }}>
              Engineering Track Breakdown
            </h3>

            {/* SWE Track */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#38bdf8" }}>🌐 Cloud Software (SWE)</span>
                <span style={{ fontSize: 12, fontFamily: "JetBrains Mono", color: "#8a8898" }}>
                  {profile.trackBreakdown?.swe.wins || 0}W / {(profile.trackBreakdown?.swe.total || 0) - (profile.trackBreakdown?.swe.wins || 0)}L ({profile.trackBreakdown?.swe.winRate || 0}%)
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${profile.trackBreakdown?.swe.winRate || 0}%`, background: "#38bdf8", borderRadius: 4 }} />
              </div>
            </div>

            {/* ECE Track */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fbbf24" }}>⚡ Embedded Firmware (ECE)</span>
                <span style={{ fontSize: 12, fontFamily: "JetBrains Mono", color: "#8a8898" }}>
                  {profile.trackBreakdown?.ece.wins || 0}W / {(profile.trackBreakdown?.ece.total || 0) - (profile.trackBreakdown?.ece.wins || 0)}L ({profile.trackBreakdown?.ece.winRate || 0}%)
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${profile.trackBreakdown?.ece.winRate || 0}%`, background: "#fbbf24", borderRadius: 4 }} />
              </div>
            </div>
          </div>

          {/* VERIFIED SKILLS PORTFOLIO */}
          <div style={{ background: "#0c0d14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#fff" }}>
                Verified Competencies
              </h3>
              <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 600 }}>
                {(profile.skillsPracticed || []).length} Validated
              </span>
            </div>

            {(profile.skillsPracticed && profile.skillsPracticed.length > 0) ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profile.skillsPracticed.map((skill) => (
                  <span
                    key={skill}
                    style={{
                      background: "rgba(139,142,255,0.08)",
                      border: "1px solid rgba(139,142,255,0.25)",
                      color: "#c4b5fd",
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "JetBrains Mono",
                    }}
                  >
                    ✓ {skill}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ color: "#8a8898", fontSize: 13, lineHeight: 1.5 }}>
                Skills are automatically unlocked upon successfully passing production incident test harnesses.
              </div>
            )}
          </div>
        </div>

        {/* RECENT MATCHES HIGHLIGHTS */}
        {profile.recentMatches && profile.recentMatches.length > 0 && (
          <div style={{ background: "#0c0d14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 22, marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#fff" }}>
              Recent Competitive Duels
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {profile.recentMatches.map((m) => (
                <div
                  key={m.matchId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.02)",
                    borderLeft: `3px solid ${m.result === "WIN" ? "#4ade80" : "#f43f5e"}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.problem}</div>
                    <div style={{ fontSize: 11, color: "#8a8898", marginTop: 2 }}>
                      vs @{m.opponent} · {new Date(m.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: m.result === "WIN" ? "#4ade80" : "#f43f5e",
                        fontFamily: "JetBrains Mono",
                      }}
                    >
                      {m.result}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECRUITER VERIFICATION AUDIT BOX */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(139,142,255,0.06) 0%, rgba(56,189,248,0.03) 100%)",
            border: "1px solid rgba(139,142,255,0.2)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>🛡️</span>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#fff" }}>
              For Hiring Managers & Technical Recruiters
            </h4>
          </div>
          <p style={{ fontSize: 13, color: "#8a8898", lineHeight: 1.6, margin: "0 0 16px" }}>
            This portfolio reflects verified code execution under strict time limits. Each problem solved requires diagnosing real-world architectural bugs, managing memory, and passing automated unit test suites without access to full solution keys.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#c8c6d4", fontFamily: "JetBrains Mono" }}>
            <span>✓ Anti-Cheat Verification Active</span>
            <span>✓ Evaluated on Isolated Docker/VM Sandbox</span>
            <span>✓ Credential Slug: {profile.verificationSlug}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
