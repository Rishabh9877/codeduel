"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import Editor from "@monaco-editor/react";
import { SimulatedHardwarePanel } from "@/components/SimulatedHardwarePanel";
import type { HardwareContext } from "@/lib/challenges";

interface ChallengeFile {
  name: string;
  content: string;
  readOnly: boolean;
}

interface ChallengeWalkthrough {
  rootCause: string;
  buggyVsFixedDiff: string;
  whyItMatters: string;
  commonMistakes: string[];
}

interface Challenge {
  id: string;
  track: "PRODUCTION_SWE" | "EMBEDDED_SYSTEMS";
  language: "typescript" | "c" | "python";
  title: string;
  repoContext: string;
  ticketMarkdown: string;
  files: ChallengeFile[];
  entrypoint: string;
  totalTests: number;
  difficulty: "easy" | "medium" | "hard";
  estimatedMinutes: number;
  skills: string[];
  walkthrough?: ChallengeWalkthrough;
  hardwareContext?: HardwareContext;
  hiddenTestsCount?: number;
}

interface SubmitResult {
  passed: number;
  total: number;
  allPassed: boolean;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  status: string;
  testResults: Array<{ name: string; passed: boolean }>;
  solved?: boolean;
  walkthrough?: ChallengeWalkthrough;
  skillsPracticed?: string[];
  streak?: number;
}

function formatMinutesAndSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SoloPracticeArena() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const challengeId = params.id as string;
  const isDaily = searchParams.get("daily") === "1";
  const cohortCode = searchParams.get("cohort");

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Multi-file tabs
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFileName, setActiveFileName] = useState<string>("");

  // Mode & Timer
  const [mode, setMode] = useState<"timed" | "untimed">("timed");
  const [countdownMinutes, setCountdownMinutes] = useState<10 | 15 | 20>(15);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(15 * 60);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimeUp, setIsTimeUp] = useState(false);

  // Test run state
  const [testRunsCount, setTestRunsCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<"testResults" | "logs">("testResults");
  const [leftTab, setLeftTab] = useState<"ticket" | "hardware">("ticket");

  // AI Hint Coach
  const [showCoach, setShowCoach] = useState(false);
  const [hints, setHints] = useState<Array<{ text: string; tier: number }>>([]);
  const [hintLoading, setHintLoading] = useState(false);

  // Walkthrough
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);
  const [walkthroughData, setWalkthroughData] = useState<ChallengeWalkthrough | null>(null);
  const [unlockingWalkthrough, setUnlockingWalkthrough] = useState(false);
  const [walkthroughError, setWalkthroughError] = useState<string | null>(null);

  // Load challenge
  useEffect(() => {
    fetch(`/api/challenges/${challengeId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Challenge not found");
        return res.json();
      })
      .then((data) => {
        if (data.challenge) {
          const c: Challenge = data.challenge;
          setChallenge(c);

          const initialFiles: Record<string, string> = {};
          let editableName = "";
          c.files.forEach((f) => {
            initialFiles[f.name] = f.content;
            if (!f.readOnly && !editableName) editableName = f.name;
          });
          setFiles(initialFiles);
          setActiveFileName(editableName || c.files[0]?.name || "");

          // Adjust initial countdown to challenge estimatedMinutes if available
          if (c.estimatedMinutes === 10 || c.estimatedMinutes === 20) {
            setCountdownMinutes(c.estimatedMinutes as 10 | 20);
            setTimeRemainingSeconds(c.estimatedMinutes * 60);
          }
        }
      })
      .catch((err) => {
        setLoadError(err.message || "Failed to load challenge");
      });
  }, [challengeId]);

  // Master Timer Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((s) => s + 1);

      if (mode === "timed" && !isTimeUp) {
        setTimeRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsTimeUp(true);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, isTimeUp]);

  // Switch countdown preset
  const handleCountdownChange = (mins: 10 | 15 | 20) => {
    setCountdownMinutes(mins);
    setTimeRemainingSeconds(mins * 60);
    setIsTimeUp(false);
  };

  // Switch file
  const currentFile = useMemo(() => {
    if (!challenge) return null;
    return challenge.files.find((f) => f.name === activeFileName);
  }, [challenge, activeFileName]);

  const monacoLanguage = useMemo(() => {
    if (!activeFileName) return "typescript";
    if (activeFileName.endsWith(".c") || activeFileName.endsWith(".h")) return "c";
    if (activeFileName.endsWith(".py")) return "python";
    if (activeFileName.endsWith(".json")) return "json";
    if (activeFileName.endsWith(".md")) return "markdown";
    return "typescript";
  }, [activeFileName]);

  const handleEditorChange = (val: string | undefined) => {
    if (currentFile?.readOnly || val === undefined) return;
    setFiles((prev) => ({ ...prev, [activeFileName]: val }));
  };

  // Run Tests
  const handleRunTests = async () => {
    if (!challenge || submitting) return;
    setSubmitting(true);
    setTestRunsCount((c) => c + 1);

    try {
      const res = await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          files,
          isDaily,
        }),
      });

      const data = await res.json();
      setSubmitResult(data);

      if (data.allPassed) {
        if (cohortCode) {
          fetch("/api/campus/assignment/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: cohortCode,
              challengeId: challenge.id,
              timeTakenSeconds: secondsElapsed,
            }),
          }).catch((e) => console.warn("Failed to report campus lab progress:", e));
        }

        if (data.walkthrough) {
          setWalkthroughData(data.walkthrough);
          setShowWalkthroughModal(true);
        }
      }
    } catch (err) {
      console.error("Test submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Request AI Hint
  const handleRequestHint = async () => {
    if (!challenge || hintLoading || hints.length >= 3) return;
    setHintLoading(true);

    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice: true,
          practiceTier: hints.length + 1,
          challengeId: challenge.id,
          currentCode: files[activeFileName] || "",
          language: challenge.language,
          activeFileName,
        }),
      });

      const data = await res.json();
      if (data.hint) {
        setHints((prev) => [...prev, { text: data.hint, tier: data.tier || prev.length + 1 }]);
      }
    } catch (err) {
      console.error("Hint request error:", err);
    } finally {
      setHintLoading(false);
    }
  };

  // Give Up & Unlock Walkthrough Guard
  const canUnlockWalkthrough = testRunsCount >= 2 || secondsElapsed >= 180;

  const handleGiveUpAndUnlock = async () => {
    if (!challenge || unlockingWalkthrough) return;
    setUnlockingWalkthrough(true);
    setWalkthroughError(null);

    try {
      const res = await fetch("/api/practice/walkthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          attemptsCount: testRunsCount,
          secondsSpent: secondsElapsed,
        }),
      });

      const data = await res.json();
      if (data.walkthrough) {
        setWalkthroughData(data.walkthrough);
        setShowWalkthroughModal(true);
      } else if (data.error) {
        setWalkthroughError(data.error);
      }
    } catch (err: any) {
      setWalkthroughError(err.message || "Failed to unlock walkthrough");
    } finally {
      setUnlockingWalkthrough(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#000", color: "#f87171" }}>
        <h2>Error Loading Challenge</h2>
        <p style={{ color: "#8a8898" }}>{loadError}</p>
        <Link href="/practice" style={{ marginTop: 16, color: "#8b8eff", textDecoration: "underline" }}>
          ← Back to Catalog
        </Link>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", color: "#8b8eff" }}>
        Loading Challenge Environment...
      </div>
    );
  }

  const testsPassed = submitResult?.passed ?? 0;
  const totalTests = challenge.totalTests;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#07070b", color: "#e8e6f0", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>
      {/* ── TOP HUD NAVIGATION ─────────────────────────────────────────────── */}
      <header
        style={{
          height: 52,
          background: "#0c0d14",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          flexShrink: 0,
        }}
      >
        {/* Left: Back + Brand + Track */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href={cohortCode ? "/campus" : "/practice"}
            style={{
              fontSize: 12,
              color: "#8a8898",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {cohortCode ? "← Campus Lab" : "← Catalog"}
          </Link>

          <span style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>
            CodeDuel <span style={{ color: "#8b8eff" }}>Solo</span>
          </span>

          <span
            style={{
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: 4,
              background: challenge.track === "PRODUCTION_SWE" ? "rgba(56,189,248,0.15)" : "rgba(251,191,36,0.15)",
              color: challenge.track === "PRODUCTION_SWE" ? "#38bdf8" : "#fbbf24",
              border: `1px solid ${challenge.track === "PRODUCTION_SWE" ? "rgba(56,189,248,0.3)" : "rgba(251,191,36,0.3)"}`,
            }}
          >
            {challenge.track === "PRODUCTION_SWE" ? "SWE" : "ECE"}
          </span>

          {cohortCode && (
            <Link
              href="/campus"
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 7px",
                borderRadius: 4,
                background: "rgba(139,142,255,0.15)",
                color: "#c4b5fd",
                border: "1px solid rgba(139,142,255,0.3)",
                textDecoration: "none",
              }}
            >
              🏫 {cohortCode}
            </Link>
          )}

          <span style={{ fontSize: 12, color: "#8a8898", fontFamily: "'JetBrains Mono', monospace" }}>
            {challenge.repoContext}
          </span>
        </div>

        {/* Center: Mode Selector & Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: 2 }}>
            <button
              onClick={() => setMode("timed")}
              style={{
                background: mode === "timed" ? "#8b8eff" : "transparent",
                color: mode === "timed" ? "#000" : "#8a8898",
                border: "none",
                borderRadius: 4,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Timed
            </button>
            <button
              onClick={() => setMode("untimed")}
              style={{
                background: mode === "untimed" ? "#8b8eff" : "transparent",
                color: mode === "untimed" ? "#000" : "#8a8898",
                border: "none",
                borderRadius: 4,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Untimed
            </button>
          </div>

          {mode === "timed" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                value={countdownMinutes}
                onChange={(e) => handleCountdownChange(Number(e.target.value) as 10 | 15 | 20)}
                style={{
                  background: "#151624",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#c8c6d4",
                  fontSize: 11,
                  padding: "3px 6px",
                  borderRadius: 4,
                  outline: "none",
                }}
              >
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
              </select>

              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 14,
                  fontWeight: 700,
                  color: timeRemainingSeconds < 120 ? "#f43f5e" : "#4ade80",
                  background: "rgba(0,0,0,0.4)",
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                ⏱ {formatMinutesAndSeconds(timeRemainingSeconds)}
              </div>
            </div>
          ) : (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: "#8a8898",
              }}
            >
              ⏱ {formatMinutesAndSeconds(secondsElapsed)} elapsed
            </div>
          )}
        </div>

        {/* Right: AI Coach & Give Up & Test CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* AI Coach Button */}
          <button
            onClick={() => setShowCoach(true)}
            style={{
              background: "rgba(139,142,255,0.12)",
              border: "1px solid rgba(139,142,255,0.3)",
              color: "#c4b5fd",
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>💡</span>
            <span>AI Coach</span>
            {hints.length > 0 && (
              <span
                style={{
                  background: "#8b8eff",
                  color: "#000",
                  borderRadius: 10,
                  fontSize: 10,
                  padding: "1px 5px",
                  fontWeight: 800,
                }}
              >
                {hints.length}/3
              </span>
            )}
          </button>

          {/* Give up & See Walkthrough Button */}
          <button
            onClick={handleGiveUpAndUnlock}
            title={
              canUnlockWalkthrough
                ? "Unlock walkthrough & root cause explanation"
                : `Walkthrough locked: run tests 2x (${testRunsCount}/2) or spend 3 mins (${secondsElapsed}/180s)`
            }
            style={{
              background: canUnlockWalkthrough ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${canUnlockWalkthrough ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: canUnlockWalkthrough ? "#fde047" : "#525060",
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: canUnlockWalkthrough ? "pointer" : "not-allowed",
            }}
          >
            {canUnlockWalkthrough ? "📖 Walkthrough" : "🔒 Walkthrough"}
          </button>

          {/* Run Tests CTA */}
          <button
            onClick={handleRunTests}
            disabled={submitting}
            style={{
              background: "#8b8eff",
              color: "#000",
              border: "none",
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 0 15px rgba(139,142,255,0.3)",
            }}
          >
            {submitting ? "Evaluating..." : "▶ Run Tests"}
          </button>
        </div>
      </header>

      {/* ── TIME UP WARNING BANNER ────────────────────────────────────────── */}
      {isTimeUp && (
        <div
          style={{
            background: "#f43f5e",
            color: "#fff",
            padding: "8px 20px",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>⏱ Time is up! You can keep coding in untimed mode or reveal the walkthrough.</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => {
                setMode("untimed");
                setIsTimeUp(false);
              }}
              style={{
                background: "#000",
                color: "#fff",
                border: "none",
                padding: "3px 10px",
                borderRadius: 4,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Continue Untimed
            </button>
            <button
              onClick={handleGiveUpAndUnlock}
              style={{
                background: "#fff",
                color: "#000",
                border: "none",
                padding: "3px 10px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              See Walkthrough
            </button>
          </div>
        </div>
      )}

      {/* ── WORKSPACE SPLIT (Left: Ticket / Right: Editor) ────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT PANEL: Production Ticket Brief */}
        <div
          style={{
            width: "38%",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            background: "#0a0a10",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Header */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              {challenge.title}
            </h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#8b8eff", fontFamily: "'JetBrains Mono', monospace" }}>
                Target: {challenge.hiddenTestsCount ? `${challenge.totalTests - challenge.hiddenTestsCount} Visible + ${challenge.hiddenTestsCount} Hidden` : `${challenge.totalTests}`} Tests
              </span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
              <span style={{ fontSize: 11, color: "#8a8898", fontFamily: "'JetBrains Mono', monospace" }}>
                Runner: {challenge.entrypoint}
              </span>
            </div>

            {/* Hardware vs Ticket Tab Toggle (if hardwareContext exists) */}
            {challenge.hardwareContext && (
              <div style={{ display: "flex", gap: 4, marginTop: 10, background: "rgba(255,255,255,0.04)", padding: 2, borderRadius: 6 }}>
                <button
                  onClick={() => setLeftTab("ticket")}
                  style={{
                    flex: 1,
                    background: leftTab === "ticket" ? "#151624" : "transparent",
                    color: leftTab === "ticket" ? "#fff" : "#8a8898",
                    border: "none",
                    borderRadius: 4,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  📋 Incident Ticket
                </button>
                <button
                  onClick={() => setLeftTab("hardware")}
                  style={{
                    flex: 1,
                    background: leftTab === "hardware" ? "rgba(251,191,36,0.18)" : "transparent",
                    color: leftTab === "hardware" ? "#fbbf24" : "#8a8898",
                    border: "none",
                    borderRadius: 4,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ⚡ Hardware & Scope
                </button>
              </div>
            )}
          </div>

          {/* Conditional Left Body: Hardware Panel OR Ticket Brief */}
          {leftTab === "hardware" && challenge.hardwareContext ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <SimulatedHardwarePanel
                hardwareContext={challenge.hardwareContext}
                hiddenTestsCount={challenge.hiddenTestsCount}
              />
            </div>
          ) : (
          <div style={{ padding: "20px", flex: 1, fontSize: 13, lineHeight: 1.6, color: "#c8c6d4" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 12,
                  color: "#8b8eff",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                📋 Incident Report & Repro Steps
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                {challenge.ticketMarkdown}
              </div>
            </div>

            {/* Architecture Explanation */}
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 12,
                  color: "#fbbf24",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                🗂 Modular Architecture
              </div>
              <p style={{ fontSize: 12, color: "#8a8898", marginBottom: 12 }}>
                Switch between tabs on the right editor. Only the bug patch file is editable; reference headers and test suites are read-only.
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
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: activeFileName === f.name ? "rgba(139,142,255,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${activeFileName === f.name ? "rgba(139,142,255,0.3)" : "rgba(255,255,255,0.05)"}`,
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <span>{f.name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: f.readOnly ? "#8a8898" : "#4ade80",
                      }}
                    >
                      {f.readOnly ? "🔒 Read-Only" : "✏️ Editable"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* RIGHT PANEL: Multi-File Monaco Editor Workspace */}
        <div
          style={{
            width: "62%",
            display: "flex",
            flexDirection: "column",
            background: "#0c0d14",
            overflow: "hidden",
          }}
        >
          {/* TABS BAR */}
          <div
            style={{
              height: 40,
              background: "#09090e",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
              gap: 4,
              overflowX: "auto",
              flexShrink: 0,
            }}
          >
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
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>{f.readOnly ? "🔒" : "✏️"}</span>
                  <span>{f.name}</span>
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
                  ✏️ Editing {activeFileName}
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
                fontFamily: "'JetBrains Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                lineNumbers: "on",
              }}
              loading={
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b8eff" }}>
                  Initializing Editor...
                </div>
              }
            />
          </div>

          {/* BOTTOM TEST RESULTS DRAWER */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              background: "#09090e",
              display: "flex",
              flexDirection: "column",
              maxHeight: submitResult ? "240px" : "48px",
              transition: "max-height 0.2s ease",
              flexShrink: 0,
            }}
          >
            {/* Header bar */}
            <div
              style={{
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {submitResult ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setActiveBottomTab("testResults")}
                      style={{
                        background: activeBottomTab === "testResults" ? "rgba(139,142,255,0.15)" : "transparent",
                        border: "1px solid " + (activeBottomTab === "testResults" ? "rgba(139,142,255,0.3)" : "transparent"),
                        color: activeBottomTab === "testResults" ? "#8b8eff" : "#8a8898",
                        padding: "4px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Tests ({testsPassed}/{totalTests})
                    </button>
                    <button
                      onClick={() => setActiveBottomTab("logs")}
                      style={{
                        background: activeBottomTab === "logs" ? "rgba(139,142,255,0.15)" : "transparent",
                        border: "1px solid " + (activeBottomTab === "logs" ? "rgba(139,142,255,0.3)" : "transparent"),
                        color: activeBottomTab === "logs" ? "#8b8eff" : "#8a8898",
                        padding: "4px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Stdout / Stderr
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "#8a8898" }}>
                    Click &quot;Run Tests&quot; to compile and evaluate your patch against the test harness.
                  </span>
                )}
              </div>

              {submitResult && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: submitResult.allPassed ? "#4ade80" : "#f43f5e",
                      fontWeight: 700,
                    }}
                  >
                    {submitResult.allPassed ? "✓ ALL TESTS PASSED" : `✗ FAILED (${testsPassed}/${totalTests})`}
                  </span>
                  <span style={{ fontSize: 11, color: "#525060" }}>
                    {submitResult.runtimeMs}ms
                  </span>
                </div>
              )}
            </div>

            {/* Content drawer */}
            {submitResult && (
              <div style={{ flex: 1, padding: "10px 20px 16px", overflowY: "auto", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {activeBottomTab === "testResults" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {submitResult.testResults && submitResult.testResults.length > 0 ? (
                      submitResult.testResults.map((t, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: t.passed ? "rgba(74,222,128,0.06)" : "rgba(244,63,94,0.06)",
                            border: `1px solid ${t.passed ? "rgba(74,222,128,0.2)" : "rgba(244,63,94,0.2)"}`,
                          }}
                        >
                          <span style={{ color: t.passed ? "#4ade80" : "#f43f5e", fontWeight: 700 }}>
                            {t.passed ? "✓ PASS" : "✗ FAIL"}
                          </span>
                          <span style={{ color: "#e8e6f0" }}>{t.name}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "#8a8898" }}>No granular test outputs recorded. Check logs tab.</div>
                    )}
                  </div>
                ) : (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#c8c6d4" }}>
                    {submitResult.stdout || submitResult.stderr || "No terminal output generated."}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI COACH MODAL ─────────────────────────────────────────────────── */}
      {showCoach && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              background: "#0e0f18",
              border: "1px solid rgba(139,142,255,0.3)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>💡</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fff" }}>
                  Socratic AI Debug Coach
                </h3>
              </div>
              <button
                onClick={() => setShowCoach(false)}
                style={{ background: "none", border: "none", color: "#8a8898", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#8a8898", margin: "0 0 16px", lineHeight: 1.5 }}>
              The coach nudges you through 3 progressive insight tiers without writing code for you.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {hints.map((h, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(139,142,255,0.06)",
                    border: "1px solid rgba(139,142,255,0.2)",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#8b8eff", marginBottom: 4 }}>
                    TIER {h.tier}: {h.tier === 1 ? "Conceptual Mechanism" : h.tier === 2 ? "High-Level Approach" : "Directional Insight"}
                  </div>
                  <div style={{ fontSize: 13, color: "#f5f4f8", lineHeight: 1.5 }}>
                    {h.text}
                  </div>
                </div>
              ))}
              {hints.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#525060", fontSize: 13 }}>
                  No hints unlocked yet. Request Tier 1 below.
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#8a8898" }}>
                {3 - hints.length} hint{3 - hints.length === 1 ? "" : "s"} remaining
              </span>

              <button
                onClick={handleRequestHint}
                disabled={hintLoading || hints.length >= 3}
                style={{
                  background: hints.length >= 3 ? "rgba(255,255,255,0.05)" : "#8b8eff",
                  color: hints.length >= 3 ? "#525060" : "#000",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: hintLoading || hints.length >= 3 ? "not-allowed" : "pointer",
                }}
              >
                {hintLoading ? "Thinking..." : hints.length >= 3 ? "All Tiers Unlocked" : `Request Tier ${hints.length + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WALKTHROUGH & SOLUTION MODAL ──────────────────────────────────── */}
      {showWalkthroughModal && walkthroughData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#0e0f18",
              border: "1px solid rgba(74,222,128,0.3)",
              borderRadius: 16,
              padding: 28,
              boxShadow: "0 25px 60px rgba(0,0,0,0.9)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: submitResult?.allPassed ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.15)",
                    color: submitResult?.allPassed ? "#4ade80" : "#fbbf24",
                    border: `1px solid ${submitResult?.allPassed ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"}`,
                    borderRadius: 100,
                    padding: "3px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  {submitResult?.allPassed ? "🎉 CHALLENGE RESOLVED" : "📖 INCIDENT POST-MORTEM"}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#fff" }}>
                  {challenge.title}
                </h2>
              </div>

              <button
                onClick={() => setShowWalkthroughModal(false)}
                style={{ background: "none", border: "none", color: "#8a8898", fontSize: 20, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Root Cause */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#8b8eff", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px" }}>
                1. Root Cause Diagnosis
              </h4>
              <p style={{ fontSize: 13, color: "#e8e6f0", lineHeight: 1.6, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, margin: 0 }}>
                {walkthroughData.rootCause}
              </p>
            </div>

            {/* Buggy vs Fixed Diff */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px" }}>
                2. Surgical Code Diff (- Buggy / + Fixed)
              </h4>
              <pre
                style={{
                  background: "#050508",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#c8c6d4",
                  overflowX: "auto",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {walkthroughData.buggyVsFixedDiff}
              </pre>
            </div>

            {/* Why it matters */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px" }}>
                3. Production Impact & Why It Matters
              </h4>
              <p style={{ fontSize: 13, color: "#e8e6f0", lineHeight: 1.6, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, margin: 0 }}>
                {walkthroughData.whyItMatters}
              </p>
            </div>

            {/* Common Mistakes */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#f43f5e", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
                4. Common Pitfalls & Mistakes
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#c8c6d4", fontSize: 13, lineHeight: 1.6 }}>
                {(walkthroughData.commonMistakes || []).map((m, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{m}</li>
                ))}
              </ul>
            </div>

            {/* Acquired Skills Badges */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(challenge.skills || []).map((sk) => (
                  <span
                    key={sk}
                    style={{
                      background: "rgba(139,142,255,0.1)",
                      border: "1px solid rgba(139,142,255,0.25)",
                      color: "#c4b5fd",
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 6,
                    }}
                  >
                    ✓ {sk}
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <Link
                  href="/practice"
                  style={{
                    background: "#8b8eff",
                    color: "#000",
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "8px 18px",
                    borderRadius: 6,
                    textDecoration: "none",
                  }}
                >
                  Return to Catalog
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
