export type SubscriptionTier = "FREE" | "PRO" | "CAMPUS";

export interface PricingPlan {
  id: SubscriptionTier;
  name: string;
  badge?: string;
  monthlyPrice: number;
  annualPriceMonthly: number;
  description: string;
  duelsPerDay: number; // -1 for unlimited
  aiHintsPerChallenge: number;
  hasAdvancedHardwareSimulation: boolean;
  hasVerifiedPortfolioBadge: boolean;
  hasFacultyDashboard: boolean;
  features: string[];
  ctaText: string;
  highlighted?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "FREE",
    name: "Student Free",
    monthlyPrice: 0,
    annualPriceMonthly: 0,
    description: "Foundational debugging training for engineering students getting started.",
    duelsPerDay: 5,
    aiHintsPerChallenge: 1,
    hasAdvancedHardwareSimulation: false,
    hasVerifiedPortfolioBadge: false,
    hasFacultyDashboard: false,
    features: [
      "5 ranked 1v1 duels per day",
      "Access to all 12 SWE & ECE practice challenges",
      "Tier 1 AI hint per challenge (syntax & nudge)",
      "Global ELO ranking & public portfolio",
      "Basic sandbox test-runner",
    ],
    ctaText: "Current Plan",
  },
  {
    id: "PRO",
    name: "Pro Competitor",
    badge: "MOST POPULAR",
    monthlyPrice: 12,
    annualPriceMonthly: 9,
    description: "For serious engineers targeting top embedded firmware and software roles.",
    duelsPerDay: -1, // Unlimited
    aiHintsPerChallenge: 3,
    hasAdvancedHardwareSimulation: true,
    hasVerifiedPortfolioBadge: true,
    hasFacultyDashboard: false,
    highlighted: true,
    features: [
      "Unlimited ranked 1v1 duels & matchmaking",
      "Full 3-Tier AI Coach (Nudges, Root-Cause, Solution Strategy)",
      "Interactive Digital Oscilloscope & MMIO Register Inspector",
      "Verified Portfolio Credential Badge with Recruiter Audit Slug",
      "ARM Cortex memory alignment & byte endianness labs",
      "Priority Docker execution sandbox (< 1s compile times)",
      "Post-solve architectural walkthroughs & benchmark comparisons",
    ],
    ctaText: "Upgrade to Pro",
  },
  {
    id: "CAMPUS",
    name: "Campus Department",
    badge: "FOR FACULTY",
    monthlyPrice: 99,
    annualPriceMonthly: 79,
    description: "For university professors, department chairs, and course TAs teaching embedded & software labs.",
    duelsPerDay: -1,
    aiHintsPerChallenge: 3,
    hasAdvancedHardwareSimulation: true,
    hasVerifiedPortfolioBadge: true,
    hasFacultyDashboard: true,
    features: [
      "Everything in Pro for up to 100 enrolled students",
      "Course cohort creation with private student join codes",
      "Automated lab grading with incident pass rates & latency tracking",
      "Course-specific student leaderboards",
      "Anti-cheat sandbox detection & telemetry logs",
      "Custom lab assignment scheduling & due dates",
      "Direct instructor support & curriculum integration",
    ],
    ctaText: "Request Department Pilot",
  },
];

export const PRICING_FAQS = [
  {
    q: "How does CodeDuel differ from LeetCode or HackerRank?",
    a: "Unlike traditional competitive programming platforms where you write algorithms from scratch, CodeDuel focuses on realistic engineering: you receive pre-written modular codebases (such as UART ring buffers, RTOS drivers, or rate limiters) containing production bugs, and race against time to diagnose root causes and pass integration test suites.",
  },
  {
    q: "Is there a student discount for engineering students?",
    a: "Yes! The core Student Free plan has zero credit card requirement and includes 5 daily duels and full access to both Embedded C and Cloud SWE incident libraries. If your university department adopts CodeDuel Campus, your Pro upgrade is 100% sponsored by your college.",
  },
  {
    q: "What does the Recruiter Verification Credential do?",
    a: "When you achieve milestones or top ELO rankings, CodeDuel generates a deterministic cryptographic slug (e.g. CD-VERIFY-XXXX). Technical hiring managers and hiring teams can verify this link to prove that your test passes occurred under real-time sandboxed conditions with anti-cheat controls.",
  },
  {
    q: "How do universities integrate CodeDuel for lab courses?",
    a: "Faculty create course sections at /campus in under 30 seconds, generating a unique join code (e.g. ECE-301-FALL). Students enter the code to join, and assignments appear automatically with automated grading and median time-to-patch telemetry.",
  },
];
