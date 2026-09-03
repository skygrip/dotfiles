#!/usr/bin/env node

/**
 * ============================================================================
 * Ask Question Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Dedicated test suite for `ask-question.ts`:
 * - Section 1: Schema & Parameter Validation (Streamlined question + options)
 * - Section 2: Argument Normalizer (Question aliases & options aliases)
 * - Section 3: Option Normalization & Number Stripping ("1. Option" -> "Option")
 * - Section 4: Headless Mode Fallback
 * - Section 5: Interactive UI Modes (options menu vs open-ended input)
 * - Section 6: Timeout & AbortSignal Handling
 */

import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m"
};

function loadAskModule() {
  const globalNodeModules = path.join(process.env.APPDATA || "", "npm", "node_modules");
  const piCodingAgentDir = path.join(globalNodeModules, "@earendil-works", "pi-coding-agent");
  const piNodeModules = path.join(piCodingAgentDir, "node_modules");
  const localNpm = path.join(os.homedir(), ".pi", "agent", "npm", "node_modules");

  const jitiRequire = createRequire(path.join(piCodingAgentDir, "dist", "index.js"));
  const createJiti = jitiRequire("jiti");

  const load = createJiti(path.join(piCodingAgentDir, "dist", "index.js"), {
    alias: {
      "@earendil-works/pi-coding-agent": piCodingAgentDir,
      "@earendil-works/pi-ai": path.join(piNodeModules, "@earendil-works", "pi-ai", "dist", "index.js"),
      "@earendil-works/pi-tui": path.join(piNodeModules, "@earendil-works", "pi-tui", "dist", "index.js"),
      "typebox/compile": path.join(localNpm, "typebox", "build", "compile", "index.mjs"),
      "typebox/value": path.join(localNpm, "typebox", "build", "value", "index.mjs"),
      "typebox/guard": path.join(localNpm, "typebox", "build", "guard", "index.mjs"),
      "typebox/error": path.join(localNpm, "typebox", "build", "error", "index.mjs"),
      "typebox/system": path.join(localNpm, "typebox", "build", "system", "index.mjs"),
      "typebox/format": path.join(localNpm, "typebox", "build", "format", "index.mjs"),
      "typebox/type": path.join(localNpm, "typebox", "build", "type", "index.mjs"),
      "typebox/schema": path.join(localNpm, "typebox", "build", "schema", "index.mjs"),
      "typebox": path.join(localNpm, "typebox", "build", "index.mjs")
    }
  });

  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions/ask-question.ts");
  return load(targetPath);
}

