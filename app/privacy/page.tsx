"use client";

import Link from "next/link";

export default function PrivacyPolicyPage() {
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
          <Link href="/terms" style={{ color: "#8a8898", textDecoration: "none" }}>Terms</Link>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 24px 100px", lineHeight: "1.7", fontSize: "14.5px", color: "#c2c0d0" }}>
        <div style={{ marginBottom: "36px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#8b8eff", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            Legal &amp; Compliance · DPDP Act 2023 &amp; GDPR
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 800, color: "#fff", margin: "10px 0 8px", letterSpacing: "-0.03em" }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: "13px", color: "#6e6d7a", margin: 0 }}>
            Effective Date: October 13, 2026 · Last Updated: October 2026
          </p>
        </div>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>1. Introduction &amp; Commitment</h2>
          <p>
            CodeDuel (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the Platform&rdquo;) is committed to protecting the privacy of our users, students, educators, and institutional partners. 
            This Privacy Policy sets out how we collect, process, store, and safeguard your data when you access CodeDuel, in accordance with the <strong>Digital Personal Data Protection (DPDP) Act, 2023 (India)</strong>, the <strong>General Data Protection Regulation (GDPR)</strong>, and applicable international data privacy standards.
          </p>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>2. Data We Collect</h2>
          <p>We believe in strict data minimization. We only collect information strictly required to run real-time competitive engineering duels:</p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li><strong>Authentication Data:</strong> When signing in via GitHub OAuth, we receive your public GitHub username, avatar URL, user ID, and verified email address. We never request or store your GitHub private repositories, passwords, or personal access tokens.</li>
            <li><strong>Duel &amp; Practice Telemetry:</strong> Code patches submitted during duels, compiler logs, assertion test pass/fail results, match duration, hints consumed, and Elo rating updates.</li>
            <li><strong>Campus &amp; Academic Data:</strong> If enrolled in a university cohort, course code, lab submission timestamps, and assignment completion scores visible to your course instructor.</li>
            <li><strong>Technical Diagnostics:</strong> Anonymized client error telemetry, browser type, and API latency measurements to maintain sandbox availability.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>3. Ephemeral Code Execution &amp; Sandbox Safety</h2>
          <p>
            When you run code against our challenge harnesses, your code is transmitted over encrypted TLS 1.3 to isolated, ephemeral Linux containers (via our sandboxed execution engine).
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li>Containers execute with strictly restricted memory, zero network access, and a 10-second hard execution timeout.</li>
            <li>Once test assertions complete, the container filesystem is instantly destroyed. We do not index student code into public training datasets.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>4. Socratic AI Hints &amp; Model Privacy</h2>
          <p>
            Our Socratic hint engine utilizes Google Gemini models solely to provide progressive debugging clues. 
            Requests sent to the hint API are stateless: prompt payloads contain only the challenge description, active file context, and your current patch snippet. 
            Neither your personal identity nor persistent student records are shared with third-party model providers, and prompt data is never retained for model re-training.
          </p>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>5. Data Storage &amp; Encryption</h2>
          <p>
            User records and match state are persisted on managed PostgreSQL database instances (Neon Serverless PostgreSQL / AWS DynamoDB). 
            All data is encrypted in transit using TLS 1.3 and encrypted at rest using industry-standard AES-256 encryption.
          </p>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>6. Your Rights under the DPDP Act &amp; GDPR</h2>
          <p>As a data principal, you have the following legal rights:</p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li><strong>Right to Access &amp; Summary:</strong> Request an export of your account profile, match history, and lab records.</li>
            <li><strong>Right to Correction &amp; Erasure:</strong> Request the deletion of your account and purge of your personal data from active stores.</li>
            <li><strong>Right to Grievance Redressal:</strong> Direct questions, concerns, or deletion requests to our designated Grievance Officer.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "24px 0 12px" }}>7. Grievance Officer &amp; Contact</h2>
          <p>
            Pursuant to the Information Technology Act, 2000 and the DPDP Act, 2023, the designated Grievance Officer for CodeDuel is:
          </p>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "16px 20px", marginTop: "12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>
            <p style={{ margin: "0 0 6px", color: "#fff", fontWeight: 600 }}>Grievance Officer, CodeDuel</p>
            <p style={{ margin: "0 0 4px", color: "#8a8898" }}>Punjab Engineering College (PEC), Sector 12</p>
            <p style={{ margin: "0 0 4px", color: "#8a8898" }}>Chandigarh 160012, India</p>
            <p style={{ margin: 0, color: "#8b8eff" }}>Email: privacy@codeduel.com / team@codeduel.com</p>
          </div>
        </section>

        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <Link href="/terms" style={{ color: "#8b8eff", textDecoration: "none" }}>Read Terms of Service →</Link>
          <Link href="/" style={{ color: "#8a8898", textDecoration: "none" }}>Back to CodeDuel Home</Link>
        </div>
      </main>
    </div>
  );
}
