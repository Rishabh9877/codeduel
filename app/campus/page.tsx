"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import type { Cohort, CohortAssignment, CohortStudent, CohortSubmission, CohortStats } from "@/lib/campus-data";
import { getDemoCohorts, SEEDED_COHORTS } from "@/lib/campus-data";
import RoleBadgeSwitcher from "@/components/RoleBadgeSwitcher";
import type { UserRole } from "@/components/RoleSwitcherModal";
import AppNavbar from "@/components/AppNavbar";
import { useUserRole } from "@/lib/useUserRole";

const AVAILABLE_CHALLENGES = [
  { id: "embedded-ring-buffer", title: "UART Ring Buffer Wrap-Around", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-gpio-debounce", title: "GPIO Switch Contact Debounce", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-spi-endianness", title: "SPI 16-Bit Endianness Byte Swap", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-pwm-prescaler", title: "Timer PWM Prescaler Math", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-interrupt-race", title: "ISR Volatile Timestamp Race", track: "EMBEDDED_SYSTEMS" },
  { id: "embedded-packed-alignment", title: "ARM Cortex Memory Alignment", track: "EMBEDDED_SYSTEMS" },
  { id: "swe-token-bucket", title: "Rate Limiter Token Leaky Bucket", track: "PRODUCTION_SWE" },
  { id: "swe-jwt-alg-confusion", title: "JWT Auth Expiration & Replay", track: "PRODUCTION_SWE" },
  { id: "swe-cache-stampede", title: "SingleFlight Mutex Lock", track: "PRODUCTION_SWE" },
  { id: "swe-url-query-sanitizer", title: "URL Query Sanitization & Splitting", track: "PRODUCTION_SWE" },
  { id: "swe-retry-backoff", title: "Exponential Backoff Jitter Clamping", track: "PRODUCTION_SWE" },
  { id: "swe-connection-pool-leak", title: "PostgreSQL Deadlock Retry", track: "PRODUCTION_SWE" },
];

