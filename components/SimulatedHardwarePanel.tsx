"use client";

import React, { useState, useEffect, useRef } from "react";
import type { HardwareContext } from "@/lib/challenges";

export interface HardwarePanelProps {
  hardwareContext: HardwareContext;
  challengeId?: string;
  executionStatus?: "IDLE" | "RUNNING" | "FAILED" | "PASSED";
  testsPassed?: number;
  totalTests?: number;
  userCode?: string;
  hiddenTestsCount?: number;
}

export function SimulatedHardwarePanel({
  hardwareContext,
  challengeId = "embedded-ring-buffer",
  executionStatus = "IDLE",
  testsPassed = 0,
  totalTests = 3,
  userCode = "",
  hiddenTestsCount,
}: HardwarePanelProps) {
  const [activeTab, setActiveTab] = useState<"waveform" | "registers" | "memory">("waveform");

  // Bench Controls
  const [isFrozen, setIsFrozen] = useState(false);
  const [timebase, setTimebase] = useState<string>("500µs/div");
  const [voltDiv, setVoltDiv] = useState<string>("1V/div");
  const [injectedGlitch, setInjectedGlitch] = useState(false);
  const [triggerCount, setTriggerCount] = useState(148);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  const isSolved = executionStatus === "PASSED" || (testsPassed === totalTests && totalTests > 0);
  const isRunning = executionStatus === "RUNNING";

  // Timebase multipliers for waveform speed
  const getTimebaseSpeed = () => {
    switch (timebase) {
      case "50µs/div": return 0.18;
      case "100µs/div": return 0.12;
      case "500µs/div": return 0.06;
      case "1ms/div": return 0.03;
      case "5ms/div": return 0.01;
      default: return 0.06;
    }
  };

  // ── 60 FPS HTML5 CANVAS WAVEFORM GENERATOR ─────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      const width = canvas.width;
      const height = canvas.height;

      // Clear with dark oscilloscope phosphor background
      ctx.fillStyle = "#070b0e";
      ctx.fillRect(0, 0, width, height);

      // Draw Reticle Grid
      ctx.strokeStyle = "rgba(40, 75, 60, 0.35)";
      ctx.lineWidth = 1;

      // Vertical div lines (10 divisions)
      const vStep = width / 10;
      for (let x = 0; x <= width; x += vStep) {
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal div lines (8 divisions)
      const hStep = height / 8;
      for (let y = 0; y <= height; y += hStep) {
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Center crosshairs
      ctx.strokeStyle = "rgba(74, 222, 128, 0.25)";
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (!isFrozen) {
        phaseRef.current += getTimebaseSpeed();
      }
      const phase = phaseRef.current;

      // Draw Waveform based on Challenge Fault vs Solved State
      ctx.lineWidth = 2.5;

      if (isSolved) {
        // SOLVED STATE: Crisp, nominal green trace (zero jitter/bounce)
        ctx.strokeStyle = "#4ade80";
        ctx.shadowColor = "rgba(74, 222, 128, 0.6)";
        ctx.shadowBlur = 8;
        ctx.beginPath();

        for (let x = 0; x < width; x++) {
          const t = (x / width) * 4 * Math.PI + phase;
          // Clean square / smoothed PWM wave
          const y = height / 2 + Math.sin(t) * 42 * (Math.abs(Math.sin(t)) > 0.3 ? 1 : 0.4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // FAULT / UNRESOLVED STATE: Render specific anomaly
        ctx.strokeStyle = injectedGlitch ? "#f43f5e" : "#fbbf24";
        ctx.shadowColor = injectedGlitch ? "rgba(244, 63, 94, 0.7)" : "rgba(251, 191, 36, 0.5)";
        ctx.shadowBlur = 6;
        ctx.beginPath();

        for (let x = 0; x < width; x++) {
          const t = (x / width) * 4 * Math.PI + phase;
          let y = height / 2;

          if (challengeId === "embedded-gpio-debounce") {
            // High frequency contact bounce chatter in middle
            const isChatterZone = (x > width * 0.35 && x < width * 0.55);
            if (isChatterZone) {
              y += (Math.random() - 0.5) * 60; // 15ms chatter spikes
            } else {
              y += (x < width * 0.35 ? -38 : 38);
            }
          } else if (challengeId === "embedded-interrupt-race") {
            // Torn read / glitch discontinuity
            const isTornPoint = (Math.floor(x + phase * 20) % 180 < 8);
            y += Math.sin(t) * 35;
            if (isTornPoint || injectedGlitch) {
              y += (Math.random() - 0.5) * 80; // Torn glitch spike
            }
          } else if (challengeId === "embedded-pwm-prescaler") {
            // Half-frequency with excessive RC ripple
            const slowT = (x / width) * 2 * Math.PI + phase * 0.5;
            y += (Math.sin(slowT) > 0 ? 35 : -35) + Math.sin(x * 0.2) * 8;
          } else if (challengeId === "embedded-packed-alignment") {
            // Cortex-M0 HardFault flatline freeze
            const faultZone = x > width * 0.45;
            if (faultZone) {
              y += 45; // Locked low on fault
            } else {
              y += Math.sin(t * 2) * 30;
            }
          } else {
            // Default ring buffer / SPI noise trace
            const hasOverrun = x > width * 0.6;
            y += Math.sin(t) * 32 + (hasOverrun ? (Math.random() - 0.5) * 24 : 0);
          }

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Live Trigger Status overlay on canvas
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillStyle = isSolved ? "#4ade80" : (injectedGlitch ? "#f43f5e" : "#fbbf24");
      ctx.fillText(
        `TRIG: ${isSolved ? "AUTO (LOCKED)" : "NORMAL (FAULT)"} | ${timebase} | ${voltDiv}`,
        12,
        height - 12
      );

      // Running strobe
      if (isRunning) {
        const scanX = (Date.now() / 3) % width;
        ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scanX, 0);
        ctx.lineTo(scanX, height);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isSolved, isRunning, isFrozen, timebase, voltDiv, injectedGlitch, challengeId]);

  // Inject glitch timeout
  const handleInjectFault = () => {
    setInjectedGlitch(true);
    setTriggerCount((c) => c + 1);
    setTimeout(() => setInjectedGlitch(false), 800);
  };

  const handleSingleCapture = () => {
    setIsFrozen(true);
    setTriggerCount((c) => c + 1);
  };

  // ── HARDWARE REGISTER BITMASKS ──────────────────────────────────────────────
  const renderRegisters = () => {
    // Determine registers based on challenge and solved state
    let cfsr = isSolved ? "0x00000000" : (challengeId === "embedded-packed-alignment" ? "0x01000000" : "0x00000000"); // Bit 24 = UNALIGNED
    let hfsr = isSolved ? "0x00000000" : (challengeId === "embedded-packed-alignment" ? "0x40000000" : "0x00000000"); // Bit 30 = FORCED
    let mmfar = isSolved ? "0x00000000" : (challengeId === "embedded-packed-alignment" ? "0x20000103" : "0x00000000");
    let primask = isSolved ? "0x01" : (challengeId === "embedded-interrupt-race" ? "0x00" : "0x00"); // 0x00 = interrupts unmasked (vulnerable)

    return (
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#8b8eff", textTransform: "uppercase" }}>
            ARM Cortex-M MMIO System Control Block (SCB)
          </span>
          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono", color: isSolved ? "#4ade80" : "#f43f5e" }}>
            {isSolved ? "● STATUS: NOMINAL (0 FAULTS)" : "▲ STATUS: FAULT ACTIVE"}
          </span>
        </div>

        {/* CFSR Register Card */}
        <div style={{ background: "#06070a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>CFSR (Configurable Fault Status)</span>
            <span style={{ fontSize: 12, fontFamily: "JetBrains Mono", color: cfsr !== "0x00000000" ? "#f43f5e" : "#4ade80", fontWeight: 700 }}>
              {cfsr}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 10, fontFamily: "JetBrains Mono" }}>
            <div style={{ background: cfsr === "0x01000000" ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.03)", padding: 6, borderRadius: 4, color: cfsr === "0x01000000" ? "#f43f5e" : "#6e6d7a" }}>
              Bit 24: UNALIGNED {cfsr === "0x01000000" ? "▲ TRIP" : "0"}
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 6, borderRadius: 4, color: "#6e6d7a" }}>
              Bit 25: DIVBYZERO 0
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 6, borderRadius: 4, color: "#6e6d7a" }}>
              Bit 16: UNDEFINSTR 0
            </div>
          </div>
        </div>

        {/* HFSR & MMFAR */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#06070a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: "#8a8898", marginBottom: 4 }}>HFSR (HardFault Status)</div>
            <div style={{ fontSize: 13, fontFamily: "JetBrains Mono", fontWeight: 700, color: hfsr !== "0x00000000" ? "#f43f5e" : "#4ade80" }}>
              {hfsr}
            </div>
            <div style={{ fontSize: 10, color: "#6e6d7a", marginTop: 4 }}>
              Bit 30 (FORCED): {hfsr !== "0x00000000" ? "ESCALATED" : "CLEAR"}
            </div>
          </div>

          <div style={{ background: "#06070a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: "#8a8898", marginBottom: 4 }}>MMFAR (Fault Address)</div>
            <div style={{ fontSize: 13, fontFamily: "JetBrains Mono", fontWeight: 700, color: mmfar !== "0x00000000" ? "#f43f5e" : "#8a8898" }}>
              {mmfar}
            </div>
            <div style={{ fontSize: 10, color: "#6e6d7a", marginTop: 4 }}>
              Target: {mmfar !== "0x00000000" ? "ODD BYTE 0x20000103" : "0x00000000"}
            </div>
          </div>
        </div>

        {/* PRIMASK Interrupt Flag */}
        <div style={{ background: "#06070a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#8a8898" }}>PRIMASK (Interrupt Mask Register)</span>
            <span style={{ fontSize: 12, fontFamily: "JetBrains Mono", fontWeight: 700, color: isSolved ? "#4ade80" : (challengeId === "embedded-interrupt-race" ? "#f43f5e" : "#8b8eff") }}>
              {primask} ({isSolved ? "ATOMIC_SAFE" : (challengeId === "embedded-interrupt-race" ? "UNPROTECTED_RACE" : "NORMAL")})
            </span>
          </div>
          <p style={{ fontSize: 11, color: "#6e6d7a", margin: 0, lineHeight: 1.4 }}>
            {isSolved
              ? "Critical section wrapped in __get_PRIMASK() / __disable_irq() — safe against torn 64-bit reads."
              : "Interrupts remain enabled during 64-bit multi-word load. Hardware ISR interrupts mid-word."}
          </p>
        </div>
      </div>
    );
  };

  // ── LOGIC ANALYZER / 8-CHANNEL PULSE TRAIN ──────────────────────────────────
  const renderLogicAnalyzer = () => {
    const isFault = !isSolved;
    const canFaultHigh = isFault && challengeId === "embedded-packed-alignment";
    const irqPulsing = isFault && challengeId === "embedded-interrupt-race";

    return (
      <div style={{ padding: "14px 16px", background: "#050608", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5 }}>
            8-Channel Digital Logic Analyzer (40 MSPS)
          </span>
          <span style={{ fontSize: 10, color: "#6e6d7a", fontFamily: "JetBrains Mono" }}>
            Trig: Ch4 / Edge: Falling
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "JetBrains Mono", fontSize: 10 }}>
          {/* CH0: SCK */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 68, color: "#38bdf8", fontWeight: 700 }}>CH0: SCK</span>
            <div style={{ flex: 1, height: 16, background: "rgba(56,189,248,0.06)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
              <svg width="100%" height="16">
                <path d="M0,13 L20,13 L20,3 L40,3 L40,13 L60,13 L60,3 L80,3 L80,13 L100,13 L100,3 L120,3 L120,13 L140,13 L140,3 L160,3 L160,13 L180,13 L180,3 L200,3 L200,13 L220,13 L220,3 L240,3 L240,13 L260,13 L260,3 L280,3 L280,13 L300,13 L300,3 L320,3 L320,13 L340,13 L340,3 L360,3 L360,13 L380,13 L380,3 L400,3 L400,13" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* CH1: MOSI */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 68, color: "#c084fc", fontWeight: 700 }}>CH1: MOSI</span>
            <div style={{ flex: 1, height: 16, background: "rgba(192,132,252,0.06)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
              <svg width="100%" height="16">
                <path d="M0,13 L40,13 L40,3 L90,3 L90,13 L150,13 L150,3 L220,3 L220,13 L310,13 L310,3 L370,3 L370,13 L400,13" fill="none" stroke="#c084fc" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* CH4: EXT_INT0 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 68, color: irqPulsing ? "#f43f5e" : "#4ade80", fontWeight: 700 }}>CH4: INT0</span>
            <div style={{ flex: 1, height: 16, background: irqPulsing ? "rgba(244,63,94,0.15)" : "rgba(74,222,128,0.06)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
              <svg width="100%" height="16">
                {irqPulsing ? (
                  <path d="M0,13 L30,13 L30,3 L50,3 L50,13 L80,13 L80,3 L100,3 L100,13 L140,13 L140,3 L155,3 L155,13 L230,13 L230,3 L250,3 L250,13 L350,13 L350,3 L370,3 L370,13" fill="none" stroke="#f43f5e" strokeWidth="2" />
                ) : (
                  <path d="M0,13 L120,13 L120,3 L140,3 L140,13 L280,13 L280,3 L300,3 L300,13 L400,13" fill="none" stroke="#4ade80" strokeWidth="1.5" />
                )}
              </svg>
            </div>
          </div>

          {/* CH7: CAN_FAULT */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 68, color: canFaultHigh ? "#f43f5e" : "#6e6d7a", fontWeight: 700 }}>CH7: FAULT</span>
            <div style={{ flex: 1, height: 16, background: canFaultHigh ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.02)", borderRadius: 3, position: "relative" }}>
              <svg width="100%" height="16">
                <path
                  d={canFaultHigh ? "M0,13 L80,13 L80,3 L400,3" : "M0,13 L400,13"}
                  fill="none"
                  stroke={canFaultHigh ? "#f43f5e" : "#4a4860"}
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0a10", color: "#e8e6f0" }}>
      {/* ── CLOSED-LOOP STATUS HEADER ─────────────────────────────────────── */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#08080d" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>⚡ TARGET:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>
              {hardwareContext.mcu}
            </span>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "2px 6px", color: "#8a8898", fontFamily: "JetBrains Mono" }}>
              {hardwareContext.clockSpeed}
            </span>
            <span style={{ fontSize: 10, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 4, padding: "2px 6px", color: "#38bdf8", fontFamily: "JetBrains Mono" }}>
              {hardwareContext.busProtocol}
            </span>

            {/* LIVE CLOSED-LOOP EXECUTION BADGE */}
            {isSolved ? (
              <span style={{ fontSize: 10, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", padding: "2px 8px", borderRadius: 4, fontWeight: 800, fontFamily: "JetBrains Mono" }}>
                ✓ HARDWARE TELEMETRY VERIFIED — 0 FAULTS
              </span>
            ) : isRunning ? (
              <span style={{ fontSize: 10, background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.4)", color: "#38bdf8", padding: "2px 8px", borderRadius: 4, fontWeight: 800, fontFamily: "JetBrains Mono" }}>
                ⏳ SAMPLING PISTON SANDBOX...
              </span>
            ) : (
              <span style={{ fontSize: 10, background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", color: "#f43f5e", padding: "2px 8px", borderRadius: 4, fontWeight: 800, fontFamily: "JetBrains Mono" }}>
                ▲ FAULT ACTIVE ({testsPassed}/{totalTests} TESTS)
              </span>
            )}
          </div>
        </div>

        {/* Observed Failure Banner */}
        <div style={{ background: isSolved ? "rgba(74,222,128,0.06)" : "rgba(244,63,94,0.08)", border: `1px solid ${isSolved ? "rgba(74,222,128,0.25)" : "rgba(244,63,94,0.25)"}`, borderRadius: 6, padding: "7px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12 }}>{isSolved ? "✅" : "⚠️"}</span>
          <div style={{ fontSize: 11, color: isSolved ? "#bbf7d0" : "#fecdd3", lineHeight: 1.4 }}>
            {isSolved
              ? "All unit tests passed. MMIO fault registers cleared, clock domain stabilized at target frequency."
              : hardwareContext.observedFailure}
          </div>
        </div>
      </div>

      {/* ── BENCH CONTROLS TOOLBAR ────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "#0c0d16", borderBottom: "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setActiveTab("waveform")}
            style={{
              background: activeTab === "waveform" ? "#181a28" : "transparent",
              border: "none",
              borderBottom: activeTab === "waveform" ? "2px solid #fbbf24" : "2px solid transparent",
              color: activeTab === "waveform" ? "#fbbf24" : "#8a8898",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "JetBrains Mono",
            }}
          >
            📈 DSO &amp; Logic Analyzer
          </button>
          <button
            onClick={() => setActiveTab("registers")}
            style={{
              background: activeTab === "registers" ? "#181a28" : "transparent",
              border: "none",
              borderBottom: activeTab === "registers" ? "2px solid #8b8eff" : "2px solid transparent",
              color: activeTab === "registers" ? "#8b8eff" : "#8a8898",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "JetBrains Mono",
            }}
          >
            🎛 Cortex-M Registers
          </button>
        </div>

        {/* Oscilloscope Interactive Dividers */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "JetBrains Mono" }}>
          {/* Timebase */}
          <select
            value={timebase}
            onChange={(e) => setTimebase(e.target.value)}
            style={{ background: "#06070a", border: "1px solid rgba(255,255,255,0.15)", color: "#fbbf24", padding: "3px 6px", borderRadius: 4, fontSize: 10, fontFamily: "inherit" }}
          >
            <option value="50µs/div">50µs/div</option>
            <option value="100µs/div">100µs/div</option>
            <option value="500µs/div">500µs/div</option>
            <option value="1ms/div">1ms/div</option>
            <option value="5ms/div">5ms/div</option>
          </select>

          {/* Volt/Div */}
          <select
            value={voltDiv}
            onChange={(e) => setVoltDiv(e.target.value)}
            style={{ background: "#06070a", border: "1px solid rgba(255,255,255,0.15)", color: "#38bdf8", padding: "3px 6px", borderRadius: 4, fontSize: 10, fontFamily: "inherit" }}
          >
            <option value="500mV/div">500mV/div</option>
            <option value="1V/div">1V/div</option>
            <option value="2V/div">2V/div</option>
          </select>

          {/* Action buttons */}
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            style={{
              background: isFrozen ? "#fbbf24" : "rgba(255,255,255,0.06)",
              color: isFrozen ? "#000" : "#e8e6f0",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "3px 8px",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {isFrozen ? "▶ RUN" : "⏸ FREEZE"}
          </button>

          <button
            onClick={handleInjectFault}
            style={{
              background: injectedGlitch ? "#f43f5e" : "rgba(244,63,94,0.1)",
              color: injectedGlitch ? "#fff" : "#f43f5e",
              border: "1px solid rgba(244,63,94,0.3)",
              padding: "3px 8px",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ⚡ INJECT FAULT
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {activeTab === "waveform" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {/* HTML5 Canvas DSO */}
            <div style={{ position: "relative", width: "100%", height: 160, background: "#070b0e" }}>
              <canvas
                ref={canvasRef}
                width={540}
                height={160}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>

            {/* 8-Channel Logic Analyzer */}
            {renderLogicAnalyzer()}
          </div>
        )}

        {activeTab === "registers" && renderRegisters()}
      </div>
    </div>
  );
}
