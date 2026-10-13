"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Cohort, CohortAssignment, CohortStudent } from "@/lib/campus";

const AVAILABLE_CHALLENGES = [
  { id: "embedded-ring-buffer", title: "UART Ring Buffer Wrap-Around", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-gpio-debounce", title: "GPIO Switch Contact Debounce", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-spi-endianness", title: "SPI 16-Bit Endianness Byte Swap", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-pwm-prescaler", title: "Timer PWM Prescaler Math", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-interrupt-race", title: "ISR Volatile Timestamp Race", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-packed-alignment", title: "ARM Cortex Memory Alignment", track: "EMBEDDED_SYSTEMS" },
  { id: "rate-limiter-token-bucket", title: "Rate Limiter Token Leaky Bucket", track: "PRODUCTION_SWE" },
  { id: "jwt-auth-expiration", title: "JWT Auth Expiration & Replay", track: "PRODUCTION_SWE" },
  { id: "lru-cache-eviction", title: "O(1) LRU Cache Eviction", track: "PRODUCTION_SWE" },
  { id: "payment-idempotency-race", title: "Payment Idempotency Mutex Race", track: "PRODUCTION_SWE" },
  { id: "websocket-reconnect-storm", title: "WebSocket Exponential Backoff", track: "PRODUCTION_SWE" },
  { id: "database-deadlock-retry", title: "PostgreSQL Deadlock Retry", track: "PRODUCTION_SWE" },
];

export default function CampusPage() {
  const { data: session } = useSession();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("ECE-301-EMBEDDED");
  const [activeCohort, setActiveCohort] = useState<
    (Cohort & { assignments: CohortAssignment[]; students: CohortStudent[]; userSubmissions?: Record<string, boolean> }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [loadingCohort, setLoadingCohort] = useState(false);

  // Modals state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);

  // Form states
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    code: "",
    title: "",
    department: "Dept. of Electrical & Computer Engineering",
    institution: "",
    description: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [asgForm, setAsgForm] = useState({
    title: "",
    challengeId: "embedded-ring-buffer",
    dueDate: "Due Friday, 11:59 PM",
    difficulty: "Medium",
    points: 100,
  });
  const [asgLoading, setAsgLoading] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);

  // Load user cohorts list
  useEffect(() => {
    fetch("/api/campus/cohorts")
      .then((r) => r.json())
      .then((data) => {
        if (data.cohorts) {
          setCohorts(data.cohorts);
          if (data.cohorts.length > 0 && !selectedCode) {
            setSelectedCode(data.cohorts[0].code);
          }
        }
      })
      .catch((err) => console.error("Failed to load cohorts:", err))
      .finally(() => setLoading(false));
  }, []);

  // Load details for selected cohort
  useEffect(() => {
    if (!selectedCode) return;
    setLoadingCohort(true);
    fetch(`/api/campus/cohort/${encodeURIComponent(selectedCode)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.cohort) {
          setActiveCohort(data.cohort);
        }
      })
      .catch((err) => console.error("Failed to load cohort details:", err))
      .finally(() => setLoadingCohort(false));
  }, [selectedCode]);

  const handleJoinCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoinLoading(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/campus/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join cohort");

      // Add to cohorts list if not already there
      setCohorts((prev) => {
        if (prev.some((c) => c.code === data.cohort.code)) return prev;
        return [data.cohort, ...prev];
      });
      setSelectedCode(data.cohort.code);
      setShowJoinModal(false);
      setJoinCodeInput("");
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.code || !createForm.title || !createForm.institution) {
      setCreateError("Course code, title, and university are required.");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/campus/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create cohort");

      setCohorts((prev) => [data.cohort, ...prev]);
      setSelectedCode(data.cohort.code);
      setShowCreateModal(false);
      setCreateForm({
        code: "",
        title: "",
        department: "Dept. of Electrical & Computer Engineering",
        institution: "",
        description: "",
      });
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asgForm.title || !activeCohort) return;
    setAsgLoading(true);

    try {
      const res = await fetch("/api/campus/assignment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activeCohort.code,
          title: asgForm.title,
          challengeId: asgForm.challengeId,
          dueDate: asgForm.dueDate,
          difficulty: asgForm.difficulty,
          points: asgForm.points,
        }),
      });
      const data = await res.json();
      if (res.ok && data.assignment) {
        setActiveCohort((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            assignments: [...prev.assignments, data.assignment],
            assignmentsCount: (prev.assignmentsCount || 0) + 1,
          };
        });
        setShowAddAssignmentModal(false);
        setAsgForm({
          title: "",
          challengeId: "embedded-ring-buffer",
          dueDate: "Due Friday, 11:59 PM",
          difficulty: "Medium",
          points: 100,
        });
      }
    } catch (err) {
      console.error("Failed to add assignment:", err);
    } finally {
      setAsgLoading(false);
    }
  };

  const copyJoinCode = () => {
    if (activeCohort && typeof window !== "undefined") {
      navigator.clipboard.writeText(activeCohort.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
              background: "rgba(139,142,255,0.15)",
              color: "#8b8eff",
              fontWeight: 700,
              letterSpacing: 0.5,
              border: "1px solid rgba(139,142,255,0.3)",
            }}
          >
            CAMPUS EDITION
          </span>
        </div>

        <div style={{ display: "flex", gap: 24, fontSize: 13, alignItems: "center" }}>
          <Link href="/practice" style={{ color: "#8a8898", textDecoration: "none" }}>
            Solo Arena
          </Link>
          <Link href="/dashboard" style={{ color: "#8a8898", textDecoration: "none" }}>
            1v1 Duels
          </Link>
          <Link href="/leaderboard" style={{ color: "#8a8898", textDecoration: "none" }}>
            Leaderboard
          </Link>
          <Link href="/profile" style={{ color: "#8a8898", textDecoration: "none" }}>
            Profile
          </Link>
          <Link href="/campus" style={{ color: "#fff", fontWeight: 700, textDecoration: "none" }}>
            Campus
          </Link>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setShowJoinModal(true)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🔑 Join Class with Code
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: "#8b8eff",
              border: "none",
              color: "#08090c",
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + Create Course Cohort
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 64px" }}>
        {/* ── B2B HERO BANNER ────────────────────────────────────────────── */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(139,142,255,0.08) 0%, rgba(56,189,248,0.04) 100%)",
            border: "1px solid rgba(139,142,255,0.2)",
            borderRadius: 14,
            padding: "24px 28px",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>🏫</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#8b8eff", textTransform: "uppercase", letterSpacing: 1 }}>
                College &amp; Departmental Course Integration
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}>
              Practical Incident Triage Labs for Engineering Curricula
            </h1>
            <p style={{ fontSize: 13, color: "#8a8898", margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
              Enable professors, TAs, and <strong>Placement Cells</strong> to run automated debugging labs for <strong>ECE / Embedded Systems</strong>, <strong>Core Cloud Software</strong>, and <strong>Service-Based IT Assessment tests (TCS NQT, Infosys, Cognizant, Accenture)</strong> with instant automated grading and cohort telemetry.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80" }}>100%</div>
              <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Automated Grading</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#8b8eff" }}>&lt; 5m</div>
              <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Median Triage Time</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>6+</div>
              <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Embedded C Labs</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8" }}>Dual</div>
              <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Product &amp; IT Service</div>
            </div>
          </div>
        </div>

        {/* ── COHORT TABS SELECTOR ───────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 20 }}>
          {cohorts.map((c) => {
            const isSelected = c.code === selectedCode;
            return (
              <button
                key={c.code}
                onClick={() => setSelectedCode(c.code)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: isSelected ? "rgba(139,142,255,0.15)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isSelected ? "rgba(139,142,255,0.4)" : "rgba(255,255,255,0.06)"}`,
                  color: isSelected ? "#fff" : "#8a8898",
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                }}
              >
                <span>{c.code}</span>
                {c.isDemo && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: "rgba(74,222,128,0.15)",
                      color: "#4ade80",
                    }}
                  >
                    Sample Demo
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── ACTIVE COHORT DETAIL VIEW ──────────────────────────────────── */}
        {loadingCohort || !activeCohort ? (
          <div style={{ padding: "64px 0", textAlign: "center", color: "#8b8eff" }}>
            Loading course dashboard...
          </div>
        ) : (
          <div>
            {/* COHORT HEADER CARD */}
            <div
              style={{
                background: "#0d0e14",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "24px 28px",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#8b8eff",
                        background: "rgba(139,142,255,0.12)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: "1px solid rgba(139,142,255,0.25)",
                      }}
                    >
                      {activeCohort.code}
                    </span>
                    <span style={{ fontSize: 12, color: "#6e6d7a" }}>
                      {activeCohort.department} · {activeCohort.institution}
                    </span>
                    {activeCohort.isDemo && (
                      <span style={{ fontSize: 10, color: "#4ade80", background: "rgba(74,222,128,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                        Sample Data
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}>
                    {activeCohort.title}
                  </h2>
                  <div style={{ fontSize: 12, color: "#8a8898", marginBottom: 12 }}>
                    Instructor: <strong>{activeCohort.instructorName}</strong>
                  </div>
                  <p style={{ fontSize: 12, color: "#a09fb0", margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
                    {activeCohort.description}
                  </p>
                </div>

                {/* JOIN CODE ACTION BOX */}
                <div
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: "14px 18px",
                    textAlign: "right",
                  }}
                >
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase", marginBottom: 4 }}>
                    Student Join Code
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: 1, marginBottom: 8 }}>
                    {activeCohort.code}
                  </div>
                  <button
                    onClick={copyJoinCode}
                    style={{
                      background: "rgba(139,142,255,0.15)",
                      border: "1px solid rgba(139,142,255,0.3)",
                      color: "#8b8eff",
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {copiedCode ? "✓ Copied to Clipboard" : "Copy Join Code"}
                  </button>
                </div>
              </div>

              {/* QUICK STATS BAR */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Enrolled Students</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                    {activeCohort.students.length || activeCohort.studentCount} Engineers
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Lab Assignments</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#8b8eff", marginTop: 2 }}>
                    {activeCohort.assignments.length} Total
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Cohort Median ELO</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80", marginTop: 2 }}>
                    {Math.round(
                      activeCohort.students.reduce((acc, s) => acc + s.elo, 0) /
                        (activeCohort.students.length || 1)
                    )}{" "}
                    Rating
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Incident Pass Rate</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", marginTop: 2 }}>
                    84.2% Passed
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2-COLUMN MAIN LAYOUT ───────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }}>
              {/* ── LEFT: LAB ASSIGNMENTS ───────────────────────────────── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Assigned Incident Triage Labs ({activeCohort.assignments.length})
                  </h3>
                  <button
                    onClick={() => setShowAddAssignmentModal(true)}
                    style={{
                      background: "rgba(139,142,255,0.12)",
                      border: "1px solid rgba(139,142,255,0.3)",
                      color: "#8b8eff",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    + Assign New Lab
                  </button>
                </div>

                {activeCohort.assignments.length === 0 ? (
                  <div style={{ background: "#0d0e14", borderRadius: 10, padding: 32, textAlign: "center", color: "#6e6d7a" }}>
                    No lab assignments configured yet. Click "+ Assign New Lab" to schedule one.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {activeCohort.assignments.map((asg, idx) => {
                      const isCompleted = activeCohort.userSubmissions?.[asg.assignmentId];
                      return (
                        <div
                          key={asg.assignmentId}
                          style={{
                            background: "#0d0e14",
                            border: `1px solid ${isCompleted ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}`,
                            borderRadius: 12,
                            padding: "18px 20px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span
                                  style={{
                                    fontSize: 9,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    background:
                                      asg.track === "EMBEDDED_SYSTEMS"
                                        ? "rgba(251,191,36,0.15)"
                                        : "rgba(56,189,248,0.15)",
                                    color: asg.track === "EMBEDDED_SYSTEMS" ? "#fbbf24" : "#38bdf8",
                                  }}
                                >
                                  {asg.track === "EMBEDDED_SYSTEMS" ? "⚡ EMBEDDED C" : "☁️ CLOUD SWE"}
                                </span>
                                <span style={{ fontSize: 11, color: "#6e6d7a" }}>{asg.dueDate}</span>
                                {isCompleted && (
                                  <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>
                                    ✓ Completed
                                  </span>
                                )}
                              </div>
                              <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#fff" }}>
                                {asg.title}
                              </h4>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b8eff" }}>
                                {asg.points} pts
                              </div>
                              <div style={{ fontSize: 10, color: "#6e6d7a" }}>{asg.difficulty}</div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                            <Link
                              href={`/practice/${asg.challengeId}?cohort=${encodeURIComponent(activeCohort.code)}`}
                              style={{
                                flex: 1,
                                textAlign: "center",
                                background: isCompleted ? "rgba(255,255,255,0.05)" : "#8b8eff",
                                color: isCompleted ? "#fff" : "#08090c",
                                fontWeight: 700,
                                fontSize: 12,
                                padding: "8px 14px",
                                borderRadius: 6,
                                textDecoration: "none",
                              }}
                            >
                              {isCompleted ? "Re-enter Solo Lab Arena" : "⚡ Launch Solo Lab Arena"}
                            </Link>
                            <Link
                              href={`/dashboard?action=find_match&track=${asg.track}`}
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: 12,
                                padding: "8px 14px",
                                borderRadius: 6,
                                textDecoration: "none",
                              }}
                            >
                              ⚔️ 1v1 Peer Duel
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── RIGHT: COHORT LEADERBOARD & FACULTY AUDIT ────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* COHORT LEADERBOARD */}
                <div
                  style={{
                    background: "#0d0e14",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Class Roster &amp; Ranking
                    </h3>
                    <span style={{ fontSize: 11, color: "#6e6d7a" }}>
                      {activeCohort.students.length} Ranked
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {activeCohort.students.map((student, idx) => (
                      <div
                        key={student.userId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: idx === 0 ? "rgba(139,142,255,0.08)" : "rgba(255,255,255,0.02)",
                          border: idx === 0 ? "1px solid rgba(139,142,255,0.25)" : "1px solid transparent",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: idx === 0 ? "#fbbf24" : idx === 1 ? "#cbd5e1" : idx === 2 ? "#d97706" : "#6e6d7a",
                              width: 18,
                            }}
                          >
                            #{idx + 1}
                          </span>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: "#161722",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              overflow: "hidden",
                            }}
                          >
                            {student.avatar ? (
                              <img src={student.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              student.username[0]?.toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                              {student.username}
                            </div>
                            <div style={{ fontSize: 10, color: "#6e6d7a" }}>
                              {student.completedAssignmentsCount} Labs Completed
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#8b8eff" }}>
                            {student.elo}
                          </div>
                          <div style={{ fontSize: 9, color: "#6e6d7a" }}>ELO</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FACULTY TRIAGE TELEMETRY (B2B DEMO CARD) */}
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(74,222,128,0.04) 0%, rgba(139,142,255,0.03) 100%)",
                    border: "1px solid rgba(74,222,128,0.2)",
                    borderRadius: 14,
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>📊</span>
                    <h4 style={{ fontSize: 12, fontWeight: 700, margin: 0, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Faculty Diagnostic Telemetry
                    </h4>
                  </div>
                  <p style={{ fontSize: 11, color: "#8a8898", margin: "0 0 14px", lineHeight: 1.5 }}>
                    Automated telemetry compiled across Docker / VM test runs for this cohort.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                      <span style={{ color: "#6e6d7a" }}>Most Common Root Cause:</span>
                      <strong style={{ color: "#fbbf24" }}>Ring Buffer Wrap-Around Pointer</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                      <span style={{ color: "#6e6d7a" }}>Median Patch Latency:</span>
                      <strong style={{ color: "#4ade80" }}>4 min 18 sec</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6e6d7a" }}>Test Harness Pass Ratio:</span>
                      <strong style={{ color: "#38bdf8" }}>92.4%</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── JOIN CLASS MODAL ────────────────────────────────────────────── */}
      {showJoinModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#0d0e14",
              border: "1px solid rgba(139,142,255,0.3)",
              borderRadius: 14,
              padding: 28,
              maxWidth: 440,
              width: "100%",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#fff" }}>
              Enroll in a College Course
            </h3>
            <p style={{ fontSize: 12, color: "#8a8898", margin: "0 0 20px", lineHeight: 1.5 }}>
              Enter the join code provided by your course instructor (e.g. <code>ECE-301-EMBEDDED</code>).
            </p>

            <form onSubmit={handleJoinCohort}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                  COURSE JOIN CODE
                </label>
                <input
                  type="text"
                  placeholder="e.g. ECE-301-EMBEDDED"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "10px 14px",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {joinError && (
                <div style={{ color: "#f43f5e", fontSize: 12, marginBottom: 14 }}>
                  {joinError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8a8898",
                    padding: "10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  style={{
                    flex: 1,
                    background: "#8b8eff",
                    border: "none",
                    color: "#08090c",
                    fontWeight: 700,
                    padding: "10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {joinLoading ? "Enrolling..." : "Enroll in Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE COURSE MODAL ─────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#0d0e14",
              border: "1px solid rgba(139,142,255,0.3)",
              borderRadius: 14,
              padding: 28,
              maxWidth: 500,
              width: "100%",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#fff" }}>
              Create Faculty Course Cohort
            </h3>
            <p style={{ fontSize: 12, color: "#8a8898", margin: "0 0 20px", lineHeight: 1.5 }}>
              Set up an interactive debugging section for your students.
            </p>

            <form onSubmit={handleCreateCohort}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                    COURSE CODE
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ECE-420-RTOS"
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      color: "#fff",
                      fontFamily: "inherit",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                    INSTITUTION / UNIVERSITY
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stanford University"
                    value={createForm.institution}
                    onChange={(e) => setCreateForm({ ...createForm, institution: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      color: "#fff",
                      fontFamily: "inherit",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                  COURSE TITLE
                </label>
                <input
                  type="text"
                  placeholder="e.g. ECE-420: Real-Time Embedded DSP &amp; Microcontrollers"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                  SYLLABUS / DESCRIPTION
                </label>
                <textarea
                  rows={3}
                  placeholder="Low-level firmware debugging, interrupt races, and memory management."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {createError && (
                <div style={{ color: "#f43f5e", fontSize: 12, marginBottom: 14 }}>
                  {createError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8a8898",
                    padding: "10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    flex: 1,
                    background: "#8b8eff",
                    border: "none",
                    color: "#08090c",
                    fontWeight: 700,
                    padding: "10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {createLoading ? "Creating..." : "Create Course Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD ASSIGNMENT MODAL ────────────────────────────────────────── */}
      {showAddAssignmentModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#0d0e14",
              border: "1px solid rgba(139,142,255,0.3)",
              borderRadius: 14,
              padding: 28,
              maxWidth: 480,
              width: "100%",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#fff" }}>
              Assign Incident Triage Lab
            </h3>
            <p style={{ fontSize: 12, color: "#8a8898", margin: "0 0 20px", lineHeight: 1.5 }}>
              Select a pre-built modular debugging incident for {activeCohort?.code}.
            </p>

            <form onSubmit={handleCreateAssignment}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                  LAB ASSIGNMENT TITLE
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab 5: ARM Cortex Memory Alignment Triage"
                  value={asgForm.title}
                  onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                  DEBUGGING CHALLENGE CURRICULUM
                </label>
                <select
                  value={asgForm.challengeId}
                  onChange={(e) => setAsgForm({ ...asgForm, challengeId: e.target.value })}
                  style={{
                    width: "100%",
                    background: "#161722",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
                >
                  {AVAILABLE_CHALLENGES.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      [{ch.track === "EMBEDDED_SYSTEMS" ? "EMBEDDED C" : "SWE"}] {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                    DUE DATE / DEADLINE
                  </label>
                  <input
                    type="text"
                    value={asgForm.dueDate}
                    onChange={(e) => setAsgForm({ ...asgForm, dueDate: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      color: "#fff",
                      fontFamily: "inherit",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                    POINTS
                  </label>
                  <input
                    type="number"
                    value={asgForm.points}
                    onChange={(e) => setAsgForm({ ...asgForm, points: Number(e.target.value) })}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      color: "#fff",
                      fontFamily: "inherit",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddAssignmentModal(false)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8a8898",
                    padding: "10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={asgLoading}
                  style={{
                    flex: 1,
                    background: "#8b8eff",
                    border: "none",
                    color: "#08090c",
                    fontWeight: 700,
                    padding: "10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {asgLoading ? "Assigning..." : "Assign to Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
