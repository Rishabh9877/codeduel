"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { useUserRole } from "@/lib/useUserRole";
import RoleBadgeSwitcher from "@/components/RoleBadgeSwitcher";

interface AppNavbarProps {
  activePage?: "dashboard" | "practice" | "campus" | "leaderboard" | "friends" | "profile" | "admin" | "pricing";
  onFindMatch?: () => void;
  matchState?: "idle" | "queued" | "matched";
  onCancelMatch?: () => void;
  customRightContent?: React.ReactNode;
}

export default function AppNavbar({
  activePage,
  onFindMatch,
  matchState = "idle",
  onCancelMatch,
  customRightContent,
}: AppNavbarProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { role, setRole, isIndividual, isStudent, isFaculty, isAdmin, canAccessCampus } = useUserRole();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleMatchClick = () => {
    if (onFindMatch) {
      onFindMatch();
    } else {
      router.push("/dashboard?action=find_match");
    }
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "rgba(6, 7, 12, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Brand & Left Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Link
          href={status === "authenticated" ? "/dashboard" : "/"}
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#fff",
            textDecoration: "none",
            letterSpacing: "-0.02em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>Codeduel</span>
          {isAdmin && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(244, 63, 94, 0.15)",
                color: "#f43f5e",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                letterSpacing: "0.06em",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              ADMIN
            </span>
          )}
        </Link>

        {/* Dynamic Nav Links Strictly Segregated By Role */}
        <div style={{ display: "flex", gap: 4 }}>
          {isAdmin ? (
            <>
              <Link href="/dashboard" style={getNavLinkStyle(activePage === "dashboard")}>
                Dashboard
              </Link>
              <Link href="/practice" style={getNavLinkStyle(activePage === "practice")}>
                Solo Practice
              </Link>
              <Link href="/leaderboard" style={getNavLinkStyle(activePage === "leaderboard")}>
                Leaderboard
              </Link>
              <Link href="/campus" style={getNavLinkStyle(activePage === "campus")}>
                Campus Hub
              </Link>
              <Link
                href="/admin/metrics"
                style={{
                  ...getNavLinkStyle(activePage === "admin"),
                  color: "#f43f5e",
                  fontWeight: 700,
                }}
              >
                ⚡ Metrics
              </Link>
              <Link href="/pricing" style={getNavLinkStyle(activePage === "pricing")}>
                Pricing
              </Link>
              <Link href="/friends" style={getNavLinkStyle(activePage === "friends")}>
                Friends
              </Link>
              <Link href="/profile" style={getNavLinkStyle(activePage === "profile")}>
                Profile
              </Link>
            </>
          ) : isFaculty ? (
            <>
              <Link href="/campus" style={getNavLinkStyle(activePage === "campus")}>
                Faculty Hub
              </Link>
              <Link href="/practice" style={getNavLinkStyle(activePage === "practice")}>
                Problem Sandbox
              </Link>
              <Link href="/leaderboard" style={getNavLinkStyle(activePage === "leaderboard")}>
                Leaderboard
              </Link>
              <Link href="/pricing" style={getNavLinkStyle(activePage === "pricing")}>
                Pricing
              </Link>
              <Link href="/profile" style={getNavLinkStyle(activePage === "profile")}>
                Profile
              </Link>
            </>
          ) : isStudent ? (
            <>
              <Link href="/dashboard" style={getNavLinkStyle(activePage === "dashboard")}>
                Dashboard
              </Link>
              <Link href="/campus" style={getNavLinkStyle(activePage === "campus")}>
                Campus Labs
              </Link>
              <Link href="/practice" style={getNavLinkStyle(activePage === "practice")}>
                Solo Practice
              </Link>
              <Link href="/dashboard?action=find_match" style={getNavLinkStyle(false)}>
                1v1 Duel
              </Link>
              <Link href="/leaderboard" style={getNavLinkStyle(activePage === "leaderboard")}>
                Leaderboard
              </Link>
              <Link href="/pricing" style={getNavLinkStyle(activePage === "pricing")}>
                Pricing
              </Link>
              <Link href="/friends" style={getNavLinkStyle(activePage === "friends")}>
                Friends
              </Link>
              <Link href="/profile" style={getNavLinkStyle(activePage === "profile")}>
                Profile
              </Link>
            </>
          ) : (
            /* INDIVIDUAL DEVELOPER: CAMPUS IS STRICTLY HIDDEN */
            <>
              <Link href="/dashboard" style={getNavLinkStyle(activePage === "dashboard")}>
                Dashboard
              </Link>
              <Link href="/practice" style={getNavLinkStyle(activePage === "practice")}>
                Solo Practice
              </Link>
              <Link href="/dashboard?action=find_match" style={getNavLinkStyle(false)}>
                1v1 Arena
              </Link>
              <Link href="/leaderboard" style={getNavLinkStyle(activePage === "leaderboard")}>
                Leaderboard
              </Link>
              <Link href="/pricing" style={getNavLinkStyle(activePage === "pricing")}>
                Pricing
              </Link>
              <Link href="/friends" style={getNavLinkStyle(activePage === "friends")}>
                Friends
              </Link>
              <Link href="/profile" style={getNavLinkStyle(activePage === "profile")}>
                Profile
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {customRightContent}

        <RoleBadgeSwitcher initialRole={role} onRoleChanged={setRole} />


        {isFaculty ? (
          <Link
            href="/campus"
            style={{
              fontSize: 12,
              fontWeight: 700,
              background: "#38bdf8",
              color: "#08090c",
              padding: "7px 14px",
              borderRadius: 7,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              transition: "transform 0.1s ease",
            }}
          >
            🏛️ Manage Cohorts
          </Link>
        ) : isAdmin ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/admin/metrics"
              style={{
                fontSize: 12,
                fontWeight: 700,
                background: "linear-gradient(135deg, #f43f5e, #e11d48)",
                color: "#fff",
                padding: "7px 12px",
                borderRadius: 7,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                boxShadow: "0 0 10px rgba(244,63,94,0.3)",
              }}
            >
              ⚡ Admin Metrics
            </Link>
            {matchState === "queued" ? (
              <button
                onClick={onCancelMatch}
                style={{
                  background: "rgba(248,113,113,0.15)",
                  border: "1px solid rgba(248,113,113,0.4)",
                  color: "#f87171",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 12px",
                  borderRadius: 7,
                  cursor: "pointer",
                }}
              >
                Cancel search
              </button>
            ) : (
              <button
                onClick={handleMatchClick}
                style={{
                  background: "#fff",
                  color: "#000",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span>⚔️</span> Find Match
              </button>
            )}
          </div>
        ) : matchState === "queued" ? (
          <button
            onClick={onCancelMatch}
            style={{
              background: "rgba(248,113,113,0.15)",
              border: "1px solid rgba(248,113,113,0.4)",
              color: "#f87171",
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: 7,
              cursor: "pointer",
            }}
          >
            Cancel search
          </button>
        ) : (
          <button
            onClick={handleMatchClick}
            style={{
              background: "#fff",
              color: "#000",
              fontSize: 12,
              fontWeight: 700,
              padding: "7px 14px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Find Match
          </button>
        )}

        {/* User Profile Avatar & Dropdown */}
        {status === "authenticated" ? (
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(139,142,255,0.12)",
                border: "1px solid rgba(139,142,255,0.25)",
                overflow: "hidden",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#8b8eff",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {session?.user?.image ? (
                <img src={session.user.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (session?.user?.name?.[0] ?? "?").toUpperCase()
              )}
            </div>

            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 8,
                  background: "#0d0e15",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  overflow: "hidden",
                  zIndex: 60,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
                  minWidth: 180,
                }}
              >
                <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session?.user?.name || "Developer"}
                  </div>
                  <div style={{ fontSize: 11, color: "#8a8898" }}>
                    {role === "ADMIN" ? "Platform Admin" : role === "FACULTY" ? "Faculty" : role === "STUDENT" ? "Student" : "Individual"}
                  </div>
                </div>

                <Link
                  href="/profile"
                  style={{
                    padding: "9px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#e8e6f0",
                    textDecoration: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  👤 My Profile
                </Link>

                <Link
                  href="/pricing"
                  style={{
                    padding: "9px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#8b8eff",
                    textDecoration: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: "rgba(139,142,255,0.06)",
                  }}
                >
                  ⚡ Upgrade to Pro / Pricing
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin/metrics"
                    style={{
                      padding: "9px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#f43f5e",
                      textDecoration: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: "rgba(244,63,94,0.06)",
                    }}
                  >
                    ⚡ Platform Metrics
                  </Link>
                )}

                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  style={{
                    background: "rgba(248,113,113,0.08)",
                    border: "none",
                    color: "#f87171",
                    padding: "9px 14px",
                    cursor: "pointer",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => signIn("github")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}

function getNavLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: isActive ? 700 : 500,
    color: isActive ? "#fff" : "#8a8898",
    background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
    padding: "6px 12px",
    borderRadius: 6,
    textDecoration: "none",
    transition: "all 0.15s ease",
  };
}
