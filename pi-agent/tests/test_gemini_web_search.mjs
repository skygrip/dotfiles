import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadGeminiModule() {
  const jitiPkg = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
  const jiti = require(jitiPkg);
  const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
  const localNpmNodeModules = path.join(os.homedir(), ".pi/agent/npm/node_modules");

  const load = jiti(path.join(import.meta.dirname, "dummy.js"), {
    alias: {
      "@earendil-works/pi-coding-agent": globalBase,
      "@earendil-works/pi-tui": path.join(globalBase, "node_modules/@earendil-works/pi-tui/dist/index.js"),
      "typebox": path.join(localNpmNodeModules, "typebox/build/index.mjs"),
      "@mozilla/readability": path.join(localNpmNodeModules, "@mozilla/readability/index.js"),
      "linkedom": path.join(localNpmNodeModules, "linkedom/cjs/index.js"),
      "turndown": path.join(localNpmNodeModules, "turndown/lib/turndown.cjs.js")
    }
  });

  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions/gemini-web-search.ts");
  return load(targetPath);
}

export async function runGeminiTests() {
  const mod = loadGeminiModule();
  const extensionFactory = mod.default || mod;

  const results = [];
  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  // Mock ExtensionAPI
  const registeredTools = new Map();
  const registeredCommands = new Map();

  const mockPi = {
    registerTool(tool) {
      registeredTools.set(tool.name, tool);
    },
    registerCommand(cmd, def) {
      registeredCommands.set(cmd, def);
    },
    registerFlag() {},
    on() {},
    getFlag() { return false; }
  };

  const mockCtx = {
    hasUI: true,
    modelRegistry: {
      async getApiKeyAndHeaders() { return null; },
      async getProviderAuth() { return null; }
    },
    ui: {
      async confirm() { return true; },
      notify() {},
      setStatus() {},
      theme: {
        fg: (_color, text) => text
      }
    }
  };

  extensionFactory(mockPi);

  // 1. Tool Registration Verification
  await test("Registration: web_search and fetch_url tools registered", async () => {
    assert.ok(registeredTools.has("web_search"), "web_search must be registered");
    assert.ok(registeredTools.has("fetch_url"), "fetch_url must be registered");
    assert.ok(registeredCommands.has("web-gate"), "web-gate command must be registered");
  });

  // 2. SSRF Guard on Private/Localhost IPs
  await test("SSRF Guard: blocks access to private 127.0.0.1 and internal hosts", async () => {
    const fetchTool = registeredTools.get("fetch_url");
    const res = await fetchTool.execute(
      "call_ssrf_test",
      { url: "http://127.0.0.1:8080/admin" },
      undefined,
      undefined,
      mockCtx
    );
    const text = res.content?.[0]?.text || "";
    assert.ok(
      text.includes("SSRF Protection") || text.includes("blocked") || text.includes("private"),
      `Expected SSRF blocking, got: ${text}`
    );
  });

  // 3. /web-gate command execution
  await test("Slash Command: /web-gate status, on, off toggles", async () => {
    const gateCmd = registeredCommands.get("web-gate");
    assert.ok(gateCmd, "web-gate command handler must exist");
    await gateCmd.handler("status", mockCtx);
    await gateCmd.handler("off", mockCtx);
    await gateCmd.handler("on", mockCtx);
    await gateCmd.handler("toggle", mockCtx);
  });

  return results;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isMain || process.argv[1]?.endsWith("test_gemini_web_search.mjs")) {
  console.log("Running Gemini Web Search Tests...");
  runGeminiTests().then((res) => {
    let allPassed = true;
    for (const r of res) {
      if (r.pass) {
        console.log(`  ✓ ${r.name}`);
      } else {
        allPassed = false;
        console.error(`  ✗ ${r.name}`);
        console.error("   ", r.error?.message || r.error);
      }
    }
    process.exit(allPassed ? 0 : 1);
  });
}
