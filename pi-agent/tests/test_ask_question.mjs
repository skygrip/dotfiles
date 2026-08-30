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
  // Section 3: Headless Mode Fallbacks
  // ----------------------------------------------------
  await asyncTest("Headless Mode: returns fallback choice or text", async () => {
    const headlessCtx = { hasUI: false };
    const res = await askTool.execute(
      "call_1",
      { question: "Proceed?", options: ["Yes", "No"] },
      undefined,
      undefined,
      headlessCtx
    );
    assert.ok(res.content?.[0]?.text?.includes("[Headless Mode Fallback]: Yes"));
    assert.equal(res.details?.headless, true);
    assert.equal(res.details?.answer, "Yes");
  });

  // ----------------------------------------------------
  // Section 4: Interactive UI Dialogs (select, confirm, input)
  // ----------------------------------------------------
  await asyncTest("Interactive Mode: options triggers ctx.ui.select", async () => {
    const mockCtx = {
      hasUI: true,
      ui: {
        async select(title, choices) {
          return choices[1]; // User picks second option (DuckDB)
        }
      }
    };

    const res = await askTool.execute(
      "call_interactive_1",
      { question: "Choose database", options: ["PostgreSQL", "DuckDB"] },
      undefined,
      undefined,
      mockCtx
    );
    assert.equal(res.details?.answer, "DuckDB");
    assert.ok(res.content?.[0]?.text?.includes('User selected: "DuckDB"'));
  });

  await asyncTest("Interactive Mode: confirmation prompt triggers ctx.ui.confirm", async () => {
    const mockCtx = {
      hasUI: true,
      ui: {
        async confirm(title, msg) {
          return true; // User confirms Yes
        }
      }
    };

    const res = await askTool.execute(
      "call_interactive_2",
      { question: "Confirm deploy to production?" },
      undefined,
      undefined,
      mockCtx
    );
    assert.equal(res.details?.answer, "Yes");
    assert.ok(res.content?.[0]?.text?.includes('User selected: "Yes"'));
  });

  await asyncTest("Interactive Mode: open-ended question triggers ctx.ui.input", async () => {
    const mockCtx = {
      hasUI: true,
      ui: {
        async input(title, placeholder) {
          return "my-token-123";
        }
      }
    };

    const res = await askTool.execute(
      "call_interactive_3",
      { question: "Enter API key" },
      undefined,
      undefined,
      mockCtx
    );
    assert.equal(res.details?.answer, "my-token-123");
    assert.ok(res.content?.[0]?.text?.includes('User response: "my-token-123"'));
  });

  // ----------------------------------------------------
  // Section 5: Timeout, Dismissal & AbortSignal Handling
  // ----------------------------------------------------
  await asyncTest("Cancellation: handles user modal dismissal (Escape/Cancel)", async () => {
    const mockCtx = {
      hasUI: true,
      ui: {
        async select() {
          return undefined; // User presses Escape or cancels modal
        }
      }
    };

    const res = await askTool.execute(
      "call_dismiss",
      { question: "Choose deployment strategy", options: ["Canary", "Blue-Green"] },
      undefined,
      undefined,
      mockCtx
    );
    assert.equal(res.details?.cancelled, true);
    assert.ok(res.content?.[0]?.text?.includes("User Cancelled Prompt"));
  });

  test("Validation: prepareArguments provides fallback when question is empty", () => {
    const prepNoQ = askTool.prepareArguments({});
    assert.equal(prepNoQ.question, "Please provide input:");

    const prepWithOptions = askTool.prepareArguments({ options: ["Alpha", "Beta"] });
    assert.equal(prepWithOptions.question, "Select an option:");
  });

  await asyncTest("Cancellation: handles AbortSignal correctly", async () => {
    const controller = new AbortController();
    controller.abort();

    const mockCtx = {
      hasUI: true,
      ui: {
        custom() { return new Promise(() => {}); }
      }
    };

    const res = await askTool.execute(
      "call_abort",
      { question: "Input?" },
      controller.signal,
      undefined,
      mockCtx
    );
    assert.ok(res.details?.cancelled || res.content?.[0]?.text?.includes("Cancelled"));
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
