"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";

export type UserRole = "INDIVIDUAL" | "STUDENT" | "FACULTY" | "ADMIN";

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onRoleChanged: (newRole: UserRole) => void;
  actionLabel?: string;
}

const ROLES_META = [
  {
    id: "ADMIN" as UserRole,
    title: "Platform Administrator",
    badge: "Root / Founder Access",
    icon: "⚡",
    color: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.2)",
    border: "rgba(244, 63, 94, 0.4)",
    tagline: "Unrestricted platform privileges: live telemetry, faculty authoring, and system controls",
    features: [
      "Real-time platform financial telemetry & metrics",
      "Global cohort supervision and assignment authoring",
      "Unrestricted AI coach and simulator diagnostics",
      "Universal duel, student, and faculty access",
    ],
  },
  {
    id: "STUDENT" as UserRole,
    title: "College Student",
    badge: "Academic Edition",
    icon: "🎓",
    color: "#4ade80",
    glow: "rgba(74, 222, 128, 0.15)",
    border: "rgba(74, 222, 128, 0.3)",
    tagline: "Course assignments, automated lab grading, and peer duel matchmaking",
    features: [
      "Enrolled course cohort labs & syllabus tracking",
      "Automated autograder test suite with code diffs",
      "Solo practice with real production bug tickets",
      "Calibrated 1v1 student arena matchmaking",
    ],
  },
  {
    id: "FACULTY" as UserRole,
    title: "Faculty / Instructor",
    badge: "Educator Portal",
    icon: "🏛️",
    color: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.15)",
    border: "rgba(56, 189, 248, 0.3)",
    tagline: "Classroom cohort manager, automated gradebook, and incident lab authoring",
    features: [
      "1-Click cohort creation & student invite codes",
      "Automated CSV gradebook export with scores",
      "Assign microservice & embedded firmware labs",
      "Real-time student progress & hint consumption",
    ],
  },
  {
    id: "INDIVIDUAL" as UserRole,
    title: "Individual Developer",
    badge: "Competitive Arena",
    icon: "💻",
    color: "#8b8eff",
    glow: "rgba(139, 142, 255, 0.15)",
    border: "rgba(139, 142, 255, 0.3)",
    tagline: "Global competitive 1v1 arena, ELO ladder, and open source bug triage",
    features: [
      "Ranked 1v1 matchmaking with ELO bracket scaling",
      "Independent solo practice across SWE & Embedded",
      "Global engineering leaderboard rankings",
      "Friend challenges, custom duel lobbies & social",
    ],
  },
];

