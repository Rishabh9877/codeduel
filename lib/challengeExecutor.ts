// =============================================================================
// MULTI-FILE CHALLENGE EXECUTOR — Piston API
// =============================================================================
//
// This module replaces the old single-file + test-case wrapper execution model.
// Instead of wrapping user code with boilerplate, each challenge has its own
// self-contained test runner (entrypoint) that imports from the user's edited files.
//
// The Piston API accepts multiple files. We send ALL challenge files (with the
// user's patched version replacing the editable file) and specify the entrypoint.
//
// The test runner outputs lines like:
//   [PASS] TEST_1: Description
//   [FAIL] TEST_2: Description
//   SUMMARY: X/Y PASSED
//
// We parse this SUMMARY line to determine pass/fail counts.
// =============================================================================

import type { Challenge, ChallengeFile } from './challenges';

// ── Backend Configuration ────────────────────────────────────────────────────

const PISTON_URL = process.env.PISTON_URL ?? 'https://emkc.org/api/v2/piston';

// Timeout for API requests (20 seconds — allows for cold-start latency)
const PISTON_TIMEOUT_MS = 20_000;

// Maximum total code size to send (200KB) — prevents abuse
const MAX_TOTAL_CODE_SIZE_BYTES = 200_000;

// ── Piston Language Mapping ──────────────────────────────────────────────────

const PISTON_LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  typescript: { language: 'typescript', version: '5.0.3' },
  c:          { language: 'c',          version: '10.2.0' },
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChallengeExecutionResult {
  passed: number;
  total: number;
  allPassed: boolean;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  status: 'accepted' | 'wrong_answer' | 'runtime_error' | 'compile_error' | 'timeout' | 'execution_service_unavailable';
  testResults: Array<{ name: string; passed: boolean }>;
}

// ── Core Executor ────────────────────────────────────────────────────────────

/**
 * Execute a challenge's test suite via the Piston API.
 *
 * @param challenge  - The challenge definition (files, entrypoint, language)
 * @param userFiles  - Map of filename → patched content from the user's editor.
 *                     Only editable files should be changed; readOnly files are
 *                     taken from the original challenge definition.
 */
