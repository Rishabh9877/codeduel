"use client";

import React, { useState, useEffect } from "react";
import RoleSwitcherModal, { UserRole } from "./RoleSwitcherModal";

interface RoleBadgeSwitcherProps {
  initialRole?: UserRole;
  onRoleChanged?: (role: UserRole) => void;
  className?: string;
}

export default function RoleBadgeSwitcher({
  initialRole,
  onRoleChanged,
  className,
}: RoleBadgeSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<UserRole>(initialRole || "INDIVIDUAL");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("preferred_role") as UserRole;
      if (stored === "STUDENT" || stored === "FACULTY" || stored === "INDIVIDUAL" || stored === "ADMIN") {
        setRole(stored);
      } else if (initialRole) {
        setRole(initialRole);
      }
    }
  }, [initialRole]);

  useEffect(() => {
    if (initialRole) setRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    const handleRoleEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.role) {
        setRole(detail.role);
      }
    };
    window.addEventListener("codeduel:role_changed", handleRoleEvent);
    return () => window.removeEventListener("codeduel:role_changed", handleRoleEvent);
  }, []);

  const handleRoleChanged = (newRole: UserRole) => {
    setRole(newRole);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_role", newRole);
      window.dispatchEvent(new CustomEvent("codeduel:role_changed", { detail: { role: newRole } }));
    }
    if (onRoleChanged) onRoleChanged(newRole);
  };

  const roleConfig = {
    ADMIN: {
      label: "Platform Admin",
      icon: "⚡",
      color: "#f43f5e",
      bg: "rgba(244, 63, 94, 0.15)",
      border: "rgba(244, 63, 94, 0.4)",
    },
    STUDENT: {
      label: "Student Mode",
      icon: "🎓",
      color: "#4ade80",
      bg: "rgba(74, 222, 128, 0.1)",
      border: "rgba(74, 222, 128, 0.25)",
    },
    FACULTY: {
      label: "Faculty Hub",
      icon: "🏛️",
      color: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.1)",
      border: "rgba(56, 189, 248, 0.25)",
    },
    INDIVIDUAL: {
      label: "Individual Dev",
      icon: "💻",
      color: "#8b8eff",
      bg: "rgba(139, 142, 255, 0.1)",
      border: "rgba(139, 142, 255, 0.25)",
    },
  }[role] || {
    label: "Individual Dev",
    icon: "💻",
    color: "#8b8eff",
    bg: "rgba(139, 142, 255, 0.1)",
    border: "rgba(139, 142, 255, 0.25)",
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setModalOpen(true);
        }}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 12px",
          borderRadius: "100px",
          fontSize: "11px",
          fontWeight: 700,
          background: roleConfig.bg,
          border: `1px solid ${roleConfig.border}`,
          color: roleConfig.color,
          cursor: "pointer",
          transition: "all 0.15s ease",
          fontFamily: "'JetBrains Mono', monospace",
          userSelect: "none",
          outline: "none",
        }}
        title="Click to switch your Codeduel role (Student, Faculty, or Individual)"
        suppressHydrationWarning
      >
        <span>{roleConfig.icon}</span>
        <span>{roleConfig.label}</span>
        <span style={{ fontSize: "9px", opacity: 0.7 }}>▾</span>
      </button>

      {modalOpen && (
        <RoleSwitcherModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          currentRole={role}
          onRoleChanged={handleRoleChanged}
        />
      )}
    </>
  );
}

