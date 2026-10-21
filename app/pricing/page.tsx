"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { PRICING_PLANS, PRICING_FAQS, PricingPlan, Currency } from "@/lib/pricing";
import AppNavbar from "@/components/AppNavbar";

export default function PricingPage() {
  const { data: session, status } = useSession();
  const [userTier, setUserTier] = useState<"FREE" | "PRO" | "CAMPUS" | null>(null);
  const [loadingTier, setLoadingTier] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [currency, setCurrency] = useState<Currency>("INR");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Pilot / Waitlist Modal
  const [showPilotModal, setShowPilotModal] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<PricingPlan | null>(null);
  const [pilotForm, setPilotForm] = useState({
    name: "",
    email: "",
    institution: "",
    role: "STUDENT",
  });
  const [pilotSubmitting, setPilotSubmitting] = useState(false);
  const [pilotSuccessMessage, setPilotSuccessMessage] = useState<string | null>(null);

  // Toast
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  // ROI Calculator states
  const [calcStudents, setCalcStudents] = useState<number>(120);
  const [calcLabs, setCalcLabs] = useState<number>(14);

  // Calculations
  const gradingHoursSaved = Math.round((calcStudents * calcLabs * 12) / 60); // 12 mins per student lab report
  const hardwareLabCostSaved = calcStudents * 12000; // Average ₹12,000 per bench DSO/microcontroller kit
  const costPerStudentINR = Math.round(40000 / calcStudents);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoadingTier(true);
    fetch("/api/user/subscription")
      .then((r) => r.json())
      .then((d) => {
        if (d.tier) setUserTier(d.tier);
      })
      .catch((err) => console.warn("Failed to load subscription tier:", err))
      .finally(() => setLoadingTier(false));
  }, [status]);

  const handlePlanClick = async (plan: PricingPlan) => {
    if (plan.id === "FREE") {
      if (userTier === "PRO") {
        if (confirm("Are you sure you want to switch from Pro back to the Free Student tier?")) {
          setIsUpgrading(true);
          try {
            const res = await fetch("/api/user/subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tier: "FREE" }),
            });
            const data = await res.json();
            if (res.ok) {
              setUserTier("FREE");
              setCheckoutNotice("Plan switched back to Free Student.");
            } else {
              alert(data.error || "Failed to update plan");
            }
          } catch {
            alert("Network error updating plan");
          } finally {
            setIsUpgrading(false);
          }
        }
        return;
      }
      window.location.href = "/practice";
      return;
    }

    if (plan.id === "PRO") {
      if (status !== "authenticated") {
        signIn("github");
        return;
      }
      if (userTier === "PRO") {
        setCheckoutNotice("You already have an active Pro Engineer plan!");
        return;
      }

      setIsUpgrading(true);
      try {
        const res = await fetch("/api/user/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: "PRO" }),
        });
        const data = await res.json();
        if (res.ok) {
          setUserTier("PRO");
          setCheckoutNotice("🎉 Upgraded to Pro Engineer! All advanced hardware simulation & 3-tier AI hints are active.");
        } else {
          alert(data.error || "Failed to upgrade to Pro");
        }
      } catch {
        alert("Network error upgrading to Pro");
      } finally {
        setIsUpgrading(false);
      }
      return;
    }

    if (plan.id === "CAMPUS") {
      setSelectedPlanForModal(plan);
      setShowPilotModal(true);
    }
  };

  const handlePilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pilotForm.email) return;
    setPilotSubmitting(true);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pilotForm.name,
          email: pilotForm.email,
          institution: pilotForm.institution,
          role: pilotForm.role,
          tier: selectedPlanForModal?.id || "PRO",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPilotSuccessMessage(data.message || "Pilot unlocked successfully!");
        setCheckoutNotice("Pro / Faculty Pilot Sandbox Unlocked! You now have unrestricted access.");
        setTimeout(() => {
          setShowPilotModal(false);
          setPilotSuccessMessage(null);
        }, 2200);
      } else {
        alert(data.error || "Failed to register pilot request");
      }
    } catch (err) {
      console.error("Waitlist error:", err);
      alert("Network error submitting request");
    } finally {
      setPilotSubmitting(false);
    }
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
      <AppNavbar activePage="pricing" />

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
        <div style={{ textAlign: "center", marginBottom: 40 }}>
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
            FLEXIBLE PLANS · FOR DEVELOPERS &amp; INSTITUTIONS
          </div>

          <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, margin: "0 0 14px", color: "#fff", letterSpacing: -1 }}>
            Simple, Transparent Debugging Subscriptions.
          </h1>
          <p style={{ maxWidth: 680, margin: "0 auto 28px", color: "#8a8898", fontSize: 14, lineHeight: 1.6 }}>
            Free for all engineering students forever. Upgrade to Pro for deep closed-loop hardware simulation and recruiter credentialing, or license for your university engineering department.
          </p>

          {/* DUAL CURRENCY & BILLING SWITCHER */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, alignItems: "center" }}>
            {/* Currency Selector */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.04)",
                padding: 4,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <button
                onClick={() => setCurrency("INR")}
                style={{
                  background: currency === "INR" ? "#38bdf8" : "transparent",
                  color: currency === "INR" ? "#08090c" : "#8a8898",
                  border: "none",
                  padding: "7px 16px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                🇮🇳 INR (₹) — India Campus &amp; Student
              </button>
              <button
                onClick={() => setCurrency("USD")}
                style={{
                  background: currency === "USD" ? "#38bdf8" : "transparent",
                  color: currency === "USD" ? "#08090c" : "#8a8898",
                  border: "none",
                  padding: "7px 16px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                🌐 USD ($) — Global
              </button>
            </div>

            {/* Monthly / Annual Billing Toggle */}
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
                  padding: "7px 16px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                style={{
                  background: billingCycle === "annual" ? "#8b8eff" : "transparent",
                  color: billingCycle === "annual" ? "#08090c" : "#8a8898",
                  border: "none",
                  padding: "7px 16px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Annual (Save up to 25%)
              </button>
            </div>
          </div>
        </div>

        {/* ── PRICING CARDS ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
            marginBottom: 64,
          }}
        >
          {PRICING_PLANS.map((plan) => {
            const isINR = currency === "INR";
            const price = isINR
              ? (billingCycle === "annual" ? plan.annualPriceMonthlyINR : plan.monthlyPriceINR)
              : (billingCycle === "annual" ? plan.annualPriceMonthlyUSD : plan.monthlyPriceUSD);
            const periodText = isINR ? plan.periodTextINR : plan.periodTextUSD;
            const ctaText = isINR ? plan.ctaTextINR : plan.ctaTextUSD;

            return (
              <div
                key={plan.id}
                style={{
                  background: plan.highlighted
                    ? "linear-gradient(180deg, #121320 0%, #0d0e17 100%)"
                    : "#0c0d14",
                  border: plan.highlighted
                    ? "1px solid rgba(139,142,255,0.4)"
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: plan.highlighted
                    ? "0 0 35px rgba(139,142,255,0.12)"
                    : "none",
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: -11,
                      left: 28,
                      background: plan.id === "PRO" ? "#8b8eff" : "#38bdf8",
                      color: "#08090c",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 100,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
                    {plan.name}
                  </h3>
                  <p style={{ fontSize: 13, color: "#8a8898", lineHeight: 1.5, margin: 0, minHeight: 40 }}>
                    {plan.description}
                  </p>
                </div>

                {/* Price Display */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 18, color: "#8b8eff", fontWeight: 700 }}>
                      {isINR ? "₹" : "$"}
                    </span>
                    <span style={{ fontSize: 38, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>
                      {price.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 13, color: "#8a8898" }}>
                      {plan.id === "CAMPUS" ? "/ term" : "/ month"}
                    </span>
                  </div>
                  {periodText && (
                    <div style={{ fontSize: 11, color: "#6e6d7a", marginTop: 4 }}>
                      {periodText}
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                {(() => {
                  const isCurrent = userTier === plan.id;
                  let btnText = ctaText;
                  let btnStyle: React.CSSProperties = {
                    background: plan.highlighted ? "#8b8eff" : "rgba(255,255,255,0.06)",
                    color: plan.highlighted ? "#08090c" : "#fff",
                    border: plan.highlighted ? "none" : "1px solid rgba(255,255,255,0.12)",
                    padding: "12px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    marginBottom: 28,
                    fontFamily: "inherit",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  };

                  if (isUpgrading) {
                    btnText = "Updating...";
                  } else if (isCurrent) {
                    btnText = plan.id === "PRO" ? "👑 Current Plan (Active)" : plan.id === "CAMPUS" ? "🏛️ Active Campus Seat" : "✓ Current Plan";
                    btnStyle.background = plan.id === "PRO" ? "rgba(139,142,255,0.2)" : "rgba(255,255,255,0.05)";
                    btnStyle.color = plan.id === "PRO" ? "#8b8eff" : "#8a8898";
                    btnStyle.border = plan.id === "PRO" ? "1px solid rgba(139,142,255,0.4)" : "1px solid rgba(255,255,255,0.08)";
                  } else if (plan.id === "FREE" && userTier === "PRO") {
                    btnText = "Switch to Free";
                  } else if (plan.id === "PRO") {
                    btnText = isINR ? "⚡ Upgrade to Pro (₹100/mo)" : "⚡ Upgrade to Pro ($19/mo)";
                  }

                  return (
                    <button
                      onClick={() => handlePlanClick(plan)}
                      disabled={isUpgrading || (isCurrent && plan.id !== "PRO")}
                      style={btnStyle}
                    >
                      {btnText}
                    </button>
                  );
                })()}

                {/* Features List */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6e6d7a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                    What's Included:
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {plan.features.map((feat, idx) => (
                      <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, color: "#c8c6d4", lineHeight: 1.4 }}>
                        <span style={{ color: plan.highlighted ? "#4ade80" : "#8b8eff", flexShrink: 0, fontWeight: 800 }}>✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── B2B CAMPUS ROI & FACULTY TIME CALCULATOR ────────────────────── */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(139,142,255,0.06) 0%, rgba(56,189,248,0.04) 100%)",
            border: "1px solid rgba(139,142,255,0.25)",
            borderRadius: 16,
            padding: "36px 32px",
            marginBottom: 64,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🧮</span>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: 1 }}>
              FOR UNIVERSITY EVALUATORS &amp; DEPARTMENT CHAIRS
            </div>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
            Campus Department ROI &amp; Time-Savings Calculator
          </h2>
          <p style={{ color: "#8a8898", fontSize: 14, margin: "0 0 28px", maxWidth: 700, lineHeight: 1.5 }}>
            See how adopting Codeduel Campus for engineering lab cohorts (e.g., ECE Embedded Firmware or CS Systems) eliminates manual faculty grading and replaces expensive laboratory equipment kits.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32, alignItems: "center" }}>
            {/* Sliders */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Enrolled Lab Students:</span>
                  <span style={{ color: "#8b8eff", fontFamily: "JetBrains Mono" }}>{calcStudents} Students</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="500"
                  step="10"
                  value={calcStudents}
                  onChange={(e) => setCalcStudents(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#8b8eff", cursor: "pointer" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Lab Assignments Per Semester:</span>
                  <span style={{ color: "#38bdf8", fontFamily: "JetBrains Mono" }}>{calcLabs} Labs</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="24"
                  step="1"
                  value={calcLabs}
                  onChange={(e) => setCalcLabs(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer" }}
                />
              </div>

              <div style={{ fontSize: 12, color: "#6e6d7a", lineHeight: 1.5 }}>
                *Based on validated 9-tester pilot telemetry: 12 minutes saved per manual student submission grading + automated zero-cheat sandbox compilation.
              </div>
            </div>

            {/* Stat Highlights */}
            <div
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 24,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#4ade80" }}>
                  {gradingHoursSaved} hrs
                </div>
                <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", marginTop: 4 }}>
                  Faculty Grading Saved
                </div>
              </div>

              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24" }}>
                  ₹{costPerStudentINR}
                </div>
                <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", marginTop: 4 }}>
                  Cost Per Student / Sem
                </div>
              </div>

              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#38bdf8" }}>
                  ₹{(hardwareLabCostSaved / 100000).toFixed(1)} Lakhs
                </div>
                <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", marginTop: 4 }}>
                  Hardware Bench Value Replaced
                </div>
              </div>

              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#8b8eff" }}>
                  100%
                </div>
                <div style={{ fontSize: 11, color: "#8a8898", textTransform: "uppercase", marginTop: 4 }}>
                  Automated LMS Export (CSV)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FAQS ───────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 24, textAlign: "center" }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PRICING_FAQS.map((faq, idx) => (
              <div
                key={idx}
                style={{
                  background: "#0c0d14",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    background: "none",
                    border: "none",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontFamily: "inherit",
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ color: "#8b8eff", fontSize: 16 }}>{openFaq === idx ? "−" : "+"}</span>
                </button>
                {openFaq === idx && (
                  <div style={{ padding: "0 20px 16px", fontSize: 13, color: "#8a8898", lineHeight: 1.6 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── PILOT / WAITLIST ACTIVATION MODAL ──────────────────────────── */}
        {showPilotModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: 20,
            }}
          >
            <div
              style={{
                background: "#0d0e17",
                border: "1px solid rgba(139,142,255,0.35)",
                borderRadius: 16,
                padding: 32,
                maxWidth: 480,
                width: "100%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "JetBrains Mono",
                    color: "#8b8eff",
                    background: "rgba(139,142,255,0.1)",
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontWeight: 700,
                  }}
                >
                  PILOT SANDBOX ACTIVATION
                </span>
                <button
                  onClick={() => setShowPilotModal(false)}
                  style={{ background: "none", border: "none", color: "#8a8898", fontSize: 18, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
                Unlock {selectedPlanForModal?.name} Pilot
              </h2>
              <p style={{ color: "#8a8898", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
                During our public launch preview, payment processing is waived for early partners and engineering cohorts. Enter your email to activate immediate full pilot access today.
              </p>

              {pilotSuccessMessage ? (
                <div
                  style={{
                    background: "rgba(74,222,128,0.12)",
                    border: "1px solid rgba(74,222,128,0.3)",
                    borderRadius: 8,
                    padding: 16,
                    color: "#4ade80",
                    fontSize: 13,
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                >
                  ✓ {pilotSuccessMessage}
                </div>
              ) : (
                <form onSubmit={handlePilotSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#8a8898", display: "block", marginBottom: 6 }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vikram Malhotra"
                      value={pilotForm.name}
                      onChange={(e) => setPilotForm({ ...pilotForm, name: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#08090c",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 13,
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: "#8a8898", display: "block", marginBottom: 6 }}>
                      Institutional Email (College / Organization) *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. prof.smith@university.edu"
                      value={pilotForm.email}
                      onChange={(e) => setPilotForm({ ...pilotForm, email: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#08090c",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 13,
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: "#8a8898", display: "block", marginBottom: 6 }}>
                      College / University
                    </label>
                    <input
                      type="text"
                      value={pilotForm.institution}
                      onChange={(e) => setPilotForm({ ...pilotForm, institution: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#08090c",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 13,
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: "#8a8898", display: "block", marginBottom: 6 }}>
                      Your Role
                    </label>
                    <select
                      value={pilotForm.role}
                      onChange={(e) => setPilotForm({ ...pilotForm, role: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#08090c",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 13,
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="STUDENT">Engineering Student</option>
                      <option value="FACULTY">Faculty / Course Instructor</option>
                      <option value="TA">Teaching Assistant (TA)</option>
                      <option value="RECRUITER">Engineering Recruiter / Hiring Lead</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={pilotSubmitting}
                    style={{
                      marginTop: 8,
                      background: "#8b8eff",
                      color: "#08090c",
                      border: "none",
                      padding: "12px 20px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: pilotSubmitting ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {pilotSubmitting ? "Activating..." : "Unlock Pilot Sandbox Now ⚡"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
