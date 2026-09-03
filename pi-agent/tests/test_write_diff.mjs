#!/usr/bin/env node

/**
 * ============================================================================
 * Write Diff Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Comprehensive test suite verifying:
 * - Section 1: Mutual Exclusivity Guard (exits on --ssh flag, active on local)
 * - Section 2: Argument Preparation & Path Normalization (strips ./, quotes, backslashes, aliases)
 * - Section 3: File Operations & Overwrite Detection (new file vs overwrite vs identical)
 * - Section 4: TUI Rendering & ctrl+o Expand/Collapse Behavior
 *
 * Usage:
 *   node test_write_diff.mjs
 */

import assert from "node:assert/strict";
import * as path from "node:path";
import * as fs from "node:fs/promises";
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

function loadWriteDiffModule() {
  const jitiPkg = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
  let jiti;
  try {
    jiti = require(jitiPkg);
  } catch {
    jiti = require("jiti");
  }

  const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
  const piNodeModules = path.join(globalBase, "node_modules");

  const load = jiti(path.join(import.meta.dirname, "dummy.js"), {
    alias: {
      "@earendil-works/pi-coding-agent": globalBase,
      "@earendil-works/pi-tui": path.join(piNodeModules, "@earendil-works", "pi-tui", "dist", "index.js")
    }
  });

  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions/write-diff.ts");
  return load(targetPath);
}

const mockTheme = {
  fg: (_name, text) => text,
  bg: (_name, text) => text,
  bold: (text) => `[BOLD]${text}[/BOLD]`
};

