"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Editor from "@monaco-editor/react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ChallengeFile {
  name: string;
  content: string;
  readOnly: boolean;
}

export interface Challenge {
  id: string;
  track: 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS';
  language: 'typescript' | 'c' | 'python';
  title: string;
  repoContext: string;
  ticketMarkdown: string;
  files: ChallengeFile[];
  entrypoint: string;
  totalTests: number;
}

export interface PlayerSlot {
  userId: string;
  username: string;
  avatar?: string;
  elo: number;
  submitted: boolean;
  passed: boolean;
  testsPassed?: number;
  hintsUsed?: number;
  isBot?: boolean;
}

export interface Match {
  matchId: string;
  status: "active" | "finished" | "forfeited" | "timed_out" | "cancelled";
  startedAt: number;
  finishedAt: number | null;
  winnerId: string | null;
  player1: PlayerSlot;
  player2: PlayerSlot;
  endedBy?: string | null;
  newWinnerElo?: number;
  newLoserElo?: number;
  isBotMatch?: boolean;
}

export interface SubmitResult {
  result?: string;
  testsPassed: number;
  testsTotal: number;
  matchOver: boolean;
  won: boolean;
  stdout?: string;
  stderr?: string;
  status?: string;
  testResults?: Array<{ name: string; passed: boolean }>;
  eloChange?: number;
  newElo?: number;
  error?: string;
}

