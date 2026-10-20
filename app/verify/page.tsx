"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";

export default function VerifyPortalPage() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/verify/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050508", color: "#f5f4f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Navigation */}
      <AppNavbar />

      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "80px 24px 100px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(139,142,255,0.1)", border: "1px solid rgba(139,142,255,0.25)", padding: "4px 14px", borderRadius: "100px", fontSize: "11px", color: "#8b8eff", fontFamily: "'JetBrains Mono', monospace", marginBottom: "24px" }}>
          <span>🛡️</span> Cryptographic Credential Registry
        </div>

        <h1 style={{ fontSize: "38px", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", marginBottom: "16px" }}>
          Verify Technical Credentials
        </h1>
        <p style={{ fontSize: "15px", color: "#8a8898", lineHeight: 1.6, marginBottom: "36px" }}>
          Validate verified debugging competency certificates, calibrated ELO ratings, and anti-cheat audit trails for candidates, graduates, and developers.
        </p>

        {/* Verification Form Card */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "32px", textAlign: "left", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
          <form onSubmit={handleVerify}>
            <label style={{ display: "block", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#8a8898", marginBottom: "10px", fontWeight: 600 }}>
              ENTER CREDENTIAL ID, VERIFICATION HASH, OR GITHUB USERNAME
            </label>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="e.g. CD-VERIFY-1A2B3C4D5E6F or octocat"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "240px",
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  color: "#fff",
                  fontSize: "14px",
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  background: "#8b8eff",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "13px",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                Verify Now →
              </button>
            </div>
          </form>

          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6e6d7a", flexWrap: "wrap", gap: "10px" }}>
            <span>🔒 SHA-256 Anti-Cheat Signature</span>
            <span>⚡ Real-Time Ledger Sync</span>
            <span>🛡️ Industry Verified Credentials</span>
          </div>
        </div>

        {/* Info Cards */}
        <div style={{ marginTop: "48px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", textAlign: "left" }}>
          <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "18px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>100% Tamper Proof</div>
            <p style={{ fontSize: "12px", color: "#8a8898", lineHeight: 1.5, margin: 0 }}>Every certificate hash is cryptographically bound to test harness results and duel timestamps.</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "18px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>Recruiter Trusted</div>
            <p style={{ fontSize: "12px", color: "#8a8898", lineHeight: 1.5, margin: 0 }}>Inspect whether candidate solved concurrency, memory safety, or circuit timing problems.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
