export type SubscriptionTier = "FREE" | "PRO" | "CAMPUS";
export type Currency = "INR" | "USD";

export interface PricingPlan {
  id: SubscriptionTier;
  name: string;
  badge?: string;
  monthlyPriceINR: number;
  annualPriceMonthlyINR: number;
  monthlyPriceUSD: number;
  annualPriceMonthlyUSD: number;
  periodTextINR?: string;
  periodTextUSD?: string;
  description: string;
  duelsPerDay: number; // -1 for unlimited
  aiHintsPerChallenge: number;
  hasAdvancedHardwareSimulation: boolean;
  hasVerifiedPortfolioBadge: boolean;
  hasFacultyDashboard: boolean;
  features: string[];
  ctaTextINR: string;
  ctaTextUSD: string;
  highlighted?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "FREE",
    name: "Student Free",
    monthlyPriceINR: 0,
    annualPriceMonthlyINR: 0,
    monthlyPriceUSD: 0,
    annualPriceMonthlyUSD: 0,
    description: "Foundational debugging training for engineering students getting started.",
    duelsPerDay: -1, // Unlimited duels as specified
    aiHintsPerChallenge: 1,
    hasAdvancedHardwareSimulation: false,
    hasVerifiedPortfolioBadge: false,
    hasFacultyDashboard: false,
    features: [
      "Unlimited 1v1 matchmaking & duels",
      "Daily Practice Challenge with streak tracking",
      "1 Tier-1 Socratic AI hint per duel/practice",
      "Access to all 12 SWE & ECE incident scenarios",
      "Global ELO ranking & public portfolio",
      "Standard sandboxed test execution harness",
    ],
    ctaTextINR: "Current Plan",
    ctaTextUSD: "Current Plan",
  },
  {
    id: "PRO",
    name: "Pro Engineer",
    badge: "PRIMARY B2C SUBSCRIPTION",
    monthlyPriceINR: 100,
    annualPriceMonthlyINR: 100, // ₹1,200/yr billed annually
    monthlyPriceUSD: 19,
    annualPriceMonthlyUSD: 15, // $15/mo billed annually
    periodTextINR: "₹1,200 / year billed annually",
    periodTextUSD: "$180 / year billed annually",
    description: "For competitive developers & engineering students targeting top product & embedded systems roles.",
    duelsPerDay: -1, // Unlimited
    aiHintsPerChallenge: 3,
    hasAdvancedHardwareSimulation: true,
    hasVerifiedPortfolioBadge: true,
    hasFacultyDashboard: false,
    highlighted: true,
    features: [
      "Unlimited 1v1 duels & matchmaking queue",
      "Full 3-Tier Socratic AI Coach (Nudges, Root-Cause, Solution Strategy)",
      "Interactive Digital Oscilloscope & Logic Analyzer test bench",
      "Live ARM Cortex-M MMIO register fault telemetry (CFSR/HFSR/PRIMASK)",
      "Post-Mortem Root-Cause analysis & canonical git diffs",
      "Verified Recruiter Portfolio Badge with cryptographic audit link",
      "Priority Piston multi-file sandbox execution (< 500ms)",
    ],
    ctaTextINR: "Subscribe to Pro (₹100/mo)",
    ctaTextUSD: "Subscribe to Pro ($19/mo)",
  },
  {
    id: "CAMPUS",
    name: "Campus Department License",
    badge: "B2B INSTITUTIONAL LICENSING",
    monthlyPriceINR: 40000,
    annualPriceMonthlyINR: 25000, // ₹1,00,000 / year (or ₹40,000 / semester)
    monthlyPriceUSD: 499,
    annualPriceMonthlyUSD: 399,
    periodTextINR: "₹40,000 / semester or ₹1,00,000 / year",
    periodTextUSD: "$499 / semester (unlimited students)",
    description: "For university engineering departments (ECE & CS), professors, and lab TAs modernizing course labs.",
    duelsPerDay: -1,
    aiHintsPerChallenge: 3,
    hasAdvancedHardwareSimulation: true,
    hasVerifiedPortfolioBadge: true,
    hasFacultyDashboard: true,
    features: [
      "Unlimited student seats across the entire department",
      "Turnkey Faculty Portal with instant 6-character cohort join codes",
      "Automated lab grading with incident pass rates & latency tracking",
      "LMS-Ready CSV Gradebook Export",
      "Plagiarism telemetry & code diff inspection across student roster",
      "Department-wide leaderboard & cohort-specific analytics",
      "SSO Integration (Roadmap)",
      "Curriculum integration & dedicated faculty onboarding support",
    ],
    ctaTextINR: "Request Campus License (₹40,000/term)",
    ctaTextUSD: "Request Campus License ($499/term)",
  },
];

export const PRICING_FAQS = [
  {
    q: "How does Codeduel differ from LeetCode or traditional coding platforms?",
    a: "Unlike traditional competitive programming platforms where you memorize and rewrite single-function algorithms from scratch, Codeduel focuses on authentic engineering: you receive realistic multi-file codebases (such as UART ring buffers, RTOS drivers, or rate limiters) containing real production bugs, and race against time to diagnose root causes, manage registers/memory, and pass integration test suites.",
  },
  {
    q: "How does the Campus Department License work for universities and colleges?",
    a: "A department purchases an annual or semester license. Faculty can instantly create course cohorts (e.g. CS-301), assign real-world debugging labs, and auto-grade submissions. Students join in 5 seconds with a 6-character code, and all enrolled students automatically receive full access during the term.",
  },
  {
    q: "Can individual students use Codeduel for free?",
    a: "Yes! The Free Student tier has zero credit card requirement and provides unlimited 1v1 matchmaking, the Daily Practice Challenge, and access to all 12 production incidents across both Embedded Systems and Cloud SWE tracks.",
  },
  {
    q: "What is included in the Verified Recruiter Portfolio and Cryptographic Certificate?",
    a: "When you resolve production incidents, your /u/[username] profile logs your verified problem solves, 5-axis competency radar chart, and generates a tamper-proof certificate slug. Recruiters can verify your real code execution record without relying on self-reported resume claims.",
  },
];
