"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050508", color: "#f5f4f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* NAVIGATION */}
      <nav
        style={{
          height: "56px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "#fff", fontWeight: 800, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          Code<span style={{ color: "#8b8eff" }}>Duel</span>
        </Link>
        <div style={{ display: "flex", gap: "20px", fontSize: "13px" }}>
          <Link href="/practice" style={{ color: "#8a8898", textDecoration: "none" }}>Practice</Link>
          <Link href="/campus" style={{ color: "#8a8898", textDecoration: "none" }}>Campus</Link>
          <Link href="/pricing" style={{ color: "#8a8898", textDecoration: "none" }}>Pricing</Link>
          <Link href="/contact" style={{ color: "#8a8898", textDecoration: "none" }}>Contact</Link>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: "840px", margin: "0 auto", padding: "60px 24px 100px", lineHeight: "1.7", fontSize: "15px", color: "#c2c0d0" }}>
        <div style={{ marginBottom: "36px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#8b8eff", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            The CodeDuel Story · PEC Chandigarh
          </span>
          <h1 style={{ fontSize: "40px", fontWeight: 800, color: "#fff", margin: "10px 0 12px", letterSpacing: "-0.03em" }}>
            Built by engineers who were tired of inverting binary trees.
          </h1>
          <p style={{ fontSize: "17px", color: "#9593a8", margin: 0, lineHeight: 1.6 }}>
            CodeDuel was founded to bridge the massive chasm between academic algorithm memorization and real-world production engineering.
          </p>
        </div>

        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>The Reality of Modern Engineering</h2>
          <p>
            According to research from the <strong>Cambridge Judge Business School</strong> and national technical employability studies, 
            over <strong>50% of an engineer's time is spent debugging existing systems</strong>—yet fewer than <strong>5% of software and electronics graduates</strong> can debug effectively when they enter industry.
          </p>
          <p>
            Why? Because every traditional coding platform trains students to memorize textbook algorithms from a completely empty scratchpad. In the real world, you are never handed a blank file and asked to write a quicksort algorithm. 
            You are dropped into a 50,000-line modular repository with an urgent customer bug ticket, a failing integration test, and 15 minutes before production telemetry drops offline.
          </p>
        </section>

        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>The Hardware &amp; ECE Blindspot</h2>
          <p>
            While computer science students had platforms to practice on, <strong>Electrical &amp; Computer Engineering (ECE)</strong> and embedded firmware developers were completely left behind.
          </p>
          <p>
            Low-level engineers working on automotive CAN buses, medical devices, aerospace flight controllers, and consumer robotics deal with race conditions between high-speed ISRs, volatile memory synchronization, timer prescaler math, and pointer memory alignment. 
            CodeDuel is the first platform to bring competitive, real-time 1v1 duels with interactive simulated hardware panels (oscilloscopes, logic analyzers, and ARM registers) to firmware engineering.
          </p>
        </section>

        {/* ORIGIN & MISSION CARD */}
        <div style={{ background: "linear-gradient(135deg, rgba(139,142,255,0.08) 0%, rgba(56,189,248,0.04) 100%)", border: "1px solid rgba(139,142,255,0.25)", borderRadius: "14px", padding: "28px 32px", margin: "40px 0" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>
            Born at Punjab Engineering College (PEC)
          </h3>
          <p style={{ fontSize: "14px", color: "#a5a3b8", lineHeight: 1.6, margin: 0 }}>
            CodeDuel originated at <strong>Punjab Engineering College (PEC), Chandigarh</strong>, after seeing classmates freeze up during high-pressure placement interviews despite having strong fundamental knowledge. 
            Supported through the <strong>Wadhwani Foundation Venture Viability Program</strong>, CodeDuel is evolving into a comprehensive campus and enterprise technical battleground that transforms how colleges teach and assess real diagnostic ability.
          </p>
        </div>

        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>Our Core Principles</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "16px" }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#8b8eff", marginBottom: "6px" }}>1. Multi-File Triage</div>
              <p style={{ fontSize: "13px", color: "#8a8898", margin: 0, lineHeight: 1.5 }}>Read headers, trace dependencies, and fix bugs in authentic project files instead of toy functions.</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#38bdf8", marginBottom: "6px" }}>2. Socratic AI, Not Cheating</div>
              <p style={{ fontSize: "13px", color: "#8a8898", margin: 0, lineHeight: 1.5 }}>Our AI coach gives conceptual nudges and diagnostic questions—it never writes the answer for you.</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#4ade80", marginBottom: "6px" }}>3. Live Matchmaking &amp; ELO</div>
              <p style={{ fontSize: "13px", color: "#8a8898", margin: 0, lineHeight: 1.5 }}>Time pressure forces rapid pattern recognition, building the exact poise engineers need in high-stakes interviews.</p>
            </div>
          </div>
        </section>

        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <Link href="/campus" style={{ color: "#8b8eff", textDecoration: "none" }}>Explore Campus Mode →</Link>
          <Link href="/contact" style={{ color: "#8a8898", textDecoration: "none" }}>Contact Our Team →</Link>
        </div>
      </main>
    </div>
  );
}
