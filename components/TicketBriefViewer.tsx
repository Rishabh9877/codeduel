"use client";

import React from "react";

interface TicketBriefViewerProps {
  markdown: string;
  repoContext?: string;
  targetFile?: string;
}

/**
 * Renders an inline string with backtick code tokens styled cleanly
 */
function renderInlineText(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = part.slice(1, -1);
      return (
        <code
          key={i}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            color: "#c4b5fd",
            background: "rgba(139, 142, 255, 0.12)",
            border: "1px solid rgba(139, 142, 255, 0.25)",
            padding: "1px 6px",
            borderRadius: "4px",
            fontWeight: 500,
          }}
        >
          {code}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function TicketBriefViewer({ markdown, repoContext, targetFile }: TicketBriefViewerProps) {
  if (!markdown) return null;

  // Normalize lines
  const rawLines = markdown.trim().split("\n");

  let title = "Incident Triage";
  let alertType = "INCIDENT REPORT";
  const bodyParagraphs: string[] = [];
  let rootCauseText = "";
  let fixRequiredText = "";
  const extraNotes: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // Header matching ### 🚨 ... or ### Incident ...
    if (line.startsWith("###")) {
      const cleaned = line.replace(/^###\s*/, "").replace(/^[🚨⚠️🔥]\s*/, "");
      title = cleaned;
      if (cleaned.toLowerCase().includes("vulnerability") || cleaned.toLowerCase().includes("critical")) {
        alertType = "CRITICAL SECURITY INCIDENT";
      } else if (cleaned.toLowerCase().includes("hardware") || cleaned.toLowerCase().includes("firmware")) {
        alertType = "FIRMWARE HARDWARE DEFECT";
      } else if (cleaned.toLowerCase().includes("outage")) {
        alertType = "PRODUCTION OUTAGE";
      } else {
        alertType = "CUSTOMER INCIDENT REPORT";
      }
      continue;
    }

    // Root cause matching
    if (line.toLowerCase().startsWith("**root cause:**")) {
      rootCauseText = line.replace(/^\*\*root cause:\*\*\s*/i, "");
      continue;
    }

    // Fix required matching
    if (line.toLowerCase().startsWith("**fix required:**") || line.toLowerCase().startsWith("**fix:**")) {
      fixRequiredText = line.replace(/^\*\*fix( required)?:\*\*\s*/i, "");
      continue;
    }

    // Regular paragraphs or extra notes
    if (rootCauseText && !fixRequiredText) {
      rootCauseText += " " + line;
    } else if (fixRequiredText) {
      fixRequiredText += " " + line;
    } else {
      bodyParagraphs.push(line);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── INCIDENT HEADER BANNER ── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(244,63,94,0.08) 0%, rgba(251,191,36,0.04) 100%)",
          border: "1px solid rgba(244,63,94,0.22)",
          borderRadius: 10,
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#fb7185",
              background: "rgba(244,63,94,0.14)",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            ● {alertType}
          </span>
          {repoContext && (
            <span
              style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#8a8898",
              }}
            >
              📦 {repoContext}
            </span>
          )}
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.4 }}>
          {title}
        </h2>
      </div>

      {/* ── INCIDENT DESCRIPTION ── */}
      {bodyParagraphs.length > 0 && (
        <div style={{ fontSize: 13, lineHeight: 1.65, color: "#dcd9e8" }}>
          {bodyParagraphs.map((p, idx) => (
            <p key={idx} style={{ margin: "0 0 10px 0" }}>
              {renderInlineText(p)}
            </p>
          ))}
        </div>
      )}

      {/* ── ROOT CAUSE CALLOUT ── */}
      {rootCauseText && (
        <div
          style={{
            background: "rgba(139,142,255,0.05)",
            border: "1px solid rgba(139,142,255,0.2)",
            borderLeft: "3px solid #8b8eff",
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#8b8eff",
              marginBottom: 6,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>🔍</span>
            <span>Root Cause Diagnostic</span>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#e2e0ed" }}>
            {renderInlineText(rootCauseText)}
          </div>
        </div>
      )}

      {/* ── REQUIRED FIX OBJECTIVE ── */}
      {fixRequiredText && (
        <div
          style={{
            background: "rgba(74,222,128,0.05)",
            border: "1px solid rgba(74,222,128,0.2)",
            borderLeft: "3px solid #4ade80",
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#4ade80",
              marginBottom: 6,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>🎯</span>
            <span>Required Fix Criteria</span>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#e2e0ed" }}>
            {renderInlineText(fixRequiredText)}
          </div>
        </div>
      )}

      {/* ── TARGET FILE HINT ── */}
      {targetFile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span style={{ color: "#8a8898" }}>Active Patch Target:</span>
          <span style={{ color: "#4ade80", fontWeight: 600 }}>✏️ {targetFile}</span>
        </div>
      )}
    </div>
  );
}