const MATCH_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveWon(
  match: { winnerId: string | null; endedBy?: string | null },
  myId: string | undefined
): boolean | null {
  if (!match.winnerId || match.endedBy === "timeout") return null;
  return match.winnerId === myId;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function MatchArena() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const matchId = params.id as string;

  // Match and Challenge state
  const [match, setMatch] = useState<Match | null>(null);
  const [finalMatchPayload, setFinalMatchPayload] = useState<Match | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [myRole, setMyRole] = useState<"player1" | "player2" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tabbed File State: Record<string, string> preserves unsaved edits across tab switches
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFileName, setActiveFileName] = useState<string>("");

  // Timer
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION_MS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<"testResults" | "logs">("testResults");

  // AI Coach state (Gemini 2.0 Flash)
  const [showCoach, setShowCoach] = useState(false);
  const [hints, setHints] = useState<Array<{ text: string; tier: number }>>([]);
  const [hintLoading, setHintLoading] = useState(false);

  // Match Over
  const [matchOver, setMatchOver] = useState(false);
  const [won, setWon] = useState<boolean | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const myId = ((session?.user as any)?.id || (session?.user as any)?.sub) as string | undefined;

  const opponentRole = myRole === "player1" ? "player2" : "player1";
  const myPlayer = match && myRole ? match[myRole] : null;
  const opponentPlayer = match && myRole ? match[opponentRole] : null;

  const hintsUsed = myPlayer?.hintsUsed ?? hints.length;

  const handleRequestHint = async () => {
    if (hintLoading || hintsUsed >= 3 || !challenge) return;
    setHintLoading(true);
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          challengeId: challenge.id,
          activeFileName,
          currentCode: files[activeFileName],
          language: monacoLanguage,
        }),
      });
      const data = await res.json();
      if (data.hint) {
        setHints((prev) => [...prev, { text: data.hint, tier: data.tier || prev.length + 1 }]);
        if (myPlayer) myPlayer.hintsUsed = data.hintsUsed;
      }
    } catch (e) {
      console.error("[MatchArena] AI Coach error:", e);
    } finally {
      setHintLoading(false);
    }
  };


  // ── 1.5s SHORT-POLLING HOOK (/api/match/[id]) ──────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!match || match.status !== "active") return;

    // 1.5-second polling interval as required
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/match/${matchId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.match) {
          setMatch(data.match);

          if (data.match.status !== "active") {
            setFinalMatchPayload(data.match);
            setMatchOver(true);
            setWon(resolveWon(data.match, myId));
            stopPolling();
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }
      } catch (e) {
        // network jitter, continue polling
      }
    }, 1500);

    return () => stopPolling();
  }, [match?.status, matchId, myId, stopPolling]);

  // ── INITIAL FETCH ──────────────────────────────────────────────────────────
  const isInitialized = useRef(false);

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/match/${matchId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to load match");
      }
      const data = await res.json();
      setMatch(data.match);
      setChallenge(data.challenge);
      if (data.myRole) setMyRole(data.myRole);

      if (!isInitialized.current && data.challenge?.files) {
        const fileMap: Record<string, string> = {};
        let defaultTab = data.challenge.files[0]?.name ?? "";

        data.challenge.files.forEach((f: ChallengeFile) => {
          fileMap[f.name] = f.content;
          // Prefer opening the editable bug file first
          if (!f.readOnly && defaultTab === data.challenge.files[0]?.name) {
            defaultTab = f.name;
          }
        });

        setFiles(fileMap);
        setActiveFileName(defaultTab);
        isInitialized.current = true;
      }

      if (data.match.status !== "active") {
        setFinalMatchPayload(data.match);
        setMatchOver(true);
        setWon(resolveWon(data.match, myId));
        stopPolling();
      }
    } catch (err: any) {
      console.error(err);
      setLoadError(err.message || "Failed to load match arena");
    }
  }, [matchId, myId, stopPolling]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchMatch();
    }
  }, [authStatus, fetchMatch]);

  // ── 15-MINUTE MATCH COUNTDOWN ──────────────────────────────────────────────
  useEffect(() => {
    if (!match || match.status !== "active") return;

    const started = match.startedAt;
    const expires = started + MATCH_DURATION_MS;

    const updateTimer = () => {
      const remaining = expires - Date.now();
      if (remaining <= 0) {
        setTimeLeft(0);
        if (timerRef.current) clearInterval(timerRef.current);
        // Call timeout API
        fetch("/api/match/timeout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        }).catch(() => {});
      } else {
        setTimeLeft(remaining);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [match?.status, match?.startedAt, matchId]);

  // ── ACTIVE FILE LOOKUP ─────────────────────────────────────────────────────
  const currentFile = useMemo(() => {
    return challenge?.files.find((f) => f.name === activeFileName);
  }, [challenge, activeFileName]);

  const monacoLanguage = useMemo(() => {
    if (!activeFileName) return "typescript";
    if (activeFileName.endsWith(".ts") || activeFileName.endsWith(".tsx") || activeFileName.endsWith(".js")) return "typescript";
    if (activeFileName.endsWith(".c") || activeFileName.endsWith(".h")) return "c";
    if (activeFileName.endsWith(".py")) return "python";
    if (activeFileName.endsWith(".json")) return "json";
    if (activeFileName.endsWith(".md")) return "markdown";
    return "plaintext";
  }, [activeFileName]);

  // ── FILE EDIT HANDLER ──────────────────────────────────────────────────────
  const handleEditorChange = (newVal: string | undefined) => {
    if (!currentFile || currentFile.readOnly) return;
    setFiles((prev) => ({
      ...prev,
      [activeFileName]: newVal ?? "",
    }));
  };

  // ── SUBMIT / TEST EXECUTION ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitting || !match || match.status !== "active") return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/match/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          files, // Record<string, string> mapping all filenames to current contents
        }),
      });

      const data = await res.json();
      setSubmitResult(data);

      if (data.matchOver) {
        setMatchOver(true);
        setWon(data.won);
        stopPolling();
      } else {
        // Refetch match to update testsPassed score
        fetchMatch();
      }
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitResult({
        testsPassed: 0,
        testsTotal: challenge?.totalTests ?? 0,
        matchOver: false,
        won: false,
        error: "Network error during code execution",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── FORFEIT ────────────────────────────────────────────────────────────────
  const handleForfeit = async () => {
    if (!confirm("Are you sure you want to forfeit this match? This counts as an immediate loss.")) return;
    try {
      await fetch("/api/match/forfeit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      setMatchOver(true);
      setWon(false);
      stopPolling();
    } catch (err) {
      console.error("Forfeit error:", err);
    }
  };

  // ── RENDER GUARDS ──────────────────────────────────────────────────────────
  if (authStatus === "loading") {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050508", color: "#8b8eff" }}>
        Loading duel environment...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#050508", color: "#f87171", gap: 16 }}>
        <p style={{ fontSize: 18, fontWeight: 600 }}>{loadError}</p>
        <Link href="/dashboard" style={{ color: "#8b8eff", textDecoration: "underline" }}>Return to Dashboard</Link>
      </div>
    );
  }

  if (!match || !challenge) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050508", color: "#8a8898" }}>
        Connecting to duel container...
      </div>
    );
  }

  const myTestsPassed = myPlayer?.testsPassed ?? (submitResult?.testsPassed ?? 0);
  const oppTestsPassed = opponentPlayer?.testsPassed ?? 0;
  const totalTests = challenge.totalTests;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#07070b", color: "#e8e6f0", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>
      {/* ── TOP HUD NAVIGATION ─────────────────────────────────────────────── */}
      <header style={{
        height: 52,
        background: "#0c0d14",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        flexShrink: 0
      }}>
        {/* Left: Brand & Track */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/dashboard" style={{ fontWeight: 800, fontSize: 16, color: "#fff", textDecoration: "none", letterSpacing: "-0.02em" }}>
            CodeDuel <span style={{ color: "#8b8eff" }}>Arena</span>
          </Link>
          <span style={{
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: 4,
            background: challenge.track === "PRODUCTION_SWE" ? "rgba(139,142,255,0.15)" : "rgba(251,191,36,0.15)",
            color: challenge.track === "PRODUCTION_SWE" ? "#8b8eff" : "#fbbf24",
            border: `1px solid ${challenge.track === "PRODUCTION_SWE" ? "rgba(139,142,255,0.3)" : "rgba(251,191,36,0.3)"}`
          }}>
            {challenge.track === "PRODUCTION_SWE" ? "Cloud SWE" : "Embedded Firmware"}
          </span>
          <span style={{ fontSize: 12, color: "#8a8898", fontFamily: "'JetBrains Mono', monospace" }}>
            {challenge.repoContext}
          </span>
        </div>

        {/* Center: Realtime Opponent Test Progress Sync */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* You */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80" }}>
              YOU ({myPlayer?.username})
            </span>
            <div style={{
              display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)",
              padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace"
            }}>
              <span style={{ color: myTestsPassed === totalTests ? "#4ade80" : "#fff", fontWeight: 700 }}>
                {myTestsPassed}/{totalTests}
              </span>
              <span style={{ color: "#8a8898" }}>passed</span>
            </div>
          </div>

          <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>VS</span>

          {/* Opponent */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: opponentPlayer?.isBot ? "#fbbf24" : "#f87171" }}>
              {opponentPlayer?.username || "Opponent"}
            </span>
            <div style={{
              display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)",
              padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace"
            }}>
              <span style={{ color: oppTestsPassed === totalTests ? "#4ade80" : "#fff", fontWeight: 700 }}>
                {oppTestsPassed}/{totalTests}
              </span>
              <span style={{ color: "#8a8898" }}>passed</span>
            </div>
            {/* Live progress indicator dot */}
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: match.status === "active" ? "#4ade80" : "#8a8898",
              boxShadow: match.status === "active" ? "0 0 8px #4ade80" : "none"
            }} title="Live short-polling synced" />
          </div>
        </div>

        {/* Right: AI Coach, Clock & Forfeit */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setShowCoach(true)}
            style={{
              background: "rgba(139,142,255,0.12)",
              border: "1px solid rgba(139,142,255,0.3)",
              color: "#8b8eff",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>💡 AI Coach</span>
            <span style={{
              background: "rgba(139,142,255,0.2)",
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              {Math.max(0, 3 - hintsUsed)} left
            </span>
          </button>

          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
            fontWeight: 700,
            color: timeLeft < 120000 ? "#f87171" : "#e8e6f0",
            background: "rgba(255,255,255,0.04)",
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            ⏱ {formatTime(timeLeft)}
          </div>
          <button
            onClick={handleForfeit}
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "#f87171",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Forfeit
          </button>
        </div>

      </header>

      {/* ── WORKSPACE SPLIT (Left: Ticket / Right: Multi-File Monaco) ──────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT PANEL: Production Ticket Inspector */}
        <div style={{
          width: "38%",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          background: "#0a0a10",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto"
        }}>
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              {challenge.title}
            </h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#8b8eff", fontFamily: "'JetBrains Mono', monospace" }}>
                Target: {challenge.totalTests} Unit Tests Required
              </span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
              <span style={{ fontSize: 11, color: "#8a8898", fontFamily: "'JetBrains Mono', monospace" }}>
                Test Runner: {challenge.entrypoint}
              </span>
            </div>
          </div>

          {/* Ticket Body */}
          <div style={{ padding: "20px", flex: 1, fontSize: 13, lineHeight: 1.6, color: "#c8c6d4" }}>
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 20
            }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#8b8eff", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📋 Ticket Brief & Root Cause
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                {challenge.ticketMarkdown}
              </div>
            </div>

            {/* Architecture / Multi-file explanation */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              padding: 16
            }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#fbbf24", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                🗂 Codebase Navigation
              </div>
              <p style={{ fontSize: 12, color: "#8a8898", marginBottom: 12 }}>
                This is a multi-file production repository. Switch between tabs on the right editor. Only the bug file is editable; reference headers, schemas, and test harnesses are read-only.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {challenge.files.map((f) => (
                  <div
                    key={f.name}
                    onClick={() => setActiveFileName(f.name)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: activeFileName === f.name ? "rgba(139,142,255,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${activeFileName === f.name ? "rgba(139,142,255,0.3)" : "rgba(255,255,255,0.05)"}`,
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace"
                    }}
                  >
                    <span>{f.name}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: f.readOnly ? "#8a8898" : "#4ade80"
                    }}>
                      {f.readOnly ? "🔒 Read-Only" : "✏️ Editable Patch"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Multi-File Monaco Editor Workspace */}
        <div style={{
          width: "62%",
          display: "flex",
          flexDirection: "column",
          background: "#0c0d14",
          overflow: "hidden"
        }}>
          {/* MONACO TABS BAR */}
          <div style={{
            height: 40,
            background: "#09090e",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            gap: 4,
            overflowX: "auto",
            flexShrink: 0
          }}>
            {challenge.files.map((f) => {
              const isActive = activeFileName === f.name;
              return (
                <button
                  key={f.name}
                  onClick={() => setActiveFileName(f.name)}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: isActive ? "#151624" : "transparent",
                    color: isActive ? "#fff" : "#8a8898",
                    border: "none",
                    borderBottom: isActive ? "2px solid #8b8eff" : "2px solid transparent",
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap"
                  }}
                >
                  <span>{f.readOnly ? "🔒" : "✏️"}</span>
                  <span>{f.name}</span>
                  {f.readOnly && (
                    <span style={{ fontSize: 9, opacity: 0.6, background: "rgba(255,255,255,0.08)", padding: "1px 4px", borderRadius: 3 }}>
                      RO
                    </span>
                  )}
                </button>
              );
            })}

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, paddingRight: 8 }}>
              {currentFile?.readOnly ? (
                <span style={{ fontSize: 11, color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace" }}>
                  🔒 Read-Only File (Reference Only)
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#4ade80", fontFamily: "'JetBrains Mono', monospace" }}>
                  ✏️ Modifying {activeFileName}
                </span>
              )}
            </div>
          </div>

          {/* MONACO EDITOR CONTAINER */}
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={monacoLanguage}
              value={files[activeFileName] ?? ""}
              onChange={handleEditorChange}
              options={{
                readOnly: currentFile?.readOnly ?? false,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                lineNumbers: "on",
                renderWhitespace: "selection",
              }}
              loading={
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b8eff" }}>
                  Initializing Monaco Editor Workspace...
                </div>
              }
            />
          </div>

          {/* BOTTOM RESULTS & ACTION BAR */}
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "#09090e",
            display: "flex",
            flexDirection: "column",
            maxHeight: submitResult ? "240px" : "56px",
            transition: "max-height 0.25s ease",
            flexShrink: 0
          }}>
            {/* Action Bar */}
            <div style={{
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {submitResult && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setActiveBottomTab("testResults")}
                      style={{
                        background: activeBottomTab === "testResults" ? "rgba(139,142,255,0.15)" : "transparent",
                        color: activeBottomTab === "testResults" ? "#8b8eff" : "#8a8898",
                        border: "1px solid rgba(255,255,255,0.08)",
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                        cursor: "pointer"
                      }}
                    >
                      Tests ({submitResult.testsPassed}/{submitResult.testsTotal})
                    </button>
                    <button
                      onClick={() => setActiveBottomTab("logs")}
                      style={{
                        background: activeBottomTab === "logs" ? "rgba(139,142,255,0.15)" : "transparent",
                        color: activeBottomTab === "logs" ? "#8b8eff" : "#8a8898",
                        border: "1px solid rgba(255,255,255,0.08)",
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                        cursor: "pointer"
                      }}
                    >
                      Runner Output
                    </button>
                  </div>
                )}
                {!submitResult && (
                  <span style={{ fontSize: 12, color: "#8a8898", fontFamily: "'JetBrains Mono', monospace" }}>
                    Unsaved edits are stored in state map across tabs. Click "Run Tests & Submit" to verify.
                  </span>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || match.status !== "active"}
                style={{
                  background: submitting ? "#3b3b4f" : "#4ade80",
                  color: "#050508",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: submitting ? "none" : "0 0 16px rgba(74,222,128,0.3)",
                  transition: "all 0.15s ease"
                }}
              >
                {submitting ? (
                  <>
                    <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #050508", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Running Test Suite...
                  </>
                ) : (
                  <>▶ Run Tests & Submit Fix</>
                )}
              </button>
            </div>

            {/* Test Results Drawer */}
            {submitResult && (
              <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px 20px 16px",
                background: "#050508",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace"
              }}>
                {activeBottomTab === "testResults" ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span style={{
                        color: submitResult.testsPassed === submitResult.testsTotal ? "#4ade80" : "#f87171",
                        fontWeight: 700
                      }}>
                        {submitResult.testsPassed === submitResult.testsTotal
                          ? "✓ ALL UNIT TESTS PASSED — MATCH WON!"
                          : `✗ ${submitResult.testsPassed}/${submitResult.testsTotal} TESTS PASSED`}
                      </span>
                    </div>

                    {submitResult.testResults && submitResult.testResults.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {submitResult.testResults.map((tr, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "4px 8px",
                              borderRadius: 4,
                              background: tr.passed ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)"
                            }}
                          >
                            <span style={{ color: tr.passed ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                              {tr.passed ? "[PASS]" : "[FAIL]"}
                            </span>
                            <span style={{ color: "#e8e6f0" }}>{tr.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre style={{ color: "#c8c6d4", whiteSpace: "pre-wrap", margin: 0 }}>
                        {submitResult.stdout || submitResult.stderr || "No test output returned."}
                      </pre>
                    )}
                  </div>
                ) : (
                  <pre style={{
                    color: submitResult.stderr ? "#f87171" : "#a8a6b8",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontSize: 11
                  }}>
                    {submitResult.stdout}
                    {submitResult.stderr && `\n\n[STDERR]\n${submitResult.stderr}`}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI COACH MODAL (Google Gemini 2.0 Flash) ─────────────────────── */}


      {showCoach && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#0c0d15",
            border: "1px solid rgba(139,142,255,0.3)",
            borderRadius: 14,
            padding: 26,
            maxWidth: 520,
            width: "90%",
            boxShadow: "0 24px 60px rgba(0,0,0,0.8)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>💡</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>
                    AI Socratic Coach
                  </h3>
                  <div style={{ fontSize: 11, color: "#8b8eff", fontFamily: "'JetBrains Mono', monospace" }}>
                    Powered by Google Gemini 2.0 Flash
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCoach(false)}
                style={{
                  background: "transparent", border: "none", color: "#8a8898",
                  fontSize: 18, cursor: "pointer", padding: 4
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#8a8898", marginBottom: 18, lineHeight: 1.4 }}>
              Receive progressive, Socratic guidance without giving away the full answer. You have {3 - hintsUsed} of 3 hints remaining.
            </p>

            {/* Hint History */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto", marginBottom: 18 }}>
              {hints.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "#6a6880", fontSize: 12 }}>
                  No hints requested yet. Stuck on this bug? Click below to request Tier 1 guidance.
                </div>
              ) : (
                hints.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(139,142,255,0.2)",
                      borderRadius: 8,
                      padding: "12px 14px"
                    }}
                  >
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#8b8eff",
                      textTransform: "uppercase",
                      marginBottom: 6
                    }}>
                      Tier {h.tier}: {h.tier === 1 ? "Conceptual Nudge" : h.tier === 2 ? "High-Level Approach" : "Implementation Insight"}
                    </div>
                    <div style={{ fontSize: 13, color: "#e8e6f0", lineHeight: 1.5 }}>
                      {h.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleRequestHint}
                disabled={hintLoading || hintsUsed >= 3}
                style={{
                  flex: 1,
                  background: hintsUsed >= 3 ? "#242533" : "#8b8eff",
                  color: hintsUsed >= 3 ? "#8a8898" : "#07070b",
                  border: "none",
                  padding: "12px 16px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: hintsUsed >= 3 || hintLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                {hintLoading ? (
                  <>Consulting Gemini 2.0 Flash...</>
                ) : hintsUsed >= 3 ? (
                  <>All 3 Hints Used</>
                ) : (
                  <>Get Tier {hintsUsed + 1} Hint ({hintsUsed === 0 ? "Nudge" : hintsUsed === 1 ? "Approach" : "Insight"})</>
                )}
              </button>
              <button
                onClick={() => setShowCoach(false)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e8e6f0",
                  padding: "12px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MATCH OVER MODAL ──────────────────────────────────────────────── */}
      {matchOver && (

        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#0f101a",
            border: `1px solid ${won ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`,
            borderRadius: 16,
            padding: "36px 40px",
            maxWidth: 460,
            width: "90%",
            textAlign: "center",
            boxShadow: "0 24px 60px rgba(0,0,0,0.8)"
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>
              {won === true ? "🏆" : won === false ? "💥" : "⏱"}
            </div>

            <h2 style={{
              fontSize: 26,
              fontWeight: 800,
              color: won === true ? "#4ade80" : won === false ? "#f87171" : "#fbbf24",
              marginBottom: 8
            }}>
              {won === true ? "VICTORY" : won === false ? "DEFEAT" : "DRAW / TIME OUT"}
            </h2>

            <p style={{ color: "#8a8898", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              {won === true
                ? "You satisfied all production test requirements before your opponent!"
                : won === false
                ? (finalMatchPayload?.winnerId === "bot_sentinel_ai"
                    ? "CodeSentinel AI passed all unit tests over 40 seconds."
                    : "The opponent patched the bug first.")
                : "Match expired without a winning patch."}
            </p>

            {/* ELO Result */}
            {finalMatchPayload && (
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "14px 20px",
                marginBottom: 24,
                display: "flex",
                justifyContent: "space-around"
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase" }}>Your Rating</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: won ? "#4ade80" : "#f87171" }}>
                    {won ? "+16 ELO" : "-16 ELO"}
                  </div>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase" }}>Challenge</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginTop: 4 }}>
                    {challenge.track === "PRODUCTION_SWE" ? "Cloud SWE" : "Embedded"}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <Link
                href="/dashboard"
                style={{
                  flex: 1,
                  background: "#8b8eff",
                  color: "#050508",
                  padding: "12px 20px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                  display: "inline-block"
                }}
              >
                Return to Dashboard
              </Link>
              <button
                onClick={() => router.push("/dashboard?action=find_match")}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  padding: "12px 20px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
