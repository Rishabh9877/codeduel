"use client";

import Link from "next/link";
import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import RoleBadgeSwitcher from "@/components/RoleBadgeSwitcher";
import AppNavbar from "@/components/AppNavbar";

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { matchState, showMatchModal, setShowMatchModal, handleFindMatch, handleCancel } = useMatchmaking();

  const [friends, setFriends] = useState<any[]>(() => {
    if (typeof window !== "undefined") { try { return JSON.parse(localStorage.getItem("friends_friends") || "[]"); } catch(e){} }
    return [];
  });
  const [pendingSent, setPendingSent] = useState<any[]>(() => {
    if (typeof window !== "undefined") { try { return JSON.parse(localStorage.getItem("friends_sent") || "[]"); } catch(e){} }
    return [];
  });
  const [pendingReceived, setPendingReceived] = useState<any[]>(() => {
    if (typeof window !== "undefined") { try { return JSON.parse(localStorage.getItem("friends_recv") || "[]"); } catch(e){} }
    return [];
  });
  const [incomingChallenges, setIncomingChallenges] = useState<any[]>(() => {
    if (typeof window !== "undefined") { try { return JSON.parse(localStorage.getItem("friends_chal") || "[]"); } catch(e){} }
    return [];
  });
  const [addUsername, setAddUsername] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "err" | "success" } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string, username: string } | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isFriendsDisabled, setIsFriendsDisabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(() => {
    if (typeof window !== "undefined") return !!localStorage.getItem("friends_friends");
    return false;
  });

  const loadFriends = async () => {
    try {
      const r = await fetch("/api/friends");
      if (r.ok) {
        const d = await r.json();
        if (d.enabled === false) {
          setIsFriendsDisabled(true);
          return;
        }
        if (!d.error) {
          setFriends(d.friends || []);
          localStorage.setItem("friends_friends", JSON.stringify(d.friends || []));

          setPendingSent(d.pendingSent || []);
          localStorage.setItem("friends_sent", JSON.stringify(d.pendingSent || []));

          setPendingReceived(d.pendingReceived || []);
          localStorage.setItem("friends_recv", JSON.stringify(d.pendingReceived || []));

          setIncomingChallenges(d.incomingChallenges || []);
          localStorage.setItem("friends_chal", JSON.stringify(d.incomingChallenges || []));
        }
      }
    } catch (err) {
      console.error("Failed to load friends:", err);
    } finally {
      setIsLoaded(true);
    }

    try {
      // Poll for active match in case someone accepted our challenge
      const rMatch = await fetch("/api/match/find");
      if (rMatch.ok) {
        const dMatch = await rMatch.json();
        if (dMatch.matchId) {
          router.push(`/match/${dMatch.matchId}`);
        }
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    loadFriends();
    const interval = setInterval(loadFriends, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [status]);

  const handleAddUsernameChange = async (val: string) => {
    setAddUsername(val);
    setMsg(null);
    if (val.length >= 2) {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data.users) {
          setSuggestions(data.users);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (username: string) => {
    setAddUsername(username);
    setShowSuggestions(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername) return;
    setShowSuggestions(false);
    setMsg(null);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", targetUsername: addUsername })
    });
    const d = await res.json();
    if (res.ok) {
      setMsg({ text: d.message || "Request sent!", type: "success" });
      setAddUsername("");
      loadFriends();
    } else {
      setMsg({ text: d.error || "Failed", type: "err" });
    }
  };

  const handleAction = async (action: "accept" | "remove", targetId: string) => {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetId })
    });
    loadFriends();
  };

  const handleChallengeAction = async (action: "send" | "accept" | "decline", targetId: string) => {
    let challengeId = undefined;
    if (action === "send" && typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      challengeId = search.get("challengeId") || search.get("problemId") || undefined;
    }

    const res = await fetch("/api/match/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetId, challengeId, problemId: challengeId })
    });

    const d = await res.json();
    if (action === "send" && res.ok) {
      alert("Challenge sent!");
    } else if (action === "accept" && d.matchId) {
      router.push(`/match/${d.matchId}`);
    } else {
      loadFriends();
    }
  };

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#e8e6f0", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: "15px" }}>
              Codeduel
            </Link>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "100px", background: "rgba(139,142,255,0.12)", color: "#8b8eff", border: "1px solid rgba(139,142,255,0.25)", fontFamily: "'JetBrains Mono', monospace" }}>
              Friends &amp; Duels
            </span>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "13px" }}>
            <Link href="/practice" style={{ color: "#8a8898", textDecoration: "none" }}>Practice Solo</Link>
            <Link href="/leaderboard" style={{ color: "#8a8898", textDecoration: "none" }}>Leaderboard</Link>
            <Link href="/pricing" style={{ color: "#8a8898", textDecoration: "none" }}>Pricing</Link>
          </div>
        </header>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ maxWidth: "520px", width: "100%", background: "#0a0a10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "36px 32px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(139,142,255,0.12)", border: "1px solid rgba(139,142,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", margin: "0 auto 20px" }}>
              👥
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "10px", color: "#fff" }}>
              Friends &amp; Direct Duels
            </h1>
            <p style={{ fontSize: "14px", color: "#8a8898", lineHeight: 1.6, marginBottom: "28px" }}>
              Sign in with your GitHub account to connect with peers, challenge friends directly to 1v1 incident firefights, and compare head-to-head match records.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => signIn("github")}
                style={{
                  background: "#8b8eff",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "14px",
                  padding: "12px 20px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Sign In with GitHub ⚡
              </button>
              <Link
                href="/practice"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e8e6f0",
                  fontWeight: 600,
                  fontSize: "13px",
                  padding: "11px 20px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                Practice Solo Without Account →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        :root {
          --bg: #000; --bg3: #0d0d14; --border: rgba(255,255,255,0.06);
          --border2: rgba(255,255,255,0.10); --indigo: #8b8eff;
          --text: #e8e6f0; --muted: #4a4860; --muted2: #8a8898;
          --green: #4ade80; --red: #f87171;
        }
        body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; }
        .db-nav {
          height: 52px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; border-bottom: 1px solid var(--border);
        }
        .db-nav-links { display: flex; gap: 4px; }
        .db-nav-link { font-size: 13px; color: var(--muted2); padding: 6px 12px; text-decoration: none; border-radius: 6px; }
        .db-nav-link:hover { background: rgba(255,255,255,0.04); color: var(--text); }
        .db-nav-link.active { color: var(--text); font-weight: 600; }
        .find-btn {
          font-size: 13px; font-weight: 700;
          padding: 8px 18px; border-radius: 7px; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 7px;
          transition: opacity .15s, transform .1s;
        }
        .find-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .find-btn:active { transform: scale(0.97) translateY(0); }
        .find-btn-idle    { background: var(--text); color: #000; }
        .find-btn-queued  { background: rgba(139,142,255,0.12); color: var(--indigo); border: 1px solid rgba(139,142,255,0.25); }
        .find-btn-cancel  {
          background: none; border: 1px solid var(--border2); color: var(--muted2);
          font-size: 12px; font-weight: 500; padding: 6px 12px;
        }
        .find-btn-cancel:hover { color: var(--red); border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.04); }
        .main-col { max-width: 600px; margin: 40px auto; padding: 0 20px; }
        .card { background: var(--bg3); border: 1px solid var(--border2); border-radius: 10px; margin-bottom: 20px; }
        .card-hdr { padding: 16px 20px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.2); font-weight: 600; font-size: 14px; border-radius: 10px 10px 0 0; }
        .row { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .row:last-child { border-bottom: none; }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--muted); }
        .username { font-weight: 500; font-size: 14px; }
        .btn { padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer; border: none; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; gap: 6px; transition: filter 0.15s, transform 0.1s; }
        .btn:hover { filter: brightness(1.1); }
        .btn:active { transform: scale(0.97); }
        .btn-add { background: var(--indigo); color: #fff; }
        .btn-acc { background: rgba(74,222,128,0.15); color: var(--green); border: 1px solid rgba(74,222,128,0.3); }
        .btn-acc:hover { background: rgba(74,222,128,0.25); }
        .btn-rem { background: rgba(248,113,113,0.1); color: var(--red); border: 1px solid rgba(248,113,113,0.2); }
        .btn-rem:hover { background: rgba(248,113,113,0.2); }
        .btn-cancel { background: transparent; border: 1px solid var(--border2); color: var(--muted2); }
        .btn-cancel:hover { color: var(--text); border-color: var(--border); }
        .btn-challenge { background: #fff; color: #000; margin-right: 8px; }
        .input-box { width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.4); border: 1px solid var(--border2); border-radius: 6px; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
        .input-box:focus { outline: none; border-color: var(--indigo); }
        .suggestions-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg3); border: 1px solid var(--border2); border-radius: 6px; overflow: hidden; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        .suggestion-item { padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .suggestion-item:last-child { border-bottom: none; }
        .suggestion-item:hover { background: rgba(255,255,255,0.05); }
        .suggestion-avatar { width: 24px; height: 24px; border-radius: 50%; }

        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .skeleton {
          animation: shimmer 2s infinite linear;
          background: linear-gradient(to right, rgba(255,255,255,0.05) 4%, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.05) 36%);
          background-size: 1000px 100%;
          border-radius: 4px;
        }
      `}</style>
      <AppNavbar
        activePage="friends"
        onFindMatch={() => setShowMatchModal(true)}
        matchState={matchState}
        onCancelMatch={handleCancel}
      />

      {/* MATCH MODAL */}
      {showMatchModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "var(--bg3)", border: "1px solid var(--border2)",
            borderRadius: 12, padding: 30, width: "100%", maxWidth: 400,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Select Match Type</h2>
            <p style={{ color: "var(--muted2)", fontSize: 13, marginBottom: 24 }}>How would you like to play?</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button 
                onClick={() => { setShowMatchModal(false); handleFindMatch(); }}
                style={{
                  background: "var(--indigo)", color: "#fff", border: "none",
                  padding: "14px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  transition: "opacity 0.2s"
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>⚡</div>
                Play Random Opponent
              </button>

              <button 
                onClick={() => { setShowMatchModal(false); router.push("/friends"); }}
                style={{
                  background: "rgba(255,255,255,0.05)", color: "var(--text)", border: "1px solid var(--border)",
                  padding: "14px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  transition: "background 0.2s"
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              >
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>👥</div>
                Challenge a Friend
              </button>
            </div>

            <button 
              onClick={() => setShowMatchModal(false)}
              style={{
                width: "100%", background: "transparent", border: "none", color: "var(--muted2)",
                marginTop: 20, cursor: "pointer", fontSize: 13, padding: 8
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}


      {/* REMOVE CONFIRMATION MODAL */}
      {removeTarget && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "var(--bg3)", border: "1px solid var(--border2)",
            borderRadius: 12, padding: 24, width: "100%", maxWidth: 360,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--text)" }}>Remove Friend</h2>
            <p style={{ color: "var(--muted2)", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to remove <strong style={{ color: "#fff" }}>{removeTarget.username}</strong> from your friends list? You will have to send a new request to add them back.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button 
                onClick={() => setRemoveTarget(null)}
                style={{
                  flex: 1, padding: "10px", background: "transparent", border: "1px solid var(--border2)",
                  color: "var(--text)", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13
                }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  handleAction("remove", removeTarget.id);
                  setRemoveTarget(null);
                }}
                style={{
                  flex: 1, padding: "10px", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)",
                  color: "var(--red)", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="main-col">
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>Friends</h1>

        {isFriendsDisabled ? (
          <div
            style={{
              background: "rgba(244,63,94,0.06)",
              border: "1px solid rgba(244,63,94,0.25)",
              borderRadius: 12,
              padding: "36px 24px",
              textAlign: "center",
              marginBottom: 30,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f43f5e", marginBottom: 8 }}>
              Friends Subsystem Unavailable in Dynamo-Only Mode
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted2)", lineHeight: 1.6, maxWidth: 520, margin: "0 auto" }}>
              The peer connections graph and direct friend invitations require a relational PostgreSQL database connection (<code>DATABASE_URL</code>).
              CodeDuel is currently running on the DynamoDB backend.
            </p>
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  padding: "10px 20px",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Return to Matchmaking
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* ADD FRIEND */}
        <div className="card">
          <div className="card-hdr">Add a Friend</div>
          <div style={{ padding: 20 }}>
            <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, position: "relative" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input 
                  className="input-box" 
                  placeholder="Enter GitHub Username..." 
                  value={addUsername} 
                  onChange={e => handleAddUsernameChange(e.target.value)} 
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {suggestions.map(s => (
                      <div key={s.username} className="suggestion-item" onClick={() => selectSuggestion(s.username)}>
                        <img src={s.avatar || "https://github.com/identicons/1.png"} className="suggestion-avatar" />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{s.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-add">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                Send Request
              </button>
            </form>
            {msg && <div style={{ marginTop: 10, fontSize: 12, color: msg.type === "success" ? "var(--green)" : "var(--red)" }}>{msg.text}</div>}
          </div>
        </div>

        {/* INCOMING CHALLENGES */}
        {incomingChallenges.length > 0 && (
          <div className="card" style={{ border: "1px solid var(--indigo)", boxShadow: "0 0 20px rgba(139,142,255,0.15)" }}>
            <div className="card-hdr" style={{ background: "rgba(139,142,255,0.1)", color: "#fff" }}>Incoming Challenges! ⚔️</div>
            {incomingChallenges.map(c => (
              <div key={c.SK} className="row">
                <div className="user-info">
                  <img src={c.challengerAvatar || "https://github.com/identicons/1.png"} className="avatar" />
                  <span className="username" style={{ color: "var(--indigo)" }}>{c.challengerName}</span>
                  <span style={{ fontSize: 12, color: "var(--muted2)", marginLeft: 6 }}>challenged you!</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-acc" onClick={() => handleChallengeAction("accept", c.challengerId)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    Accept & Play
                  </button>
                  <button className="btn btn-rem" onClick={() => handleChallengeAction("decline", c.challengerId)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PENDING REQUESTS */}
        {pendingReceived.length > 0 && (
          <div className="card">
            <div className="card-hdr" style={{ color: "var(--gold)" }}>Pending Received ({pendingReceived.length})</div>
            {pendingReceived.map(req => (
              <div key={req.friendship_id} className="row">
                <div className="user-info">
                  <img src={req.friend_avatar || "https://github.com/identicons/1.png"} className="avatar" />
                  <span className="username">{req.friend_username}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-acc" onClick={() => handleAction("accept", req.friend_id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Accept
                  </button>
                  <button className="btn btn-rem" onClick={() => handleAction("remove", req.friend_id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SENT REQUESTS */}
        {pendingSent.length > 0 && (
          <div className="card">
            <div className="card-hdr" style={{ color: "var(--muted2)" }}>Sent Requests ({pendingSent.length})</div>
            {pendingSent.map(req => (
              <div key={req.friendship_id} className="row">
                <div className="user-info">
                  <img src={req.friend_avatar || "https://github.com/identicons/1.png"} className="avatar" />
                  <span className="username" style={{ color: "var(--muted2)" }}>{req.friend_username}</span>
                </div>
                <div>
                  <button className="btn btn-cancel" onClick={() => handleAction("remove", req.friend_id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FRIENDS LIST */}
        <div className="card">
          <div className="card-hdr">Your Friends {!isLoaded ? "" : `(${friends.length})`}</div>
          {!isLoaded ? (
            [1,2,3].map(i => (
              <div key={i} className="row">
                <div className="user-info">
                  <div className="skeleton avatar"></div>
                  <div className="skeleton" style={{ width: 120, height: 16 }}></div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 6 }}></div>
                  <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 6 }}></div>
                </div>
              </div>
            ))
          ) : friends.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--muted2)", fontSize: 13 }}>
              You haven't added any friends yet.
            </div>
          ) : (
            friends.map(f => (
              <div key={f.friendship_id} className="row">
                <div className="user-info">
                  <img src={f.friend_avatar || "https://github.com/identicons/1.png"} className="avatar" />
                  <span className="username">{f.friend_username}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-challenge" onClick={() => handleChallengeAction("send", f.friend_github_id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    Challenge
                  </button>
                  <button className="btn btn-rem" onClick={() => setRemoveTarget({ id: f.friend_id, username: f.friend_username })}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="17" y1="8" x2="23" y2="14"></line><line x1="23" y1="8" x2="17" y2="14"></line></svg>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        </>
        )}
      </div>
    </>
  );
}
