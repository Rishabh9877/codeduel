"use client";

import Link from "next/link";

export default function TermsOfServicePage() {
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
          <Link href="/privacy" style={{ color: "#8a8898", textDecoration: "none" }}>Privacy</Link>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 24px 100px", lineHeight: "1.7", fontSize: "14.5px", color: "#c2c0d0" }}>
        <div style={{ marginBottom: "36px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#8b8eff", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            Legal &amp; User Agreement
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 800, color: "#fff", margin: "10px 0 8px", letterSpacing: "-0.03em" }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: "13px", color: "#6e6d7a", margin: 0 }}>
            Effective Date: October 13, 2026 · Last Updated: October 2026
          </p>
        </div>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>1. Acceptance of Terms</h2>
          <p>
            By creating an account, authenticating via GitHub, joining a match, or utilizing CodeDuel (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service. 
            If you represent an academic institution, university department, or bootcamp using Campus Mode, you confirm that you have the authority to bind your organization to these terms.
          </p>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>2. Fair Play &amp; Anti-Cheat Standards</h2>
          <p>
            CodeDuel is a competitive engineering battleground designed to evaluate authentic problem-solving and diagnostic speed. To preserve competitive integrity:
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li><strong>No Automated Bots or Macros:</strong> You may not use automated browser scripts, headful bots, or external programmatic solvers to play ranked 1v1 duels.</li>
            <li><strong>No Sandbox Exploitation:</strong> You may not attempt to escape the Piston execution sandbox, execute fork bombs, consume excessive memory, or perform denial-of-service attacks on compiler containers.</li>
            <li><strong>Fair Rating Integrity:</strong> Match throwing, intentional rating deflation (smurfing), or collusion between dual accounts to manipulate the Elo leaderboard will result in immediate rating resets or account bans.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>3. Code Submissions &amp; Intellectual Property</h2>
          <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li><strong>Your Code:</strong> You retain ownership of all original code patches and solutions you write during matches or practice sessions.</li>
            <li><strong>Platform Intellectual Property:</strong> CodeDuel and its licensors retain all rights, title, and interest in and to the challenge incident tickets, test harness runners, multi-file simulated repositories, simulated hardware visualizers (oscilloscopes, logic analyzers), and platform branding.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>4. Academic &amp; University Campus Mode</h2>
          <p>
            When instructors create cohorts or assign labs via CodeDuel Campus Mode:
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li>Instructors may create custom cohorts with 6-character join codes and assign challenges for course credit or lab evaluations.</li>
            <li>Student submission timestamps, test completion counts, and pass rates are shared with enrolled instructors for grading purposes.</li>
            <li>Commercial redistribution or scraping of CodeDuel challenge test suites outside authorized educational licenses is prohibited.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>5. Sandboxed Execution &amp; Resource Quotas</h2>
          <p>
            To ensure fair resource sharing, code submissions are subject to execution constraints (10-second timeout, memory bounds). 
            CodeDuel reserves the right to terminate long-running or resource-intensive executions. We do not guarantee uninterrupted uptime during scheduled infrastructure maintenance.
          </p>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>6. Governing Law &amp; Jurisdiction</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or related to these Terms shall be subject to the exclusive jurisdiction of the competent courts in <strong>Chandigarh, India</strong>.
          </p>
        </section>

        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <Link href="/privacy" style={{ color: "#8b8eff", textDecoration: "none" }}>Read Privacy Policy →</Link>
          <Link href="/" style={{ color: "#8a8898", textDecoration: "none" }}>Back to CodeDuel Home</Link>
        </div>
      </main>
    </div>
  );
}
