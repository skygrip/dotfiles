#!/usr/bin/env node

/**
 * ============================================================================
 * Unified Extension Test Runner for Pi Coding Agent
 * ============================================================================
 *
 * Discovers and runs all 8 custom extension test suites:
 * 1. write-diff (Local diff cards & ctrl+o expansion)
 * 2. prompt-cleaner (System prompt hygiene & history key ordering)
 * 3. permissions-gate (Security & workspace boundaries)
 * 4. ssh (Remote SSH & SFTP loopback transport)
 * 5. sequential-thinking (Intermediate reasoning scratchpad)
 * 6. ask-question (Interactive prompt modals & mutex queue)
 * 7. gemini-web-search (Google grounded web search & citations)
 * 8. fetch-url (Web scraping, Readability, Chrome CDP & Turndown)
 *
 * Usage:
 *   node pi-agent/tests/run_all_tests.mjs              # Run all 8 suites
 *   node pi-agent/tests/run_all_tests.mjs --offline    # Skip live external network calls (<1.5s)
 *   node pi-agent/tests/run_all_tests.mjs ask          # Run matching suite(s) only
 *   node pi-agent/tests/run_all_tests.mjs gate search  # Run multiple matching suites
 */

import { runWriteDiffTests } from "./test_write_diff.mjs";
import { runPromptCleanerTests } from "./test_prompt_cleaner.mjs";
import { runPermissionsGateTests } from "./test_permissions_gate.mjs";
import { runSshTests } from "./test_ssh.mjs";
import { runSequentialThinkingTests } from "./test_sequential_thinking.mjs";
import { runAskQuestionTests } from "./test_ask_question.mjs";
import { runGeminiTests } from "./test_gemini_web_search.mjs";
import { runFetchUrlTests } from "./test_fetch_url.mjs";
import { ANSI, isOfflineMode } from "./test_harness.mjs";

const SUITES = [
  { name: "Write Diff (write-diff.ts)", runner: runWriteDiffTests },
  { name: "Prompt Cleaner (prompt-cleaner.ts)", runner: runPromptCleanerTests },
  { name: "Permissions Gate (permissions-gate.ts)", runner: runPermissionsGateTests },
  { name: "SSH Remote (ssh.ts)", runner: runSshTests },
  { name: "Sequential Thinking (sequential-thinking.ts)", runner: runSequentialThinkingTests },
  { name: "Ask Question (ask-question.ts)", runner: runAskQuestionTests },
  { name: "Gemini Web Search (gemini-web-search.ts)", runner: runGeminiTests },
  { name: "Fetch URL (fetch-url.ts)", runner: runFetchUrlTests }
];

async function main() {
  const offline = isOfflineMode();
  if (offline) {
    process.env.PI_TEST_OFFLINE = "1";
  }

  const filterArgs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const activeSuites = filterArgs.length > 0
    ? SUITES.filter((s) => filterArgs.some((f) => s.name.toLowerCase().includes(f.toLowerCase())))
    : SUITES;

  console.log(`\n${ANSI.bold}${ANSI.cyan}======================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}       Pi Coding Agent: Complete Extension Test Suite Runner          ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}======================================================================${ANSI.reset}`);

  if (offline) {
    console.log(`  ${ANSI.yellow}⚡ Mode: FAST OFFLINE (Skipping external network & live API calls)${ANSI.reset}`);
  }
  if (filterArgs.length > 0) {
    console.log(`  ${ANSI.cyan}🔍 Filter: ${filterArgs.join(", ")} (${activeSuites.length} of ${SUITES.length} suites selected)${ANSI.reset}`);
  }
  console.log();

  if (activeSuites.length === 0) {
    console.log(`${ANSI.red}No test suites matched filter: ${filterArgs.join(", ")}${ANSI.reset}\n`);
    process.exit(1);
  }

  const globalStart = Date.now();
  const summaryRows = [];
  let grandTotalPassed = 0;
  let grandTotalFailed = 0;
  const allFailures = [];

  for (const suite of activeSuites) {
    const start = Date.now();
    try {
      const results = await suite.runner();
      const duration = Date.now() - start;
      const passed = results.filter((r) => r.pass).length;
      const failed = results.filter((r) => !r.pass).length;
      grandTotalPassed += passed;
      grandTotalFailed += failed;

      for (const f of results.filter((r) => !r.pass)) {
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
