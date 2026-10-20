"use client";

import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RoleSwitcherModal, { UserRole } from "@/components/RoleSwitcherModal";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [previewTab, setPreviewTab] = useState<"embedded" | "swe">("embedded");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("STUDENT");

  const handleSignInWithRole = (role: UserRole) => {
    localStorage.setItem("preferred_role", role);
    signIn("github");
  };

  useEffect(() => {
    if (status === "authenticated") router.push("/dashboard");
  }, [status, router]);

  // Scroll reveal observer
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            if (e.target.classList.contains("feed-table")) {
              e.target.classList.add("rows-in");
            }
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document
      .querySelectorAll(".reveal, .reveal-stagger, .feed-table")
      .forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600&display=swap');

        :root {
          --bg:      #000;
          --bg2:     #060608;
          --bg3:     #0d0d14;
          --border:  rgba(255,255,255,0.06);
          --border2: rgba(255,255,255,0.10);
          --indigo:  #8b8eff;
          --text:    #e8e6f0;
          --muted:   #4a4860;
          --muted2:  #8a8898;
          --green:   #4ade80;
          --red:     #f87171;
          --amber:   #fbbf24;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Geist', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          background-image: radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px);
          background-size: 26px 26px;
        }
        a { text-decoration: none; color: inherit; }

        /* ── NAV ─────────────────────────────────────────── */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: 52px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px;
          border-bottom: 1px solid var(--border);
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(24px) saturate(1.5);
        }
        .nav-brand { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px; }
        .nav-center { display: flex; gap: 20px; list-style: none; }
        .nav-center a { font-size: 13px; color: var(--muted2); transition: color .15s; }
        .nav-center a:hover { color: var(--text); }
        .nav-right { display: flex; align-items: center; gap: 8px; }

        .btn-primary {
          font-size: 13px; font-weight: 600;
          background: var(--text); color: #000;
          border: none; border-radius: 6px;
          padding: 7px 14px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
          transition: opacity .15s, transform .1s;
        }
        .btn-primary:hover { opacity: 0.88; }
        .btn-primary:active { transform: scale(0.97); }

        /* ── HERO ────────────────────────────────────────── */
        .hero {
          padding: 130px 24px 60px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; position: relative; overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute; top: -60px; left: 50%; transform: translateX(-50%);
          width: 900px; height: 500px;
          background: radial-gradient(ellipse at 50% 0%,
            rgba(139,142,255,0.13) 0%,
            rgba(139,142,255,0.04) 40%,
            transparent 70%);
          pointer-events: none;
        }

        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 13px; border-radius: 100px;
          border: 1px solid rgba(139,142,255,0.25);
          background: rgba(139,142,255,0.05);
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--indigo); margin-bottom: 24px;
          position: relative; z-index: 1;
        }
        .eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--indigo);
          animation: pulse-dot 2.4s ease-in-out infinite;
        }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.8)} }

        .hero-h1 {
          font-size: clamp(48px, 8.5vw, 92px);
          font-weight: 700; letter-spacing: -0.045em; line-height: 0.95;
          margin-bottom: 20px; max-width: 820px;
          position: relative; z-index: 1;
        }
        .hero-h1 .accent {
          background: linear-gradient(135deg, #a5a8ff 0%, #7b7fff 50%, #c4b5fd 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          font-size: 16px; line-height: 1.6; color: var(--muted2);
          max-width: 620px; margin: 0 auto 36px;
          position: relative; z-index: 1;
        }

        .btn-cta {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--text); color: #000;
          font-size: 13.5px; font-weight: 700;
          padding: 10px 18px; border-radius: 7px;
          border: none; cursor: pointer;
          transition: opacity .15s, transform .1s;
        }
        .btn-cta:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-cta:active { transform: scale(0.97); }

        .btn-cta-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.03); color: var(--muted2);
          font-size: 13.5px; font-weight: 500;
          padding: 10px 18px; border-radius: 7px;
          border: 1px solid var(--border2); cursor: pointer;
          transition: color .15s, border-color .15s, background .15s;
        }
        .btn-cta-ghost:hover {
          color: var(--text); border-color: rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.06);
        }

        /* ── ARENA DEMO CARD ─────────────────────────────── */
        .arena-wrap {
          width: 100%; max-width: 900px;
          position: relative; z-index: 1; margin-top: 20px;
        }
        .arena-card {
          background: var(--bg3);
          border: 1px solid rgba(139,142,255,0.25);
          border-radius: 12px; overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(139,142,255,0.08),
            0 24px 80px rgba(0,0,0,0.8);
          text-align: left;
        }
        .arena-chrome {
          height: 42px; padding: 0 16px;
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(0,0,0,0.6);
          border-bottom: 1px solid var(--border);
        }
        .chrome-dots { display: flex; gap: 6px; align-items: center; }
        .chrome-dot { width: 10px; height: 10px; border-radius: 50%; }
        .cd-r { background: #ff5f57; } .cd-y { background: #febc2e; } .cd-g { background: #28c840; }
        .demo-tag {
          font-size: 10.5px; font-family: 'JetBrains Mono', monospace;
          background: rgba(139,142,255,0.15); border: 1px solid rgba(139,142,255,0.3);
          color: var(--indigo); padding: 2px 8px; border-radius: 4px; font-weight: 600;
        }
        .chrome-tabs { display: flex; gap: 12px; align-items: center; font-size: 12px; }
        .chrome-tab { color: var(--muted2); font-family: 'JetBrains Mono', monospace; }
        .chrome-tab.active { color: #fff; font-weight: 600; }

        .editor-body {
          display: flex;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px; line-height: 1.6;
          background: #09090f;
          padding: 16px 0;
          overflow-x: auto;
        }
        .line-nums {
          padding: 0 16px 0 14px;
          color: var(--muted);
          text-align: right;
          user-select: none;
          border-right: 1px solid var(--border);
        }
        .code-area { padding: 0 20px; flex: 1; }
        .k { color: #c678dd; } .fn { color: #61afef; } .cm { color: #5c6370; font-style: italic; }
        .str { color: #98c379; } .pn { color: #abb2bf; } .num { color: #d19a66; } .err { color: #f87171; font-weight: 700; }

        .test-badges-panel {
          border-top: 1px solid var(--border);
          background: #07070c;
          padding: 14px 20px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .test-badge-row {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 11.5px; font-family: 'JetBrains Mono', monospace;
        }
        .tb-pass { color: var(--green); }
        .tb-fail { color: var(--red); }
        .tb-pending { color: var(--amber); }

        .opponent-status-bar {
          border-top: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          padding: 10px 20px;
          display: flex; align-items: center; justify-content: space-between;
          font-size: 12px; font-family: 'JetBrains Mono', monospace;
        }

        /* ── SECTIONS COMMON ─────────────────────────────── */
        section { padding: 92px 24px; max-width: 1040px; margin: 0 auto; scroll-margin-top: 70px; }
        .eyebrow-sm {
          display: inline-block; font-size: 11px; font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 0.12em; color: var(--indigo);
          margin-bottom: 14px;
        }
        .section-title {
          font-size: clamp(28px, 4.2vw, 42px); font-weight: 700;
          letter-spacing: -0.035em; line-height: 1.18; margin-bottom: 16px;
        }
        .section-sub {
          font-size: 15.5px; color: var(--muted2); line-height: 1.7; max-width: 660px; margin-bottom: 44px;
        }
        .fade-divider {
          border: none; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
          max-width: 1040px; margin: 0 auto;
        }

        /* ── THE PROBLEM ─────────────────────────────────── */
        .problem-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
          gap: 20px;
        }
        .problem-card {
          background: rgba(255,255,255,0.015); border: 1px solid var(--border);
          border-radius: 12px; padding: 28px 24px;
          display: flex; flex-direction: column; gap: 12px;
          transition: border-color 0.2s;
        }
        .problem-card:hover { border-color: var(--border2); }
        .problem-card h3 { font-size: 16px; font-weight: 600; color: var(--text); }
        .problem-card p { font-size: 13.5px; color: var(--muted2); line-height: 1.65; }

        /* ── HOW IT WORKS ────────────────────────────────── */
        .steps-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .step-card {
          background: rgba(255,255,255,0.015); border: 1px solid var(--border);
          border-radius: 10px; padding: 24px 22px;
        }
        .step-num { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--indigo); margin-bottom: 8px; font-weight: 700; }
        .step-name { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
        .step-desc { font-size: 13px; color: var(--muted2); line-height: 1.6; }

        /* ── TWO TRACKS ──────────────────────────────────── */
        .tracks-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 24px;
        }
        .track-card {
          background: #08090e; border: 1px solid var(--border);
          border-radius: 14px; padding: 32px 28px; display: flex; flex-direction: column; gap: 18px;
          position: relative; overflow: hidden;
          transition: border-color 0.2s, transform 0.2s;
        }
        .track-card:hover { border-color: rgba(139,142,255,0.3); transform: translateY(-2px); }
        .track-badge {
          display: inline-block; font-size: 11px; font-family: 'JetBrains Mono', monospace;
          padding: 3px 10px; border-radius: 100px; width: fit-content; font-weight: 600;
        }
        .track-card h3 { font-size: 20px; font-weight: 700; }
        .track-card p { font-size: 14px; color: var(--muted2); line-height: 1.65; }
        .track-tags { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin-top: auto; }
        .track-tags li {
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          background: rgba(255,255,255,0.03); border: 1px solid var(--border);
          padding: 3px 8px; border-radius: 4px; color: var(--muted2);
        }

        /* ── FOR COLLEGES ────────────────────────────────── */
        .campus-box {
          background: linear-gradient(135deg, rgba(139,142,255,0.04) 0%, rgba(139,142,255,0.01) 100%);
          border: 1px solid rgba(139,142,255,0.18);
          border-radius: 16px; padding: 36px 32px;
          display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: center;
        }
        @media (max-width: 768px) {
          .campus-box { grid-template-columns: 1fr; }
        }

        /* ── PRICING TEASER ──────────────────────────────── */
        .pricing-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px; margin-bottom: 28px;
        }
        .pricing-card {
          background: rgba(255,255,255,0.015); border: 1px solid var(--border);
          border-radius: 12px; padding: 28px 24px; display: flex; flex-direction: column;
        }
        .pricing-tier { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
        .pricing-price { font-size: 24px; font-weight: 800; font-family: 'JetBrains Mono', monospace; margin-bottom: 12px; }
        .pricing-desc { font-size: 13px; color: var(--muted2); line-height: 1.55; margin-bottom: 16px; }
        .pricing-features { list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; color: var(--muted2); margin-top: auto; }

        /* ── LIVE FEED TABLE ─────────────────────────────── */
        .feed-card {
          background: rgba(255,255,255,0.015); border: 1px solid var(--border);
          border-radius: 12px; overflow: hidden;
        }
        .feed-hdr {
          padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid var(--border);
        }
        .feed-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .feed-table th {
          text-align: left; padding: 12px 20px; font-size: 11px;
          font-family: 'JetBrains Mono', monospace; color: var(--muted2);
          text-transform: uppercase; background: rgba(255,255,255,0.02);
        }
        .feed-table td { padding: 14px 20px; border-top: 1px solid var(--border); }
        .feed-badge {
          display: inline-block; padding: 2px 8px; border-radius: 4px;
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
        }

        /* ── FOOTER ──────────────────────────────────────── */
        footer {
          border-top: 1px solid var(--border);
          padding: 64px 24px 36px; max-width: 1040px; margin: 0 auto;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
        }
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr; gap: 28px; }
        }
        .footer-col h4 {
          font-size: 11px; font-weight: 700; color: var(--text);
          text-transform: uppercase; letter-spacing: 0.08em;
          margin: 0 0 14px; font-family: 'JetBrains Mono', monospace;
        }
        .footer-col ul {
          list-style: none; padding: 0; margin: 0;
          display: flex; flex-direction: column; gap: 10px;
        }
        .footer-col a {
          font-size: 13px; color: var(--muted2); text-decoration: none;
          transition: color 0.15s;
        }
        .footer-col a:hover { color: var(--text); }
        .footer-bottom {
          padding-top: 24px; border-top: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center;
          font-size: 12px; color: var(--muted2); flex-wrap: wrap; gap: 12px;
        }
      `}</style>

      {/* TOP NAVIGATION */}
      <nav className="nav">
        <span className="nav-brand">
          <span>Codeduel</span>
          <span style={{
            fontSize: "10px",
            fontFamily: "'JetBrains Mono', monospace",
            background: "rgba(139,142,255,0.15)",
            border: "1px solid rgba(139,142,255,0.3)",
            color: "var(--indigo)",
            padding: "1px 6px",
            borderRadius: "4px"
          }}>
            Private Alpha
          </span>
        </span>
        <ul className="nav-center">
          <li><Link href="#problem">The Problem</Link></li>
          <li><Link href="#how-it-works">How It Works</Link></li>
          <li><Link href="#tracks">Two Tracks</Link></li>
          <li><Link href="/campus">For Colleges</Link></li>
          <li><Link href="/pricing">Pricing</Link></li>
          <li><Link href="/leaderboard">Leaderboard</Link></li>
        </ul>
        <div className="nav-right">
          <button className="btn-primary" onClick={() => setRoleModalOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Sign In / Join Arena
          </button>
        </div>
      </nav>

      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            Real-Time Competitive Engineering Arena · Season 1
          </div>
          <h1 className="hero-h1">
            Don't write it.<br />
            <span className="accent">Fix it.</span>
          </h1>
          <p className="hero-sub" style={{ fontSize: "17px", fontWeight: 500, color: "var(--text)", maxWidth: "680px", marginBottom: "32px" }}>
            We train students and developers through 1v1 dynamic software and ECE duels.
          </p>

          {/* Persona selector pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "18px",
              zIndex: 1,
            }}
          >
            <span style={{ fontSize: "11px", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", marginRight: "4px" }}>
              Join Platform As:
            </span>
            <button
              onClick={() => handleSignInWithRole("STUDENT")}
              style={{
                background: "rgba(74,222,128,0.1)",
                border: "1px solid rgba(74,222,128,0.3)",
                color: "#4ade80",
                padding: "6px 14px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <span>🎓</span> College Student
            </button>
            <button
              onClick={() => handleSignInWithRole("FACULTY")}
              style={{
                background: "rgba(56,189,248,0.1)",
                border: "1px solid rgba(56,189,248,0.3)",
                color: "#38bdf8",
                padding: "6px 14px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <span>🏛️</span> Faculty / Instructor
            </button>
            <button
              onClick={() => handleSignInWithRole("INDIVIDUAL")}
              style={{
                background: "rgba(139,142,255,0.1)",
                border: "1px solid rgba(139,142,255,0.3)",
                color: "#8b8eff",
                padding: "6px 14px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <span>💻</span> Individual Dev
            </button>
          </div>

          {/* Primary CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center", marginBottom: "32px", zIndex: 1 }}>
            <button className="btn-cta" onClick={() => setRoleModalOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Sign in with GitHub
            </button>
            <Link href="/practice" className="btn-cta-ghost" style={{ fontWeight: 600 }}>
              Practice solo demo →
            </Link>
            <Link href="/campus" className="btn-cta-ghost" style={{ borderColor: "rgba(139,142,255,0.35)", color: "var(--indigo)" }}>
              Campus edition →
            </Link>
          </div>

          {/* DUAL INCIDENT PREVIEW SWITCHER PILL */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "100px",
              padding: "4px",
              gap: "4px",
              marginBottom: "24px",
            }}
          >
            <button
              onClick={() => setPreviewTab("embedded")}
              style={{
                background: previewTab === "embedded" ? "rgba(251,191,36,0.14)" : "transparent",
                color: previewTab === "embedded" ? "#fbbf24" : "var(--muted2)",
                border: previewTab === "embedded" ? "1px solid rgba(251,191,36,0.28)" : "1px solid transparent",
                padding: "6px 16px",
                borderRadius: "100px",
                fontSize: "12px",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              ⚡ Embedded C (ring_buffer.c)
            </button>
            <button
              onClick={() => setPreviewTab("swe")}
              style={{
                background: previewTab === "swe" ? "rgba(56,189,248,0.14)" : "transparent",
                color: previewTab === "swe" ? "#38bdf8" : "var(--muted2)",
                border: previewTab === "swe" ? "1px solid rgba(56,189,248,0.28)" : "1px solid transparent",
                padding: "6px 16px",
                borderRadius: "100px",
                fontSize: "12px",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              🌐 Cloud SWE (rateLimiter.ts)
            </button>
          </div>

          {/* HERO DEMO CARD: LIVE INCIDENT PREVIEW (EMBEDDED C VS CLOUD SWE TS) */}
          <div className="arena-wrap">
            <div className="arena-card">
              <div className="arena-chrome">
                <div className="chrome-dots">
                  <div className="chrome-dot cd-r" />
                  <div className="chrome-dot cd-y" />
                  <div className="chrome-dot cd-g" />
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "10px",
                      fontFamily: "'JetBrains Mono', monospace",
                      background: "rgba(244,63,94,0.18)",
                      border: "1px solid rgba(244,63,94,0.4)",
                      color: "#f43f5e",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontWeight: 800,
                    }}
                  >
                    DON'T WRITE IT. FIX IT. — LIVE OUTAGE
                  </span>
                </div>
                <div className="chrome-tabs">
                  {previewTab === "embedded" ? (
                    <>
                      <span className="chrome-tab active">✏️ ring_buffer.c</span>
                      <span className="chrome-tab">🔒 ring_buffer.h</span>
                      <span className="chrome-tab">🔒 test_suite.c</span>
                    </>
                  ) : (
                    <>
                      <span className="chrome-tab active" style={{ color: "#38bdf8" }}>✏️ rateLimiter.ts</span>
                      <span className="chrome-tab">🔒 types.ts</span>
                      <span className="chrome-tab">🔒 rateLimiter.test.ts</span>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "var(--amber)", fontWeight: 700 }}>
                    ⏱ 11:42
                  </span>
                  <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#4ade80", background: "rgba(74,222,128,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                    +16 ELO
                  </span>
                </div>
              </div>

              {/* EDITOR BODY (Switchable between ring_buffer.c and rateLimiter.ts) */}
              <div className="editor-body">
                <div className="line-nums">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <div key={n}>{n}</div>)}
                </div>
                <div className="code-area">
                  {previewTab === "embedded" ? (
                    <>
                      <div><span className="cm">// Issue #44: UART Ring Buffer Telemetry Loss under high baud rate</span></div>
                      <div><span className="cm">// BUG: Off-by-one check drops valid packet when tail wraps buffer limit</span></div>
                      <div><span className="k">bool </span><span className="fn">ring_buf_enqueue</span><span className="pn">(ring_buf_t *rb, </span><span className="k">uint8_t </span>byte<span className="pn">) {"{"}</span></div>
                      <div>&nbsp;&nbsp;<span className="k">uint32_t </span>next_head = (rb-&gt;head + <span className="num">1</span>) % rb-&gt;capacity;</div>
                      <div>&nbsp;&nbsp;<span className="cm">// Defect: rejects valid byte when index equals tail offset</span></div>
                      <div>&nbsp;&nbsp;<span className="k">if </span>(next_head == rb-&gt;tail) <span className="pn">{"{"}</span></div>
                      <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="err">return false; // Packet lost during DMA burst!</span></div>
                      <div>&nbsp;&nbsp;<span className="pn">{"}"}</span></div>
                      <div>&nbsp;&nbsp;rb-&gt;buffer[rb-&gt;head] = byte;</div>
                      <div>&nbsp;&nbsp;rb-&gt;head = next_head;</div>
                      <div>&nbsp;&nbsp;<span className="k">return true</span>;</div>
                      <div><span className="pn">{"}"}</span></div>
                    </>
                  ) : (
                    <>
                      <div><span className="cm">// Incident #812: API Gateway Token Bucket Rate Limiter Starvation</span></div>
                      <div><span className="cm">// BUG: Math.floor(elapsed / 1000) truncates sub-second token replenishment</span></div>
                      <div><span className="k">export class </span><span className="fn">TokenBucket</span><span className="pn"> {"{"}</span></div>
                      <div>&nbsp;&nbsp;<span className="fn">allowRequest</span><span className="pn">(tokensNeeded = <span className="num">1</span>): </span><span className="k">boolean</span> <span className="pn">{"{"}</span></div>
                      <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="k">const </span>elapsedMs = Date.now() - <span className="k">this</span>.lastRefillMs;</div>
                      <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="cm">// Defect: integer division truncates fractional seconds to 0</span></div>
                      <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="err">const refill = Math.floor(elapsedMs / 1000) * this.refillRate;</span></div>
                      <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="k">this</span>.tokens = Math.min(<span className="k">this</span>.capacity, <span className="k">this</span>.tokens + refill);</div>
                      <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="k">if </span>(<span className="k">this</span>.tokens &gt;= tokensNeeded) <span className="pn">{"{"}</span> <span className="k">this</span>.tokens -= tokensNeeded; <span className="k">return true</span>; <span className="pn">{"}"}</span></div>
                      <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="k">return false</span>;</div>
                      <div>&nbsp;&nbsp;<span className="pn">{"}"}</span></div>
                      <div><span className="pn">{"}"}</span></div>
                    </>
                  )}
                </div>
              </div>

              {/* TEST BADGES PANEL */}
              <div className="test-badges-panel">
                {previewTab === "embedded" ? (
                  <>
                    <div className="test-badge-row">
                      <span className="tb-pass">✓ TEST 1: Buffer Initialization &amp; Normal Enqueue</span>
                      <span className="tb-pass">PASSED</span>
                    </div>
                    <div className="test-badge-row">
                      <span className="tb-fail">✗ TEST 2: High-Speed UART Wrap-Around Telemetry</span>
                      <span className="tb-fail">FAILED (Byte dropped at index 255)</span>
                    </div>
                    <div className="test-badge-row">
                      <span className="tb-pending">⏳ TEST 3: Concurrent ISR Overrun Protection</span>
                      <span className="tb-pending">AWAITING PATCH</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="test-badge-row">
                      <span className="tb-pass">✓ TEST 1: Sustained 1-second burst traffic consumption</span>
                      <span className="tb-pass">PASSED</span>
                    </div>
                    <div className="test-badge-row">
                      <span className="tb-fail">✗ TEST 2: Sub-second fractional token replenishment (500ms intervals)</span>
                      <span className="tb-fail">FAILED (Expected tokens &gt; 0, got 0)</span>
                    </div>
                    <div className="test-badge-row">
                      <span className="tb-pending">⏳ TEST 3: High-frequency RPC storm concurrency</span>
                      <span className="tb-pending">AWAITING PATCH</span>
                    </div>
                  </>
                )}
              </div>

              {/* OPPONENT PROGRESS BAR */}
              <div className="opponent-status-bar">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--muted2)" }}>Opponent:</span>
                  <span style={{ color: "var(--amber)", fontWeight: 600 }}>CodeSentinel AI [BOT]</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "90px", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: "66%", height: "100%", background: "var(--amber)" }} />
                  </div>
                  <span style={{ color: "var(--muted2)", fontSize: "11px" }}>2/3 passed</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: THE PROBLEM */}
        <hr className="fade-divider" />
        <section id="problem">
          <span className="eyebrow-sm reveal">The Problem</span>
          <h2 className="section-title reveal">
            Students practice writing toy algorithms.<br />
            Real engineering is debugging.
          </h2>
          <p className="section-sub reveal">
            Most computer science and ECE courses spend semesters testing whether candidates can implement algorithms from an empty file. In industry and labs, engineers rarely write greenfield code from scratch.
          </p>
          <div className="problem-grid reveal-stagger">
            <div className="problem-card">
              <h3>The Traditional Trap</h3>
              <p>
                Students spend countless hours memorizing textbook puzzles (inverting binary trees, dynamic programming) from a blank slate. These never teach students how to navigate large, modular codebases or diagnose race conditions.
              </p>
            </div>
            <div className="problem-card">
              <h3>The Engineering Reality</h3>
              <p>
                In firmware labs, aerospace, automotive, and cloud infrastructure, over 80% of an engineer's time is spent reading unfamiliar repositories, diagnosing boundary leaks, and resolving customer outages under time pressure.
              </p>
            </div>
            <div className="problem-card">
              <h3>The Codeduel Standard</h3>
              <p>
                We put you in authentic multi-file codebases with failing integration tests and customer incident tickets. You locate the root defect, write the patch, and prove correctness in live competitive duels.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: HOW IT WORKS */}
        <hr className="fade-divider" />
        <section id="how-it-works">
          <span className="eyebrow-sm reveal">How It Works</span>
          <h2 className="section-title reveal">Five steps from incident ticket to verified fix.</h2>
          <p className="section-sub reveal">
            A battle-tested competitive workflow that rewards diagnostic accuracy, fast comprehension, and clean code.
          </p>
          <div className="steps-grid reveal-stagger">
            <div className="step-card">
              <div className="step-num">STEP 01</div>
              <div className="step-name">Match or Practice</div>
              <p className="step-desc">Enter 1v1 ELO-rated matchmaking or hone your skills in solo practice across your chosen engineering track.</p>
            </div>
            <div className="step-card">
              <div className="step-num">STEP 02</div>
              <div className="step-name">Get Buggy Code</div>
              <p className="step-desc">Receive a customer incident ticket, production architecture context, and pre-written modular files with intentional bugs.</p>
            </div>
            <div className="step-card">
              <div className="step-num">STEP 03</div>
              <div className="step-name">Triage & Fix</div>
              <p className="step-desc">Inspect read-only headers and interfaces, pinpoint the root cause, and write your surgical patch in the web editor.</p>
            </div>
            <div className="step-card">
              <div className="step-num">STEP 04</div>
              <div className="step-name">Run Real Tests</div>
              <p className="step-desc">Execute automated test suites against isolated compiler sandboxes with immediate pass/fail feedback.</p>
            </div>
            <div className="step-card">
              <div className="step-num">STEP 05</div>
              <div className="step-name">Climb the Ladder</div>
              <p className="step-desc">First engineer to pass all automated test assertions wins the duel and earns rating points on the global leaderboard.</p>
            </div>
          </div>
        </section>

        {/* SECTION 3: TWO TRACKS & ELO CALIBRATION */}
        <hr className="fade-divider" />
        <section id="tracks">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span className="eyebrow-sm reveal">Two Engineering Tracks</span>
            <h2 className="section-title reveal" style={{ maxWidth: "720px", margin: "0 auto 14px" }}>
              Specialized arenas for modern systems engineering.
            </h2>
            <p className="section-sub reveal" style={{ maxWidth: "620px", margin: "0 auto" }}>
              Race to diagnose customer tickets, patch multi-file repositories, and pass automated unit tests across your chosen discipline.
            </p>
          </div>

          <div className="tracks-grid reveal-stagger">
            {/* Embedded Systems Track */}
            <div className="track-card">
              <span className="track-badge" style={{ background: "rgba(251,191,36,0.12)", color: "var(--amber)", border: "1px solid rgba(251,191,36,0.25)" }}>
                ⚡ ECE &amp; HARDWARE TRACK
              </span>
              <h3>Embedded Systems &amp; Electronics (C)</h3>
              <p>
                Debug microcontroller drivers, peripheral communication buses, memory-constrained circular buffers, and timing races before deploying to silicon.
              </p>
              <ul className="track-tags">
                <li>UART Ring Buffers</li>
                <li>GPIO Debounce ISRs</li>
                <li>SPI Multi-Byte Endianness</li>
                <li>PWM Timer Prescalers</li>
                <li>ARM Cortex-M Faults</li>
              </ul>
              <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                <Link
                  href="/practice?track=EMBEDDED_SYSTEMS"
                  className="btn-cta"
                  style={{ background: "#fbbf24", color: "#000", fontSize: "13px", padding: "9px 16px" }}
                >
                  Practice Embedded →
                </Link>
                <Link
                  href="/dashboard?action=find_match&track=EMBEDDED_SYSTEMS"
                  className="btn-cta-ghost"
                  style={{ fontSize: "13px", padding: "9px 16px" }}
                >
                  Queue 1v1 ECE Match ⚡
                </Link>
              </div>
            </div>

            {/* Cloud SWE Track */}
            <div className="track-card">
              <span className="track-badge" style={{ background: "rgba(139,142,255,0.12)", color: "var(--indigo)", border: "1px solid rgba(139,142,255,0.25)" }}>
                🌐 CLOUD &amp; BACKEND TRACK
              </span>
              <h3>Cloud Software Engineering (TypeScript / Python)</h3>
              <p>
                Diagnose backend service outages, concurrency bottlenecks, connection pool resource leaks, and authentication bypasses in production stacks.
              </p>
              <ul className="track-tags">
                <li>Token Bucket Rate Limiters</li>
                <li>Exponential Backoff Jitter</li>
                <li>JWT Algorithm Confusion</li>
                <li>PostgreSQL Pool Leaks</li>
                <li>Cache Stampede Mutexes</li>
              </ul>
              <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                <Link
                  href="/practice?track=PRODUCTION_SWE"
                  className="btn-cta"
                  style={{ background: "#8b8eff", color: "#000", fontSize: "13px", padding: "9px 16px" }}
                >
                  Practice Cloud SWE →
                </Link>
                <Link
                  href="/dashboard?action=find_match&track=PRODUCTION_SWE"
                  className="btn-cta-ghost"
                  style={{ fontSize: "13px", padding: "9px 16px" }}
                >
                  Queue 1v1 SWE Match ⚡
                </Link>
              </div>
            </div>
          </div>

          {/* Minimal ELO Bracket Calibration Strip */}
          <div
            style={{
              marginTop: "28px",
              padding: "16px 24px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.015)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "var(--muted2)" }}>
              Calibrated ELO Rating Brackets:
            </span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Link
                href="/practice?difficulty=easy"
                style={{
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#4ade80",
                  background: "rgba(74,222,128,0.08)",
                  border: "1px solid rgba(74,222,128,0.2)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
              >
                Bracket I: Junior / Intern (800–1099 ELO)
              </Link>
              <Link
                href="/practice?difficulty=medium"
                style={{
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#fbbf24",
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
              >
                Bracket II: Systems Engineer (1100–1399 ELO)
              </Link>
              <Link
                href="/practice?difficulty=hard"
                style={{
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#f43f5e",
                  background: "rgba(244,63,94,0.08)",
                  border: "1px solid rgba(244,63,94,0.2)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
              >
                Bracket III: Staff / Principal (1400+ ELO)
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 4: CAMPUS & PLACEMENT READINESS */}
        <hr className="fade-divider" />
        <section id="campus">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <span className="eyebrow-sm reveal">Institutional &amp; Hiring Readiness</span>
            <h2 className="section-title reveal" style={{ maxWidth: "700px", margin: "0 auto 12px" }}>
              Built for engineering universities &amp; technical placement rounds.
            </h2>
            <p className="section-sub reveal" style={{ maxWidth: "620px", margin: "0 auto" }}>
              Turn passive programming labs into high-stakes debugging sessions, calibrated for core hardware firms and IT assessments.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {/* Campus & Lab Hub */}
            <div
              style={{
                background: "rgba(139,142,255,0.03)",
                border: "1px solid rgba(139,142,255,0.18)",
                borderRadius: "14px",
                padding: "32px 28px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "10.5px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  color: "var(--indigo)",
                  background: "rgba(139,142,255,0.12)",
                  border: "1px solid rgba(139,142,255,0.25)",
                  padding: "3px 10px",
                  borderRadius: "100px",
                  width: "fit-content",
                }}
              >
                🏫 UNIVERSITY FACULTY &amp; LABS
              </span>
              <h3 style={{ fontSize: "20px", fontWeight: 700 }}>Autonomous Lab Management</h3>
              <p style={{ fontSize: "14px", color: "var(--muted2)", lineHeight: 1.6, margin: 0 }}>
                Professors create custom lab cohorts with 6-character join codes (e.g. PEC301), assign production incident tickets, and download automated CSV gradebooks with student telemetry.
              </p>
              <div style={{ marginTop: "auto", paddingTop: "12px" }}>
                <Link href="/campus" className="btn-cta" style={{ background: "var(--indigo)", color: "#000", fontSize: "13px" }}>
                  Explore Campus Portal →
                </Link>
              </div>
            </div>

            {/* Placement & IT Recruitment */}
            <div
              style={{
                background: "rgba(56,189,248,0.03)",
                border: "1px solid rgba(56,189,248,0.18)",
                borderRadius: "14px",
                padding: "32px 28px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "10.5px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  color: "#38bdf8",
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.25)",
                  padding: "3px 10px",
                  borderRadius: "100px",
                  width: "fit-content",
                }}
              >
                🎯 CORE &amp; IT PLACEMENT PREP
              </span>
              <h3 style={{ fontSize: "20px", fontWeight: 700 }}>Product Cores &amp; Mass IT Hiring</h3>
              <p style={{ fontSize: "14px", color: "var(--muted2)", lineHeight: 1.6, margin: 0 }}>
                Train students to conquer technical rounds for core systems (Qualcomm, Texas Instruments, Google) and high-volume IT assessments (TCS NQT, Infosys, Cognizant, Accenture).
              </p>
              <div style={{ marginTop: "auto", paddingTop: "12px" }}>
                <Link href="/practice" className="btn-cta-ghost" style={{ fontSize: "13px" }}>
                  Practice Placement Incidents →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: PRICING TEASER */}
        <hr className="fade-divider" />
        <section id="pricing">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <span className="eyebrow-sm reveal">Transparent Subscriptions</span>
            <h2 className="section-title reveal" style={{ maxWidth: "600px", margin: "0 auto 12px" }}>
              Plans for ambitious engineers &amp; colleges.
            </h2>
            <p className="section-sub reveal" style={{ maxWidth: "540px", margin: "0 auto" }}>
              Transparent tiers for individual developer mastery and turnkey university departmental labs.
            </p>
          </div>

          <div className="pricing-grid reveal-stagger">
            <div className="pricing-card">
              <div className="pricing-tier">Student Free</div>
              <div className="pricing-price">
                ₹0 <span style={{ fontSize: "13px", color: "var(--muted2)", fontWeight: 400 }}>($0) / mo</span>
              </div>
              <p className="pricing-desc">Foundational debugging training for engineering students getting started.</p>
              <ul className="pricing-features">
                <li>• Unlimited 1v1 matchmaking &amp; duels</li>
                <li>• Daily Practice Challenge with streaks</li>
                <li>• Tier-1 Socratic AI guidance per duel</li>
                <li>• Global real-time ELO leaderboard</li>
              </ul>
            </div>

            <div className="pricing-card" style={{ borderColor: "rgba(139,142,255,0.35)", background: "rgba(139,142,255,0.04)" }}>
              <div className="pricing-tier" style={{ color: "var(--indigo)" }}>Pro Engineer</div>
              <div className="pricing-price">
                ₹100 <span style={{ fontSize: "13px", color: "var(--muted2)", fontWeight: 400 }}>($19) / mo</span>
              </div>
              <p className="pricing-desc">Primary B2C subscription for developers targeting top product and firmware roles.</p>
              <ul className="pricing-features">
                <li>• Unlimited 3-Tier Socratic AI Coach</li>
                <li>• Digital Oscilloscope &amp; Logic Analyzer</li>
                <li>• ARM Cortex MMIO fault telemetry</li>
                <li>• Verified Recruiter Portfolio &amp; Certificates</li>
              </ul>
            </div>

            <div className="pricing-card" style={{ borderColor: "rgba(56,189,248,0.25)", background: "rgba(56,189,248,0.02)" }}>
              <div className="pricing-tier" style={{ color: "#38bdf8" }}>Campus Department</div>
              <div className="pricing-price">
                ₹40,000 <span style={{ fontSize: "13px", color: "var(--muted2)", fontWeight: 400 }}>($499) / term</span>
              </div>
              <p className="pricing-desc">Secondary B2B institutional licensing for university engineering departments.</p>
              <ul className="pricing-features">
                <li>• Unlimited student seats across department</li>
                <li>• 6-character cohort join codes (e.g. PEC301)</li>
                <li>• Automated lab grading &amp; plagiarism telemetry</li>
                <li>• Downloadable Automated CSV Gradebook</li>
              </ul>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <Link href="/pricing" className="btn-cta-ghost" style={{ display: "inline-flex" }}>
              View Complete Pricing Details &amp; ROI Calculator →
            </Link>
          </div>
        </section>

        {/* SECTION 6: LIVE FEED */}
        <hr className="fade-divider" />
        <section id="live">
          <div className="feed-card reveal">
            <div className="feed-hdr">
              <div>
                <span style={{ fontSize: "14px", fontWeight: 700, marginRight: "10px" }}>Live Battleground Activity</span>
                <span style={{
                  fontSize: "10.5px", fontFamily: "'JetBrains Mono', monospace",
                  background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)",
                  color: "var(--green)", padding: "2px 7px", borderRadius: "4px"
                }}>
                  ● Live Telemetry
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--muted2)", fontFamily: "'JetBrains Mono', monospace" }}>
                Updated in real time
              </span>
            </div>
            <table className="feed-table">
              <thead>
                <tr>
                  <th>Engineers</th>
                  <th>Challenge Ticket</th>
                  <th>Track</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { p1: "RD", p2: "BOT", names: "Rishabh9877 vs CodeSentinel AI (Bot)", prob: "PR #108: Token Bucket Rate Limiter", track: "Cloud SWE · TS", result: "Win +16 ELO", win: true },
                  { p1: "VA", p2: "BOT", names: "vivaanarora vs CodeSentinel AI (Bot)", prob: "Issue #44: UART Ring Buffer Telemetry", track: "Embedded · C", result: "Win +18 ELO", win: true },
                  { p1: "RD", p2: "VA", names: "Rishabh9877 vs vivaanarora", prob: "Issue #89: Cortex-M0 Unaligned HardFault", track: "Embedded · C", result: "Win +19 ELO", win: true },
                  { p1: "G1", p2: "BOT", names: "Guest_Alpha vs CodeSentinel AI (Bot)", prob: "PR #212: Exponential Retry Jitter", track: "Cloud SWE · TS", result: "Win +17 ELO", win: true },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{row.names}</span>
                    </td>
                    <td><span style={{ color: "var(--muted2)", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>{row.prob}</span></td>
                    <td>
                      <span className="feed-badge" style={{ background: "rgba(139,142,255,0.1)", color: "var(--indigo)" }}>
                        {row.track}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: row.win ? "var(--green)" : "var(--red)", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                        {row.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* PROFESSIONAL FOOTER */}
      <footer>
        <div className="footer-grid">
          <div className="footer-col">
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>
              Codeduel
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted2)", lineHeight: 1.6, maxWidth: "340px", margin: "0 0 14px" }}>
              We train students and developers through 1v1 dynamic software and ECE duels. Real production codebases, zero textbook puzzle memorization.
            </p>
            <div style={{ fontSize: "12px", color: "var(--muted2)", fontFamily: "'JetBrains Mono', monospace" }}>
              📍 Global Engineering Network · Remote &amp; Universities Everywhere
            </div>
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><Link href="/practice">Solo Practice Arena</Link></li>
              <li><Link href="/campus">Campus &amp; Lab Mode</Link></li>
              <li><Link href="/leaderboard">Global Leaderboard</Link></li>
              <li><Link href="/pricing">Pricing &amp; Plans</Link></li>
              <li><Link href="/admin/metrics">Platform Metrics</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Curriculum</h4>
            <ul>
              <li><Link href="/practice">Embedded Systems (C)</Link></li>
              <li><Link href="/practice">Cloud Systems (TS/Py)</Link></li>
              <li><Link href="/practice">Simulated Hardware</Link></li>
              <li><Link href="/campus">NQT &amp; Placement Prep</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Company &amp; Legal</h4>
            <ul>
              <li><Link href="/about">About Codeduel</Link></li>
              <li><Link href="/privacy">Privacy Policy (DPDP)</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
              <li><Link href="/contact">Contact &amp; Partnerships</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © 2026 Codeduel Inc. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <Link href="/privacy" style={{ color: "var(--muted2)", textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "var(--muted2)", textDecoration: "none" }}>Terms</Link>
            <Link href="/about" style={{ color: "var(--muted2)", textDecoration: "none" }}>About</Link>
            <Link href="/contact" style={{ color: "var(--muted2)", textDecoration: "none" }}>Contact</Link>
          </div>
        </div>
      </footer>

      <RoleSwitcherModal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        currentRole={selectedRole}
        actionLabel="Sign In"
        onRoleChanged={(r) => handleSignInWithRole(r)}
      />
    </>
  );
}