export default function RoleSwitcherModal({
  isOpen,
  onClose,
  currentRole,
  onRoleChanged,
  actionLabel,
}: RoleSwitcherModalProps) {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [facultyPasscode, setFacultyPasscode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userName = (session?.user?.name || "").toLowerCase();
  // `username` is the GitHub login stored in the JWT token (not the display name)
  const userLogin = ((session?.user as any)?.username || "").toLowerCase();
  const userId = ((session?.user as any)?.id || (session?.user as any)?.sub || "").toLowerCase();
  const sessionRole = (session?.user as any)?.role;
  const sessionIsAdmin = (session?.user as any)?.isAdmin;
  const storedFounder = typeof window !== "undefined" ? localStorage.getItem("codeduel_is_founder") : null;

  // Strict founder check: Only rishabh9877 / verified platform admin
  const isFounderAdmin =
    userLogin === "rishabh9877" ||
    userName === "rishabh9877" ||
    userId === "rishabh9877" ||
    sessionRole === "ADMIN" ||
    sessionIsAdmin === true ||
    storedFounder === "true";

  useEffect(() => {
    if (isFounderAdmin && typeof window !== "undefined") {
      localStorage.setItem("codeduel_is_founder", "true");
    }
  }, [isFounderAdmin]);

  // Sync state when modal opens or currentRole changes
  useEffect(() => {
    if (isOpen) {
      setSelectedRole(currentRole);
      setErrorMessage(null);
      setFacultyPasscode("");
    }
  }, [isOpen, currentRole]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  const handleConfirm = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      // STUDENT and INDIVIDUAL don't need server-side gating — apply immediately
      if (selectedRole === "STUDENT" || selectedRole === "INDIVIDUAL") {
        if (typeof window !== "undefined") {
          localStorage.setItem("preferred_role", selectedRole);
        }
        onRoleChanged(selectedRole);
        // Best-effort server sync (non-blocking)
        if (session?.user) {
          fetch("/api/user/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: selectedRole }),
          }).catch(() => {});
        }
        onClose();
        return;
      }

      // ADMIN role: only for admin users, apply directly
      if (selectedRole === "ADMIN") {
        if (!isFounderAdmin) {
          setErrorMessage("Admin access is restricted to the platform founder only.");
          setSaving(false);
          return;
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("preferred_role", "ADMIN");
        }
        onRoleChanged("ADMIN");
        if (session?.user) {
          fetch("/api/user/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "ADMIN" }),
          }).catch(() => {});
        }
        onClose();
        return;
      }

      // FACULTY: needs passcode verification (unless founder admin bypass)
      if (session?.user) {
        const res = await fetch("/api/user/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: selectedRole,
            facultyPasscode: !isFounderAdmin ? facultyPasscode.trim() : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Access Denied: Faculty verification failed. Please check your credentials.");
          setSaving(false);
          return;
        }
      } else {
        // Guest / unauthenticated check for faculty
        if (!isFounderAdmin && selectedRole === "FACULTY") {
          const res = await fetch("/api/campus/verify-faculty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passcode: facultyPasscode.trim() }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setErrorMessage(data.error || "Faculty credentials required: Please enter a valid Faculty Verification Key or university email.");
            setSaving(false);
            return;
          }
        }
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("preferred_role", selectedRole);
      }
      onRoleChanged(selectedRole);
      onClose();
    } catch (err: any) {
      console.warn("Failed to persist role setting:", err);
      if (typeof window !== "undefined") {
        localStorage.setItem("preferred_role", selectedRole);
      }
      onRoleChanged(selectedRole);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Only display ADMIN role to root/founder admin
  const visibleRoles = ROLES_META.filter((r) => {
    if (r.id === "ADMIN") {
      return isFounderAdmin;
    }
    return true;
  });

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0c0d14",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "18px",
          maxWidth: "640px",
          width: "100%",
          maxHeight: "min(92vh, 720px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(139,142,255,0.06)",
          color: "#fff",
          position: "relative",
          margin: "auto 0",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* FIXED HEADER */}
        <div
          style={{
            padding: "24px 28px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
            flexShrink: 0,
            background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#8b8eff",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Workspace Organization
              </span>
              <h2 style={{ fontSize: "21px", fontWeight: 800, margin: "4px 0 0", color: "#fff", letterSpacing: "-0.02em" }}>
                Select Your Codeduel Role
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#8a8898",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#8a8898";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: "12.5px", color: "#8a8898", margin: "8px 0 0", lineHeight: 1.4 }}>
            Tailor your navigation, tools, and permissions. Switch anytime without losing rating or stats.
          </p>
        </div>

        {/* SCROLLABLE BODY */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 28px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {visibleRoles.map((r) => {
            const isSelected = selectedRole === r.id;
            return (
              <div
                key={r.id}
                onClick={() => {
              setSelectedRole(r.id);
              // Always clear stale errors when user picks a new role
              if (errorMessage) setErrorMessage(null);
            }}
                style={{
                  background: isSelected ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.015)",
                  border: isSelected ? `2px solid ${r.color}` : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? `0 0 20px ${r.glow}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ fontSize: "20px" }}>{r.icon}</span>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{r.title}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "100px",
                        background: `${r.color}20`,
                        color: r.color,
                        border: `1px solid ${r.color}40`,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {r.badge}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: isSelected ? `5px solid ${r.color}` : "2px solid rgba(255,255,255,0.25)",
                      background: isSelected ? "#000" : "transparent",
                      transition: "all 0.15s ease",
                    }}
                  />
                </div>

                <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0 0 8px 29px", lineHeight: 1.35 }}>
                  {r.tagline}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginLeft: "29px" }}>
                  {r.features.map((feat, idx) => (
                    <div key={idx} style={{ fontSize: "11px", color: "#6b7280", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: r.color, fontSize: "11px", fontWeight: 700 }}>✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Faculty Passcode Verification Box */}
          {selectedRole === "FACULTY" && (
            <div
              style={{
                background: isFounderAdmin ? "rgba(74, 222, 128, 0.08)" : "rgba(56, 189, 248, 0.08)",
                border: isFounderAdmin ? "1px solid rgba(74, 222, 128, 0.25)" : "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: "10px",
                padding: "14px 16px",
                marginTop: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "16px" }}>{isFounderAdmin ? "🛡️" : "🔒"}</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: isFounderAdmin ? "#4ade80" : "#38bdf8" }}>
                  {isFounderAdmin ? "Founder / Administrator Bypass Active" : "Instructor Credential Verification"}
                </span>
              </div>
              {isFounderAdmin ? (
                <p style={{ fontSize: "12px", color: "#d1d5db", margin: 0, lineHeight: 1.4 }}>
                  Authenticated as <strong>{session?.user?.name || "Rishabh9877"}</strong>. You have unrestricted faculty access across all university cohorts without needing an educator passcode.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: "12px", color: "#a09eb0", margin: "0 0 10px", lineHeight: 1.4 }}>
                    Faculty privileges require an official university email (<code>.edu</code> / <code>.ac.in</code>) or a Faculty Verification Key.
                  </p>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="password"
                      placeholder="Enter Faculty Verification Key"
                      value={facultyPasscode}
                      onChange={(e) => {
                        setFacultyPasscode(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      style={{
                        flex: 1,
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "#fff",
                        fontSize: "12px",
                        fontFamily: "'JetBrains Mono', monospace",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "11px", color: "#6e6d7a", marginTop: "6px" }}>
                    Institutional key provided by your academic institution or platform supervisor.
                  </div>
                </>
              )}
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#f87171",
                fontSize: "12px",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* FIXED FOOTER */}
        <div
          style={{
            padding: "16px 28px",
            borderTop: "1px solid rgba(255, 255, 255, 0.07)",
            background: "#08090f",
            flexShrink: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "11px", color: "#6b7280" }}>
            Current: <span style={{ color: "#fff", fontWeight: 600 }}>{visibleRoles.find((r) => r.id === currentRole)?.title || currentRole}</span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#8a8898",
                fontSize: "13px",
                fontWeight: 600,
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#8a8898";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              style={{
                background: selectedRole === "ADMIN" ? "linear-gradient(135deg, #f43f5e, #e11d48)" : "#fff",
                color: selectedRole === "ADMIN" ? "#fff" : "#000",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                padding: "8px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: selectedRole === "ADMIN" ? "0 0 16px rgba(244,63,94,0.35)" : "0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              {saving
                ? "Applying..."
                : actionLabel
                ? `${actionLabel} as ${visibleRoles.find((r) => r.id === selectedRole)?.title}`
                : `Apply ${visibleRoles.find((r) => r.id === selectedRole)?.title || selectedRole} Mode`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
