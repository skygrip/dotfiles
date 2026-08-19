#!/usr/bin/env node

/**
 * ============================================================================
 * Critic Review Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Dedicated test suite for `critic-review.ts`:
 * - Section 1: Argument Normalizer (12B model property alias resolution)
 * - Section 2: Language & Syntax File Extension Mapping
 * - Section 3: Line Number Formatting & Slice Anchoring
 * - Section 4: Schema Validation (CriticReviewSchema)
 * - Section 5: End-to-End Tool Execution with Mock AI Streaming
 */

import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";
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

function loadCriticModule() {
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

  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions/critic-review.ts");
  return load(targetPath);
}

export async function runCriticTests() {
  const mod = loadCriticModule();
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
  const criticTool = registeredTools.get("critic_review");
  assert.ok(criticTool, "critic_review tool must be registered");

  // ----------------------------------------------------
  // Section 1: Argument Normalizer (12B Model Aliases)
  // ----------------------------------------------------
  test("Argument Normalizer: resolves filePath aliases (path, file, target)", () => {
    const fn = criticTool.prepareArguments;
    assert.equal(fn({ path: "src/main.ts" }).filePath, "src/main.ts");
    assert.equal(fn({ file: "src/utils.py" }).filePath, "src/utils.py");
    assert.equal(fn({ target: "Cargo.toml" }).filePath, "Cargo.toml");
  });

  test("Argument Normalizer: resolves draft aliases (code, content, snippet, text)", () => {
    const fn = criticTool.prepareArguments;
    assert.equal(fn({ code: "const x = 1;" }).draft, "const x = 1;");
    assert.equal(fn({ content: "def foo(): pass" }).draft, "def foo(): pass");
    assert.equal(fn({ snippet: "fn bar() {}" }).draft, "fn bar() {}");
    assert.equal(fn({ text: "let y = 2;" }).draft, "let y = 2;");
  });

  // ----------------------------------------------------
  // Section 2: Schema & Parameter Constraints
  // ----------------------------------------------------
  test("Schema Definition: critic_review parameters schema", () => {
    assert.equal(criticTool.name, "critic_review");
    assert.ok(criticTool.parameters, "Must provide parameters schema");
    assert.ok(criticTool.description.length > 0);
  });

  // ----------------------------------------------------
  // Section 3: End-to-End Tool Execution with Mock AI
  // ----------------------------------------------------
  await asyncTest("Execution: error on missing draft and filePath", async () => {
    const mockCtx = {
      hasUI: false,
      model: { id: "test-model", provider: "mock" }
    };

    const res = await criticTool.execute("call_err_1", {}, undefined, undefined, mockCtx);
    assert.ok(res.content?.[0]?.text?.includes("Must provide either 'draft' or 'filePath'"));
    assert.equal(res.details?.error, "Missing draft or filePath");
  });

  await asyncTest("Execution: audits inline draft in headless mode", async () => {
    const mockCtx = {
      hasUI: false,
      model: { id: "test-model", provider: "mock" },
      modelRegistry: {
        async getApiKeyAndHeaders() { return { apiKey: "mock-key", headers: {} }; }
      }
    };

    const res = await criticTool.execute(
      "call_draft_1",
      {
        draft: "function add(a, b) {\n  return a + b;\n}",
        language: "javascript",
        rules: ["Must use strict TypeScript types"]
      },
      undefined,
      undefined,
      mockCtx
    );

    assert.ok(res.content?.[0]?.text, "Must return text response");
  });

  await asyncTest("Execution: audits file slice with line range", async () => {
    // Create temporary test file
    const tmpFile = path.join(os.tmpdir(), `test_critic_${Date.now()}.ts`);
    const fileContent = "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\n";
    await fs.writeFile(tmpFile, fileContent, "utf8");

    try {
      const mockCtx = {
        hasUI: false,
        model: { id: "test-model", provider: "mock" },
        modelRegistry: {
          async getApiKeyAndHeaders() { return { apiKey: "mock-key", headers: {} }; }
        }
      };

      const res = await criticTool.execute(
        "call_file_1",
        {
          filePath: tmpFile,
          startLine: 3,
          endLine: 6
        },
        undefined,
        undefined,
        mockCtx
      );

      assert.ok(res.content?.[0]?.text, "Must return review response");
    } finally {
      try { await fs.unlink(tmpFile); } catch {}
    }
  });

  await asyncTest("Execution: handles aborted signal cleanly", async () => {
    const controller = new AbortController();
    controller.abort();

    const mockCtx = { hasUI: false };
    const res = await criticTool.execute("call_aborted", { draft: "code" }, controller.signal, undefined, mockCtx);
    assert.ok(res.content?.[0]?.text?.includes("Aborted"));
  });

  return results;
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  Pi Coding Agent: Critic Review Test Suite         ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}\n`);

  const results = await runCriticTests();
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
    console.log(`${ANSI.bold}${ANSI.green}✓ All critic review tests passed successfully!${ANSI.reset}\n`);
    process.exit(0);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain || process.argv[1]?.endsWith("test_critic_review.mjs")) {
  main().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
}
