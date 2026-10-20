"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { UserRole } from "@/components/RoleSwitcherModal";

export function useUserRole(initial?: UserRole) {
  const { data: session, status } = useSession();
  // Use `username` (GitHub login set in JWT) — NOT `name` (display name like "Rishabh")
  const userLogin = ((session?.user as any)?.username || "").toLowerCase();
  const userName = (session?.user?.name || "").toLowerCase();
  const userId = ((session?.user as any)?.id || (session?.user as any)?.sub || "");
  const sessionRole = (session?.user as any)?.role;
  const sessionIsAdmin = (session?.user as any)?.isAdmin;
  // Strict check: GitHub username must be exactly rishabh9877
  const isRishabh = userLogin === "rishabh9877" || userName === "rishabh9877" || sessionRole === "ADMIN" || sessionIsAdmin === true;

  const [role, setRoleState] = useState<UserRole>(initial || "INDIVIDUAL");

  // Sync state on client mount from localStorage cleanly after hydration
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("preferred_role") as UserRole;
      if (stored === "STUDENT" || stored === "FACULTY" || stored === "ADMIN" || stored === "INDIVIDUAL") {
        setRoleState(stored);
      }
    }
  }, []);

  // Sync state on role change across tabs or components
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "preferred_role" && e.newValue) {
        setRoleState(e.newValue as UserRole);
      }
    };
    const handleCustomRoleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.role) {
        setRoleState(detail.role);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("codeduel:role_changed", handleCustomRoleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("codeduel:role_changed", handleCustomRoleChange);
    };
  }, []);

  // Sync with session / profile on mount
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      if (isRishabh) {
        if (typeof window !== "undefined") {
          localStorage.setItem("codeduel_is_founder", "true");
        }
        const stored = typeof window !== "undefined" ? localStorage.getItem("preferred_role") : null;
        if (stored === "STUDENT" || stored === "FACULTY" || stored === "INDIVIDUAL" || stored === "ADMIN") {
          setRoleState(stored as UserRole);
        } else {
          // Rishabh starts as ADMIN initially unless they've chosen another role
          setRoleState("ADMIN");
          if (typeof window !== "undefined") {
            localStorage.setItem("preferred_role", "ADMIN");
          }
        }
      } else {
        // Normal user: cannot hold ADMIN role. Reset if invalid.
        const stored = typeof window !== "undefined" ? localStorage.getItem("preferred_role") : null;
        if (stored === "ADMIN") {
          setRoleState("INDIVIDUAL");
          if (typeof window !== "undefined") {
            localStorage.setItem("preferred_role", "INDIVIDUAL");
            localStorage.removeItem("codeduel_is_founder");
          }
        } else if (!stored) {
          fetch("/api/user/me")
            .then((r) => (r.ok ? r.json() : null))
            .then((me) => {
              if (me?.role && me.role !== "ADMIN") {
                setRoleState(me.role as UserRole);
                if (typeof window !== "undefined") {
                  localStorage.setItem("preferred_role", me.role);
                }
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [status, session, isRishabh]);

  const setRole = useCallback(async (newRole: UserRole, passcode?: string) => {
    setRoleState(newRole);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_role", newRole);
      window.dispatchEvent(new CustomEvent("codeduel:role_changed", { detail: { role: newRole } }));
    }
    try {
      await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: newRole,
          facultyPasscode: passcode,
        }),
      });
    } catch (e) {
      console.warn("Failed to update role on server:", e);
    }
  }, []);

  // Admin access is ONLY active when ADMIN is selected in the role dropdown
  // This allows the admin (Rishabh) to switch to Student or Faculty to test normally
  const isAdmin = role === "ADMIN";
  const isFaculty = role === "FACULTY" || isAdmin;
  const isStudent = role === "STUDENT";
  const isIndividual = role === "INDIVIDUAL";
  const canAccessCampus = role === "STUDENT" || role === "FACULTY" || isAdmin;

  return {
    role,
    setRole,
    isIndividual,
    isStudent,
    isFaculty,
    isAdmin,
    canAccessCampus,
    isRishabh,
    canBeAdmin: isRishabh,
  };
}
