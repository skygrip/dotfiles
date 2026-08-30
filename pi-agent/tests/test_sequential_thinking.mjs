#!/usr/bin/env node

/**
 * ============================================================================
 * Sequential Thinking Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Test suite verifying:
 * - Section 1: Schema & Registration
 * - Section 2: Argument Pass-Through ({ thought: string })
 * - Section 3: Tool Execution & Confirmation Response
 * - Section 4: TUI Rendering & ctrl+o Expansion Support
 *
 * Usage:
 *   node test_sequential_thinking.mjs
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

function loadSequentialThinkingModule() {
  const jitiPkg = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
  let jiti;
  try {
    jiti = require(jitiPkg);
  } catch {
    jiti = require("jiti");
  }

  const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
  const piNodeModules = path.join(globalBase, "node_modules");

  const localNpmNodeModules = path.join(os.homedir(), ".pi/agent/npm/node_modules");

  const load = jiti(path.join(import.meta.dirname, "dummy.js"), {
    alias: {
      "@earendil-works/pi-coding-agent": globalBase,
      "@earendil-works/pi-tui": path.join(piNodeModules, "@earendil-works", "pi-tui", "dist", "index.js"),
      "typebox": path.join(localNpmNodeModules, "typebox", "build", "index.mjs"),
      "typebox/type": path.join(localNpmNodeModules, "typebox", "build", "type", "index.mjs")
    }
  });

  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions/sequential-thinking.ts");
  return load(targetPath);
}

const mockTheme = {
  fg: (_name, text) => text,
  bg: (_name, text) => text,
  bold: (text) => `[BOLD]${text}[/BOLD]`
};

export async function runSequentialThinkingTests() {
  const mod = loadSequentialThinkingModule();
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

  // ----------------------------------------------------
  // Section 1: Schema & Registration
  // ----------------------------------------------------
  test("Registration: registers sequential_thinking tool on Pi harness", () => {
    const registeredTools = new Map();
    const mockPi = {
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };

    extensionFactory(mockPi);
    const tool = registeredTools.get("sequential_thinking");
    assert.ok(tool, "Tool sequential_thinking must be registered");
    assert.equal(tool.name, "sequential_thinking");
    assert.ok(tool.parameters, "Must have parameters schema");
    assert.ok(tool.parameters.properties.thought, "Schema must require 'thought' field");
  });

  // ----------------------------------------------------
  // ----------------------------------------------------
  // Section 2: Argument Pass-Through
  // ----------------------------------------------------
  test("Argument Pass-Through: cleanly passes thought parameter", () => {
    const registeredTools = new Map();
    const mockPi = {
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const tool = registeredTools.get("sequential_thinking");
    const prep = tool.prepareArguments({ thought: "1. Analyze root cause" });
    assert.equal(prep.thought, "1. Analyze root cause");

    const emptyPrep = tool.prepareArguments({});
    assert.equal(emptyPrep.thought, "");
  });

  test("Argument Robustness: handles non-object and edge case inputs", () => {
    const registeredTools = new Map();
    const mockPi = {
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const tool = registeredTools.get("sequential_thinking");
    assert.deepEqual(tool.prepareArguments(null), null);
    assert.deepEqual(tool.prepareArguments(undefined), undefined);
    assert.equal(tool.prepareArguments("just a string"), "just a string");
    assert.equal(tool.prepareArguments({ thought: 12345 }).thought, "");
  });

  // ----------------------------------------------------
  // Section 3: Tool Execution
  // ----------------------------------------------------
  await asyncTest("Execution: returns thought confirmation", async () => {
    const registeredTools = new Map();
    const mockPi = {
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const tool = registeredTools.get("sequential_thinking");
    const res = await tool.execute("call_st_1", { thought: "Decomposing problem into 3 phases..." });

    assert.ok(res.content?.[0]?.text?.includes("Thought logged successfully"));
    assert.equal(res.details?.thought, "Decomposing problem into 3 phases...");
  });

  await asyncTest("Execution: handles multi-turn sequential thoughts cleanly", async () => {
    const registeredTools = new Map();
    const mockPi = {
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const tool = registeredTools.get("sequential_thinking");
    const steps = [
      "Phase 1: Survey dependencies",
      "Phase 2: Refactor AST walker",
      "Phase 3: Run integration tests"
    ];

    for (let i = 0; i < steps.length; i++) {
      const res = await tool.execute(`call_st_${i}`, { thought: steps[i] });
      assert.equal(res.details?.thought, steps[i]);
      assert.ok(res.content?.[0]?.text?.includes("Thought logged successfully"));
    }
  });

  // ----------------------------------------------------
  // Section 4: TUI Rendering & ctrl+o Expansion
  // ----------------------------------------------------
  test("TUI Rendering: renders collapsed thought (10 lines) with ctrl+o hint", () => {
    const registeredTools = new Map();
    const mockPi = {
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const tool = registeredTools.get("sequential_thinking");

    let longThought = "";
    for (let i = 1; i <= 20; i++) {
      longThought += `Step ${i}: verifying component state\n`;
    }

    // 1. Collapsed view
    const compCollapsed = tool.renderCall({ thought: longThought }, mockTheme, { expanded: false });
    assert.ok(compCollapsed.text.includes("Step 1"));
    assert.ok(compCollapsed.text.includes("ctrl+o"), "Must show ctrl+o expansion hint");

    // 2. Expanded view
    const compExpanded = tool.renderCall({ thought: longThought }, mockTheme, { expanded: true });
    assert.ok(!compExpanded.text.includes("ctrl+o"), "Expanded view must not show expansion hint");
    assert.ok(compExpanded.text.includes("Step 20"), "Must render full thought");
  });

  return results;
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  Pi Coding Agent: Sequential Thinking Test Suite  ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}\n`);

  const results = await runSequentialThinkingTests();
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
    console.log(`${ANSI.bold}${ANSI.green}✓ All sequential thinking tests passed successfully!${ANSI.reset}\n`);
    process.exit(0);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain || process.argv[1]?.endsWith("test_sequential_thinking.mjs")) {
  main().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
}
