// =============================================================================
// Codeduel ELO RATING ENGINE
// =============================================================================
// Standard chess-style ELO rating system with K-factor adaptation and floor protection.
// Default K=32 for rapid convergence in competitive student debugging duels.
// Default floor=800 ensures ratings remain meaningful and positive.
// =============================================================================

export const DEFAULT_K_FACTOR = 32;
export const DEFAULT_RATING_FLOOR = 800;
export const STARTING_ELO = 1000;

export interface RankTier {
  name: string;
  badge: string;
  minElo: number;
  maxElo: number;
  color: string;
}

export const RANK_TIERS: RankTier[] = [
  { name: "Junior Apprentice", badge: "BRONZE", minElo: 0, maxElo: 999, color: "#cd7f32" },
  { name: "SWE I", badge: "SILVER", minElo: 1000, maxElo: 1199, color: "#94a3b8" },
  { name: "SWE II", badge: "GOLD", minElo: 1200, maxElo: 1399, color: "#facc15" },
  { name: "Senior Engineer", badge: "PLATINUM", minElo: 1400, maxElo: 1599, color: "#38bdf8" },
  { name: "Staff Engineer", badge: "DIAMOND", minElo: 1600, maxElo: 1799, color: "#a855f7" },
  { name: "Principal / Fellow", badge: "MASTER", minElo: 1800, maxElo: 9999, color: "#f43f5e" },
];

export function getRankTier(elo: number): RankTier {
  const rating = Number(elo) || STARTING_ELO;
  return (
    RANK_TIERS.slice().reverse().find((t) => rating >= t.minElo) || RANK_TIERS[0]
  );
}

/**
 * Calculates the expected win probability of player A against player B.
 * Formula: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
export function getExpectedScore(myElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - myElo) / 400));
}

/**
 * Calculates the net ELO delta for a match result.
 */
export function getEloDelta(
  myElo: number,
  opponentElo: number,
  won: boolean,
  kFactor: number = DEFAULT_K_FACTOR
): number {
  const expected = getExpectedScore(myElo, opponentElo);
  const actual = won ? 1 : 0;
  return Math.round(kFactor * (actual - expected));
}

/**
 * Calculates the new ELO for a single player given the match outcome.
 * Preserves backwards compatibility with `calcElo(myElo, opponentElo, won)`.
 */
export function calcElo(
  myElo: number,
  opponentElo: number,
  won: boolean,
  options?: { floor?: number; kFactor?: number }
): number {
  const floor = options?.floor ?? DEFAULT_RATING_FLOOR;
  const k = options?.kFactor ?? DEFAULT_K_FACTOR;
  const delta = getEloDelta(myElo, opponentElo, won, k);
  const newElo = myElo + delta;
  return Math.max(floor, newElo);
}

/**
 * Calculates updated ratings and deltas for both participants in a duel.
 */
export function calculateMatchRatings(
  winnerElo: number,
  loserElo: number,
  options?: { floor?: number; kFactor?: number }
): {
  newWinnerElo: number;
  newLoserElo: number;
  winnerDelta: number;
  loserDelta: number;
} {
  const floor = options?.floor ?? DEFAULT_RATING_FLOOR;
  const k = options?.kFactor ?? DEFAULT_K_FACTOR;

  const winnerDelta = getEloDelta(winnerElo, loserElo, true, k);
  const newWinnerElo = Math.max(floor, winnerElo + winnerDelta);

  const loserDelta = getEloDelta(loserElo, winnerElo, false, k);
  const newLoserElo = Math.max(floor, loserElo + loserDelta);

  return {
    newWinnerElo,
    newLoserElo,
    winnerDelta,
    loserDelta,
  };
}

/**
 * Dynamically scales the CodeSentinel AI bot's speed and test completion
 * according to the human player's ELO bracket.
 */
export function getBotSimulationParams(humanElo: number, totalTests: number = 3) {
  const rating = Number(humanElo) || STARTING_ELO;

  if (rating < 1050) {
    // Beginner / Junior Bracket: Generous 4+ minutes, slow progress, bot trips on edge case
    return {
      solveDurationMs: 260000,
      testIntervalMs: 75000,
      maxPassableBeforeSolve: Math.max(1, totalTests - 1),
      autoWinAllowed: false, // Does not force instant loss on beginners
    };
  } else if (rating < 1250) {
    // Intermediate / SWE I: ~3 minutes target time
    return {
      solveDurationMs: 180000,
      testIntervalMs: 50000,
      maxPassableBeforeSolve: totalTests,
      autoWinAllowed: true,
    };
  } else if (rating < 1450) {
    // Advanced / SWE II: ~1.8 minutes target time
    return {
      solveDurationMs: 110000,
      testIntervalMs: 32000,
      maxPassableBeforeSolve: totalTests,
      autoWinAllowed: true,
    };
  } else {
    // Senior+ / Staff / Master: 55 seconds rapid solve
    return {
      solveDurationMs: 58000,
      testIntervalMs: 17000,
      maxPassableBeforeSolve: totalTests,
      autoWinAllowed: true,
    };
  }
}

