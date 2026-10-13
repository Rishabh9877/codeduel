"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

interface ChallengeItem {
  id: string;
  track: "PRODUCTION_SWE" | "EMBEDDED_SYSTEMS";
  language: "typescript" | "c" | "python";
  title: string;
  repoContext: string;
  totalTests: number;
  filesCount: number;
  editableFile: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedMinutes: number;
  skills: string[];
  hiddenTestsCount?: number;
  hasHardwareSimulation?: boolean;
}

interface DailyInfo {
  date: string;
  challenge: ChallengeItem;
  streak: number;
  completedToday: boolean;
}

export default function PracticeCatalogPage() {
  const { data: session } = useSession();
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [daily, setDaily] = useState<DailyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [trackFilter, setTrackFilter] = useState<"ALL" | "PRODUCTION_SWE" | "EMBEDDED_SYSTEMS">("ALL");
  const [langFilter, setLangFilter] = useState<"ALL" | "typescript" | "c" | "python">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<"ALL" | "easy" | "medium" | "hard">("ALL");
  const [selectedSkill, setSelectedSkill] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/challenges").then((r) => r.json()),
      fetch("/api/practice/daily").then((r) => r.json()),
    ])
      .then(([chalData, dailyData]) => {
        if (chalData.challenges) setChallenges(chalData.challenges);
        if (dailyData.challenge) setDaily(dailyData);
      })
      .catch((err) => console.error("Failed to load practice data:", err))
      .finally(() => setLoading(false));
  }, []);

  // Compute all available unique skills
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    challenges.forEach((c) => {
      (c.skills || []).forEach((s) => set.add(s));
    });
    return Array.from(set).sort();
  }, [challenges]);

  // Filtered challenges
  const filtered = useMemo(() => {
    return challenges.filter((c) => {
      if (trackFilter !== "ALL" && c.track !== trackFilter) return false;
      if (langFilter !== "ALL" && c.language !== langFilter) return false;
      if (difficultyFilter !== "ALL" && c.difficulty !== difficultyFilter) return false;
      if (selectedSkill !== "ALL" && !(c.skills || []).includes(selectedSkill)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesRepo = c.repoContext.toLowerCase().includes(q);
        const matchesSkill = (c.skills || []).some((s) => s.toLowerCase().includes(q));
        if (!matchesTitle && !matchesRepo && !matchesSkill) return false;
      }
      return true;
    });
  }, [challenges, trackFilter, langFilter, difficultyFilter, selectedSkill, searchQuery]);

  return (
    <div className="practice-root">
      <style jsx global>{`
        :root {
          --bg: #000000;
          --bg2: #08080a;
          --bg3: #0f0f13;
          --bg4: #15151c;
          --border: rgba(255, 255, 255, 0.08);
          --border2: rgba(255, 255, 255, 0.14);
          --text: #f5f4f8;
          --muted: #8a8898;
          --muted2: #525060;
          --accent: #8b8eff;
          --accent-glow: rgba(139, 142, 255, 0.15);
          --cyan: #38bdf8;
          --amber: #fbbf24;
          --green: #4ade80;
          --rose: #f43f5e;
        }

        body {
          background-color: var(--bg);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          margin: 0;
        }

        .practice-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }

        .practice-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: var(--text);
          font-weight: 700;
          font-size: 14px;
          letter-spacing: -0.02em;
        }

        .practice-nav-links {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .practice-nav-link {
          font-size: 13px;
          color: var(--muted);
          padding: 6px 14px;
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s;
        }

        .practice-nav-link:hover {
          color: var(--text);
          background: rgba(255, 255, 255, 0.05);
        }

        .practice-nav-link.active {
          color: var(--text);
          background: rgba(139, 142, 255, 0.12);
          border: 1px solid rgba(139, 142, 255, 0.25);
          font-weight: 600;
        }

        .practice-main {
          max-width: 1140px;
          margin: 0 auto;
          padding: 36px 24px 80px;
        }

        /* DAILY BANNER */
        .daily-banner {
          background: linear-gradient(135deg, rgba(139, 142, 255, 0.1) 0%, rgba(56, 189, 248, 0.04) 100%);
          border: 1px solid rgba(139, 142, 255, 0.28);
          border-radius: 14px;
          padding: 24px 28px;
          margin-bottom: 36px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .daily-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(139, 142, 255, 0.15);
          border: 1px solid rgba(139, 142, 255, 0.3);
          border-radius: 100px;
          padding: 3px 10px;
          font-size: 11px;
          font-family: "JetBrains Mono", monospace;
          color: var(--accent);
          font-weight: 600;
          margin-bottom: 8px;
        }

        .streak-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(251, 191, 36, 0.12);
          border: 1px solid rgba(251, 191, 36, 0.28);
          color: #fde047;
          border-radius: 100px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
          font-family: "JetBrains Mono", monospace;
        }

        /* FILTER BAR */
        .filter-section {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px 20px;
          margin-bottom: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .filter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .filter-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 12px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .filter-btn:hover {
          color: var(--text);
          border-color: var(--border2);
          background: rgba(255, 255, 255, 0.06);
        }

        .filter-btn.active {
          color: #fff;
          background: rgba(139, 142, 255, 0.15);
          border-color: var(--accent);
          font-weight: 600;
        }

        .search-input {
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 7px 14px;
          color: var(--text);
          font-size: 13px;
          outline: none;
          min-width: 240px;
          transition: border-color 0.15s;
        }

        .search-input:focus {
          border-color: var(--accent);
        }

        /* CHALLENGE GRID */
        .challenge-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }

        .challenge-card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          text-decoration: none;
          color: inherit;
        }

        .challenge-card:hover {
          border-color: rgba(139, 142, 255, 0.35);
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(139, 142, 255, 0.08);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 5px;
          padding: 2px 7px;
          font-family: "JetBrains Mono", monospace;
        }

        .badge-swe {
          background: rgba(56, 189, 248, 0.12);
          color: var(--cyan);
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .badge-embedded {
          background: rgba(251, 191, 36, 0.12);
          color: var(--amber);
          border: 1px solid rgba(251, 191, 36, 0.25);
        }

        .badge-easy {
          background: rgba(74, 222, 128, 0.1);
          color: var(--green);
          border: 1px solid rgba(74, 222, 128, 0.25);
        }

        .badge-medium {
          background: rgba(251, 191, 36, 0.1);
          color: var(--amber);
          border: 1px solid rgba(251, 191, 36, 0.25);
        }

        .badge-hard {
          background: rgba(244, 63, 94, 0.1);
          color: var(--rose);
          border: 1px solid rgba(244, 63, 94, 0.25);
        }

        .skill-chip {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #c4b5fd;
          font-size: 10px;
          padding: 2px 7px;
          border-radius: 4px;
          font-family: "JetBrains Mono", monospace;
        }

        .start-btn {
          background: rgba(139, 142, 255, 0.12);
          border: 1px solid rgba(139, 142, 255, 0.25);
          color: #e0e1ff;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s;
          text-decoration: none;
        }

        .challenge-card:hover .start-btn {
          background: var(--accent);
          color: #000;
          border-color: var(--accent);
        }
      `}</style>

      {/* TOP NAVIGATION */}
      <nav className="practice-nav">
        <Link href="/" className="practice-brand">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "linear-gradient(135deg, #8b8eff 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#000",
            }}
          >
            ⚡
          </div>
          <span>CodeDuel</span>
          <span
            style={{
              fontSize: 10,
              background: "rgba(255,255,255,0.06)",
              padding: "2px 6px",
              borderRadius: 4,
              color: "#8a8898",
            }}
          >
            SOLO
          </span>
        </Link>

        <div className="practice-nav-links">
          <Link href="/practice" className="practice-nav-link active">
            Practice
          </Link>
          <Link href="/dashboard" className="practice-nav-link">
            1v1 Arena
          </Link>
          <Link href="/leaderboard" className="practice-nav-link">
            Leaderboard
          </Link>
          <Link href="/campus" className="practice-nav-link">
            Campus
          </Link>
          <Link href="/profile" className="practice-nav-link">
            Profile
          </Link>
        </div>
      </nav>

      <main className="practice-main">
        {/* HEADER */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontFamily: "JetBrains Mono, monospace",
              color: "var(--accent)",
              background: "rgba(139,142,255,0.1)",
              border: "1px solid rgba(139,142,255,0.2)",
              padding: "3px 10px",
              borderRadius: 100,
              marginBottom: 10,
            }}
          >
            <span>🎯</span> Socratic Solo Lab
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Solo Debugging Arena
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0, maxWidth: 640 }}>
            Inspect real modular codebases, diagnose production incidents, and satisfy rigorous test suites without matchmaking queues.
          </p>
        </div>

        {/* DAILY CHALLENGE BANNER */}
        {daily && daily.challenge && (
          <div className="daily-banner">
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span className="daily-badge">📅 DAILY CHALLENGE · {daily.date}</span>
                {daily.completedToday ? (
                  <span
                    style={{
                      background: "rgba(74,222,128,0.15)",
                      color: "#4ade80",
                      border: "1px solid rgba(74,222,128,0.3)",
                      borderRadius: 100,
                      padding: "2px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    ✓ Completed Today
                  </span>
                ) : (
                  <span
                    style={{
                      background: "rgba(56,189,248,0.15)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56,189,248,0.3)",
                      borderRadius: 100,
                      padding: "2px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    ⚡ Unsolved Today
                  </span>
                )}
                <span className="streak-pill">🔥 {daily.streak} Day Streak</span>
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px", color: "#fff" }}>
                {daily.challenge.title}
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                <span
                  className={`badge ${
                    daily.challenge.track === "PRODUCTION_SWE" ? "badge-swe" : "badge-embedded"
                  }`}
                >
                  {daily.challenge.track === "PRODUCTION_SWE" ? "Cloud SWE" : "Embedded ECE"}
                </span>
                <span className={`badge badge-${daily.challenge.difficulty}`}>
                  {daily.challenge.difficulty}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "JetBrains Mono" }}>
                  ~{daily.challenge.estimatedMinutes} mins · {daily.challenge.totalTests} tests · {daily.challenge.language}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(daily.challenge.skills || []).map((sk) => (
                  <span key={sk} className="skill-chip">
                    {sk}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <Link
                href={`/practice/${daily.challenge.id}?daily=1`}
                style={{
                  background: "#8b8eff",
                  color: "#000",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(139,142,255,0.3)",
                }}
              >
                <span>Launch Daily</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}

        {/* FILTER BAR */}
        <div className="filter-section">
          {/* Row 1: Track & Search */}
          <div className="filter-row">
            <div className="filter-group">
              <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 4, fontWeight: 600 }}>Track:</span>
              <button
                className={`filter-btn ${trackFilter === "ALL" ? "active" : ""}`}
                onClick={() => setTrackFilter("ALL")}
              >
                All Tracks ({challenges.length})
              </button>
              <button
                className={`filter-btn ${trackFilter === "PRODUCTION_SWE" ? "active" : ""}`}
                onClick={() => setTrackFilter("PRODUCTION_SWE")}
              >
                Cloud SWE ({challenges.filter((c) => c.track === "PRODUCTION_SWE").length})
              </button>
              <button
                className={`filter-btn ${trackFilter === "EMBEDDED_SYSTEMS" ? "active" : ""}`}
                onClick={() => setTrackFilter("EMBEDDED_SYSTEMS")}
              >
                Embedded ECE ({challenges.filter((c) => c.track === "EMBEDDED_SYSTEMS").length})
              </button>
            </div>

            <input
              type="text"
              placeholder="Search by title, repo, or skill..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Row 2: Language, Difficulty, Skill tag */}
          <div className="filter-row">
            <div className="filter-group">
              <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 4, fontWeight: 600 }}>Language:</span>
              {(["ALL", "typescript", "c", "python"] as const).map((lang) => (
                <button
                  key={lang}
                  className={`filter-btn ${langFilter === lang ? "active" : ""}`}
                  onClick={() => setLangFilter(lang)}
                >
                  {lang === "ALL" ? "All" : lang.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="filter-group">
              <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 4, fontWeight: 600 }}>Difficulty:</span>
              {(["ALL", "easy", "medium", "hard"] as const).map((diff) => (
                <button
                  key={diff}
                  className={`filter-btn ${difficultyFilter === diff ? "active" : ""}`}
                  onClick={() => setDifficultyFilter(diff)}
                >
                  {diff.toUpperCase()}
                </button>
              ))}
            </div>

            {allSkills.length > 0 && (
              <div className="filter-group">
                <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 4, fontWeight: 600 }}>Skill:</span>
                <select
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                  style={{
                    background: "var(--bg3)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  <option value="ALL">All Skills ({allSkills.length})</option>
                  {allSkills.map((sk) => (
                    <option key={sk} value={sk}>
                      {sk}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* CATALOG GRID */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
            Loading challenge catalog...
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "var(--bg2)",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>No challenges match your filters</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
              Try adjusting your track, difficulty, language, or search query.
            </p>
            <button
              className="filter-btn active"
              onClick={() => {
                setTrackFilter("ALL");
                setLangFilter("ALL");
                setDifficultyFilter("ALL");
                setSelectedSkill("ALL");
                setSearchQuery("");
              }}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="challenge-grid">
            {filtered.map((c) => (
              <Link key={c.id} href={`/practice/${c.id}`} className="challenge-card">
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className={`badge ${c.track === "PRODUCTION_SWE" ? "badge-swe" : "badge-embedded"}`}>
                        {c.track === "PRODUCTION_SWE" ? "SWE" : "ECE"}
                      </span>
                      <span className={`badge badge-${c.difficulty}`}>{c.difficulty}</span>
                    </div>
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 11,
                        color: "var(--muted)",
                        background: "rgba(255,255,255,0.03)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {c.language}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "#f5f4f8" }}>
                    {c.title}
                  </h3>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                      fontFamily: "JetBrains Mono, monospace",
                      marginBottom: 14,
                    }}
                  >
                    📦 {c.repoContext}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 18 }}>
                    {(c.skills || []).map((sk) => (
                      <span key={sk} className="skill-chip">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 14,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "JetBrains Mono", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⏱ ~{c.estimatedMinutes}m · {c.hiddenTestsCount ? `${c.totalTests - c.hiddenTestsCount}+${c.hiddenTestsCount} hidden` : `${c.totalTests}`} tests</span>
                    {c.hasHardwareSimulation && (
                      <span style={{ color: "#fbbf24", background: "rgba(251,191,36,0.12)", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>
                        ⚡ Scope
                      </span>
                    )}
                  </span>
                  <span className="start-btn">
                    <span>Practice</span>
                    <span>→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* PRACTICE FOOTER */}
        <div style={{ marginTop: 64, paddingTop: 28, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, fontSize: 12, color: "var(--muted2)" }}>
          <div>
            CodeDuel Solo Practice Arena · Punjab Engineering College (PEC)
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/about" style={{ color: "var(--muted)", textDecoration: "none" }}>About</Link>
            <Link href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>Privacy (DPDP)</Link>
            <Link href="/terms" style={{ color: "var(--muted)", textDecoration: "none" }}>Terms</Link>
            <Link href="/contact" style={{ color: "var(--muted)", textDecoration: "none" }}>Contact</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
