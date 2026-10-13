import {
  calcElo,
  calculateMatchRatings,
  getExpectedScore,
  getEloDelta,
  DEFAULT_K_FACTOR,
  DEFAULT_RATING_FLOOR,
} from "../lib/elo";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASSED: ${msg}`);
}

console.log("=================================================");
console.log("RUNNING CODEDUEL ELO UNIT TEST SUITE");
console.log("=================================================\n");

// Test 1: Equal Ratings Expected Score
const expectedEqual = getExpectedScore(1200, 1200);
assert(
  Math.abs(expectedEqual - 0.5) < 0.001,
  `Equal ratings expect 50% probability (got ${expectedEqual})`
);

// Test 2: Probability Symmetry (P(A beats B) + P(B beats A) === 1)
const pA = getExpectedScore(1450, 1200);
const pB = getExpectedScore(1200, 1450);
assert(
  Math.abs(pA + pB - 1.0) < 0.0001,
  `Probability sum symmetry: ${pA.toFixed(4)} + ${pB.toFixed(4)} = 1.0`
);

// Test 3: Standard 1200 vs 1200 match
const resEqual = calculateMatchRatings(1200, 1200);
assert(
  resEqual.newWinnerElo === 1216 && resEqual.newLoserElo === 1184,
  `Equal 1200 match: Winner -> 1216 (+16), Loser -> 1184 (-16)`
);

// Test 4: Underdog win (1200 beats 1600)
const resUnderdog = calculateMatchRatings(1200, 1600);
assert(
  resUnderdog.winnerDelta >= 28 && resUnderdog.loserDelta <= -28,
  `Underdog win awards significant delta (+${resUnderdog.winnerDelta} / ${resUnderdog.loserDelta})`
);

// Test 5: Heavy favorite win (1600 beats 1200)
const resFavorite = calculateMatchRatings(1600, 1200);
assert(
  resFavorite.winnerDelta <= 4 && resFavorite.loserDelta >= -4,
  `Heavy favorite win yields modest delta (+${resFavorite.winnerDelta} / ${resFavorite.loserDelta})`
);

// Test 6: Rating floor protection (rating cannot drop below 800)
const nearFloor = 805;
const beatenByPro = 1600;
const newLoserElo = calcElo(nearFloor, beatenByPro, false);
assert(
  newLoserElo >= DEFAULT_RATING_FLOOR,
  `Rating floor maintained: 805 loser drops to ${newLoserElo} (>= floor ${DEFAULT_RATING_FLOOR})`
);

// Test 7: Bot match rating updates
const playerElo = 1300;
const botElo = 1250;
const matchRes = calculateMatchRatings(playerElo, botElo);
assert(
  matchRes.newWinnerElo > playerElo && matchRes.newLoserElo < botElo,
  `Bot match ratings update symmetrically (Winner: ${playerElo} -> ${matchRes.newWinnerElo}, Loser: ${botElo} -> ${matchRes.newLoserElo})`
);

console.log("\n=================================================");
console.log("ALL ELO ENGINE TESTS PASSED (100% GREEN)");
console.log("=================================================");