export async function executeChallenge(
  challenge: Challenge,
  userFiles: Record<string, string>
): Promise<ChallengeExecutionResult> {

  // 1. Merge user's edits with the challenge's read-only files
  const mergedFiles: { name: string; content: string }[] = challenge.files.map((f) => ({
    name: f.name,
    content: f.readOnly ? f.content : (userFiles[f.name] ?? f.content),
  }));

  // 2. Validate total size
  const totalSize = mergedFiles.reduce((sum, f) => sum + Buffer.byteLength(f.content, 'utf-8'), 0);
  if (totalSize > MAX_TOTAL_CODE_SIZE_BYTES) {
    return {
      passed: 0,
      total: challenge.totalTests,
      allPassed: false,
      stdout: '',
      stderr: `Total code size (${totalSize} bytes) exceeds maximum allowed (${MAX_TOTAL_CODE_SIZE_BYTES} bytes).`,
      runtimeMs: 0,
      status: 'runtime_error',
      testResults: [],
    };
  }

  // 3. Resolve Piston language config
  const langConfig = PISTON_LANGUAGE_MAP[challenge.language];
  if (!langConfig) {
    return {
      passed: 0,
      total: challenge.totalTests,
      allPassed: false,
      stdout: '',
      stderr: `Unsupported language: "${challenge.language}"`,
      runtimeMs: 0,
      status: 'runtime_error',
      testResults: [],
    };
  }

  // 4. Build Piston request payload
  // The entrypoint file must be FIRST in the files array for Piston to execute it.
  const entrypointFile = mergedFiles.find((f) => f.name === challenge.entrypoint);
  const otherFiles = mergedFiles.filter((f) => f.name !== challenge.entrypoint);

  if (!entrypointFile) {
    return {
      passed: 0,
      total: challenge.totalTests,
      allPassed: false,
      stdout: '',
      stderr: `Entrypoint file "${challenge.entrypoint}" not found in challenge files.`,
      runtimeMs: 0,
      status: 'runtime_error',
      testResults: [],
    };
  }

  const pistonFiles = [
    { name: entrypointFile.name, content: entrypointFile.content },
    ...otherFiles.map((f) => ({ name: f.name, content: f.content })),
  ];

  // 5. Execute via Piston API
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PISTON_TIMEOUT_MS);

    const response = await fetch(`${PISTON_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: pistonFiles,
        compile_timeout: 15000,
        run_timeout: 10000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const runtimeMs = Date.now() - start;

    if (!response.ok) {
      const statusCode = response.status;
      console.error(`[challengeExecutor] Piston returned HTTP ${statusCode}`);

      return {
        passed: 0,
        total: challenge.totalTests,
        allPassed: false,
        stdout: '',
        stderr: statusCode === 400
          ? 'Invalid execution request. The selected language or version may not be available on the server.'
          : 'Code execution service is temporarily unavailable. Please try again.',
        runtimeMs,
        status: 'execution_service_unavailable',
        testResults: [],
      };
    }

    const data = await response.json();
    const stdout = (data.run?.stdout ?? data.compile?.stdout ?? '').toString();
    const stderr = (data.run?.stderr ?? data.compile?.stderr ?? '').toString();
    const compileStderr = (data.compile?.stderr ?? '').toString();

    // Check for compilation errors
    if (data.compile?.code !== undefined && data.compile.code !== 0 && !stdout) {
      return {
        passed: 0,
        total: challenge.totalTests,
        allPassed: false,
        stdout: data.compile?.stdout ?? '',
        stderr: compileStderr || 'Compilation failed.',
        runtimeMs,
        status: 'compile_error',
        testResults: [],
      };
    }

    // 6. Parse test results from stdout
    const { passed, total, testResults } = parseTestOutput(stdout, challenge.totalTests);

    return {
      passed,
      total,
      allPassed: passed === total && total > 0,
      stdout,
      stderr: stderr || null as unknown as string,
      runtimeMs,
      status: passed === total && total > 0 ? 'accepted' : (stderr ? 'runtime_error' : 'wrong_answer'),
      testResults,
    };

  } catch (err: any) {
    const runtimeMs = Date.now() - start;
    const isAbort = err.name === 'AbortError';

    console.error(`[challengeExecutor] ${isAbort ? 'Timeout' : 'Network error'}: ${err.message}`);

    return {
      passed: 0,
      total: challenge.totalTests,
      allPassed: false,
      stdout: '',
      stderr: isAbort
        ? 'Code execution timed out. Your solution may have an infinite loop or excessive computation.'
        : 'Code execution service is temporarily unavailable. Please try again.',
      runtimeMs,
      status: isAbort ? 'timeout' : 'execution_service_unavailable',
      testResults: [],
    };
  }
}

// ── Output Parser ────────────────────────────────────────────────────────────

/**
 * Parse the standardized test runner output.
 *
 * Expected format per test:
 *   [PASS] TEST_N: Description
 *   [FAIL] TEST_N: Description
 *
 * Expected summary line:
 *   SUMMARY: X/Y PASSED
 */
function parseTestOutput(
  stdout: string,
  expectedTotal: number
): { passed: number; total: number; testResults: Array<{ name: string; passed: boolean }> } {
  const lines = stdout.split('\n');
  const testResults: Array<{ name: string; passed: boolean }> = [];

  // Parse individual test lines
  for (const line of lines) {
    const passMatch = line.match(/^\[PASS\]\s+(.+)/);
    if (passMatch) {
      testResults.push({ name: passMatch[1].trim(), passed: true });
      continue;
    }

    const failMatch = line.match(/^\[FAIL\]\s+(.+)/);
    if (failMatch) {
      testResults.push({ name: failMatch[1].trim(), passed: false });
    }
  }

  // Try to parse the SUMMARY line for authoritative counts
  const summaryMatch = stdout.match(/SUMMARY:\s*(\d+)\/(\d+)\s*PASSED/);
  if (summaryMatch) {
    return {
      passed: parseInt(summaryMatch[1], 10),
      total: parseInt(summaryMatch[2], 10),
      testResults,
    };
  }

  // Fallback: count from parsed test results
  const passed = testResults.filter((t) => t.passed).length;
  return {
    passed,
    total: expectedTotal,
    testResults,
  };
}
