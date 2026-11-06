import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import * as http from "node:http";
import { loadExtension, isOfflineMode } from "./test_harness.mjs";

function loadFetchUrlModule() {
  return loadExtension("fetch-url.ts");
}

export async function runFetchUrlTests() {
  const mod = loadFetchUrlModule();
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

  // Mock ExtensionAPI Harness
  const registeredTools = new Map();
  const registeredCommands = new Map();
  const registeredFlags = new Map();

  const mockPi = {
    registerTool(tool) {
      registeredTools.set(tool.name, tool);
    },
    registerCommand(cmd, def) {
      registeredCommands.set(cmd, def);
    },
    registerFlag(flag, def) {
      registeredFlags.set(flag, def);
    },
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

  // Initialize Extension
  extensionFactory(mockPi);
  const fetchTool = registeredTools.get("fetch_url");
  const fetchGateCmd = registeredCommands.get("fetch-gate");
  const fetchEngineCmd = registeredCommands.get("fetch-engine");

  // =========================================================================
  // DOMAIN 1: Gatekeeping, Protocol Security & Configuration
  // =========================================================================

  // Test 1: Registration & Interface Contract
  await test("Contract & Registration: fetch_url, /fetch-gate, and /fetch-engine registered", async () => {
    assert.ok(fetchTool, "fetch_url tool must be registered");
    assert.equal(fetchTool.name, "fetch_url");
    assert.ok(fetchGateCmd, "fetch-gate command must be registered");
    assert.ok(fetchEngineCmd, "fetch-engine command must be registered");
    assert.ok(registeredFlags.has("no-fetch-gate"), "no-fetch-gate flag must be registered");
    assert.ok(registeredFlags.has("fetch-engine"), "fetch-engine flag must be registered");

    // Parameter pass-through validation
    const prepared = fetchTool.prepareArguments({ url: "https://example.com/api" });
    assert.deepEqual(prepared, { url: "https://example.com/api" });
  });

  // Test 2: Protocol Whitelisting & Network Perimeter
  await test("Protocol Perimeter: allows http/https & localhost; blocks file/ftp schemes", async () => {
    // 1. Non-web schemes strictly blocked
    const fileRes = await fetchTool.execute("call_file", { url: "file:///etc/passwd" }, undefined, undefined, mockCtx);
    assert.ok(fileRes.content[0].text.includes("Invalid protocol") || fileRes.content[0].text.includes("Error"));

    const ftpRes = await fetchTool.execute("call_ftp", { url: "ftp://ftp.example.com/file.txt" }, undefined, undefined, mockCtx);
    assert.ok(ftpRes.content[0].text.includes("Invalid protocol") || ftpRes.content[0].text.includes("Error"));

    // 2. Localhost permitted for local development (should fail with network error, not protocol block)
    await fetchEngineCmd.handler("got-scraping", mockCtx);
    const localRes = await fetchTool.execute("call_local", { url: "http://localhost:59999/status" }, undefined, undefined, mockCtx);
    await fetchEngineCmd.handler("auto", mockCtx);
    const localText = localRes.content[0].text.toLowerCase();
    assert.ok(!localText.includes("invalid protocol"), "Localhost must be permitted");
  });

  // Test 3: Pre-Request Permission Gate & Headless Safety
  await test("Permission Gate: interactive confirmation, user decline handling, and headless safety", async () => {
    // Toggle gate ON
    await fetchGateCmd.handler("on", mockCtx);

    // 1. User confirms -> allowed
    if (!isOfflineMode()) {
      const allowCtx = { ...mockCtx, ui: { ...mockCtx.ui, confirm: async () => true } };
      const allowRes = await fetchTool.execute("call_allow", { url: "https://raw.githubusercontent.com/octocat/Hello-World/master/README" }, undefined, undefined, allowCtx);
      assert.ok(!allowRes.details?.denied, "Fetch must proceed when user confirms");
    }

    // 2. User declines -> clean rejection without throwing
    const declineCtx = { ...mockCtx, ui: { ...mockCtx.ui, confirm: async () => false } };
    const declineRes = await fetchTool.execute("call_deny", { url: "https://example.com" }, undefined, undefined, declineCtx);
    assert.equal(declineRes.details?.denied, true, "Must record denied status in details");
    assert.ok(declineRes.content[0].text.includes("Denied by User"), "Must inform user/LLM of denial");

    // 3. Headless / non-interactive environment -> safe denial
    const headlessCtx = { ...mockCtx, hasUI: false };
    const headlessRes = await fetchTool.execute("call_headless", { url: "https://example.com" }, undefined, undefined, headlessCtx);
    assert.equal(headlessRes.details?.denied, true, "Must safely deny in headless mode without UI");

    // Reset gate back to default
    await fetchGateCmd.handler("off", mockCtx);
  });

  // =========================================================================
  // DOMAIN 2: Engine-Specific Testing (got-scraping, chrome, auto)
  // =========================================================================

  // Test 4: Engine: got-scraping (Pure Fast HTTP)
  if (!isOfflineMode()) {
    await test("Engine got-scraping: executes fast HTTP path, bypasses browser, respects boundaries", async () => {
      await fetchEngineCmd.handler("got-scraping", mockCtx);

      const res = await fetchTool.execute(
        "call_got_scraping",
        { url: "https://raw.githubusercontent.com/octocat/Hello-World/master/README" },
        undefined,
        undefined,
        mockCtx
      );

      assert.equal(res.details?.engine, "got-scraping");
      assert.equal(res.details?.usedBrowser, false, "Must not invoke browser or CDP");
      assert.equal(res.details?.viaCDP, false);
      assert.ok(res.content[0].text.includes("Hello World"), "Must retrieve text via got-scraping");

      // UI tag rendering
      const rendered = fetchTool.renderResult(res, { expanded: false }, mockCtx.ui.theme);
      const renderedStr = rendered.text || rendered.toString();
      assert.ok(renderedStr.includes("[got-scraping]"), "Badge must display [got-scraping]");

      await fetchEngineCmd.handler("auto", mockCtx);
    });
  }

  // Test 5: Engine: chrome (Direct Remote Debugging / CDP & Diagnostics)
  if (!isOfflineMode()) {
    await test("Engine chrome: executes direct CDP path, handles session discovery & diagnostics", async () => {
      await fetchEngineCmd.handler("chrome", mockCtx);

      const res = await fetchTool.execute(
        "call_chrome_test",
        { url: "https://example.com" },
        undefined,
        undefined,
        mockCtx
      );

      assert.equal(res.details?.engine, "chrome");

      // If Chrome is open with remote debugging active, it succeeds via CDP;
      // If not open, it MUST return the actionable diagnostic link!
      if (res.details?.error) {
        assert.ok(
          res.details.error.includes("chrome://inspect/#remote-debugging") ||
          res.details.error.includes("timed out") ||
          res.details.error.includes("declined"),
          "Chrome failure must provide clear diagnostic guidance"
        );
      } else {
        assert.equal(res.details?.usedBrowser, true);
        assert.equal(res.details?.viaCDP, true);
        assert.equal(res.details?.isUserSession, true);
      }

      await fetchEngineCmd.handler("auto", mockCtx);
    });
  }

  // Test 6: Engine: auto (Hybrid Happy Path & Fallback Narrative)
  await test("Engine auto: HTTP-first happy path and seamless fallback narrative generation", async () => {
    await fetchEngineCmd.handler("auto", mockCtx);

    // 1. Happy path: standard fetch resolves fast over HTTP
    if (!isOfflineMode()) {
      const happyRes = await fetchTool.execute(
        "call_auto_happy",
        { url: "https://raw.githubusercontent.com/octocat/Hello-World/master/README" },
        undefined,
        undefined,
        mockCtx
      );
      assert.equal(happyRes.details?.usedBrowser, false, "Happy path must not invoke browser");
    }

    // 2. Fallback narrative: verifies UI shows chronological got-scraping -> Chrome transition
    const mockFallbackResult = {
      content: [{ type: "text", text: "Page content" }],
      details: {
        viaCDP: true,
        isUserSession: true,
        usedBrowser: true,
        fallbackReason: "HTTP 403: Forbidden"
      }
    };
    const renderedFallback = fetchTool.renderResult(mockFallbackResult, { expanded: false }, mockCtx.ui.theme);
    const fallbackText = renderedFallback.text || renderedFallback.toString();
    assert.ok(fallbackText.includes("FETCH FAILED: got-scraping failed (HTTP 403: Forbidden)"), "Must explain HTTP failure");
    assert.ok(fallbackText.includes("Falling back to engine: Chrome"), "Must display fallback transition");
    assert.ok(fallbackText.includes("FETCH COMPLETED [Chrome User Session]"), "Must show final CDP completion tag");
  });

  // =========================================================================
  // DOMAIN 3: Content Transformation & Multimodal Vision
  // =========================================================================

  // Test 7: 6-Route Content Sniffer Matrix
  await test("Content Sniffer: accurately classifies HTML, Image, SVG, JSON, Text, and Binary", async () => {
    const { sniffContentType } = mod;
    assert.ok(typeof sniffContentType === "function", "sniffContentType must be exported");

    // 1. PNG magic bytes: 89 50 4E 47
    assert.equal(sniffContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00]), "").category, "image");

    // 2. JPEG magic bytes: FF D8 FF
    assert.equal(sniffContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "").category, "image");

    // 3. WebP magic bytes: RIFF....WEBP
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    assert.equal(sniffContentType(webpBytes, "").category, "image");

    // 4. SVG Vector XML
    const svgBytes = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>");
    assert.equal(sniffContentType(svgBytes, "image/svg+xml").category, "svg");

    // 5. JSON
    const jsonBytes = new TextEncoder().encode('{"status":"success","items":[1,2,3]}');
    assert.equal(sniffContentType(jsonBytes, "application/json").category, "json");

    // 6. HTML
    const htmlBytes = new TextEncoder().encode("<!DOCTYPE html><html><body><p>Text</p></body></html>");
    assert.equal(sniffContentType(htmlBytes, "text/html").category, "html");

    // 7. Binary (null byte detection)
    const binBytes = new Uint8Array([0x01, 0x02, 0x00, 0x03, 0x04]);
    assert.equal(sniffContentType(binBytes, "application/octet-stream").category, "binary");
  });

  // Test 8: DOM Normalization, Defuddle & Absolute URL Rewriting
  await test("DOM & Defuddle: converts HTML to clean markdown and rewrites relative URLs to absolute", async () => {
    const { htmlToMarkdown } = mod;
    assert.ok(typeof htmlToMarkdown === "function", "htmlToMarkdown must be exported");

    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Architecture Guide</title></head>
        <body>
          <nav><a href="/home">Home</a></nav>
          <article>
            <h1>System Architecture</h1>
            <p>For more information, see our <a href="/docs/configuration">Configuration Guide</a>.</p>
            <p>External reference: <a href="https://example.org/spec">W3C Spec</a>.</p>
          </article>
          <footer><p>&copy; 2026</p></footer>
        </body>
      </html>
    `;

    const parsed = htmlToMarkdown(sampleHtml, "https://developer.example.com/articles/arch");
    assert.equal(parsed.title, "Architecture Guide");
    assert.ok(parsed.markdown.includes("System Architecture"), "Must include article heading");

    // Relative link must be normalized to absolute URL
    assert.ok(
      parsed.markdown.includes("[Configuration Guide](https://developer.example.com/docs/configuration)"),
      "Relative link must be rewritten to fully qualified absolute URL"
    );
    assert.ok(
      parsed.markdown.includes("[W3C Spec](https://example.org/spec)"),
      "Absolute link must be preserved"
    );
  });

  // Test 9: Content Image Extraction, Lazy-Load Promotion & Junk Filtering
  await test("Image Extraction: promotes data-src lazy images, captures heroes, and filters junk pixels", async () => {
    const { htmlToMarkdown } = mod;

    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sydney Luxury Waterfront</title>
          <meta property="og:image" content="https://example.com/photos/hero-waterfront.jpg">
          <meta name="twitter:image" content="https://example.com/photos/twitter-preview.png">
        </head>
        <body>
          <header>
            <img src="https://example.com/assets/logo.png" width="90" height="30" alt="Site Logo">
          </header>
          <article>
            <h1>Waterfront Residence</h1>
            <figure>
              <img src="/photos/living-room.jpg" width="1200" height="800" alt="Spacious Living Room">
              <figcaption>Harbor views from main lounge</figcaption>
            </figure>
            <!-- Modern lazy-loaded image using data-src -->
            <img data-src="/photos/pool-terrace.jpg" width="1024" height="768" alt="Infinity Pool Terrace">
            <!-- Junk tracking pixel -->
            <img src="https://tracking.doubleclick.net/pixel" width="1" height="1">
            <!-- Junk avatar -->
            <img src="https://example.com/avatar/agent.jpg" width="32" height="32" alt="Agent">
          </article>
        </body>
      </html>
    `;

    const parsed = htmlToMarkdown(sampleHtml, "https://realestate.example.com/properties/123");
    assert.ok(parsed.images && parsed.images.length > 0, "Must extract high-value images");

    const imgUrls = parsed.images.map(i => i.url);
    assert.ok(imgUrls.includes("https://example.com/photos/hero-waterfront.jpg"), "Must extract OpenGraph hero");
    assert.ok(imgUrls.includes("https://realestate.example.com/photos/living-room.jpg"), "Must extract figure photo");

    // Verify lazy-loaded data-src promotion
    assert.ok(
      parsed.markdown.includes("https://realestate.example.com/photos/pool-terrace.jpg"),
      "Must promote data-src lazy-loaded image to absolute URL in markdown"
    );

    // Verify junk filtering
    assert.ok(!imgUrls.some(u => u.includes("logo")), "Must filter out logos");
    assert.ok(!imgUrls.some(u => u.includes("doubleclick")), "Must filter out tracking pixels");
    assert.ok(!imgUrls.some(u => u.includes("avatar")), "Must filter out avatars");
  });

  // Test 10: Image Deduplication
  if (!isOfflineMode()) {
    await test("Image Deduplication: preserves contextual inline images and avoids bottom appendix duplicates", async () => {
      // Test on Google's WebP gallery comparison page
      const res = await fetchTool.execute(
        "call_dedup_test",
        { url: "https://developers.google.com/speed/webp/gallery1" },
        undefined,
        undefined,
        mockCtx
      );

      const text = res.content[0].text;
      assert.ok(text.includes("WebP Gallery"), "Must retrieve WebP gallery page");

      // 1. Comparison images are present inline in the article
      assert.ok(text.includes("https://www.gstatic.com/webp/gallery/1.webp"), "Must have inline WebP comparison image");
      assert.ok(text.includes("https://www.gstatic.com/webp/gallery/2.webp"), "Must have inline WebP comparison image 2");

      // 2. The bottom section must NOT duplicate the inline images
      if (text.includes("### 🖼️ Extracted Page Images")) {
        const bottomSection = text.split("### 🖼️ Extracted Page Images")[1];
        assert.ok(
          !bottomSection.includes("https://www.gstatic.com/webp/gallery/1.webp"),
          "Inline comparison image must not be duplicated in the bottom appendix"
        );
      }
    });

    // Test 11: In-Process Multimodal Vision (Universal WebP -> PNG Conversion)
    await test("Multimodal Vision: converts WebP to PNG in-process via Photon WASM without Chrome", async () => {
      const res = await fetchTool.execute(
        "call_vision_test",
        { url: "https://www.gstatic.com/webp/gallery/2.webp" },
        undefined,
        undefined,
        mockCtx
      );

      assert.equal(res.details?.isImage, true, "Must classify as image");
      assert.equal(res.details?.usedBrowser, false, "Must NOT invoke Chrome for image conversion");
      assert.equal(res.details?.contentType, "image/png", "Must convert WebP to image/png");

      const imgPart = res.content.find(c => c.type === "image");
      assert.ok(imgPart, "Must contain multimodal image content part");
      assert.equal(imgPart.mimeType, "image/png");

      // Standard PNG magic signature in base64: \x89PNG = iVBORw0KGgo
      assert.ok(imgPart.data.startsWith("iVBORw0KGgo"), "Converted bytes must start with valid PNG header");
    });
  }

  // =========================================================================
  // DOMAIN 4: Token Budgeting, UX & Live Regression
  // =========================================================================

  // Test 12: Output Truncation Guard & Ctrl+O Full Content Expansion
  await test("Token Budgeting: truncateHead caps output lines & bytes, preserves fullContent for Ctrl+O", async () => {
    const { truncateHead } = mod;
    assert.ok(typeof truncateHead === "function", "truncateHead must be exported");

    let longDoc = "";
    for (let i = 1; i <= 200; i++) {
      longDoc += `Line ${i}: benchmark documentation paragraph with token metrics\n`;
    }

    const capped = truncateHead(longDoc, { maxLines: 20, maxBytes: 2048 });
    assert.equal(capped.truncated, true, "Must flag content as truncated");
    assert.ok(capped.content.split("\n").length <= 20, "Must enforce maxLines cap");

    // Verify Ctrl+O expansion in renderResult
    const mockTruncated = {
      content: [{ type: "text", text: "Preview line 1\nPreview line 2" }],
      details: {
        url: "https://example.com/long-page",
        fullContent: longDoc,
        durationMs: 250
      }
    };

    // Collapsed preview
    const collapsed = fetchTool.renderResult(mockTruncated, { expanded: false }, mockCtx.ui.theme);
    const collapsedStr = collapsed.text || collapsed.toString();
    assert.ok(collapsedStr.includes("FETCH COMPLETED"));

    // Expanded view on Ctrl+O
    const expanded = fetchTool.renderResult(mockTruncated, { expanded: true }, mockCtx.ui.theme);
    const expandedStr = expanded.text || expanded.toString();
    assert.ok(expandedStr.includes("Line 199:"), "Ctrl+O expanded view must contain full un-truncated content");
  });

  // Test 13: TUI Rendering & Theme Components
  await test("TUI Components: renderCall and renderResult format tool output and themes cleanly", async () => {
    // 1. renderCall formatting
    const callText = fetchTool.renderCall({ url: "https://example.com/test" }, mockCtx.ui.theme);
    assert.ok((callText.text || callText.toString()).includes("https://example.com/test"));

    // 2. Partial/In-flight rendering
    const partialText = fetchTool.renderResult(
      { content: [{ type: "text", text: "Fetching https://example.com..." }] },
      { isPartial: true },
      mockCtx.ui.theme
    );
    assert.ok((partialText.text || partialText.toString()).includes("Fetching https://example.com..."));

    // 3. Denied rendering
    const deniedText = fetchTool.renderResult(
      { content: [], details: { denied: true, url: "https://secret.com" } },
      { expanded: false },
      mockCtx.ui.theme
    );
    assert.ok((deniedText.text || deniedText.toString()).includes("FETCH DENIED"));
  });

  // Test 14: End-to-End Live Regression Targets (Raw Text, HTML, Google Gallery)
  if (!isOfflineMode()) {
    await test("Live Regression: fetches and parses live diverse web endpoints end-to-end", async () => {
      const liveTargets = [
        {
          url: "https://raw.githubusercontent.com/octocat/Hello-World/master/README",
          check: (res) => {
            assert.ok(res.content[0].text.includes("Hello World"), "Must fetch raw text from GitHub");
            assert.equal(res.details?.url, "https://raw.githubusercontent.com/octocat/Hello-World/master/README");
          }
        },
        {
          url: "https://github.com",
          check: (res) => {
            assert.ok(res.content[0].text.length > 50, "Must fetch and parse GitHub HTML");
            assert.ok(res.details?.title, "Must extract page title");
          }
        },
        {
          url: "https://developers.google.com/speed/webp/gallery1",
          check: (res) => {
            assert.ok(res.content[0].text.includes("WebP Gallery"), "Must extract Google WebP gallery article");
            assert.ok(res.content[0].text.includes("https://www.gstatic.com/webp/gallery/1.webp"), "Must have absolute URLs");
          }
        }
      ];

      for (const target of liveTargets) {
        const res = await fetchTool.execute("live_regression", { url: target.url }, undefined, undefined, mockCtx);
        assert.ok(res, `Result must exist for ${target.url}`);
        assert.ok(!res.details?.error, `Unexpected error on ${target.url}: ${res.details?.error}`);
        assert.ok(typeof res.details?.durationMs === "number", "durationMs must be recorded");
        target.check(res);
      }
    });
  }

  // Test 15: WAF Header & JavaScript-Required Fallback Routing (Local HTTP Server)
  await test("WAF & JS Fallback Routing: detects Cloudflare/Vercel/AWS/DataDome/Imperva/Kasada & empty SPA shells and routes to Chrome", async () => {
    const server = http.createServer((req, res) => {
      switch (req.url) {
        case "/waf/cloudflare":
          res.writeHead(200, { "content-type": "text/html", "cf-mitigated": "challenge" });
          res.end("<html><body>Just a moment...</body></html>");
          break;
        case "/waf/vercel":
          res.writeHead(200, { "content-type": "text/html", "x-vercel-mitigated": "challenge" });
          res.end("<html><body>Vercel Security Checkpoint</body></html>");
          break;
        case "/waf/aws":
          res.writeHead(200, { "content-type": "text/html", "x-amzn-waf-action": "challenge" });
          res.end("<html><body>AWS WAF</body></html>");
          break;
        case "/waf/datadome":
          res.writeHead(200, { "content-type": "text/html", "x-datadome": "protected" });
          res.end("<html><body>DataDome</body></html>");
          break;
        case "/waf/imperva":
          res.writeHead(403, { "content-type": "text/html", "x-cdn": "Imperva" });
          res.end("<html><body>Incapsula incident</body></html>");
          break;
        case "/waf/kasada":
          res.writeHead(429, { "content-type": "text/html", "x-kpsdk-ct": "0123456789" });
          res.end("<html><body>Kasada</body></html>");
          break;
        case "/spa/empty":
          res.writeHead(200, { "content-type": "text/html" });
          res.end("<!doctype html><html><head><title>Vite SPA</title><script type='module' src='/app.js'></script></head><body><div id='root'></div></body></html>");
          break;
        case "/spa/noscript":
          res.writeHead(200, { "content-type": "text/html" });
          res.end("<!doctype html><html><head><title>App</title></head><body><div class='no-js'>You need to enable JavaScript to run this app.</div></body></html>");
          break;
        default:
          res.writeHead(404);
          res.end();
      }
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Verify each WAF & SPA case is caught in got-scraping mode
      await fetchEngineCmd.handler("got-scraping", mockCtx);

      const expectedBlocks = [
        ["/waf/cloudflare", "Blocked by Cloudflare challenge"],
        ["/waf/vercel", "Blocked by Vercel Attack Challenge"],
        ["/waf/aws", "Blocked by AWS WAF challenge"],
        ["/waf/datadome", "Blocked by DataDome"],
        ["/waf/imperva", "Blocked by Imperva/Incapsula"],
        ["/waf/kasada", "Blocked by Kasada"],
        ["/spa/empty", "JavaScript rendering required"],
        ["/spa/noscript", "JavaScript rendering required"]
      ];

      for (const [route, expectedReason] of expectedBlocks) {
        const res = await fetchTool.execute("test_waf", { url: `${baseUrl}${route}` }, undefined, undefined, mockCtx);
        assert.ok(
          res.details?.error?.includes(expectedReason),
          `Route ${route} should fail with '${expectedReason}', got: '${res.details?.error}'`
        );
      }

      // 2. Verify auto mode sets fallbackReason and routes to Chrome CDP on both WAF and JS-shell pages
      await fetchEngineCmd.handler("auto", mockCtx);

      for (const [route, expectedReason] of [
        ["/waf/cloudflare", "Blocked by Cloudflare challenge"],
        ["/spa/empty", "JavaScript rendering required"]
      ]) {
        const updates = [];
        const ac = new AbortController();
        const onUpdate = (u) => {
          const txt = u?.content?.[0]?.text || "";
          updates.push(txt);
          if (txt.includes("falling back to Chrome User Session (CDP)")) {
            ac.abort();
          }
        };

        const res = await fetchTool.execute("test_auto_fallback", { url: `${baseUrl}${route}` }, ac.signal, onUpdate, mockCtx);
        assert.ok(
          res.details?.fallbackReason?.includes(expectedReason),
          `Auto mode on ${route} must record fallbackReason '${expectedReason}', got: '${res.details?.fallbackReason}'`
        );
        assert.ok(
          updates.some((u) => u.includes("falling back to Chrome User Session (CDP)")),
          `Auto mode on ${route} must emit fallback transition update to Chrome CDP`
        );
      }
    } finally {
      server.close();
      await fetchEngineCmd.handler("auto", mockCtx);
    }
  });

  // Test 16: Live JavaScript-Required Site Routing (help.zscaler.com)
  if (!isOfflineMode()) {
    await test("Live JS-Required Site (help.zscaler.com): detects unhydrated SPA shell and routes to Chrome fallback", async () => {
      await fetchEngineCmd.handler("auto", mockCtx);
      const updates = [];
      const ac = new AbortController();
      const onUpdate = (u) => {
        const txt = u?.content?.[0]?.text || "";
        updates.push(txt);
        if (txt.includes("falling back to Chrome User Session (CDP)")) {
          ac.abort();
        }
      };

      const res = await fetchTool.execute(
        "live_zscaler_spa",
        { url: "https://help.zscaler.com/zia/configuring-ssltls-inspection-policy" },
        ac.signal,
        onUpdate,
        mockCtx
      );

      assert.ok(
        res.details?.fallbackReason?.includes("JavaScript rendering required"),
        `Must detect unhydrated JS shell on help.zscaler.com, got fallbackReason: '${res.details?.fallbackReason}'`
      );
      assert.ok(
        updates.some((u) => u.includes("falling back to Chrome User Session (CDP)")),
        "Must escalate help.zscaler.com from got-scraping to Chrome CDP in auto mode"
      );
    });
  }

  // Test 17: Chrome CDP Event-Driven Wait Pipeline (CAPTCHA Solve + Navigation Recovery + MutationObserver)
  await test("Chrome CDP Wait Pipeline: handles CAPTCHA bringToFront, cross-navigation recovery, and MutationObserver settle", async () => {
    const { waitForChromePageReady } = mod;
    assert.ok(typeof waitForChromePageReady === "function", "waitForChromePageReady must be exported");

    // 1. Simulate a Cloudflare CAPTCHA page where solving triggers a navigation ("Execution context was destroyed")
    let stage = "challenge";
    let broughtToFront = false;
    let loadStateWaits = 0;
    let settleCalled = false;
    const updates = [];

    const mockPage = {
      async bringToFront() {
        broughtToFront = true;
      },
      async waitForLoadState() {
        loadStateWaits++;
      },
      async evaluate() {
        // First check: on challenge screen; after navigation: challenge cleared
        return stage === "challenge";
      },
      async waitForFunction(_fn, arg) {
        if (stage === "challenge") {
          // Simulate user solving CAPTCHA and triggering full-page reload
          stage = "hydrated";
          throw new Error("page.waitForFunction: Execution context was destroyed, most likely because of a navigation.");
        }
        if (arg && typeof arg.debounceMs === "number") {
          settleCalled = true;
        }
        return true;
      }
    };

    await waitForChromePageReady(mockPage, {
      onUpdate: (u) => updates.push(u?.content?.[0]?.text || ""),
      challengeTimeoutMs: 5000,
      settleTimeoutMs: 1000,
      quietMs: 50
    });

    assert.equal(broughtToFront, true, "Must bring Chrome tab to front when CAPTCHA is detected");
    assert.ok(
      updates.some((u) => u.includes("Security challenge / CAPTCHA detected in Chrome")),
      "Must notify user via onUpdate when CAPTCHA is detected"
    );
    assert.ok(loadStateWaits >= 1, "Must wait for domcontentloaded after navigation context destruction");
    assert.equal(settleCalled, true, "Must run MutationObserver DOM settler after challenge resolves");

    // 2. Simulate an unsolved CAPTCHA timing out cleanly
    const stuckPage = {
      async bringToFront() {},
      async waitForLoadState() {},
      async evaluate() { return true; },
      async waitForFunction() {
        await new Promise((r) => setTimeout(r, 30));
        throw new Error("Timeout");
      }
    };

    await assert.rejects(
      () => waitForChromePageReady(stuckPage, { challengeTimeoutMs: 80, settleTimeoutMs: 50, quietMs: 20 }),
      /Timed out waiting for CAPTCHA/
    );

    // 3. Live Real-Chrome Integration (when online & Chrome binary is installed)
    if (!isOfflineMode()) {
      const { createRequire } = await import("node:module");
      const piReq = createRequire(path.join(os.homedir(), ".pi", "agent", "npm", "package.json"));
      const { chromium } = piReq("playwright-core");
      const { htmlToMarkdown } = mod;

      let browser = null;
      try {
        browser = await chromium.launch({ channel: "chrome", headless: true });
      } catch {}

      if (browser) {
        let solved = false;
        const captchaServer = http.createServer((req, res) => {
          if (!solved) {
            solved = true;
            res.writeHead(403, { "content-type": "text/html" });
            res.end(`<!doctype html><html><head><title>Just a moment...</title></head><body>
              <div id="challenge-running">Checking your browser...</div>
              <script>setTimeout(() => { window.location.reload(); }, 300);</script>
            </body></html>`);
          } else {
            res.writeHead(200, { "content-type": "text/html" });
            res.end(`<!doctype html><html><head><title>Solved Article</title></head><body>
              <article><h1>Welcome After CAPTCHA</h1><p>${"This is the hydrated article content after solving the security challenge. ".repeat(6)}</p></article>
            </body></html>`);
          }
        });
        await new Promise((r) => captchaServer.listen(0, "127.0.0.1", r));
        const port = captchaServer.address().port;

        try {
          // 3a. Real Chrome solving a 403 challenge reload -> 200 article
          const page = await browser.newPage();
          await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
          await waitForChromePageReady(page);
          const parsedCaptcha = htmlToMarkdown(await page.content(), page.url());
          assert.equal(parsedCaptcha.title, "Solved Article");
          assert.ok(parsedCaptcha.markdown.includes("Welcome After CAPTCHA"), "Must extract post-CAPTCHA article");
          await page.close();

          // 3b. Real Chrome hydrating help.zscaler.com SPA via MutationObserver + Defuddle
          const zPage = await browser.newPage();
          await zPage.goto("https://help.zscaler.com/zia/configuring-ssltls-inspection-policy", { waitUntil: "domcontentloaded" });
          await waitForChromePageReady(zPage);
          const parsedZscaler = htmlToMarkdown(await zPage.content(), zPage.url());
          assert.ok(parsedZscaler.title.includes("Configuring SSL/TLS Inspection Policy"), "Must extract hydrated Zscaler title");
          assert.ok(parsedZscaler.markdown.length > 5000, "Must extract full hydrated Zscaler article (>5,000 chars)");
          await zPage.close();
        } finally {
          captchaServer.close();
          await browser.close();
        }
      }
    }
  });

  return results;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isMain || process.argv[1]?.endsWith("test_fetch_url.mjs")) {
  console.log("Running Fetch URL Comprehensive Test Suite (17 Tests)...");
  runFetchUrlTests().then((res) => {
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
