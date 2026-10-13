// =============================================================================
// CODEDUEL ELO RATING ENGINE
// =============================================================================
// Standard chess-style ELO rating system with K-factor adaptation and floor protection.
// Default K=32 for rapid convergence in competitive student debugging duels.
// Default floor=800 ensures ratings remain meaningful and positive.
// =============================================================================

export const DEFAULT_K_FACTOR = 32;
export const DEFAULT_RATING_FLOOR = 800;

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
