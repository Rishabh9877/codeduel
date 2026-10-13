"use client";

import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: "campus_pilot",
    institution: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

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
          <Link href="/about" style={{ color: "#8a8898", textDecoration: "none" }}>About</Link>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 24px 100px" }}>
        <div style={{ marginBottom: "36px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#8b8eff", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            Get In Touch
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 800, color: "#fff", margin: "10px 0 8px", letterSpacing: "-0.03em" }}>
            Contact CodeDuel
          </h1>
          <p style={{ fontSize: "15px", color: "#8a8898", margin: 0, lineHeight: 1.5 }}>
            Whether you want to deploy Campus Mode in your university lab, report an engineering incident, or explore placement partnerships, our team is here to assist.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "36px", alignItems: "start" }}>
          {/* CONTACT FORM */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "28px" }}>
            {submitted ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>📬</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>Message Received</h3>
                <p style={{ fontSize: "13px", color: "#8a8898", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Thank you for reaching out. A member of the CodeDuel engineering and campus team will respond within 24 hours.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", category: "campus_pilot", institution: "", message: "" }); }}
                  style={{
                    background: "rgba(139,142,255,0.15)",
                    border: "1px solid rgba(139,142,255,0.3)",
                    color: "#8b8eff",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#a09fb0", marginBottom: "6px", fontWeight: 500 }}>
                    YOUR FULL NAME
                  </label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Dr. Arun Kumar"
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      color: "#fff",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#a09fb0", marginBottom: "6px", fontWeight: 500 }}>
                    WORK / COLLEGE EMAIL
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@pec.edu.in"
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      color: "#fff",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#a09fb0", marginBottom: "6px", fontWeight: 500 }}>
                    INQUIRY CATEGORY
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={{
                      width: "100%",
                      background: "#0d0e14",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      color: "#fff",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  >
                    <option value="campus_pilot">University Lab Pilot (Campus Edition)</option>
                    <option value="placement_cell">Placement Cell / Corporate Assessments</option>
                    <option value="student_support">Student / Developer Support</option>
                    <option value="challenge_contribution">Submit a Production Incident Bug</option>
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#a09fb0", marginBottom: "6px", fontWeight: 500 }}>
                    INSTITUTION / COMPANY (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={form.institution}
                    onChange={(e) => setForm({ ...form, institution: e.target.value })}
                    placeholder="e.g. Punjab Engineering College"
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      color: "#fff",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#a09fb0", marginBottom: "6px", fontWeight: 500 }}>
                    MESSAGE
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us about your class size, target courses, or questions..."
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      color: "#fff",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    background: "#8b8eff",
                    color: "#050508",
                    fontWeight: 700,
                    fontSize: "13px",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    transition: "opacity 0.15s",
                  }}
                >
                  {loading ? "Sending Inquiry..." : "Submit Message →"}
                </button>
              </form>
            )}
          </div>

          {/* CONTACT INFO CARD */}
          <div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#8b8eff", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
                Campus Headquarters
              </div>
              <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>CodeDuel Lab</h4>
              <p style={{ fontSize: "13px", color: "#8a8898", lineHeight: 1.6, margin: 0 }}>
                Punjab Engineering College (PEC)<br />
                Sector 12, Chandigarh 160012<br />
                India
              </p>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "24px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
                Direct Channels
              </div>
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: "#6e6d7a", textTransform: "uppercase" }}>University Partnerships</div>
                <div style={{ fontSize: "13px", color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>campus@codeduel.com</div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: "#6e6d7a", textTransform: "uppercase" }}>General Inquiries</div>
                <div style={{ fontSize: "13px", color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>team@codeduel.com</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#6e6d7a", textTransform: "uppercase" }}>Legal &amp; Privacy</div>
                <div style={{ fontSize: "13px", color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>privacy@codeduel.com</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
