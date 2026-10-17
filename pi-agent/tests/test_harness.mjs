import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m"
};

export function isOfflineMode() {
  return process.env.PI_TEST_OFFLINE === "1" ||
    process.argv.includes("--offline") ||
    process.argv.includes("--fast");
}

let cachedJiti = null;

export function getJitiLoader() {
  if (cachedJiti) return cachedJiti;

  const globalBase = path.join(process.env.APPDATA || "", "npm", "node_modules", "@earendil-works", "pi-coding-agent");
  const piNodeModules = path.join(globalBase, "node_modules");
  const localNpmNodeModules = path.join(os.homedir(), ".pi", "agent", "npm", "node_modules");
  const typeboxBase = fs.existsSync(path.join(piNodeModules, "typebox")) ? piNodeModules : localNpmNodeModules;

  let jitiRequire;
  try {
    jitiRequire = createRequire(path.join(globalBase, "dist", "index.js"));
  } catch {
    jitiRequire = require;
  }

  let createJiti;
  try {
    createJiti = jitiRequire("jiti");
  } catch {
    createJiti = require("jiti");
  }

  const aliases = {
    "@earendil-works/pi-coding-agent": globalBase,
    "@earendil-works/pi-tui": path.join(piNodeModules, "@earendil-works", "pi-tui", "dist", "index.js"),
    "typebox": path.join(typeboxBase, "typebox", "build", "index.mjs"),
    "typebox/type": path.join(typeboxBase, "typebox", "build", "type", "index.mjs"),
    "typebox/compile": path.join(typeboxBase, "typebox", "build", "compile", "index.mjs"),
    "typebox/value": path.join(typeboxBase, "typebox", "build", "value", "index.mjs"),
    "typebox/guard": path.join(typeboxBase, "typebox", "build", "guard", "index.mjs"),
    "typebox/error": path.join(typeboxBase, "typebox", "build", "error", "index.mjs"),
    "typebox/system": path.join(typeboxBase, "typebox", "build", "system", "index.mjs"),
    "typebox/format": path.join(typeboxBase, "typebox", "build", "format", "index.mjs"),
    "typebox/schema": path.join(typeboxBase, "typebox", "build", "schema", "index.mjs"),
    "@mozilla/readability": path.join(localNpmNodeModules, "@mozilla/readability", "index.js"),
    "linkedom": path.join(localNpmNodeModules, "linkedom", "cjs", "index.js"),
    "turndown": path.join(localNpmNodeModules, "turndown", "lib", "turndown.cjs.js"),
    "got-scraping": path.join(localNpmNodeModules, "got-scraping", "dist", "index.js"),
    "playwright-core": path.join(localNpmNodeModules, "playwright-core", "index.js")
  };

  cachedJiti = createJiti(path.join(import.meta.dirname, "dummy.js"), { alias: aliases });
  return cachedJiti;
}

export function loadExtension(extensionFileName) {
  const loader = getJitiLoader();
  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions", extensionFileName);
  return loader(targetPath);
}

export function createMockTheme() {
  return {
    fg: (_color, text) => text,
    bg: (_color, text) => text,
    bold: (text) => `[BOLD]${text}[/BOLD]`
  };
}

export function createTestRecorder(suiteTitle) {
  const results = [];

  function test(name, fn) {
    try {
      const res = fn();
      if (res && typeof res.then === "function") {
        throw new Error(`Test "${name}" returned a promise; use asyncTest instead`);
      }
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

  function printSummary(startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;

    console.log(`\n----------------------------------------------------`);
    console.log(`Test Summary:`);
    console.log(`  Passed: ${ANSI.green}${passed}${ANSI.reset}`);
    console.log(`  Failed: ${failed > 0 ? ANSI.red : ANSI.dim}${failed}${ANSI.reset}`);
    console.log(`  Duration: ${duration}s\n`);

    if (failed > 0) {
      console.log(`${ANSI.red}Failures:${ANSI.reset}`);
      for (const f of results.filter(r => !r.pass)) {
        console.log(`  ✗ ${f.name}: ${f.error?.message || f.error}`);
      }
    } else {
      console.log(`${ANSI.green}✓ All ${suiteTitle} tests passed successfully!${ANSI.reset}\n`);
    }

    return results;
  }

  return { test, asyncTest, results, printSummary };
}
