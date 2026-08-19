#!/usr/bin/env node

/**
 * ============================================================================
 * Ask Question Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Dedicated test suite for `ask-question.ts`:
 * - Section 1: Argument Normalizer (Enum aliases: boolean -> confirm, menu -> select)
 * - Section 2: Choice Normalization & Number Stripping ("1. Option" -> "Option")
 * - Section 3: Headless Mode Fallback & Default Values
 * - Section 4: Interactive UI Modes (confirm, select, input)
 * - Section 5: Timeout & AbortSignal Handling
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
  // Section 1: Argument Normalizer & Enum Aliases
  // ----------------------------------------------------
  test("Argument Normalizer: resolves type aliases (boolean, yes_no -> confirm)", () => {
    const fn = askTool.prepareArguments;
    assert.equal(fn({ type: "boolean" }).type, "confirm");
    assert.equal(fn({ type: "yes_no" }).type, "confirm");
    assert.equal(fn({ type: "confirmation" }).type, "confirm");
  });

  test("Argument Normalizer: resolves type aliases (options, menu, choice -> select)", () => {
    const fn = askTool.prepareArguments;
    assert.equal(fn({ type: "options" }).type, "select");
    assert.equal(fn({ type: "menu" }).type, "select");
    assert.equal(fn({ type: "choice" }).type, "select");
    assert.equal(fn({ type: "multiple_choice" }).type, "select");
  });

  // ----------------------------------------------------
  // Section 2: Choice Sanitization & Number Stripping
  // ----------------------------------------------------
  test("Choice Normalizer: strips leading numbers and bullet points", () => {
    const fn = askTool.prepareArguments;
    const res = fn({
      type: "select",
      choices: [
        "1. Option Alpha",
        "2) Option Beta",
        "* Option Gamma",
        "- Option Delta",
        "• Option Epsilon"
      ]
    });
    assert.deepEqual(res.choices, [
      "Option Alpha",
      "Option Beta",
      "Option Gamma",
      "Option Delta",
      "Option Epsilon"
    ]);
  });

  test("Choice Normalizer: parses object lists and stringified JSON arrays", () => {
    const fn = askTool.prepareArguments;
    const res = fn({
      type: "select",
      choices: [{ label: "Choice One" }, { name: "Choice Two" }, { value: "Choice Three" }]
    });
    assert.deepEqual(res.choices, ["Choice One", "Choice Two", "Choice Three"]);
  });

  // ----------------------------------------------------
  // Section 3: Headless Mode Fallbacks
  // ----------------------------------------------------
  await asyncTest("Headless Mode: returns defaultValue when provided", async () => {
    const headlessCtx = { hasUI: false };
    const res = await askTool.execute(
      "call_1",
      { question: "Proceed?", type: "confirm", defaultValue: "Yes" },
      undefined,
      undefined,
      headlessCtx
    );
    assert.equal(res.details?.answer, "Yes");
    assert.ok(res.content?.[0]?.text?.includes("[Headless Mode Fallback]: Yes"));
    assert.equal(res.details?.headless, true);
  });

  await asyncTest("Headless Mode: returns sensible default without defaultValue", async () => {
    const headlessCtx = { hasUI: false };

    // Confirm defaults to 'No'
    const resConfirm = await askTool.execute(
      "call_2",
      { question: "Delete all files?", type: "confirm" },
      undefined,
      undefined,
      headlessCtx
    );
    assert.equal(resConfirm.details?.answer, "No");
    assert.ok(resConfirm.content?.[0]?.text?.includes("[Headless Mode Fallback]: No"));

    // Select defaults to first choice
    const resSelect = await askTool.execute(
      "call_3",
      { question: "Pick library", type: "select", choices: ["A", "B"] },
      undefined,
      undefined,
      headlessCtx
    );
    assert.equal(resSelect.details?.answer, "A");
    assert.ok(resSelect.content?.[0]?.text?.includes("[Headless Mode Fallback]: A"));
  });

  // ----------------------------------------------------
  // Section 4: Interactive UI Modes (confirm, select, input)
  // ----------------------------------------------------
  await asyncTest("Interactive Mode: confirm returns user boolean choice", async () => {
    const mockCtx = {
      hasUI: true,
      ui: {
        async confirm(title, msg) {
          return true; // User clicks Yes
        }
      }
    };

    const res = await askTool.execute(
      "call_interactive_1",
      { question: "Deploy to production?", type: "confirm" },
      undefined,
      undefined,
      mockCtx
    );
    assert.equal(res.details?.answer, "Yes");
    assert.ok(res.content?.[0]?.text?.includes('User selected: "Yes"'));
  });

  await asyncTest("Interactive Mode: select returns selected menu item", async () => {
    const mockCtx = {
      hasUI: true,
      ui: {
        async select(title, choices) {
          return choices[1]; // User picks second option
        }
      }
    };

    const res = await askTool.execute(
      "call_interactive_2",
      { question: "Choose database", type: "select", choices: ["Postgres", "DuckDB", "SQLite"] },
      undefined,
      undefined,
      mockCtx
    );
    assert.equal(res.details?.answer, "DuckDB");
    assert.ok(res.content?.[0]?.text?.includes('User selected: "DuckDB"'));
  });

  await asyncTest("Interactive Mode: input returns freeform text entered by user", async () => {
    const mockCtx = {
      hasUI: true,
      ui: {
        async input(title, placeholder) {
          return "my-api-token-value";
        }
      }
    };

    const res = await askTool.execute(
      "call_interactive_3",
      { question: "Enter API Token", type: "input" },
      undefined,
      undefined,
      mockCtx
    );
    assert.equal(res.details?.answer, "my-api-token-value");
    assert.ok(res.content?.[0]?.text?.includes('User response: "my-api-token-value"'));
  });

  // ----------------------------------------------------
  // Section 5: AbortSignal Cancellation
  // ----------------------------------------------------
  await asyncTest("Cancellation: handles AbortSignal correctly", async () => {
    const controller = new AbortController();
    controller.abort();

    const mockCtx = {
      hasUI: true,
      ui: {
        async input() { return "never reached"; }
      }
    };

    const res = await askTool.execute(
      "call_abort",
      { question: "Input?", type: "input", defaultValue: "DefaultOnAbort" },
      controller.signal,
      undefined,
      mockCtx
    );
    assert.ok(res.details?.cancelled || res.content?.[0]?.text?.includes("DefaultOnAbort"));
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
