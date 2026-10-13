"use client";

import React, { useState } from "react";
import type { HardwareContext } from "@/lib/challenges";

interface Props {
  hardwareContext: HardwareContext;
  hiddenTestsCount?: number;
}

export function SimulatedHardwarePanel({ hardwareContext, hiddenTestsCount }: Props) {
  const [activeTab, setActiveTab] = useState<"waveform" | "registers" | "memory">("waveform");

  const renderWaveform = () => {
    const type = hardwareContext.waveformSvg || "generic";

    if (type === "uart-overflow") {
      return (
        <svg viewBox="0 0 540 140" style={{ width: "100%", height: "auto", display: "block" }}>
          {/* Grid lines */}
          <line x1="40" y1="20" x2="520" y2="20" stroke="#1f2330" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="40" y1="65" x2="520" y2="65" stroke="#1f2330" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="40" y1="110" x2="520" y2="110" stroke="#1f2330" strokeWidth="1" strokeDasharray="4 4" />

          {/* Time markers */}
          <text x="40" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">0µs</text>
          <text x="160" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">25µs</text>
          <text x="280" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">50µs</text>
          <text x="400" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">75µs</text>
          <text x="500" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">100µs</text>

          {/* Channel 1: UART RX */}
          <text x="4" y="44" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">RX</text>
          <path
            d="M 40 50 L 70 50 L 70 30 L 100 30 L 100 50 L 130 50 L 130 30 L 170 30 L 170 50 L 220 50 L 220 30 L 270 30 L 270 50 L 320 50 L 320 30 L 360 30 L 360 50 L 410 50 L 410 30 L 450 30 L 450 50 L 520 50"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
          />

          {/* Glitch zone background */}
          <rect x="340" y="24" width="160" height="85" fill="rgba(244,63,94,0.12)" stroke="rgba(244,63,94,0.4)" strokeDasharray="3 3" rx="4" />
          <text x="350" y="38" fill="#f43f5e" fontSize="9" fontWeight="bold" fontFamily="JetBrains Mono">▲ OVERRUN: BUFFER FULL</text>

          {/* Channel 2: OVERRUN ERROR (ORE) FLAG */}
          <text x="4" y="94" fill="#f43f5e" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">ORE</text>
          <path
            d="M 40 100 L 340 100 L 340 75 L 520 75"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2"
          />

          {/* Byte annotations */}
          <text x="75" y="45" fill="#8b8eff" fontSize="8" fontFamily="JetBrains Mono">0x55</text>
          <text x="135" y="45" fill="#8b8eff" fontSize="8" fontFamily="JetBrains Mono">0xAA</text>
          <text x="225" y="45" fill="#8b8eff" fontSize="8" fontFamily="JetBrains Mono">0x10</text>
          <text x="365" y="45" fill="#f87171" fontSize="8" fontFamily="JetBrains Mono">DROPPED</text>
        </svg>
      );
    }

    if (type === "gpio-bounce") {
      return (
        <svg viewBox="0 0 540 140" style={{ width: "100%", height: "auto", display: "block" }}>
          {/* Time markers */}
          <line x1="40" y1="20" x2="520" y2="20" stroke="#1f2330" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="40" y1="65" x2="520" y2="65" stroke="#1f2330" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="40" y1="110" x2="520" y2="110" stroke="#1f2330" strokeWidth="1" strokeDasharray="4 4" />

          <text x="40" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">0ms</text>
          <text x="180" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">5ms</text>
          <text x="320" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">10ms</text>
          <text x="480" y="14" fill="#525060" fontSize="9" fontFamily="JetBrains Mono">15ms</text>

          {/* Channel 1: RAW GPIO IN */}
          <text x="4" y="44" fill="#fbbf24" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">PIN</text>
          {/* Clean high, then bounce chatter, then stable low */}
          <path
            d="M 40 30 L 140 30 L 145 50 L 150 30 L 155 50 L 160 30 L 165 50 L 170 30 L 178 50 L 185 32 L 195 50 L 520 50"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
          />

          {/* Shaded chatter zone */}
          <rect x="135" y="22" width="70" height="90" fill="rgba(244,63,94,0.12)" stroke="rgba(244,63,94,0.4)" strokeDasharray="3 3" rx="4" />
          <text x="140" y="72" fill="#f43f5e" fontSize="8" fontWeight="bold" fontFamily="JetBrains Mono">▲ BOUNCE &lt; 5ms</text>

          {/* Channel 2: DEBOUNCED STATE */}
          <text x="4" y="94" fill="#4ade80" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">STABLE</text>
          <path
            d="M 40 85 L 205 85 L 205 105 L 520 105"
            fill="none"
            stroke="#4ade80"
            strokeWidth="2"
          />
          <text x="220" y="100" fill="#4ade80" fontSize="8" fontFamily="JetBrains Mono">LATCHED AFTER THRESHOLD (5ms)</text>
        </svg>
      );
    }

    if (type === "spi-endian") {
      return (
        <svg viewBox="0 0 540 140" style={{ width: "100%", height: "auto", display: "block" }}>
          {/* SCK Clock */}
          <text x="4" y="38" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">SCK</text>
          <path
            d="M 40 45 L 60 45 L 60 25 L 75 25 L 75 45 L 90 45 L 90 25 L 105 25 L 105 45 L 120 45 L 120 25 L 135 25 L 135 45 L 150 45 L 150 25 L 165 25 L 165 45 L 180 45 L 180 25 L 195 25 L 195 45 L 230 45 L 230 25 L 245 25 L 245 45 L 260 45 L 260 25 L 275 25 L 275 45 L 290 45 L 290 25 L 305 25 L 305 45 L 340 45 L 520 45"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
          />

          {/* MISO Data Line */}
          <text x="4" y="80" fill="#c084fc" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">MISO</text>
          <path
            d="M 40 85 L 60 85 L 60 70 L 120 70 L 120 85 L 165 85 L 165 70 L 210 70 L 240 85 L 280 70 L 320 85 L 520 85"
            fill="none"
            stroke="#c084fc"
            strokeWidth="2"
          />

          {/* Shaded byte swap warning */}
          <rect x="55" y="60" width="145" height="50" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.4)" rx="4" />
          <text x="65" y="100" fill="#fbbf24" fontSize="9" fontWeight="bold" fontFamily="JetBrains Mono">BYTE 0: MSB (0x0F)</text>

          <rect x="225" y="60" width="145" height="50" fill="rgba(56,189,248,0.12)" stroke="rgba(56,189,248,0.4)" rx="4" />
          <text x="235" y="100" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="JetBrains Mono">BYTE 1: LSB (0xA0)</text>

          <text x="55" y="125" fill="#f43f5e" fontSize="9" fontWeight="bold" fontFamily="JetBrains Mono">
            ⚠️ Swapping order causes raw = 0xA00F instead of 0x0FA0!
          </text>
        </svg>
      );
    }

    if (type === "interrupt-race") {
      return (
        <svg viewBox="0 0 540 140" style={{ width: "100%", height: "auto", display: "block" }}>
          {/* Main Loop Read */}
          <text x="4" y="38" fill="#4ade80" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">MAIN</text>
          <path d="M 40 35 L 220 35 L 220 50 L 360 50 L 360 35 L 520 35" fill="none" stroke="#4ade80" strokeWidth="2" />
          <text x="60" y="30" fill="#4ade80" fontSize="9" fontFamily="JetBrains Mono">READ HIGH WORD</text>
          <text x="375" y="30" fill="#4ade80" fontSize="9" fontFamily="JetBrains Mono">READ LOW WORD</text>

          {/* ISR Trigger Pulse */}
          <text x="4" y="82" fill="#f43f5e" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">IRQ</text>
          <path d="M 40 90 L 240 90 L 240 68 L 330 68 L 330 90 L 520 90" fill="none" stroke="#f43f5e" strokeWidth="2" />

          {/* Shaded collision area */}
          <rect x="220" y="20" width="140" height="90" fill="rgba(244,63,94,0.15)" stroke="rgba(244,63,94,0.5)" strokeDasharray="3 3" rx="4" />
          <text x="228" y="75" fill="#f43f5e" fontSize="8" fontWeight="bold" fontFamily="JetBrains Mono">▲ TORN READ CORRUPTION</text>
          <text x="228" y="88" fill="#f43f5e" fontSize="8" fontFamily="JetBrains Mono">ISR updates 64-bit TS mid-read!</text>
        </svg>
      );
    }

    // Default / CAN alignment
    return (
      <svg viewBox="0 0 540 140" style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Differential CAN Bus */}
        <text x="4" y="35" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">CANH</text>
        <path d="M 40 30 L 120 30 L 130 20 L 220 20 L 230 30 L 320 30 L 330 20 L 420 20 L 430 30 L 520 30" fill="none" stroke="#38bdf8" strokeWidth="2" />

        <text x="4" y="65" fill="#818cf8" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">CANL</text>
        <path d="M 40 60 L 120 60 L 130 70 L 220 70 L 230 60 L 320 60 L 330 70 L 420 70 L 430 60 L 520 60" fill="none" stroke="#818cf8" strokeWidth="2" />

        {/* HardFault Trigger */}
        <text x="4" y="105" fill="#f43f5e" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">FAULT</text>
        <path d="M 40 115 L 260 115 L 260 92 L 520 92" fill="none" stroke="#f43f5e" strokeWidth="2" />

        <rect x="250" y="80" width="220" height="42" fill="rgba(244,63,94,0.18)" stroke="rgba(244,63,94,0.5)" rx="4" />
        <text x="260" y="98" fill="#f43f5e" fontSize="9" fontWeight="bold" fontFamily="JetBrains Mono">⚠️ Cortex-M0 HardFault Triggered</text>
        <text x="260" y="112" fill="#f87171" fontSize="8" fontFamily="JetBrains Mono">Unaligned uint32_t load at offset 0x03</text>
      </svg>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0a10", color: "#e8e6f0" }}>
      {/* ── MCU SPECS HEADER ──────────────────────────────────────────────── */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#08080d" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>⚡ TARGET CHIP:</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>
              {hardwareContext.mcu}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "2px 6px", color: "#8a8898", fontFamily: "JetBrains Mono" }}>
              {hardwareContext.clockSpeed}
            </span>
            <span style={{ fontSize: 10, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 4, padding: "2px 6px", color: "#38bdf8", fontFamily: "JetBrains Mono" }}>
              {hardwareContext.busProtocol}
            </span>
          </div>
        </div>

        {/* Failure Callout */}
        <div style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#f43f5e" }}>⚠️</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
              Observed Hardware Glitch
            </div>
            <div style={{ fontSize: 11, color: "#fecdd3", lineHeight: 1.4 }}>
              {hardwareContext.observedFailure}
            </div>
          </div>
        </div>
      </div>

      {/* ── SUB-TABS ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", background: "#0c0d16", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 12px", gap: 4 }}>
        <button
          onClick={() => setActiveTab("waveform")}
          style={{
            background: activeTab === "waveform" ? "#151624" : "transparent",
            border: "none",
            borderBottom: activeTab === "waveform" ? "2px solid #fbbf24" : "2px solid transparent",
            color: activeTab === "waveform" ? "#fbbf24" : "#8a8898",
            fontSize: 11,
            fontWeight: 700,
            padding: "8px 14px",
            cursor: "pointer",
            fontFamily: "JetBrains Mono",
          }}
        >
          📈 Logic Analyzer / Scope
        </button>
        <button
          onClick={() => setActiveTab("registers")}
          style={{
            background: activeTab === "registers" ? "#151624" : "transparent",
            border: "none",
            borderBottom: activeTab === "registers" ? "2px solid #8b8eff" : "2px solid transparent",
            color: activeTab === "registers" ? "#8b8eff" : "#8a8898",
            fontSize: 11,
            fontWeight: 700,
            padding: "8px 14px",
            cursor: "pointer",
            fontFamily: "JetBrains Mono",
          }}
        >
          🎛 Registers ({hardwareContext.registers?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("memory")}
          style={{
            background: activeTab === "memory" ? "#151624" : "transparent",
            border: "none",
            borderBottom: activeTab === "memory" ? "2px solid #38bdf8" : "2px solid transparent",
            color: activeTab === "memory" ? "#38bdf8" : "#8a8898",
            fontSize: 11,
            fontWeight: 700,
            padding: "8px 14px",
            cursor: "pointer",
            fontFamily: "JetBrains Mono",
          }}
        >
          🗺 Memory Map
        </button>
      </div>

      {/* ── TAB CONTENT ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
        {activeTab === "waveform" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Digital Timing Diagram (Logic 8 / 24MHz Sample Rate)
              </span>
              <span style={{ fontSize: 10, color: "#4ade80", fontFamily: "JetBrains Mono" }}>● LIVE TRACE CAPTURE</span>
            </div>

            <div style={{ background: "#06070a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              {renderWaveform()}
            </div>

            <div style={{ fontSize: 11, color: "#8a8898", lineHeight: 1.5, background: "rgba(255,255,255,0.02)", padding: 10, borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
              💡 <strong>Hardware Debugging Insight:</strong> Real embedded engineers diagnose firmware bugs by correlating register values with external logic analyzer captures. Notice how the glitch aligns with boundary state updates.
            </div>
          </div>
        )}

        {activeTab === "registers" && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Simulated Memory-Mapped I/O Registers
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {hardwareContext.registers?.map((reg) => (
                <div
                  key={reg.name}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontFamily: "JetBrains Mono",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#8b8eff", fontWeight: 700, fontSize: 12 }}>{reg.name}</span>
                    <span style={{ color: "#4ade80", fontSize: 11 }}>{reg.value}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "#8a8898" }}>
                    <span>Offset: {reg.address}</span>
                    <span style={{ color: "#c8c6d4" }}>{reg.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "memory" && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8898", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              ARM Memory Architecture Map
            </div>

            {/* Visual Bar */}
            <div style={{ display: "flex", height: 18, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ flex: 4, background: "#38bdf8", opacity: 0.8 }} title="Flash ROM" />
              <div style={{ flex: 2, background: "#4ade80", opacity: 0.8 }} title="SRAM" />
              <div style={{ flex: 3, background: "#fbbf24", opacity: 0.8 }} title="Peripherals" />
              <div style={{ flex: 1, background: "#c084fc", opacity: 0.8 }} title="Private Peripherals" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {hardwareContext.memoryMap?.map((mem) => (
                <div
                  key={mem.region}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 11,
                    fontFamily: "JetBrains Mono",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: "#fff" }}>{mem.region}: </span>
                    <span style={{ color: "#8a8898" }}>{mem.start} - {mem.end}</span>
                  </div>
                  <span style={{ color: "#8b8eff", fontSize: 10 }}>{mem.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── HIDDEN TEST SUITE FOOTER ───────────────────────────────────────── */}
      {hiddenTestsCount && hiddenTestsCount > 0 ? (
        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "#08080d", display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
          <span style={{ color: "#fbbf24" }}>🛡️</span>
          <span style={{ color: "#8a8898" }}>
            <strong>Anti-Hardcoding Suite:</strong> 2 visible unit tests + {hiddenTestsCount} hidden edge-case test evaluated on submission.
          </span>
        </div>
      ) : null}
    </div>
  );
}
