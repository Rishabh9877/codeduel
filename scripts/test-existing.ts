import { SEED_CHALLENGES } from '../lib/challenges';
import { executeChallenge } from '../lib/challengeExecutor';

async function main() {
  for (const [id, challenge] of Object.entries(SEED_CHALLENGES)) {
    console.log(`\n--- Testing ${id} (${challenge.track}, ${challenge.language}) ---`);
    const initialResult = await executeChallenge(challenge, {});
    console.log(`Passed: ${initialResult.passed}/${initialResult.total}, status: ${initialResult.status}`);
    if (initialResult.stderr) {
      console.log(`STDERR:\n${initialResult.stderr}`);
    }
  }
}

main().catch(console.error);
