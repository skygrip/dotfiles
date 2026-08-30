#!/usr/bin/env node

/**
 * ============================================================================
 * Unified Extension Test Runner for Pi Coding Agent
 * ============================================================================
 *
 * Discovers and runs all 7 test suites, reporting aggregated results in a clean table:
 * 1. write-diff (Local diff cards & ctrl+o expansion)
 * 2. prompt-cleaner (System prompt hygiene & history key ordering)
 * 3. permissions-gate (Security & workspace boundaries)
 * 4. ssh (Remote SSH & SFTP loopback transport)
 * 5. critic-review (Secondary LLM audit runner)
 * 6. sequential-thinking (Intermediate reasoning scratchpad)
 * 7. ask-question (Interactive prompt modals)
 *
 * Usage:
 *   node pi-agent/tests/run_all_tests.mjs
 */

import * as path from "node:path";
import { runWriteDiffTests } from "./test_write_diff.mjs";
import { runPromptCleanerTests } from "./test_prompt_cleaner.mjs";
import { runPermissionsGateTests } from "./test_permissions_gate.mjs";
import { runSshTests } from "./test_ssh.mjs";
import { runSequentialThinkingTests } from "./test_sequential_thinking.mjs";
import { runAskQuestionTests } from "./test_ask_question.mjs";
import { runGeminiTests } from "./test_gemini_web_search.mjs";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m"
};

const SUITES = [
  { name: "Write Diff (write-diff.ts)", runner: runWriteDiffTests },
  { name: "Prompt Cleaner (prompt-cleaner.ts)", runner: runPromptCleanerTests },
  { name: "Permissions Gate (permissions-gate.ts)", runner: runPermissionsGateTests },
  { name: "SSH Remote (ssh.ts)", runner: runSshTests },
  { name: "Sequential Thinking (sequential-thinking.ts)", runner: runSequentialThinkingTests },
  { name: "Ask Question (ask-question.ts)", runner: runAskQuestionTests },
  { name: "Gemini Web Search (gemini-web-search.ts)", runner: runGeminiTests }
];

async function main() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}======================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}       Pi Coding Agent: Complete Extension Test Suite Runner          ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}======================================================================${ANSI.reset}\n`);

  const globalStart = Date.now();
  const summaryRows = [];
  let grandTotalPassed = 0;
  let grandTotalFailed = 0;
  const allFailures = [];

  for (const suite of SUITES) {
    const start = Date.now();
    try {
      const results = await suite.runner();
      const duration = Date.now() - start;
      const passed = results.filter(r => r.pass).length;
      const failed = results.filter(r => !r.pass).length;
      grandTotalPassed += passed;
      grandTotalFailed += failed;

      for (const f of results.filter(r => !r.pass)) {
        allFailures.push({ suite: suite.name, test: f.name, error: f.error });
      }

      summaryRows.push({
        suite: suite.name,
        passed,
        failed,
        duration: `${(duration / 1000).toFixed(2)}s`,
        status: failed === 0 ? `${ANSI.green}PASS${ANSI.reset}` : `${ANSI.red}FAIL${ANSI.reset}`
      });
    } catch (err) {
      summaryRows.push({
        suite: suite.name,
        passed: 0,
        failed: 1,
        duration: "0.00s",
        status: `${ANSI.red}CRASH${ANSI.reset}`
      });
      allFailures.push({ suite: suite.name, test: "Suite Runner", error: err });
    }
  }

  const globalDuration = Date.now() - globalStart;

  // Print Summary Table
  console.log(`${ANSI.bold}Suite Execution Summary:${ANSI.reset}\n`);
  console.log(`  ${"Test Suite".padEnd(46)} ${"Passed".padStart(8)} ${"Failed".padStart(8)} ${"Time".padStart(8)}  Status`);
  console.log(`  ${"-".repeat(46)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(8)}  ------`);

  for (const row of summaryRows) {
    const sName = row.suite.padEnd(46);
    const sPass = `${row.passed}`.padStart(8);
    const sFail = `${row.failed > 0 ? ANSI.red : ANSI.dim}${row.failed}${ANSI.reset}`.padStart(row.failed > 0 ? 17 : 17);
    const sTime = row.duration.padStart(8);
    console.log(`  ${sName} ${sPass} ${sFail} ${sTime}  ${row.status}`);
  }

  console.log(`\n${ANSI.bold}${ANSI.cyan}----------------------------------------------------------------------${ANSI.reset}`);
  console.log(`${ANSI.bold}Totals:${ANSI.reset}  Passed: ${ANSI.green}${grandTotalPassed}${ANSI.reset}  |  Failed: ${grandTotalFailed > 0 ? ANSI.red : ANSI.dim}${grandTotalFailed}${ANSI.reset}  |  Total Time: ${(globalDuration / 1000).toFixed(2)}s\n`);

  if (allFailures.length > 0) {
    console.log(`${ANSI.bold}${ANSI.red}Failures Detail:${ANSI.reset}`);
    for (const f of allFailures) {
      console.log(`  • [${f.suite}] ${f.test}: ${f.error?.message || f.error}`);
    }
    process.exit(1);
  } else {
    console.log(`${ANSI.bold}${ANSI.green}✓ All test suites passed with 100% success!${ANSI.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Runner encountered fatal error:", err);
  process.exit(1);
});
