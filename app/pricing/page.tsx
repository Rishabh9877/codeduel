"use client";

import Link from "next/link";
import { useState } from "react";
import { PRICING_PLANS, PRICING_FAQS, PricingPlan } from "@/lib/pricing";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Campus modal
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [campusSubmitted, setCampusSubmitted] = useState(false);
  const [campusForm, setCampusForm] = useState({
    name: "",
    email: "",
    institution: "",
    department: "Electrical & Computer Engineering (ECE)",
    studentsCount: "50-100",
  });

  // Pro checkout toast/feedback
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const handlePlanClick = (plan: PricingPlan) => {
    if (plan.id === "CAMPUS") {
      setShowCampusModal(true);
      return;
    }
    if (plan.id === "FREE") {
      window.location.href = "/practice";
      return;
    }
    if (plan.id === "PRO") {
      setCheckoutNotice("Demo Pro Subscription Activated! Your account now has unlimited duels and full 3-tier AI coach access.");
      setTimeout(() => setCheckoutNotice(null), 5000);
    }
  };

  const handleCampusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCampusSubmitted(true);
    setTimeout(() => {
      setShowCampusModal(false);
      setCampusSubmitted(false);
      setCampusForm({
        name: "",
        email: "",
        institution: "",
        department: "Electrical & Computer Engineering (ECE)",
        studentsCount: "50-100",
      });
    }, 2500);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090c",
        color: "#e8e6f0",
        fontFamily: "'JetBrains Mono', -apple-system, monospace",
      }}
    >
      {/* ── TOP NAV ──────────────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 60,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(8,9,12,0.9)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#fff",
              textDecoration: "none",
              letterSpacing: -0.5,
            }}
          >
            Code<span style={{ color: "#8b8eff" }}>Duel</span>
          </Link>
          <span style={{ fontSize: 11, color: "#6e6d7a" }}>PRICING &amp; LICENSING</span>
        </div>

        <div style={{ display: "flex", gap: 24, fontSize: 13, alignItems: "center" }}>
          <Link href="/practice" style={{ color: "#8a8898", textDecoration: "none" }}>
            Solo Arena
          </Link>
          <Link href="/dashboard" style={{ color: "#8a8898", textDecoration: "none" }}>
            1v1 Duels
          </Link>
          <Link href="/leaderboard" style={{ color: "#8a8898", textDecoration: "none" }}>
            Leaderboard
          </Link>
          <Link href="/campus" style={{ color: "#8a8898", textDecoration: "none" }}>
            Campus
          </Link>
          <Link href="/pricing" style={{ color: "#fff", fontWeight: 700, textDecoration: "none" }}>
            Pricing
          </Link>
        </div>

        <div>
          <Link
            href="/dashboard"
            style={{
              background: "#8b8eff",
              color: "#08090c",
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Launch Arena ⚡
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* CHECKOUT NOTICE TOAST */}
        {checkoutNotice && (
          <div
            style={{
              position: "fixed",
              top: 76,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(74,222,128,0.15)",
              border: "1px solid rgba(74,222,128,0.4)",
              color: "#4ade80",
              padding: "12px 24px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              zIndex: 100,
              backdropFilter: "blur(10px)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            ✓ {checkoutNotice}
          </div>
        )}

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 100,
              background: "rgba(139,142,255,0.1)",
              border: "1px solid rgba(139,142,255,0.25)",
              color: "#8b8eff",
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 16,
              letterSpacing: 0.5,
            }}
          >
            TRANSPARENT, STUDENT-FIRST TIERS
          </div>

          <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, margin: "0 0 14px", color: "#fff", letterSpacing: -1 }}>
            Build Verified Debugging Competency.
          </h1>
          <p style={{ maxWidth: 640, margin: "0 auto 28px", color: "#8a8898", fontSize: 14, lineHeight: 1.6 }}>
            Free for individual engineering students forever. Upgrade to Pro for deep hardware simulations and recruiter verification, or license CodeDuel for your university course.
          </p>

          {/* BILLING TOGGLE */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.04)",
              padding: 4,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <button
              onClick={() => setBillingCycle("monthly")}
              style={{
                background: billingCycle === "monthly" ? "rgba(255,255,255,0.1)" : "transparent",
                color: billingCycle === "monthly" ? "#fff" : "#8a8898",
                border: "none",
                padding: "8px 18px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              style={{
                background: billingCycle === "annual" ? "#8b8eff" : "transparent",
                color: billingCycle === "annual" ? "#08090c" : "#8a8898",
                border: "none",
                padding: "8px 18px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Annual Billing</span>
              <span
                style={{
                  background: billingCycle === "annual" ? "rgba(0,0,0,0.2)" : "rgba(74,222,128,0.2)",
                  color: billingCycle === "annual" ? "#08090c" : "#4ade80",
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                SAVE 25%
              </span>
            </button>
          </div>
        </div>

        {/* ── 3-TIER PRICING CARDS ────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 64 }}>
          {PRICING_PLANS.map((plan) => {
            const price = billingCycle === "annual" ? plan.annualPriceMonthly : plan.monthlyPrice;
            const isHighlight = plan.highlighted;

            return (
              <div
                key={plan.id}
                style={{
                  background: isHighlight
                    ? "linear-gradient(180deg, rgba(139,142,255,0.08) 0%, rgba(13,14,20,0.95) 100%)"
                    : "#0d0e14",
                  border: `1px solid ${isHighlight ? "rgba(139,142,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 16,
                  padding: "32px 26px",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: isHighlight ? "0 20px 40px rgba(139,142,255,0.08)" : "none",
                }}
              >
                {plan.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: 26,
                      background: isHighlight ? "linear-gradient(90deg, #8b8eff, #a78bfa)" : "#222530",
                      color: isHighlight ? "#08090c" : "#fff",
                      padding: "2px 10px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0.5,
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}>
                    {plan.name}
                  </h3>
                  <p style={{ fontSize: 12, color: "#8a8898", margin: 0, minHeight: 36, lineHeight: 1.5 }}>
                    {plan.description}
                  </p>
                </div>

                {/* PRICE ROW */}
                <div style={{ marginBottom: 24, display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>
                    ${price}
                  </span>
                  <span style={{ fontSize: 12, color: "#6e6d7a" }}>
                    / month {billingCycle === "annual" && plan.monthlyPrice > 0 ? "(billed annually)" : ""}
                  </span>
                </div>

                {/* CTA BUTTON */}
                <button
                  onClick={() => handlePlanClick(plan)}
                  style={{
                    background: isHighlight
                      ? "#8b8eff"
                      : "rgba(255,255,255,0.06)",
                    border: isHighlight
                      ? "none"
                      : "1px solid rgba(255,255,255,0.12)",
                    color: isHighlight ? "#08090c" : "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "12px 18px",
                    borderRadius: 8,
                    cursor: "pointer",
                    marginBottom: 28,
                    fontFamily: "inherit",
                    transition: "transform 0.15s",
                  }}
                >
                  {plan.ctaText}
                </button>

                {/* FEATURES LIST */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6e6d7a", textTransform: "uppercase", marginBottom: 12 }}>
                    INCLUDED FEATURES:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#c8c6d4", lineHeight: 1.4 }}>
                        <span style={{ color: isHighlight ? "#8b8eff" : "#4ade80", fontWeight: 700, flexShrink: 0 }}>✓</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── DETAILED COMPARISON TABLE ─────────────────────────────────── */}
        <div style={{ background: "#0d0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "32px 28px", marginBottom: 64 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 20px", color: "#fff" }}>
            Feature Matrix &amp; Technical Capabilities
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th style={{ padding: "12px 14px", color: "#6e6d7a", fontWeight: 600 }}>Capability</th>
                  <th style={{ padding: "12px 14px", color: "#8a8898" }}>Student Free</th>
                  <th style={{ padding: "12px 14px", color: "#8b8eff" }}>Pro Competitor</th>
                  <th style={{ padding: "12px 14px", color: "#fbbf24" }}>Campus License</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Daily 1v1 Ranked Duels", free: "5 per day", pro: "Unlimited", campus: "Unlimited" },
                  { name: "Incident Challenge Catalog", free: "All 12 problems", pro: "All 12 problems", campus: "Custom Labs + All 12" },
                  { name: "Socratic AI Coach Tiers", free: "Tier 1 (Nudge only)", pro: "Tiers 1, 2, 3", campus: "Tiers 1, 2, 3" },
                  { name: "Logic Analyzer Waveforms", free: "Basic Waveforms", pro: "Interactive Logic Waveforms", campus: "Full Hardware Suite" },
                  { name: "Live MMIO Register Inspector", free: "Read-only", pro: "Interactive Read/Write", campus: "Interactive Read/Write" },
                  { name: "ARM Cortex Alignment Fault Labs", free: "Standard", pro: "Advanced Alignment", campus: "Advanced Alignment" },
                  { name: "Recruiter Credential Audit Slug", free: "Standard Slug", pro: "Verified Pro Badge", campus: "Department Verified" },
                  { name: "Faculty Gradebook & Telemetry", free: "—", pro: "—", campus: "✓ Full Class Analytics" },
                  { name: "Private Course Join Codes", free: "—", pro: "—", campus: "✓ Unlimited Sections" },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 14px", color: "#e8e6f0", fontWeight: 500 }}>{row.name}</td>
                    <td style={{ padding: "12px 14px", color: "#8a8898" }}>{row.free}</td>
                    <td style={{ padding: "12px 14px", color: "#c4b5fd", fontWeight: 600 }}>{row.pro}</td>
                    <td style={{ padding: "12px 14px", color: "#fde68a", fontWeight: 600 }}>{row.campus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FAQ ACCORDION ──────────────────────────────────────────────── */}
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, textAlign: "center", margin: "0 0 28px", color: "#fff" }}>
            Frequently Asked Questions
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PRICING_FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  style={{
                    background: "#0d0e14",
                    border: `1px solid ${isOpen ? "rgba(139,142,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    style={{
                      width: "100%",
                      padding: "16px 20px",
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <span>{faq.q}</span>
                    <span style={{ color: "#8b8eff", fontSize: 18, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.15s" }}>
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "0 20px 18px", color: "#8a8898", fontSize: 13, lineHeight: 1.6 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PRICING FOOTER */}
        <div style={{ marginTop: 64, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, fontSize: 12, color: "#6e6d7a" }}>
          <div>
            CodeDuel Pricing &amp; Academic Licensing · Punjab Engineering College (PEC)
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/about" style={{ color: "#8a8898", textDecoration: "none" }}>About</Link>
            <Link href="/privacy" style={{ color: "#8a8898", textDecoration: "none" }}>Privacy (DPDP)</Link>
            <Link href="/terms" style={{ color: "#8a8898", textDecoration: "none" }}>Terms</Link>
            <Link href="/contact" style={{ color: "#8a8898", textDecoration: "none" }}>Contact</Link>
          </div>
        </div>
      </main>

      {/* ── CAMPUS PILOT INQUIRY MODAL ─────────────────────────────────────── */}
      {showCampusModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#0d0e14",
              border: "1px solid rgba(139,142,255,0.4)",
              borderRadius: 16,
              padding: 32,
              maxWidth: 480,
              width: "100%",
            }}
          >
            {campusSubmitted ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎓</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#fff" }}>
                  Pilot Request Received!
                </h3>
                <p style={{ fontSize: 13, color: "#8a8898", lineHeight: 1.5 }}>
                  Our academic partnership team will reach out with pilot course onboarding and student access codes for {campusForm.institution}.
                </p>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}>
                  Request Campus Department Pilot
                </h3>
                <p style={{ fontSize: 12, color: "#8a8898", margin: "0 0 20px", lineHeight: 1.5 }}>
                  Get automated incident grading and private course cohorts for your college faculty.
                </p>

                <form onSubmit={handleCampusSubmit}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                      YOUR NAME &amp; TITLE
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Prof. Vikram Malhotra"
                      value={campusForm.name}
                      onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        color: "#fff",
                        fontFamily: "inherit",
                        fontSize: 12,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                      INSTITUTIONAL / ACADEMIC EMAIL
                    </label>
                    <input
                      required
                      type="email"
                      placeholder="malhotra@pec.edu.in"
                      value={campusForm.email}
                      onChange={(e) => setCampusForm({ ...campusForm, email: e.target.value })}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        color: "#fff",
                        fontFamily: "inherit",
                        fontSize: 12,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                      COLLEGE / UNIVERSITY NAME
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Punjab Engineering College (PEC)"
                      value={campusForm.institution}
                      onChange={(e) => setCampusForm({ ...campusForm, institution: e.target.value })}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        color: "#fff",
                        fontFamily: "inherit",
                        fontSize: 12,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#6e6d7a", marginBottom: 6 }}>
                      TARGET DEPARTMENT
                    </label>
                    <select
                      value={campusForm.department}
                      onChange={(e) => setCampusForm({ ...campusForm, department: e.target.value })}
                      style={{
                        width: "100%",
                        background: "#161722",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        color: "#fff",
                        fontFamily: "inherit",
                        fontSize: 12,
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="Electrical & Computer Engineering (ECE)">Electrical &amp; Computer Engineering (ECE)</option>
                      <option value="Computer Science (CS)">Computer Science (CS)</option>
                      <option value="Embedded Systems & Robotics">Embedded Systems &amp; Robotics</option>
                      <option value="Systems Programming">Systems Programming</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowCampusModal(false)}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#8a8898",
                        padding: "10px",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        flex: 1,
                        background: "#8b8eff",
                        border: "none",
                        color: "#08090c",
                        fontWeight: 700,
                        padding: "10px",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Submit Inquiry
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
