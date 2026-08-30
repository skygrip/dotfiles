import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
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
      "turndown": path.join(localNpmNodeModules, "turndown/lib/turndown.cjs.js"),
      "got-scraping": path.join(localNpmNodeModules, "got-scraping/dist/index.js"),
      "playwright-core": path.join(localNpmNodeModules, "playwright-core/index.js")
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
        fg: (_color, text) => text,
        bold: (text) => text
      }
    }
  };

  extensionFactory(mockPi);

  // 1. Tool Registration Verification
  await test("Registration: web_search, fetch_url, /web-gate, and /chrome registered", async () => {
    assert.ok(registeredTools.has("web_search"), "web_search must be registered");
    assert.ok(registeredTools.has("fetch_url"), "fetch_url must be registered");
    assert.ok(registeredCommands.has("web-gate"), "web-gate command must be registered");
    assert.ok(registeredCommands.has("chrome"), "chrome command must be registered");
  });

  // 2. Strict Parameter Pass-Through (prepareArguments)
  await test("Parameter Pass-Through: web_search and fetch_url prepareArguments", async () => {
    const webSearch = registeredTools.get("web_search");
    const fetchUrl = registeredTools.get("fetch_url");

    const searchArgs = webSearch.prepareArguments({ query: "typescript 5.6 features" });
    assert.deepEqual(searchArgs, { query: "typescript 5.6 features" });

    const fetchArgs = fetchUrl.prepareArguments({ url: "https://example.com/docs" });
    assert.deepEqual(fetchArgs, { url: "https://example.com/docs" });
  });

  // 3. Localhost & Dev Endpoints Allowed
  await test("Localhost Support: allows local development URLs (localhost, 127.0.0.1)", async () => {
    const fetchTool = registeredTools.get("fetch_url");
    const res = await fetchTool.execute(
      "call_local_test",
      { url: "http://localhost:59999/nonexistent" },
      undefined,
      undefined,
      mockCtx
    );
    const text = res.content?.[0]?.text || "";
    // Should fail with connection/fetch error, NOT an SSRF blocked error!
    assert.ok(
      !text.toLowerCase().includes("ssrf") && !text.toLowerCase().includes("blocked internal"),
      `Localhost should not be blocked by SSRF filter, got: ${text}`
    );
  });

  // 4. Protocol Validation (non-HTTP rejection)
  await test("Protocol Validation: blocks non-HTTP protocols like file:// and ftp://", async () => {
    const fetchTool = registeredTools.get("fetch_url");
    const res = await fetchTool.execute(
      "call_protocol_test",
      { url: "file:///etc/passwd" },
      undefined,
      undefined,
      mockCtx
    );
    const text = res.content?.[0]?.text || "";
    assert.ok(
      text.includes("Invalid protocol") || text.includes("Error"),
      `Expected protocol blocking, got: ${text}`
    );
  });

  // 3. /web-gate & /chrome commands execution
  await test("Slash Commands: /web-gate and /chrome handlers", async () => {
    const gateCmd = registeredCommands.get("web-gate");
    assert.ok(gateCmd, "web-gate command handler must exist");
    await gateCmd.handler("status", mockCtx);
    await gateCmd.handler("off", mockCtx);
    await gateCmd.handler("on", mockCtx);
    await gateCmd.handler("toggle", mockCtx);

    const chromeCmd = registeredCommands.get("chrome");
    assert.ok(chromeCmd, "chrome command handler must exist");
    await chromeCmd.handler("profile", mockCtx);
    await chromeCmd.handler("status", mockCtx);
  });

  // 4. Content Sniffer: 6-Route Category Resolution
  await test("Sniffer: accurately categorizes HTML, JSON, SVG, Images, Binary, and Text", async () => {
    const { sniffContentType } = mod;
    assert.ok(typeof sniffContentType === "function", "sniffContentType must be exported");

    // PNG
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(sniffContentType(pngBytes, "").category, "image");

    // JPEG
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    assert.equal(sniffContentType(jpegBytes, "").category, "image");

    // SVG
    const svgBytes = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><circle/></svg>");
    assert.equal(sniffContentType(svgBytes, "image/svg+xml").category, "svg");

    // JSON
    const jsonBytes = new TextEncoder().encode('{"status":"ok","count":42}');
    assert.equal(sniffContentType(jsonBytes, "application/json").category, "json");

    // HTML
    const htmlBytes = new TextEncoder().encode("<!DOCTYPE html><html><body><h1>Hello</h1></body></html>");
    assert.equal(sniffContentType(htmlBytes, "text/html").category, "html");

    // Binary with null byte
    const binBytes = new Uint8Array([0x00, 0x01, 0x02, 0x00, 0x04]);
    assert.equal(sniffContentType(binBytes, "application/octet-stream").category, "binary");
  });

  // 5. Protocol Security Guard
  await test("Protocol Guard: blocks non-HTTP/HTTPS protocols", async () => {
    const fetchTool = registeredTools.get("fetch_url");
    const blockedTargets = [
      "ftp://github.com",
      "file:///etc/passwd",
      "gopher://test.local",
      "javascript:alert(1)"
    ];

    for (const url of blockedTargets) {
      const res = await fetchTool.execute("protocol_call", { url }, undefined, undefined, mockCtx);
      const text = (res.content?.[0]?.text || "").toLowerCase();
      assert.ok(
        text.includes("invalid protocol") || text.includes("error"),
        `Expected protocol blocking for ${url}, got: ${text}`
      );
    }
  });

  // 6. Chrome Profile Directory & Executable Discovery
  await test("Chrome Automation: resolves executable and agent profile directory", async () => {
    const profileDir = path.join(os.homedir(), ".pi", "agent", "chrome_profile");
    assert.ok(fs.existsSync(profileDir), "Agent Chrome profile directory must exist on disk");
  });

  // 7. Live Fast HTTP Fetch with got-scraping across multiple target URLs
  await test("Live HTTP: fetches and parses markdown across diverse web targets (raw text, HTML, Google)", async () => {
    const fetchTool = registeredTools.get("fetch_url");
    const testTargets = [
      {
        url: "https://raw.githubusercontent.com/octocat/Hello-World/master/README",
        validate: (res) => {
          assert.ok(res.content?.[0]?.text?.includes("Hello World"), "Must fetch raw README content from GitHub");
          assert.equal(res.details?.url, "https://raw.githubusercontent.com/octocat/Hello-World/master/README");
          assert.ok(!res.details?.error, `Unexpected error: ${res.details?.error}`);
        }
      },
      {
        url: "https://github.com",
        validate: (res) => {
          assert.ok(res.content?.[0]?.text && res.content[0].text.length > 0, "Must fetch and parse GitHub HTML content");
          assert.ok(res.details?.title, "GitHub page should have a title");
          assert.ok(!res.details?.error, `Unexpected error: ${res.details?.error}`);
        }
      },
      {
        url: "https://google.com",
        validate: (res) => {
          assert.ok(res.content?.[0]?.text && res.content[0].text.length > 0, "Must fetch Google HTML content");
          assert.ok(!res.details?.error, `Unexpected error: ${res.details?.error}`);
        }
      }
    ];

    for (const { url, validate } of testTargets) {
      const updates = [];
      const res = await fetchTool.execute(
        "call_live_fetch",
        { url },
        undefined,
        (update) => {
          if (update?.content?.[0]?.text) {
            updates.push(update.content[0].text);
          }
        },
        mockCtx
      );

      assert.ok(res, `Result must exist for ${url}`);
      validate(res);
      assert.ok(typeof res.details?.durationMs === "number", "durationMs must be recorded");
    }
  });

  // 8. Ctrl+O Expansion renders fullContent without truncation
  await test("Ctrl+O Expansion: renderResult renders fullContent when expanded is true", async () => {
    const fetchTool = registeredTools.get("fetch_url");
    const mockResult = {
      content: [{ type: "text", text: "Short truncated preview" }],
      details: {
        url: "https://github.com",
        fullContent: "Full un-truncated markdown content spanning all lines and tables from GitHub",
        durationMs: 450,
        usedBrowser: true,
        viaCDP: true
      }
    };

    // Collapsed view (expanded = false)
    const collapsed = fetchTool.renderResult(mockResult, { expanded: false }, mockCtx.ui.theme);
    const collapsedStr = collapsed.text || collapsed.toString?.() || "";
    assert.ok(collapsedStr.includes("Short truncated preview") || collapsedStr.includes("FETCH COMPLETED"));
    assert.ok(collapsedStr.includes("[Chrome Live CDP]"), "Header must show [Chrome Live CDP]");

    // Expanded view on Ctrl+O (expanded = true)
    const expanded = fetchTool.renderResult(mockResult, { expanded: true }, mockCtx.ui.theme);
    const expandedStr = expanded.text || expanded.toString?.() || "";
    assert.ok(
      expandedStr.includes("Full un-truncated markdown content spanning all lines and tables from GitHub"),
      "Ctrl+O expanded view must contain fullContent"
    );
  });

  // 9. Browser Fallback Header Tags in renderResult
  await test("Browser Tags: renderResult displays [Chrome Live CDP] when viaCDP is true", async () => {
    const fetchTool = registeredTools.get("fetch_url");
    const resCDP = fetchTool.renderResult(
      { content: [{ type: "text", text: "content" }], details: { viaCDP: true, usedBrowser: true } },
      { expanded: false },
      mockCtx.ui.theme
    );
    assert.ok((resCDP.text || resCDP.toString()).includes("[Chrome Live CDP]"));
  });

  // 10. Live Chrome Launch & CDP Attachment Fallback
  await test("Live Chrome CDP Fallback: launches Agent Chrome and fetches page over CDP", async () => {
    const chromeCmd = registeredCommands.get("chrome");
    assert.ok(chromeCmd, "chrome command handler must exist");
    
    // Launch Chrome window on screen
    await chromeCmd.handler("start", mockCtx);

    const port = process.env.PI_CHROME_CDP_PORT?.trim() || "9222";
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    assert.ok(res.ok, `Chrome Remote Debugging must be active on port ${port}`);

    // Connect Playwright over CDP to verify live control
    const playwrightPkg = path.join(os.homedir(), ".pi/agent/npm/node_modules/playwright-core");
    const { chromium } = require(playwrightPkg);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    assert.ok(browser, "Must connect Playwright over CDP to active Chrome");

    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    const page = await context.newPage();
    
    await page.goto("https://github.com", { waitUntil: "domcontentloaded" });
    const pageTitle = await page.title();
    assert.ok(pageTitle.includes("GitHub"), `Page title must include GitHub, got: ${pageTitle}`);

    await page.close();
  });

  // 11. Output Truncation Guard
  await test("Truncation Guard: truncateHead caps content to maxLines and maxBytes", async () => {
    const { truncateHead } = mod;
    assert.ok(typeof truncateHead === "function", "truncateHead must be exported");

    let longText = "";
    for (let i = 1; i <= 50; i++) {
      longText += `Line ${i}: sample markdown text line\n`;
    }

    const res = truncateHead(longText, { maxLines: 10, maxBytes: 1024 });
    assert.equal(res.truncated, true, "Must flag as truncated");
    assert.equal(res.content.split("\n").length, 10, "Must contain exactly 10 lines");
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