export default function CampusPage() {
  const { data: session } = useSession();
  const {
    role: userRole,
    setRole: setUserRole,
    isIndividual,
    isStudent,
    isFaculty,
    isAdmin,
  } = useUserRole();

  const [cohorts, setCohorts] = useState<Cohort[]>(() => getDemoCohorts());
  const [demoCohorts, setDemoCohorts] = useState<Cohort[]>(() => getDemoCohorts());
  const [selectedCode, setSelectedCode] = useState<string>("ECE-204-EMBEDDED");
  const [activeCohort, setActiveCohort] = useState<
    (Cohort & {
      assignments: CohortAssignment[];
      students: CohortStudent[];
      userSubmissions?: Record<string, boolean>;
      allSubmissions?: CohortSubmission[];
      stats?: CohortStats;
    }) | null
  >(() => {
    const demo = SEEDED_COHORTS[0];
    return {
      ...demo,
      isDemo: false,
      userSubmissions: { "asg-ring-buffer": true, "asg-gpio-debounce": true },
      allSubmissions: demo.students.flatMap((s, sIdx) => [
        {
          userId: s.userId,
          username: s.username,
          assignmentId: "asg-ring-buffer",
          status: "PASSED",
          timeTakenSeconds: 180 + ((sIdx * 17) % 110),
          passedAt: new Date(Date.now() - 3600000 * 48 + sIdx * 3600000).toISOString(),
        },
        ...(s.completedAssignmentsCount >= 2
          ? [
              {
                userId: s.userId,
                username: s.username,
                assignmentId: "asg-gpio-debounce",
                status: "PASSED",
                timeTakenSeconds: 220 + ((sIdx * 23) % 130),
                passedAt: new Date(Date.now() - 3600000 * 24 + sIdx * 3600000).toISOString(),
              },
            ]
          : []),
      ]),
      stats: {
        totalStudents: demo.students.length,
        totalSubmissions: 28,
        avgTimeSeconds: 245,
        passRate: 84,
      },
    };
  });
  const [loading, setLoading] = useState(false);
  const [loadingCohort, setLoadingCohort] = useState(false);

  const userId = session?.user ? (((session.user as any).id || (session.user as any).sub) as string) : "";
  // Role permissions follow the actively selected role in the switcher (so admin can test as normal student)
  const isFacultyUser = isFaculty;
  const isCohortInstructor = Boolean(activeCohort && (isAdmin || (userId && activeCohort.instructorId === userId)));
  const canManageCohort = isFacultyUser || isCohortInstructor;
  const isDemoCohort = !session?.user && Boolean(activeCohort?.isDemo);

  // Modals state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);

  // Form states
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [selectedJoinCodes, setSelectedJoinCodes] = useState<string[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [exitLoading, setExitLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    code: "",
    title: "",
    department: "Dept. of Computer Science & Engineering",
    institution: "",
    description: "",
    facultyPasscode: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [asgForm, setAsgForm] = useState({
    title: "",
    challengeId: "embedded-ring-buffer",
    dueDate: "Due Friday, 11:59 PM",
    difficulty: "Medium",
    points: 100,
    minTestsPassing: 3,
  });
  const [asgLoading, setAsgLoading] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);

  // Automated CSV Gradebook Generator using real enrolled students and real submission data
  const handleDownloadCSV = () => {
    if (!activeCohort) return;
    if (!activeCohort.students || activeCohort.students.length === 0) {
      alert(
        `No students are currently enrolled in ${activeCohort.code}. When students join with code "${activeCohort.code}" and complete assignments, their real grades will export here.`
      );
      return;
    }

    const isDemoCohort = !session?.user && Boolean(activeCohort.isDemo);
    const headers = [
      "Student Name",
      "Student ID",
      "Course Code",
      "Course Title",
      "Completed Labs",
      "Total Labs",
      "Gradebook Score (%)",
      "Cohort ELO",
      "Enrolled Date",
      "Curriculum Status",
      "Data Mode",
    ];

    const totalLabs = activeCohort.assignments.length;

    const rows = activeCohort.students.map((s) => {
      const completed = Number(s.completedAssignmentsCount || 0);
      const scorePercent = totalLabs > 0 ? Math.min(100, Math.round((completed / totalLabs) * 100)) : 0;
      const enrolled = s.enrolledAt ? new Date(s.enrolledAt).toLocaleDateString() : "Active";
      const status =
        completed === totalLabs && totalLabs > 0
          ? "ALL LABS COMPLETED"
          : `${completed} OF ${totalLabs} COMPLETED`;

      return [
        `"${(s.username || "Student").replace(/"/g, '""')}"`,
        `"${s.userId}"`,
        `"${activeCohort.code}"`,
        `"${activeCohort.title.replace(/"/g, '""')}"`,
        completed,
        totalLabs,
        `${scorePercent}%`,
        s.elo,
        `"${enrolled}"`,
        `"${status}"`,
        `"${isDemoCohort ? "SAMPLE DEMO DATA" : "AUTHENTIC"}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      isDemoCohort
        ? `${activeCohort.code}_Sample_Demo_Gradebook.csv`
        : `${activeCohort.code}_Official_Gradebook.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load user cohorts list and sync user role
  useEffect(() => {
    Promise.all([
      fetch("/api/campus/cohorts").then((r) => r.json()),
      fetch("/api/user/me").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([cohortData]) => {
        if (cohortData.demoCohorts) {
          setDemoCohorts(cohortData.demoCohorts);
        }

        if (cohortData.cohorts && cohortData.cohorts.length > 0) {
          setCohorts(cohortData.cohorts);
          if (!selectedCode) {
            setSelectedCode(cohortData.cohorts[0].code);
          }
        } else if (cohortData.demoCohorts && cohortData.demoCohorts.length > 0) {
          // Unauthenticated visitors or guests see demo cohorts immediately
          setCohorts(cohortData.demoCohorts);
          if (!selectedCode) {
            setSelectedCode(cohortData.demoCohorts[0].code);
          }
        } else {
          setCohorts([]);
        }
      })
      .catch((err) => console.error("Failed to load campus data:", err))
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

  const handleJoinCohort = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Parse codes from input (split by commas, spaces, newlines, semicolons)
    const manualCodes = joinCodeInput
      .split(/[\s,;]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const allCodesToJoin = Array.from(new Set([...selectedJoinCodes, ...manualCodes]));

    if (allCodesToJoin.length === 0) {
      setJoinError("Please select at least one course or enter course code(s).");
      return;
    }

    if (!session?.user) {
      if (confirm("Sign in with GitHub is required to enroll in college class cohorts. Would you like to sign in now?")) {
        signIn("github");
      }
      return;
    }

    setJoinLoading(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/campus/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: allCodesToJoin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join cohorts");

      const newlyJoined = Array.isArray(data.cohorts) && data.cohorts.length > 0 ? data.cohorts : [data.cohort];

      // Add to cohorts list
      setCohorts((prev) => {
        const existingCodes = new Set(prev.map((c) => c.code));
        const toAdd = newlyJoined.filter((c: any) => !existingCodes.has(c.code));
        return [...toAdd, ...prev];
      });

      if (newlyJoined.length > 0) {
        setSelectedCode(newlyJoined[0].code);
      }

      setShowJoinModal(false);
      setJoinCodeInput("");
      setSelectedJoinCodes([]);

      alert(
        `🎉 Successfully enrolled in ${newlyJoined.length} course${
          newlyJoined.length > 1 ? "s" : ""
        }: ${newlyJoined.map((c: any) => c.code).join(", ")}!`
      );
    } catch (err: any) {
      setJoinError(err.message || "Failed to join courses.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleEnrollCurrentCohort = async (code: string) => {
    if (!session?.user) {
      signIn("github");
      return;
    }
    setJoinLoading(true);
    try {
      const res = await fetch("/api/campus/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join cohort");
      const cRes = await fetch(`/api/campus/cohort/${encodeURIComponent(code)}`);
      const cData = await cRes.json();
      if (cData.cohort) {
        setActiveCohort(cData.cohort);
      }
      setCohorts((prev) => {
        if (prev.some((c) => c.code === code)) return prev;
        return [data.cohort || { ...activeCohort }, ...prev];
      });
      alert(`🎉 Successfully enrolled in ${code}! Your autograded labs and course gradebook are now active.`);
    } catch (err: any) {
      alert(err.message || "Could not enroll in class.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleExitCohort = async (code: string) => {
    const cohortToExit = cohorts.find((c) => c.code === code) || activeCohort;
    const courseTitle = cohortToExit?.title || code;

    if (
      !confirm(
        `Are you sure you want to unenroll and exit ${code} (${courseTitle})?\n\nYou will be removed from the class roster and this course will no longer appear on your dashboard.`
      )
    ) {
      return;
    }

    setExitLoading(true);
    try {
      const res = await fetch("/api/campus/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to exit course");

      // Update cohorts list in state
      const remaining = cohorts.filter((c) => c.code !== code);
      setCohorts(remaining);

      // If we exited the currently selected cohort, switch to next available cohort or clear selection
      if (selectedCode === code) {
        if (remaining.length > 0) {
          setSelectedCode(remaining[0].code);
        } else {
          setSelectedCode("");
          setActiveCohort(null);
        }
      }

      alert(`✓ You have successfully exited ${code}.`);
    } catch (err: any) {
      alert(err.message || "Could not exit course.");
    } finally {
      setExitLoading(false);
    }
  };

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.code || !createForm.title || !createForm.institution) {
      setCreateError("Course code, title, and university are required.");
      return;
    }

    if (!session?.user) {
      if (confirm("Sign in with GitHub is required to create a permanent college cohort. Would you like to sign in now?")) {
        signIn("github");
      }
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
        facultyPasscode: "",
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

    // If unauthenticated guest, simulate adding it to preview state so user can evaluate UI
    if (!session?.user) {
      const newDemoAsg: CohortAssignment = {
        assignmentId: `asg-demo-${Date.now()}`,
        title: asgForm.title,
        challengeId: asgForm.challengeId,
        dueDate: asgForm.dueDate,
        track: (AVAILABLE_CHALLENGES.find((c) => c.id === asgForm.challengeId)?.track as any) || "PRODUCTION_SWE",
        difficulty: asgForm.difficulty as any,
        points: Number(asgForm.points || 100),
        createdAt: new Date().toISOString(),
      };
      setActiveCohort((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          assignments: [...prev.assignments, newDemoAsg],
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
        minTestsPassing: 3,
      });
      alert("✨ Demo lab assigned! Added to preview syllabus so you can test the interface. Sign in with GitHub to save permanent cohorts.");
      return;
    }

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
      if (!res.ok) {
        alert(data.error || "Failed to create assignment.");
        return;
      }
      if (data.assignment) {
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
          minTestsPassing: 3,
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
      <AppNavbar activePage="campus" />

      {isIndividual && !isAdmin ? (
        <div style={{ maxWidth: 880, margin: "40px auto 80px", padding: "0 24px" }}>
          {/* Institutional Gateway for Individual Developers */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(139,142,255,0.08) 0%, rgba(56,189,248,0.04) 100%)",
              border: "1px solid rgba(139,142,255,0.25)",
              borderRadius: 18,
              padding: "44px 36px",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(139,142,255,0.05)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(139,142,255,0.12)",
                border: "1px solid rgba(139,142,255,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                margin: "0 auto 18px",
              }}
            >
              🏛️
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 100,
                background: "rgba(139,142,255,0.15)",
                color: "#8b8eff",
                border: "1px solid rgba(139,142,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: 1,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Academic &amp; University Portal
            </span>

            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "14px 0 8px", color: "#fff", letterSpacing: "-0.02em" }}>
              Codeduel Campus Edition
            </h1>
            <p style={{ fontSize: 14, color: "#9ca3af", maxWidth: 620, margin: "0 auto 32px", lineHeight: 1.6 }}>
              You are currently viewing Codeduel with an <strong>Individual Developer</strong> profile. Campus Edition is an institutional environment dedicated to university course cohorts, student lab autograding, and verified faculty grading.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, textAlign: "left", marginBottom: 32 }}>
              {/* Option 1: College Student */}
              <div
                style={{
                  background: "rgba(74,222,128,0.04)",
                  border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: 14,
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>🎓</span>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fff" }}>
                        I am a College Student
                      </h3>
                      <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 600 }}>Enrolled Student Portal</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#9ca3af", lineHeight: 1.5, margin: "0 0 16px" }}>
                    Join your professor's class cohort using an invite code. Complete assigned SWE &amp; Embedded debugging labs with real-time autograder scoring.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setUserRole("STUDENT");
                  }}
                  style={{
                    background: "#4ade80",
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    padding: "11px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    width: "100%",
                  }}
                >
                  <span>🎓</span>
                  <span>Enter as College Student →</span>
                </button>
              </div>

              {/* Option 2: Faculty Member */}
              <div
                style={{
                  background: "rgba(56,189,248,0.04)",
                  border: "1px solid rgba(56,189,248,0.2)",
                  borderRadius: 14,
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>🏛️</span>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fff" }}>
                        I am Faculty / Instructor
                      </h3>
                      <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600 }}>Educator Command Center</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#9ca3af", lineHeight: 1.5, margin: "0 0 16px" }}>
                    Create departmental cohorts, author incident triage assignments, monitor live student submission telemetry, and export official CSV gradebooks.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setUserRole("FACULTY");
                  }}
                  style={{
                    background: "#38bdf8",
                    color: "#08090c",
                    border: "none",
                    borderRadius: 8,
                    padding: "11px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    width: "100%",
                  }}
                >
                  <span>🏛️</span>
                  <span>Enter as Faculty / Instructor →</span>
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 20 }}>
              <Link
                href="/dashboard"
                style={{
                  fontSize: 13,
                  color: "#8a8898",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8a8898")}
              >
                <span>←</span>
                <span>Return to Individual Competitive 1v1 Arena</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 64px" }}>
        {/* ── DEMO PROTOTYPE PREVIEW BANNER — only for unauthenticated guests ── */}
        {!session?.user && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(234, 88, 12, 0.05) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                🧪
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", letterSpacing: "0.04em" }}>
                    CAMPUS EDITION PREVIEW
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(245, 158, 11, 0.2)",
                      color: "#fde68a",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      textTransform: "uppercase",
                    }}
                  >
                    Interactive Sandbox
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    (Sign in with GitHub to enroll in live courses)
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#d1d5db", lineHeight: 1.5, maxWidth: 760 }}>
                  You are previewing simulated course cohorts, sample student rosters, and autograded incident triage telemetry. Colleges and students can freely inspect the UI, switch between <strong>Student Mode</strong> and <strong>Faculty Mode</strong>, test lab launches, and export gradebooks before signing up.
                </p>
              </div>
            </div>

            {!session?.user ? (
              <button
                onClick={() => signIn("github")}
                style={{
                  background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                  color: "#08090c",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 4px 14px rgba(245, 158, 11, 0.3)",
                  whiteSpace: "nowrap",
                }}
              >
                <span>⚡ Sign Up / Sign In with GitHub</span>
                <span>→</span>
              </button>
            ) : (
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                Signed in as <strong style={{ color: "#fff" }}>{session.user.name}</strong>
              </div>
            )}
          </div>
        )}

        {/* ── AUTHENTIC ROLE CONTEXT BANNER ──────────────── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            background: "#0c0d14",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "10px 18px",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 6,
                background: isAdmin ? "rgba(244,63,94,0.12)" : canManageCohort ? "rgba(56,189,248,0.12)" : "rgba(74,222,128,0.12)",
                color: isAdmin ? "#f43f5e" : canManageCohort ? "#38bdf8" : "#4ade80",
                border: `1px solid ${isAdmin ? "rgba(244,63,94,0.3)" : canManageCohort ? "rgba(56,189,248,0.25)" : "rgba(74,222,128,0.25)"}`,
              }}
            >
              {isAdmin ? "⚡ ROOT CAMPUS SUPERVISOR" : canManageCohort ? "🏛️ FACULTY INSTRUCTOR HUB" : "🎓 STUDENT COURSE PORTAL"}
            </span>
            <span style={{ fontSize: 12, color: "#8a8898" }}>
              {isAdmin
                ? "Root Supervision: Universal Access to Supervise All Cohorts, Author Assignments & Inspect Telemetry"
                : canManageCohort
                ? "Verified Course Management, Live Autograder Telemetry & Gradebook Export"
                : activeCohort
                ? `Enrolled in ${activeCohort.title} (${activeCohort.code})`
                : "Syllabus Labs, Practice Challenges & Calibrated Peer Matchmaking"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {canManageCohort && activeCohort && (
              <button
                onClick={handleDownloadCSV}
                style={{
                  background: "rgba(74,222,128,0.12)",
                  border: "1px solid rgba(74,222,128,0.3)",
                  color: "#4ade80",
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "inherit",
                }}
              >
                <span>📥</span>
                <span>Download Official CSV Gradebook</span>
              </button>
            )}
          </div>
        </div>

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

        {/* ── COHORT TABS SELECTOR ── */}
        {cohorts.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 20 }}>
            {cohorts.map((c) => {
              const isSelected = c.code === selectedCode;
              return (
                <div
                  key={c.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 8,
                    background: isSelected ? "rgba(139,142,255,0.15)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isSelected ? "rgba(139,142,255,0.4)" : "rgba(255,255,255,0.06)"}`,
                    transition: "all 0.15s ease",
                  }}
                >
                  <button
                    onClick={() => setSelectedCode(c.code)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      background: "transparent",
                      border: "none",
                      color: isSelected ? "#fff" : "#8a8898",
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontFamily: "inherit",
                    }}
                  >
                    <span>{c.code}</span>
                    {!session?.user && c.isDemo && (
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExitCohort(c.code);
                    }}
                    title={`Exit and unenroll from ${c.code}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: isSelected ? "#f87171" : "#6e6d7a",
                      fontSize: 12,
                      padding: "6px 10px 6px 2px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      opacity: isSelected ? 0.8 : 0.4,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = isSelected ? "0.8" : "0.4";
                      e.currentTarget.style.color = isSelected ? "#f87171" : "#6e6d7a";
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {/* + Add Course Button */}
            <button
              onClick={() => {
                setJoinError(null);
                setJoinCodeInput("");
                setSelectedJoinCodes([]);
                setShowJoinModal(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 15px",
                borderRadius: 8,
                background: "rgba(139,142,255,0.08)",
                border: "1px dashed rgba(139,142,255,0.35)",
                color: "#8b8eff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(139,142,255,0.18)";
                e.currentTarget.style.borderColor = "#8b8eff";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(139,142,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(139,142,255,0.35)";
                e.currentTarget.style.color = "#8b8eff";
              }}
              title="Join one or multiple courses simultaneously"
            >
              <span style={{ fontSize: 14 }}>＋</span>
              <span>Add Course</span>
            </button>
          </div>
        )}

        {/* ── MAIN COHORT VIEW OR ONBOARDING ── */}
        {!selectedCode && cohorts.length === 0 ? (
          !canManageCohort ? (
            <div
              style={{
                background: "#0c0d14",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "44px 32px",
                textAlign: "center",
                maxWidth: 640,
                margin: "20px auto 40px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(74,222,128,0.12)",
                  border: "1px solid rgba(74,222,128,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  margin: "0 auto 16px",
                }}
              >
                🎓
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
                Welcome to Student Campus Edition
              </h2>
              <p style={{ fontSize: 13, color: "#8a8898", lineHeight: 1.6, maxWidth: 480, margin: "0 auto 28px" }}>
                You are not enrolled in any university class cohorts yet. Enter the cohort code provided by your professor or TA to sync your course syllabus, assignments, and automated grading.
              </p>

              <form onSubmit={handleJoinCohort} style={{ display: "flex", gap: 10, maxWidth: 440, margin: "0 auto 20px" }}>
                <input
                  type="text"
                  placeholder="Enter Course Code (e.g. CS-301)"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    color: "#fff",
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={joinLoading || !joinCodeInput.trim()}
                  style={{
                    background: "#4ade80",
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    padding: "12px 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {joinLoading ? "Joining..." : "Join Class"}
                </button>
              </form>

              {joinError && (
                <div style={{ color: "#f87171", fontSize: 12, marginBottom: 20 }}>
                  ⚠️ {joinError}
                </div>
              )}

              {demoCohorts.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 24, marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#6e6d7a", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>
                    Or Join An Available University Course Cohort
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                    {demoCohorts.map((demo) => (
                      <button
                        key={demo.code}
                        onClick={() => {
                          setSelectedCode(demo.code);
                        }}
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          padding: "10px 18px",
                          color: "#e8e6f0",
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "#fff" }}>📚 {demo.code}</span>
                        <span style={{ color: "#a09eb0" }}>{demo.title}</span>
                        <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>
                          ({demo.assignmentsCount} labs)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: "#0c0d14",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "44px 32px",
                textAlign: "center",
                maxWidth: 640,
                margin: "20px auto 40px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  margin: "0 auto 16px",
                }}
              >
                🏛️
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
                Faculty Course Command Center
              </h2>
              <p style={{ fontSize: 13, color: "#8a8898", lineHeight: 1.6, maxWidth: 480, margin: "0 auto 28px" }}>
                Create your first course cohort to generate student join codes, assign real-world bug tickets, track live submission diffs, and export automated CSV gradebooks.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  background: "#38bdf8",
                  color: "#000",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: 24,
                }}
              >
                + Create Course Cohort
              </button>

              {demoCohorts.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 24, marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#6e6d7a", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>
                    Or Inspect Example Instructor Lab
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                    {demoCohorts.map((demo) => (
                      <button
                        key={demo.code}
                        onClick={() => setSelectedCode(demo.code)}
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          padding: "9px 16px",
                          color: "#e8e6f0",
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span>⚡ Inspect {demo.code} Sandbox</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : loadingCohort || !activeCohort ? (
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
                    {isDemoCohort && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#fbbf24",
                          border: "1px solid rgba(245, 158, 11, 0.35)",
                          textTransform: "uppercase",
                        }}
                      >
                        Sample Course Preview
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: "#6e6d7a" }}>
                      {activeCohort.department} · {activeCohort.institution}
                    </span>
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
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      onClick={copyJoinCode}
                      style={{
                        background: "rgba(139,142,255,0.15)",
                        border: "1px solid rgba(139,142,255,0.3)",
                        color: "#8b8eff",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {copiedCode ? "✓ Copied to Clipboard" : "Copy Join Code"}
                    </button>
                    {isStudent && !cohorts.some((c) => c.code === activeCohort.code) && (
                      <button
                        onClick={() => handleEnrollCurrentCohort(activeCohort.code)}
                        disabled={joinLoading}
                        style={{
                          background: "#4ade80",
                          border: "none",
                          color: "#000",
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {joinLoading ? "Enrolling..." : "Enroll in Course"}
                      </button>
                    )}
                    {cohorts.some((c) => c.code === activeCohort.code) && (
                      <button
                        onClick={() => handleExitCohort(activeCohort.code)}
                        disabled={exitLoading}
                        style={{
                          background: "rgba(239, 68, 68, 0.12)",
                          border: "1px solid rgba(239, 68, 68, 0.35)",
                          color: "#f87171",
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.22)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)")}
                        title={`Unenroll and exit ${activeCohort.code}`}
                      >
                        <span>🚪</span> {exitLoading ? "Exiting..." : "Exit Course"}
                      </button>
                    )}
                  </div>
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
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Enrolled Students</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                    {activeCohort.students.length} {activeCohort.students.length === 1 ? "Student" : "Students"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase" }}>Lab Assignments</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#8b8eff", marginTop: 2 }}>
                    {activeCohort.assignments.length} Total
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Cohort Median ELO</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80", marginTop: 2 }}>
                    {activeCohort.students.length > 0
                      ? Math.round(activeCohort.students.reduce((acc, s) => acc + s.elo, 0) / activeCohort.students.length)
                      : 1000}{" "}
                    Rating
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6e6d7a", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Incident Pass Rate</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", marginTop: 2 }}>
                    {activeCohort.stats && activeCohort.stats.totalSubmissions > 0
                      ? `${activeCohort.stats.passRate}% Automated Pass`
                      : "Awaiting Submissions"}
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
                    {canManageCohort ? `Assigned Incident Triage Labs (${activeCohort.assignments.length})` : "Course Syllabus & Labs"}
                  </h3>
                  {canManageCohort ? (
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
                  ) : (
                    <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>
                      ✓ {Object.keys(activeCohort.userSubmissions || {}).length}/{activeCohort.assignments.length} Labs Completed
                    </span>
                  )}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Class Roster &amp; Ranking
                      </h3>
                    </div>
                    <span style={{ fontSize: 11, color: "#6e6d7a" }}>
                      {activeCohort.students.length} Enrolled
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {activeCohort.students.length === 0 ? (
                      <div
                        style={{
                          padding: "32px 16px",
                          textAlign: "center",
                          background: "rgba(255,255,255,0.015)",
                          borderRadius: 8,
                          border: "1px dashed rgba(255,255,255,0.08)",
                        }}
                      >
                        <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                          No Students Enrolled Yet
                        </div>
                        <p style={{ fontSize: 11, color: "#8a8898", maxWidth: 300, margin: "0 auto 14px", lineHeight: 1.5 }}>
                          Share cohort code <strong style={{ color: "#8b8eff", fontFamily: "'JetBrains Mono', monospace" }}>{activeCohort.code}</strong> with your class. As students complete lab challenges, their live rankings and ELO will populate here.
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(activeCohort.code);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          style={{
                            background: copiedCode ? "rgba(74,222,128,0.15)" : "rgba(139,142,255,0.12)",
                            border: copiedCode ? "1px solid #4ade80" : "1px solid rgba(139,142,255,0.3)",
                            color: copiedCode ? "#4ade80" : "#8b8eff",
                            padding: "6px 14px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {copiedCode ? "✓ Join Code Copied" : "📋 Copy Class Join Code"}
                        </button>
                      </div>
                    ) : (
                      activeCohort.students.map((student, idx) => {
                        const isCurrentUser = userId && student.userId === userId;
                        return (
                          <div
                            key={student.userId}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 12px",
                              borderRadius: 8,
                              background: isCurrentUser
                                ? "rgba(74,222,128,0.08)"
                                : idx === 0
                                ? "rgba(139,142,255,0.08)"
                                : "rgba(255,255,255,0.02)",
                              border: isCurrentUser
                                ? "1px solid rgba(74,222,128,0.3)"
                                : idx === 0
                                ? "1px solid rgba(139,142,255,0.25)"
                                : "1px solid transparent",
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
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                                  <span>{student.username}</span>
                                  {isCurrentUser && (
                                    <span style={{ fontSize: 9, background: "#4ade80", color: "#000", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                                      YOU
                                    </span>
                                  )}
                                  {student.role === "FACULTY" && (
                                    <span style={{ fontSize: 9, background: "rgba(56,189,248,0.2)", color: "#38bdf8", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                                      INSTRUCTOR
                                    </span>
                                  )}
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
                        );
                      })
                    )}
                  </div>
                </div>

                {/* FACULTY VIEW: DIAGNOSTIC TELEMETRY & GRADEBOOK */}
                {canManageCohort ? (
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(74,222,128,0.04) 0%, rgba(139,142,255,0.03) 100%)",
                      border: "1px solid rgba(74,222,128,0.2)",
                      borderRadius: 14,
                      padding: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>📊</span>
                        <h4 style={{ fontSize: 12, fontWeight: 700, margin: 0, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Faculty Diagnostic Telemetry
                        </h4>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          background: isDemoCohort ? "rgba(245, 158, 11, 0.15)" : "rgba(74,222,128,0.15)",
                          color: isDemoCohort ? "#fbbf24" : "#4ade80",
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontWeight: 700,
                          border: `1px solid ${isDemoCohort ? "rgba(245, 158, 11, 0.3)" : "rgba(74,222,128,0.3)"}`,
                        }}
                      >
                        {isDemoCohort ? "PREVIEW ENVIRONMENT" : "AUTHENTIC"}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "#8a8898", margin: "0 0 14px", lineHeight: 1.5 }}>
                      Live telemetry computed across student test suite runs and compiler outputs for this section.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                        <span style={{ color: "#6e6d7a" }}>Cohort Enrollment:</span>
                        <strong style={{ color: "#4ade80" }}>
                          {activeCohort.students.length} Enrolled {activeCohort.students.length === 1 ? "Student" : "Students"}
                        </strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                        <span style={{ color: "#6e6d7a" }}>Total Submissions:</span>
                        <strong style={{ color: "#fff" }}>
                          {activeCohort.stats?.totalSubmissions ?? 0} Recorded
                        </strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                        <span style={{ color: "#6e6d7a" }}>Average Time-to-Fix:</span>
                        <strong style={{ color: "#fff" }}>
                          {activeCohort.stats && activeCohort.stats.totalSubmissions > 0
                            ? `${Math.floor(activeCohort.stats.avgTimeSeconds / 60)}m ${activeCohort.stats.avgTimeSeconds % 60}s`
                            : "Awaiting Submissions"}
                        </strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                        <span style={{ color: "#6e6d7a" }}>Cohort Pass Rate:</span>
                        <strong style={{ color: "#fbbf24" }}>
                          {activeCohort.stats && activeCohort.stats.totalSubmissions > 0
                            ? `${activeCohort.stats.passRate}% Automated Pass`
                            : "Awaiting Submissions"}
                        </strong>
                      </div>

                      {/* Lab Completion Breakdown */}
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontSize: 10, color: "#8b8eff", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                          Lab Completion Status:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                          {activeCohort.assignments.length === 0 ? (
                            <span style={{ color: "#6e6d7a" }}>No labs assigned yet.</span>
                          ) : (
                            activeCohort.assignments.map((asg) => {
                              const passedCount = (activeCohort.allSubmissions || []).filter(
                                (s) => s.assignmentId === asg.assignmentId
                              ).length;
                              return (
                                <div key={asg.assignmentId} style={{ display: "flex", justifyContent: "space-between", color: "#c8c6d4" }}>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}>
                                    {asg.title}
                                  </span>
                                  <span style={{ color: passedCount > 0 ? "#4ade80" : "#6e6d7a", fontWeight: 700 }}>
                                    {passedCount}/{activeCohort.students.length} Passed
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleDownloadCSV}
                        style={{
                          marginTop: 10,
                          width: "100%",
                          background: "rgba(74,222,128,0.12)",
                          border: "1px solid rgba(74,222,128,0.3)",
                          color: "#4ade80",
                          padding: "8px 12px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          fontFamily: "inherit",
                        }}
                      >
                        <span>📥</span>
                        <span>Download Official CSV Gradebook</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* STUDENT VIEW: LAB GUIDELINES & SYLLABUS SYNC */
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(139,142,255,0.04) 0%, rgba(56,189,248,0.03) 100%)",
                      border: "1px solid rgba(139,142,255,0.2)",
                      borderRadius: 14,
                      padding: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>⚡</span>
                      <h4 style={{ fontSize: 12, fontWeight: 700, margin: 0, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Autograded Lab Sandbox
                      </h4>
                    </div>
                    <p style={{ fontSize: 11, color: "#8a8898", margin: "0 0 14px", lineHeight: 1.5 }}>
                      All lab challenges are compiled in isolated sandbox environments with instant autograding against test assertions.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                        <span style={{ color: "#4ade80" }}>✓</span>
                        <span>Zero-latency compiler diagnostics and memory check</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                        <span style={{ color: "#4ade80" }}>✓</span>
                        <span>Real-time gradebook synchronization on all tests passed</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                        <span style={{ color: "#4ade80" }}>✓</span>
                        <span>ELO rating progression on each successfully debugged incident</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                        <span style={{ color: "#4ade80" }}>✓</span>
                        <span>1v1 peer challenges to practice calibrated triage under time pressure</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CAMPUS FOOTER */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, fontSize: 12, color: "#6e6d7a" }}>
          <div>
            Codeduel Campus Edition · Collegiate Engineering &amp; Placement Labs Hub
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/about" style={{ color: "#8a8898", textDecoration: "none" }}>About</Link>
            <Link href="/privacy" style={{ color: "#8a8898", textDecoration: "none" }}>Privacy (DPDP)</Link>
            <Link href="/terms" style={{ color: "#8a8898", textDecoration: "none" }}>Terms</Link>
            <Link href="/contact" style={{ color: "#8a8898", textDecoration: "none" }}>Faculty Support</Link>
          </div>
        </div>
      </div>
      )}

      {/* ── BATCH ADD / JOIN CLASS MODAL ────────────────────────────────────── */}
      {showJoinModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
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
              padding: "26px 28px",
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 4px", color: "#fff" }}>
                  Add &amp; Enroll in Courses
                </h3>
                <p style={{ fontSize: 12.5, color: "#8a8898", margin: 0, lineHeight: 1.5 }}>
                  Join multiple university classes at once using course codes or select from available department cohorts.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinError(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6e6d7a",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinCohort}>
              {/* Option 1: Course Catalog Multi-Select */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Select from Department Cohorts:
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const available = demoCohorts
                          .filter((d) => !cohorts.some((c) => c.code === d.code))
                          .map((d) => d.code);
                        setSelectedJoinCodes(available);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#8b8eff",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      Select All Available
                    </button>
                    <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedJoinCodes([])}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--muted2)",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                  {demoCohorts.map((d) => {
                    const isAlreadyEnrolled = cohorts.some((c) => c.code === d.code);
                    const isChecked = selectedJoinCodes.includes(d.code);

                    return (
                      <div
                        key={d.code}
                        onClick={() => {
                          if (isAlreadyEnrolled) return;
                          setSelectedJoinCodes((prev) =>
                            prev.includes(d.code) ? prev.filter((c) => c !== d.code) : [...prev, d.code]
                          );
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: isAlreadyEnrolled
                            ? "rgba(255,255,255,0.01)"
                            : isChecked
                            ? "rgba(139,142,255,0.14)"
                            : "rgba(255,255,255,0.03)",
                          border: isChecked
                            ? "1px solid #8b8eff"
                            : "1px solid rgba(255,255,255,0.07)",
                          cursor: isAlreadyEnrolled ? "default" : "pointer",
                          opacity: isAlreadyEnrolled ? 0.6 : 1,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked || isAlreadyEnrolled}
                            disabled={isAlreadyEnrolled}
                            onChange={() => {}}
                            style={{ cursor: isAlreadyEnrolled ? "default" : "pointer", accentColor: "#8b8eff" }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#8b8eff", fontFamily: "'JetBrains Mono', monospace" }}>
                                {d.code}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {d.title.split(": ")[1] || d.title}
                              </span>
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--muted2)", marginTop: 2 }}>
                              {d.instructorName} · {d.department}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isAlreadyEnrolled ? (
                            <span style={{ fontSize: 9.5, background: "rgba(74,222,128,0.15)", color: "#4ade80", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                              ✓ Enrolled
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: isChecked ? "#8b8eff" : "var(--muted2)", fontWeight: 600 }}>
                              {isChecked ? "Selected" : "+ Select"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Option 2: Enter Manual Course Codes */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Or Enter Course Code(s):
                </label>
                <textarea
                  placeholder="Paste or type multiple codes (e.g. ECE-204-EMBEDDED, CS-301-SYSTEMS, CS-402)"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "#fff",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12.5,
                    boxSizing: "border-box",
                    resize: "none",
                    outline: "none",
                  }}
                />
                <div style={{ fontSize: 10.5, color: "var(--muted2)", marginTop: 4 }}>
                  Tip: Separate multiple course join codes with commas, spaces, or newlines.
                </div>
              </div>

              {joinError && (
                <div style={{ color: "#f43f5e", fontSize: 12, marginBottom: 14, background: "rgba(244,63,94,0.1)", padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(244,63,94,0.2)" }}>
                  {joinError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8a8898",
                    padding: "11px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  style={{
                    flex: 1.5,
                    background: "#8b8eff",
                    border: "none",
                    color: "#08090c",
                    fontWeight: 700,
                    padding: "11px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {joinLoading ? (
                    "Enrolling..."
                  ) : (
                    <>
                      <span>Join Courses</span>
                      {selectedJoinCodes.length > 0 && (
                        <span style={{ background: "rgba(0,0,0,0.25)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 10 }}>
                          {selectedJoinCodes.length}
                        </span>
                      )}
                    </>
                  )}
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

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                  FACULTY VERIFICATION KEY (REQUIRED FOR INSTRUCTOR ACCESS)
                </label>
                <input
                  type="password"
                  placeholder="Enter institutional faculty key"
                  value={createForm.facultyPasscode}
                  onChange={(e) => setCreateForm({ ...createForm, facultyPasscode: e.target.value })}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: 10, color: "#6e6d7a", marginTop: 4 }}>
                  Institutional verification key provided to authorized course instructors (or verified .edu/.ac.in university domain).
                </div>
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
