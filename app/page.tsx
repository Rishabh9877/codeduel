"use client";

import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
        section { padding: 72px 24px; max-width: 980px; margin: 0 auto; scroll-margin-top: 70px; }
        .eyebrow-sm {
          display: inline-block; font-size: 11px; font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 0.1em; color: var(--indigo);
          margin-bottom: 12px;
        }
        .section-title {
          font-size: clamp(26px, 4vw, 38px); font-weight: 700;
          letter-spacing: -0.035em; line-height: 1.15; margin-bottom: 16px;
        }
        .section-sub {
          font-size: 15px; color: var(--muted2); line-height: 1.7; max-width: 640px; margin-bottom: 40px;
        }
        .fade-divider {
          border: none; height: 1px;
          background: linear-gradient(90deg, transparent, var(--border2), transparent);
          max-width: 980px; margin: 0 auto;
        }

        /* ── THE PROBLEM ─────────────────────────────────── */
        .problem-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .problem-card {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: 10px; padding: 24px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .problem-card h3 { font-size: 16px; font-weight: 600; color: var(--text); }
        .problem-card p { font-size: 13.5px; color: var(--muted2); line-height: 1.6; }

        /* ── HOW IT WORKS ────────────────────────────────── */
        .steps-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }
        .step-card {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: 8px; padding: 20px 18px;
        }
        .step-num { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--indigo); margin-bottom: 8px; }
        .step-name { font-size: 14.5px; font-weight: 700; margin-bottom: 8px; }
        .step-desc { font-size: 12.5px; color: var(--muted2); line-height: 1.55; }

        /* ── TWO TRACKS ──────────────────────────────────── */
        .tracks-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }
        .track-card {
          background: var(--bg3); border: 1px solid var(--border);
          border-radius: 12px; padding: 28px; display: flex; flex-direction: column; gap: 16px;
          position: relative; overflow: hidden;
        }
        .track-badge {
          display: inline-block; font-size: 11px; font-family: 'JetBrains Mono', monospace;
          padding: 3px 10px; border-radius: 100px; width: fit-content;
        }
        .track-card h3 { font-size: 20px; font-weight: 700; }
        .track-card p { font-size: 13.5px; color: var(--muted2); line-height: 1.6; }
        .track-tags { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin-top: auto; }
        .track-tags li {
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          background: rgba(255,255,255,0.04); border: 1px solid var(--border);
          padding: 3px 8px; border-radius: 4px; color: var(--muted2);
        }

        /* ── FOR COLLEGES ────────────────────────────────── */
        .campus-box {
          background: linear-gradient(135deg, rgba(139,142,255,0.06) 0%, rgba(139,142,255,0.02) 100%);
          border: 1px solid rgba(139,142,255,0.2);
          border-radius: 14px; padding: 36px;
          display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: center;
        }
        @media (max-width: 768px) {
          .campus-box { grid-template-columns: 1fr; }
        }

        /* ── PRICING TEASER ──────────────────────────────── */
        .pricing-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px; margin-bottom: 24px;
        }
        .pricing-card {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: 10px; padding: 24px; display: flex; flex-direction: column;
        }
        .pricing-tier { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
        .pricing-price { font-size: 24px; font-weight: 800; font-family: 'JetBrains Mono', monospace; margin-bottom: 12px; }
        .pricing-desc { font-size: 13px; color: var(--muted2); line-height: 1.5; margin-bottom: 16px; }
        .pricing-features { list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; color: var(--muted2); margin-top: auto; }

        /* ── LIVE FEED TABLE ─────────────────────────────── */
        .feed-card {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: 10px; overflow: hidden;
        }
        .feed-hdr {
          padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid var(--border);
        }
        .feed-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .feed-table th {
          text-align: left; padding: 10px 16px; font-size: 11px;
          font-family: 'JetBrains Mono', monospace; color: var(--muted2);
          text-transform: uppercase; background: rgba(255,255,255,0.02);
        }
        .feed-table td { padding: 14px 16px; border-top: 1px solid var(--border); }
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
          <span>CodeDuel</span>
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
          <button className="btn-primary" onClick={() => signIn("github")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>
      </nav>

      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            Private Alpha · Season 1
          </div>
          <h1 className="hero-h1">
            Don't write it.<br />
            <span className="accent">Fix it.</span>
          </h1>
          <p className="hero-sub">
            We train students and developers through 1v1 dynamic software and ECE duels.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center", marginBottom: "40px" }}>
            <button className="btn-cta" onClick={() => signIn("github")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Sign in with GitHub
            </button>
            <Link href="/practice" className="btn-cta-ghost" style={{ fontWeight: 600 }}>
              Practice solo →
            </Link>
            <Link href="/campus" className="btn-cta-ghost" style={{ borderColor: "rgba(139,142,255,0.35)", color: "var(--indigo)" }}>
              For colleges →
            </Link>
          </div>

          {/* HERO DEMO MOCK: BUGGY EMBEDDED-C RING BUFFER DUEL */}
          <div className="arena-wrap">
            <div className="arena-card">
              <div className="arena-chrome">
                <div className="chrome-dots">
                  <div className="chrome-dot cd-r" />
                  <div className="chrome-dot cd-y" />
                  <div className="chrome-dot cd-g" />
                  <span className="demo-tag" style={{ marginLeft: "8px" }}>Demo</span>
                </div>
                <div className="chrome-tabs">
                  <span className="chrome-tab active">✏️ ring_buffer.c</span>
                  <span className="chrome-tab">🔒 ring_buffer.h</span>
                  <span className="chrome-tab">🔒 test_suite.c</span>
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

              {/* EDITOR BODY (C Embedded snippet with bug) */}
              <div className="editor-body">
                <div className="line-nums">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <div key={n}>{n}</div>)}
                </div>
                <div className="code-area">
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
                </div>
              </div>

              {/* TEST BADGES PANEL */}
              <div className="test-badges-panel">
                <div className="test-badge-row">
                  <span className="tb-pass">✓ TEST 1: Buffer Initialization & Normal Enqueue</span>
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
              </div>

              {/* OPPONENT PROGRESS BAR */}
              <div className="opponent-status-bar">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--muted2)" }}>Opponent:</span>
                  <span style={{ color: "var(--amber)", fontWeight: 600 }}>CodeSentinel AI (Bot)</span>
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
              <h3>The CodeDuel Standard</h3>
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

        {/* SECTION 3: TWO TRACKS */}
        <hr className="fade-divider" />
        <section id="tracks">
          <span className="eyebrow-sm reveal">Two Tracks</span>
          <h2 className="section-title reveal">Specialized arenas for modern engineering.</h2>
          <p className="section-sub reveal">
            Whether you are building bare-metal firmware or cloud microservices, CodeDuel tests the exact skills required on the job.
          </p>
          <div className="tracks-grid reveal-stagger">
            <div className="track-card">
              <span className="track-badge" style={{ background: "rgba(251,191,36,0.12)", color: "var(--amber)", border: "1px solid rgba(251,191,36,0.25)" }}>
                ECE & Hardware Track
              </span>
              <h3>Embedded Systems & Electronics (C)</h3>
              <p>
                Debug low-level microcontroller drivers, peripheral communication buses, memory-constrained buffers, and timing glitches before deploying to hardware.
              </p>
              <ul className="track-tags">
                <li>Circular Ring Buffers</li>
                <li>GPIO Debounce Interrupts</li>
                <li>SPI Multi-Byte Endianness</li>
                <li>PWM Timer Prescalers</li>
                <li>Bare-Metal Clang/GCC</li>
              </ul>
            </div>

            <div className="track-card">
              <span className="track-badge" style={{ background: "rgba(139,142,255,0.12)", color: "var(--indigo)", border: "1px solid rgba(139,142,255,0.25)" }}>
                Software Engineering Track
              </span>
              <h3>Cloud Software Engineering (TypeScript / Python)</h3>
              <p>
                Diagnose backend service outages, concurrency bottlenecks, connection pool resource leaks, and security exploits in modern application stacks.
              </p>
              <ul className="track-tags">
                <li>Token Bucket Rate Limiters</li>
                <li>Exponential Backoff Jitter</li>
                <li>JWT Algorithm Confusion</li>
                <li>PostgreSQL Pool Leaks</li>
                <li>Cache Stampede Mutexes</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 4: FOR COLLEGES */}
        <hr className="fade-divider" />
        <section id="campus">
          <div className="campus-box reveal">
            <div>
              <span className="eyebrow-sm">For Colleges & Faculty</span>
              <h2 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "12px" }}>
                Practical debugging labs for electronics and programming courses.
              </h2>
              <p style={{ fontSize: "14px", color: "var(--muted2)", lineHeight: 1.6, maxWidth: "560px", marginBottom: "16px" }}>
                Engineering universities use CodeDuel to turn passive programming and embedded labs into hands-on, high-stakes debugging sessions. Create classes, assign incident tickets, and review verified student progress.
              </p>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12.5px", color: "var(--text)" }}>
                <span>✓ Unguessable class join codes</span>
                <span>✓ Automated test-suite grading</span>
                <span>✓ Detailed student attempt logs</span>
              </div>
            </div>
            <div>
              <Link
                href="/campus"
                style={{
                  display: "inline-block",
                  background: "var(--indigo)",
                  color: "#050508",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "14px",
                  textDecoration: "none",
                  whiteSpace: "nowrap"
                }}
              >
                Explore Campus Mode →
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 4.5: PLACEMENT & IT RECRUITMENT READINESS */}
        <hr className="fade-divider" />
        <section id="placement">
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span className="eyebrow-sm reveal">Campus Placements & IT Recruitment</span>
            <h2 className="section-title reveal" style={{ maxWidth: "760px", margin: "0 auto 10px" }}>
              Trained for Tier-1 Product Engineering &amp; Service-Based IT Assessments.
            </h2>
            <p className="section-sub reveal" style={{ maxWidth: "680px", margin: "0 auto" }}>
              Whether students are targeting core hardware giants and cloud systems, or preparing for high-volume IT services technical assessments (TCS NQT, Infosys, Cognizant, Wipro, Accenture), CodeDuel trains them to isolate edge cases and pass time-pressured coding tests.
            </p>
          </div>
          <div className="tracks-grid reveal-stagger">
            <div className="track-card" style={{ borderColor: "rgba(56,189,248,0.25)" }}>
              <span className="track-badge" style={{ background: "rgba(56,189,248,0.12)", color: "var(--cyan)", border: "1px solid rgba(56,189,248,0.25)" }}>
                Tier-1 Product &amp; Hardware Tracks
              </span>
              <h3>Core Systems, Semiconductors &amp; Cloud</h3>
              <p>
                Qualcomm, Texas Instruments, Google, and high-growth startups test low-level memory layout, concurrency, and real-time RTOS drivers.
              </p>
              <ul className="track-tags">
                <li>ARM Cortex-M Hardware Faults</li>
                <li>UART / SPI Protocol Drivers</li>
                <li>Distributed Token Bucket Limits</li>
                <li>PostgreSQL Connection Pools</li>
              </ul>
            </div>

            <div className="track-card" style={{ borderColor: "rgba(139,142,255,0.25)" }}>
              <span className="track-badge" style={{ background: "rgba(139,142,255,0.12)", color: "var(--indigo)", border: "1px solid rgba(139,142,255,0.25)" }}>
                Service-Based IT &amp; NQT Assessment Track
              </span>
              <h3>Mass Recruiter Coding Rounds &amp; Enterprise Triage</h3>
              <p>
                TCS NQT, Cognizant GenC, Infosys HackWithInfy, and Accenture technical evaluations test edge-case isolation, boundary errors, and bug resolution under clock pressure.
              </p>
              <ul className="track-tags">
                <li>Boundary Condition &amp; Wrap-Around</li>
                <li>String &amp; Token Parsing Edge Cases</li>
                <li>Async Worker Starvation</li>
                <li>Automated Test Assertion Speed</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 5: PRICING TEASER */}
        <hr className="fade-divider" />
        <section id="pricing">
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span className="eyebrow-sm reveal">Pricing Teaser</span>
            <h2 className="section-title reveal" style={{ maxWidth: "600px", margin: "0 auto 10px" }}>
              Honest subscriptions for students and colleges.
            </h2>
            <p style={{ fontSize: "13px", color: "var(--muted2)" }}>
              Transparent tiers for individual developer mastery and scalable university departmental labs.
            </p>
          </div>
          <div className="pricing-grid reveal-stagger">
            <div className="pricing-card">
              <div className="pricing-tier">Free Tier</div>
              <div className="pricing-price">$0</div>
              <p className="pricing-desc">For students starting their practical debugging journey.</p>
              <ul className="pricing-features">
                <li>• Daily 1v1 ranked duels</li>
                <li>• Core challenge catalog access</li>
                <li>• Global ELO leaderboard</li>
                <li>• Basic Socratic AI coach hints</li>
              </ul>
            </div>
            <div className="pricing-card" style={{ borderColor: "rgba(139,142,255,0.3)", background: "rgba(139,142,255,0.03)" }}>
              <div className="pricing-tier" style={{ color: "var(--indigo)" }}>Pro Student</div>
              <div className="pricing-price">$12 <span style={{ fontSize: "13px", color: "var(--muted2)", fontWeight: 400 }}>/ mo</span></div>
              <p className="pricing-desc">For developers preparing for rigorous technical interviews and lab exams.</p>
              <ul className="pricing-features">
                <li>• Unlimited solo practice arena</li>
                <li>• Complete multi-file catalog</li>
                <li>• Deep post-match walkthroughs</li>
                <li>• Unlimited Socratic AI hints</li>
              </ul>
            </div>
            <div className="pricing-card">
              <div className="pricing-tier">Campus Department</div>
              <div className="pricing-price">Custom <span style={{ fontSize: "13px", color: "var(--muted2)", fontWeight: 400 }}>/ campus</span></div>
              <p className="pricing-desc">For engineering departments and university lab instructors.</p>
              <ul className="pricing-features">
                <li>• Class management & join codes</li>
                <li>• Timed lab assignments</li>
                <li>• Class performance dashboards</li>
                <li>• CSV student analytics exports</li>
              </ul>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <Link href="/pricing" className="btn-cta-ghost" style={{ display: "inline-flex" }}>
              View Complete Plans & Tier Details →
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
                  { p1: "RD", p2: "BOT", names: "Rishabh vs CodeSentinel AI (Bot)", prob: "PR #108: Token Bucket Rate Limiter", track: "Cloud SWE · TS", result: "Win +16 ELO", win: true },
                  { p1: "NP", p2: "AD", names: "Tanmay_J vs Ananya_S", prob: "Issue #44: UART Ring Buffer Telemetry", track: "Embedded · C", result: "Win +18 ELO", win: true },
                  { p1: "LK", p2: "SC", names: "Linus_KernelDev vs Silicon_Carmack", prob: "Issue #89: Cortex-M0 Unaligned HardFault", track: "Embedded · C", result: "Win +19 ELO", win: true },
                  { p1: "CA", p2: "TA", names: "CloudNative_Ace vs Tokio_AsyncMaster", prob: "PR #212: Exponential Retry Jitter", track: "Cloud SWE · TS", result: "Win +17 ELO", win: true },
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
              Code<span style={{ color: "var(--indigo)" }}>Duel</span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted2)", lineHeight: 1.6, maxWidth: "340px", margin: "0 0 14px" }}>
              We train students and developers through 1v1 dynamic software and ECE duels. Real production codebases, zero textbook puzzle memorization.
            </p>
            <div style={{ fontSize: "12px", color: "var(--muted2)", fontFamily: "'JetBrains Mono', monospace" }}>
              📍 Punjab Engineering College (PEC), Chandigarh
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
              <li><Link href="/about">About CodeDuel</Link></li>
              <li><Link href="/privacy">Privacy Policy (DPDP)</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
              <li><Link href="/contact">Contact &amp; Partnerships</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © 2026 CodeDuel Inc. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <Link href="/privacy" style={{ color: "var(--muted2)", textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "var(--muted2)", textDecoration: "none" }}>Terms</Link>
            <Link href="/about" style={{ color: "var(--muted2)", textDecoration: "none" }}>About</Link>
            <Link href="/contact" style={{ color: "var(--muted2)", textDecoration: "none" }}>Contact</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