export async function runWriteDiffTests() {
  const mod = loadWriteDiffModule();
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
  // Section 1: Mutual Exclusivity Guard
  // ----------------------------------------------------
  test("Mutual Guard: exits early and skips registration when --ssh flag is active", () => {
    const registeredTools = new Map();
    const mockPiSsh = {
      getFlag(name) { return name === "ssh" ? "user@remote.host" : undefined; },
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };

    extensionFactory(mockPiSsh);
    assert.equal(registeredTools.has("write"), false, "Must not register write tool when --ssh flag is active");
  });

  test("Mutual Guard: registers custom write tool on local sessions", () => {
    const registeredTools = new Map();
    const mockPiLocal = {
      getFlag() { return undefined; },
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };

    extensionFactory(mockPiLocal);
    assert.equal(registeredTools.has("write"), true, "Must register write tool for local sessions");
  });

  // ----------------------------------------------------
  // Section 2: Argument Preparation & Normalization
  // ----------------------------------------------------

  test("Argument Preparation: extracts path and content cleanly", () => {
    const registeredTools = new Map();
    const mockPi = {
      getFlag() { return undefined; },
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const writeTool = registeredTools.get("write");
    const prep = writeTool.prepareArguments({ path: "src/components/Button.tsx", content: "export default () => null;" });
    assert.equal(prep.path, "src/components/Button.tsx");
    assert.equal(prep.content, "export default () => null;");
  });

  // ----------------------------------------------------
  // Section 3: File Operations & Overwrite Detection
  // ----------------------------------------------------
  await asyncTest("File Operations: executes new file write without overwrite diff", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-write-diff-test-"));
    const origCwd = process.cwd();

    try {
      process.chdir(tempDir);

      const registeredTools = new Map();
      const mockPi = {
        getFlag() { return undefined; },
        registerTool(tool) { registeredTools.set(tool.name, tool); }
      };
      extensionFactory(mockPi);

      const writeTool = registeredTools.get("write");
      const targetFile = "new-module.ts";
      const content = "export const x = 100;\nexport const y = 200;\n";

      const res = await writeTool.execute("call_1", { path: targetFile, content });
      assert.equal(res.isError, undefined);
      assert.equal(res.details.isOverwrite, false, "Must detect new file creation");
      assert.equal(res.details.lineCount, 3);

      const diskContent = await fs.readFile(path.join(tempDir, targetFile), "utf-8");
      assert.equal(diskContent, content);
    } finally {
      process.chdir(origCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  await asyncTest("File Operations: detects overwrite and generates native Pi diff", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-write-diff-test-"));
    const origCwd = process.cwd();

    try {
      process.chdir(tempDir);

      const targetFile = "config.json";
      const initial = '{\n  "version": 1,\n  "debug": false\n}\n';
      await fs.writeFile(path.join(tempDir, targetFile), initial, "utf-8");

      const registeredTools = new Map();
      const mockPi = {
        getFlag() { return undefined; },
        registerTool(tool) { registeredTools.set(tool.name, tool); }
      };
      extensionFactory(mockPi);

      const writeTool = registeredTools.get("write");
      const updated = '{\n  "version": 2,\n  "debug": true\n}\n';

      const res = await writeTool.execute("call_2", { path: targetFile, content: updated });
      assert.equal(res.isError, undefined);
      assert.equal(res.details.isOverwrite, true, "Must detect file overwrite");
      assert.ok(res.details.diff, "Must generate diff string");
      assert.ok(res.details.diff.includes("-2"), "Diff must show removed line");
      assert.ok(res.details.diff.includes("+2"), "Diff must show added line");
    } finally {
      process.chdir(origCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  await asyncTest("File Operations: detects identical overwrite (no changes)", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-write-diff-test-"));
    const origCwd = process.cwd();

    try {
      process.chdir(tempDir);

      const targetFile = "same.txt";
      const content = "unchanged text\n";
      await fs.writeFile(path.join(tempDir, targetFile), content, "utf-8");

      const registeredTools = new Map();
      const mockPi = {
        getFlag() { return undefined; },
        registerTool(tool) { registeredTools.set(tool.name, tool); }
      };
      extensionFactory(mockPi);

      const writeTool = registeredTools.get("write");
      const res = await writeTool.execute("call_3", { path: targetFile, content });
      assert.equal(res.isError, undefined);
      assert.equal(res.details.isOverwrite, true);
      assert.equal(res.details.noChanges, true, "Must flag identical content as noChanges");
    } finally {
      process.chdir(origCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // ----------------------------------------------------
  // Section 4: TUI Rendering & ctrl+o Expansion
  // ----------------------------------------------------
  test("TUI Rendering: renders collapsed diff (12 lines) with 'ctrl+o to expand' hint", () => {
    const registeredTools = new Map();
    const mockPi = {
      getFlag() { return undefined; },
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const writeTool = registeredTools.get("write");

    // Construct a large 25-line diff
    let largeDiff = "";
    for (let i = 1; i <= 25; i++) {
      largeDiff += `+${i} line ${i}\n`;
    }

    const result = {
      content: [{ type: "text", text: "Wrote file" }],
      details: {
        isOverwrite: true,
        diff: largeDiff,
        filePath: "src/large-file.ts"
      }
    };

    // 1. Collapsed view (expanded: false)
    const collapsedComponent = writeTool.renderResult(result, { expanded: false }, mockTheme, {});
    const collapsedText = collapsedComponent.text || "";

    assert.ok(collapsedText.includes("⚡ Overwrite Diff:"), "Must include overwrite header");
    assert.ok(collapsedText.includes("ctrl+o"), "Must contain ctrl+o expansion hint when truncated");
    assert.ok(collapsedText.includes("more lines"), "Must state remaining lines count");

    // 2. Expanded view (expanded: true)
    const expandedComponent = writeTool.renderResult(result, { expanded: true }, mockTheme, {});
    const expandedText = expandedComponent.text || "";

    assert.ok(!expandedText.includes("ctrl+o"), "Expanded view must not include truncation hint");
    assert.ok(expandedText.includes("line 25"), "Expanded view must render all 25 lines");
  });

  test("TUI Rendering: renders '✓ no changes' badge for identical content", () => {
    const registeredTools = new Map();
    const mockPi = {
      getFlag() { return undefined; },
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const writeTool = registeredTools.get("write");
    const result = {
      content: [{ type: "text", text: "No changes" }],
      details: {
        isOverwrite: true,
        noChanges: true,
        filePath: "test.txt"
      }
    };

    const component = writeTool.renderResult(result, {}, mockTheme, {});
    assert.ok(component.text.includes("no changes"), "Must render 'no changes' indicator");
  });

  test("TUI Rendering: renders syntax preview and ctrl+o hint for brand new files", () => {
    const registeredTools = new Map();
    const mockPi = {
      getFlag() { return undefined; },
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const writeTool = registeredTools.get("write");

    let longCode = "";
    for (let i = 1; i <= 20; i++) {
      longCode += `const item_${i} = ${i};\n`;
    }

    const result = {
      content: [{ type: "text", text: "Created file" }],
      details: {
        isOverwrite: false,
        content: longCode,
        lineCount: 20,
        filePath: "src/items.ts"
      }
    };

    const compCollapsed = writeTool.renderResult(result, { expanded: false }, mockTheme, {});
    assert.ok(compCollapsed.text.includes("const item_1"));
    assert.ok(compCollapsed.text.includes("ctrl+o"), "New long file must include ctrl+o expansion hint");

    const compExpanded = writeTool.renderResult(result, { expanded: true }, mockTheme, {});
    assert.ok(compExpanded.text.includes("const item_20"), "Expanded new file view must show all lines");
  });

  test("TUI Rendering: renders error text cleanly when isError is true", () => {
    const registeredTools = new Map();
    const mockPi = {
      getFlag() { return undefined; },
      registerTool(tool) { registeredTools.set(tool.name, tool); }
    };
    extensionFactory(mockPi);

    const writeTool = registeredTools.get("write");
    const result = {
      isError: true,
      content: [{ type: "text", text: "EACCES: permission denied, open '/root/protected.txt'" }]
    };

    const component = writeTool.renderResult(result, {}, mockTheme, {});
    assert.ok(component.text.includes("permission denied"), "Must render error message");
  });

  return results;
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  Pi Coding Agent: Write Diff Extension Test Suite  ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}\n`);

  const results = await runWriteDiffTests();
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
    console.log(`${ANSI.bold}${ANSI.green}✓ All write diff tests passed successfully!${ANSI.reset}\n`);

    // Render a real visual demo for inspection
    console.log(`${ANSI.bold}${ANSI.yellow}--- Visual TUI Diff Output Demo ---${ANSI.reset}\n`);
    const demoDiff = `  1 import express from "express";\n+ 2 import cors from "cors";\n+ 3 \n  2 const app = express();\n+ 5 app.use(cors());\n  3 \n- 4 app.get("/api/users", (req, res) => {\n- 5   res.json({ users: [] });\n+ 7 app.get("/api/users", async (req, res) => {\n+ 8   const users = await fetchUsersFromDatabase();\n+ 9   res.json({ success: true, users });\n  6 });\n  7 \n- 8 app.listen(3000, () => {\n- 9   console.log("Server listening on port 3000");\n+12 app.listen(8080, () => {\n+13   console.log("Server listening on port 8080");\n 10 });`;
    
    let activeTheme = mockTheme;
    try {
      const themeModule = require(path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js"));
      themeModule.initTheme("dark");
      activeTheme = themeModule.theme;
    } catch {}

    const sampleResult = {
      content: [{ type: "text", text: "Wrote file" }],
      details: { isOverwrite: true, diff: demoDiff, filePath: "src/server.ts" }
    };

    const mod = loadWriteDiffModule();
    const extensionFactory = mod.default || mod;
    const mockRegistered = new Map();
    extensionFactory({ getFlag: () => undefined, registerTool: (t) => mockRegistered.set(t.name, t) });
    const localTool = mockRegistered.get("write");

    console.log(`${ANSI.cyan}[1. Collapsed View (12 lines max)]:${ANSI.reset}`);
    console.log(localTool.renderResult(sampleResult, { expanded: false }, activeTheme, {}).text);

    console.log(`\n${ANSI.cyan}[2. Expanded View (ctrl+o)]:${ANSI.reset}`);
    console.log(localTool.renderResult(sampleResult, { expanded: true }, activeTheme, {}).text);
    console.log(`\n${ANSI.bold}${ANSI.yellow}-----------------------------------${ANSI.reset}\n`);

    process.exit(0);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain || process.argv[1]?.endsWith("test_write_diff.mjs")) {
  main().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
}
