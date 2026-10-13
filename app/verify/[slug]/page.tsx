import type { Metadata } from "next";
import Link from "next/link";
import { dynamo, TABLE } from "@/lib/dynamo";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Credential Verification (${slug}) | CodeDuel`,
    description: `Verify technical debugging credentials, anti-cheat logs, and ELO ratings on CodeDuel.`,
  };
}

export default async function VerifyCredentialPage({ params }: Props) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).trim().toUpperCase();

  let matchedProfile: any = null;
  let verificationHash = "";

  try {
    const scanRes = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "PROFILE" },
      })
    );

    const allProfiles = scanRes.Items || [];

    for (const p of allProfiles) {
      const computed = `CD-VERIFY-${Buffer.from(`${p.userId}-${p.username}`).toString("hex").slice(0, 12).toUpperCase()}`;
      if (
        computed === cleanSlug ||
        (p.username && p.username.toUpperCase() === cleanSlug) ||
        (p.userId && p.userId.toUpperCase() === cleanSlug)
      ) {
        matchedProfile = p;
        verificationHash = computed;
        break;
      }
    }
  } catch (err) {
    console.error("Verification lookup failed:", err);
  }

  const isVerified = !!matchedProfile;
  const username = matchedProfile?.username || "Unknown Developer";
  const elo = Number(matchedProfile?.elo ?? 1200);
  const wins = Number(matchedProfile?.wins ?? 0);
  const losses = Number(matchedProfile?.losses ?? 0);
  const total = wins + losses;
  const skills: string[] = Array.isArray(matchedProfile?.skillsPracticed) ? matchedProfile.skillsPracticed : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090c",
        color: "#e8e6f0",
        fontFamily: "'JetBrains Mono', -apple-system, monospace",
        padding: "48px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 640, width: "100%" }}>
        {/* NAV BRAND */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link
            href="/"
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#fff",
              textDecoration: "none",
              letterSpacing: -0.5,
            }}
          >
            Code<span style={{ color: "#8b8eff" }}>Duel</span> Verification Authority
          </Link>
          <div style={{ fontSize: 11, color: "#6e6d7a", marginTop: 4 }}>
            Decentralized Engineering Skill &amp; Bug-Triage Verification
          </div>
        </div>

        {/* CERTIFICATE CARD */}
        <div
          style={{
            background: "#0d0e14",
            border: `1px solid ${isVerified ? "rgba(74,222,128,0.3)" : "rgba(244,63,94,0.3)"}`,
            borderRadius: 16,
            padding: 36,
            boxShadow: isVerified
              ? "0 20px 50px rgba(74,222,128,0.06)"
              : "0 20px 50px rgba(244,63,94,0.06)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top highlight bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: isVerified
                ? "linear-gradient(90deg, #4ade80, #38bdf8)"
                : "linear-gradient(90deg, #f43f5e, #fb923c)",
            }}
          />

          {/* STATUS BADGE */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: isVerified ? "rgba(74,222,128,0.12)" : "rgba(244,63,94,0.12)",
                border: `1px solid ${isVerified ? "rgba(74,222,128,0.3)" : "rgba(244,63,94,0.3)"}`,
                color: isVerified ? "#4ade80" : "#f43f5e",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              {isVerified ? "✓ AUTHENTIC VERIFIED CREDENTIAL" : "✗ UNVERIFIED OR INVALID SLUG"}
            </span>
            <span style={{ fontSize: 10, color: "#6e6d7a" }}>
              ISSUED BY CODEDUEL ENGINE
            </span>
          </div>

          {isVerified ? (
            <>
              {/* DEVELOPER IDENTITY */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "#161722",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 700,
                    overflow: "hidden",
                  }}
                >
                  {matchedProfile.avatar ? (
                    <img
                      src={matchedProfile.avatar}
                      alt={username}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    username[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#fff" }}>
                    {username}
                  </h2>
                  <div style={{ fontSize: 12, color: "#8a8898", marginTop: 2 }}>
                    Verified Competitor · CodeDuel ID: {matchedProfile.userId}
                  </div>
                </div>
              </div>

              {/* AUDIT METRICS */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  marginBottom: 24,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "16px 14px",
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "#8a8898", textTransform: "uppercase" }}>
                    Verified ELO
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#8b8eff", marginTop: 2 }}>
                    {elo}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#8a8898", textTransform: "uppercase" }}>
                    Incidents Solved
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#4ade80", marginTop: 2 }}>
                    {wins}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#8a8898", textTransform: "uppercase" }}>
                    Total Duels
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginTop: 2 }}>
                    {total}
                  </div>
                </div>
              </div>

              {/* VERIFIED SKILLS BADGES */}
              {skills.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8898", marginBottom: 8 }}>
                    AUTOMATED TEST-SUITE PASSES:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {skills.slice(0, 8).map((s) => (
                      <span
                        key={s}
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "rgba(139,142,255,0.08)",
                          border: "1px solid rgba(139,142,255,0.2)",
                          color: "#c4b5fd",
                        }}
                      >
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AUDIT DETAILS */}
              <div
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 11,
                  color: "#8a8898",
                  lineHeight: 1.6,
                  marginBottom: 24,
                }}
              >
                <div><strong>Credential Hash:</strong> {verificationHash}</div>
                <div><strong>Verification Mode:</strong> Deterministic anti-cheat sandbox evaluation</div>
                <div><strong>Evaluation Standard:</strong> Modular pre-written code debugging under time pressure</div>
              </div>

              {/* ACTION LINKS */}
              <div style={{ display: "flex", gap: 12 }}>
                <Link
                  href={`/u/${encodeURIComponent(username)}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    background: "#8b8eff",
                    color: "#08090c",
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "12px 18px",
                    borderRadius: 8,
                    textDecoration: "none",
                  }}
                >
                  View Full Public Portfolio &amp; Match History →
                </Link>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#fff" }}>
                Credential Not Found
              </h3>
              <p style={{ fontSize: 13, color: "#8a8898", maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.6 }}>
                The credential hash <code style={{ color: "#f43f5e" }}>{cleanSlug}</code> could not be validated against any active engineer records. The credential may have been revoked or typed incorrectly.
              </p>
              <Link
                href="/leaderboard"
                style={{
                  display: "inline-block",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 12,
                  padding: "10px 20px",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Browse Global Leaderboard
              </Link>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#4a4858" }}>
          CodeDuel V2 · Technical Competency &amp; Incident Debugging Proof
        </div>
      </div>
    </div>
  );
}