export async function runAskQuestionTests() {
  const mod = loadAskModule();
  const extensionFactory = mod.default || mod;

  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  // Register tool with mock Pi harness
  const registeredTools = new Map();
  const mockPi = {
    registerTool(tool) {
      registeredTools.set(tool.name, tool);
    },
    registerCommand() {},
    registerFlag() {},
    on() {},
    getFlag() { return false; }
  };

  extensionFactory(mockPi);
  const askTool = registeredTools.get("ask_question");
  assert.ok(askTool, "ask_question tool must be registered");

  // ----------------------------------------------------
  // Section 1: Schema & Parameter Validation
  // ----------------------------------------------------
  test("Schema: streamlined schema exposes question and options only", () => {
    assert.ok(askTool.parameters?.properties?.question, "question property must be present");
    assert.ok(askTool.parameters?.properties?.options, "options property must be present");
    assert.equal(askTool.parameters?.properties?.type, undefined, "type enum must not be exposed");
    assert.equal(askTool.parameters?.properties?.timeoutMs, undefined, "timeoutMs must not be in tool schema");
    assert.ok(typeof mod.DEFAULT_TIMEOUT_MS === "number" && mod.DEFAULT_TIMEOUT_MS > 0, "DEFAULT_TIMEOUT_MS must be a positive number");
  });

  test("Argument Normalizer: resolves question aliases (prompt, message, query, title)", () => {
    const fn = askTool.prepareArguments;
    assert.equal(fn({ prompt: "Proceed?" }).question, "Proceed?");
    assert.equal(fn({ message: "Choose target" }).question, "Choose target");
    assert.equal(fn({ query: "Which engine?" }).question, "Which engine?");
    assert.equal(fn({ title: "Confirm delete" }).question, "Confirm delete");
  });

  test("Argument Normalizer: resolves options aliases (choices, items, variants)", () => {
    const fn = askTool.prepareArguments;
    assert.deepEqual(fn({ choices: ["A", "B"] }).options, ["A", "B"]);
    assert.deepEqual(fn({ items: ["1. X", "2. Y"] }).options, ["X", "Y"]);
    assert.deepEqual(fn({ variants: ["Alpha", "Beta"] }).options, ["Alpha", "Beta"]);
  });

  // ----------------------------------------------------
  // Section 2: Option Sanitization & Number Stripping
  // ----------------------------------------------------
  test("Option Normalizer: strips leading numbers and bullet points", () => {
    const fn = askTool.prepareArguments;
    const res = fn({
      options: [
        "1. Option Alpha",
        "2) Option Beta",
        "* Option Gamma",
        "- Option Delta",
        "• Option Epsilon"
      ]
    });
    assert.deepEqual(res.options, [
      "Option Alpha",
      "Option Beta",
      "Option Gamma",
      "Option Delta",
      "Option Epsilon"
    ]);
  });

  test("Option Normalizer: parses object lists and extracts label/name/value", () => {
    const fn = askTool.prepareArguments;
    const res = fn({
      options: [{ label: "Choice One" }, { name: "Choice Two" }, { value: "Choice Three" }]
    });
    assert.deepEqual(res.options, ["Choice One", "Choice Two", "Choice Three"]);
  });

  test("Option Normalizer: extracts options from prompt string with numbered items", () => {
    const fn = askTool.prepareArguments;
    const res = fn({
      question: "Which database should we use?\n1. PostgreSQL\n2. DuckDB\n3. SQLite"
    });
    assert.deepEqual(res.options, ["PostgreSQL", "DuckDB", "SQLite"]);
  });

  // ----------------------------------------------------
  // Section 3: Interactive UI Modes & Non-Selection Errors
  // ----------------------------------------------------
  await asyncTest("Mode 1 (Multi-Choice): passes 2+ options to ctx.ui.select and records answer", async () => {
    const mockCtx = {
      hasUI: true,
      ui: {
        async select(title, choices) {
          return choices[1]; // User picks DuckDB
        }
      }
    };

    const res = await askTool.execute(
      "call_m1",
      { question: "Choose database", options: ["PostgreSQL", "DuckDB"] },
      undefined,
      undefined,
      mockCtx
    );
    assert.equal(res.details?.answer, "DuckDB");
    assert.ok(res.content?.[0]?.text?.includes('User selected: "DuckDB"'));
  });

  await asyncTest("Mode 2 (Binary Decision): omitting options defaults to ['Yes', 'No'] in ctx.ui.select", async () => {
    let receivedChoices = [];
    const mockCtx = {
      hasUI: true,
      ui: {
        async select(title, choices) {
          receivedChoices = choices;
          return choices[0]; // User picks Yes
        }
      }
    };

    const res = await askTool.execute(
      "call_m2",
      { question: "Confirm deploy to production?" },
      undefined,
      undefined,
      mockCtx
    );
    assert.deepEqual(receivedChoices, ["Yes", "No"]);
    assert.equal(res.details?.answer, "Yes");
    assert.ok(res.content?.[0]?.text?.includes('User selected: "Yes"'));
  });

  await asyncTest("Non-Selection Unified Error: dismissal, timeout, and headless all return Error: No selection made", async () => {
    // 1. Headless environment
    const headlessRes = await askTool.execute("call_h", { question: "Q?" }, undefined, undefined, { hasUI: false });
    assert.equal(headlessRes.content?.[0]?.text, "Error: No selection made.");
    assert.equal(headlessRes.details?.error, "No selection made");
    assert.equal(headlessRes.details?.cancelled, true);

    // 2. User dismissal (Escape / Cancel)
    const dismissCtx = { hasUI: true, ui: { async select() { return undefined; } } };
    const dismissRes = await askTool.execute("call_d", { question: "Q?", options: ["A", "B"] }, undefined, undefined, dismissCtx);
    assert.equal(dismissRes.content?.[0]?.text, "Error: No selection made.");
    assert.equal(dismissRes.details?.error, "No selection made");
    assert.equal(dismissRes.details?.cancelled, true);

    // 3. Aborted / Timeout signal
    const abortCtrl = new AbortController();
    abortCtrl.abort();
    const abortCtx = { hasUI: true, ui: { async select() { return "A"; } } };
    const abortRes = await askTool.execute("call_a", { question: "Q?" }, abortCtrl.signal, undefined, abortCtx);
    assert.equal(abortRes.content?.[0]?.text, "Error: No selection made.");
    assert.equal(abortRes.details?.error, "No selection made");
  });

  test("TUI Component Rendering: renderCall header and renderResult badges", () => {
    const mockTheme = {
      fg: (_color, str) => str,
      bold: (str) => `[BOLD]${str}[/BOLD]`
    };

    // 1. renderCall preview
    const callComponent = askTool.renderCall(
      { question: "Select target", options: ["Alpha", "Beta"] },
      mockTheme,
      {}
    );
    assert.ok(callComponent, "renderCall must return a component");

    // 2. renderResult - Answered
    const answeredResult = askTool.renderResult(
      { details: { answer: "Alpha", cancelled: false } },
      {},
      mockTheme,
      {}
    );
    assert.ok(answeredResult, "renderResult answered must return a component");

    // 3. renderResult - No selection made error
    const errorResult = askTool.renderResult(
      { details: { cancelled: true, error: "No selection made" } },
      {},
      mockTheme,
      {}
    );
    assert.ok(errorResult, "renderResult error must return a component");
  });

  return results;
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  Pi Coding Agent: Ask Question Test Suite          ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}\n`);

  const results = await runAskQuestionTests();
  const durationMs = Date.now() - startTime;

  let totalPassed = 0;
  let totalFailed = 0;
  const failures = [];

  for (const r of results) {
    if (r.pass) {
      totalPassed++;
      console.log(`  ${ANSI.green}✓${ANSI.reset} ${r.name}`);
    } else {
      totalFailed++;
      failures.push(r);
      console.log(`  ${ANSI.red}✗${ANSI.reset} ${r.name}`);
      console.log(`    ${ANSI.red}${r.error?.message || r.error}${ANSI.reset}`);
    }
  }

  console.log(`\n${ANSI.bold}${ANSI.cyan}----------------------------------------------------${ANSI.reset}`);
  console.log(`${ANSI.bold}Test Summary:${ANSI.reset}`);
  console.log(`  Passed: ${ANSI.green}${totalPassed}${ANSI.reset}`);
  console.log(`  Failed: ${totalFailed > 0 ? ANSI.red : ANSI.dim}${totalFailed}${ANSI.reset}`);
  console.log(`  Duration: ${(durationMs / 1000).toFixed(2)}s\n`);

  if (failures.length > 0) {
    process.exit(1);
  } else {
    console.log(`${ANSI.bold}${ANSI.green}✓ All ask question tests passed successfully!${ANSI.reset}\n`);
    process.exit(0);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain || process.argv[1]?.endsWith("test_ask_question.mjs")) {
  main().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
}
