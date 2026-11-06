import {
  resizeImage,
  formatDimensionNote,
  convertToPng,
  type ExtensionAPI,
  type ExtensionContext
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { createRequire } from "node:module";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { pathToFileURL } from "node:url";

/**
 * Lean URL Fetch & Web Extraction Extension for Pi Coding Agent
 *
 * Tools & Commands:
 * - `fetch_url`: HTTP retrieval with got-scraping, WAF & JS-shell detection, Chrome CDP browser fallback (via DevToolsActivePort), Defuddle markdown extraction, and multimodal vision.
 * - `/fetch-gate`: Slash command to toggle pre-request confirmation gate ([status|on|off|toggle]).
 * - `/fetch-engine`: Slash command to set retrieval engine ([auto|chrome|got-scraping|status]).
 *
 * Configuration & CLI Flags:
 * - `--no-fetch-gate`: CLI flag to disable confirmation prompts for URL fetch.
 * - `PI_FETCH_GATE`: Environment variable override (set to "0" or "false" to disable).
 * - `PI_GATES`: Master environment variable override (set to "0" or "false" to disable all gates).
 * - `--fetch-engine`: CLI flag to set retrieval engine ('auto' | 'chrome' | 'got-scraping').
 * - `PI_FETCH_ENGINE`: Environment variable override for retrieval engine.
 */

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_FETCH_BYTES = 5 * 1024 * 1024; // 5 MB download limit
const CONFIRM_TIMEOUT_MS = 30000; // 30s confirmation auto-dismiss

export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50 KB output ceiling
const COLLAPSED_PREVIEW_LINES = 6;

export type FetchEngine = "auto" | "chrome" | "got-scraping";

/**
 * Evaluates whether a gate should be active at startup based on CLI flags and environment variables.
 */
function isGateInitiallyEnabled(gateKey: string, flagName: string, pi?: ExtensionAPI): boolean {
  if (pi?.getFlag(flagName) === true) {
    return false;
  }
  if (process.argv.includes(`--${flagName}`) || process.argv.includes("--no-gates")) {
    return false;
  }

  const master = process.env.PI_GATES?.trim().toLowerCase();
  if (master && ["0", "false", "off", "disable", "disabled", "no"].includes(master)) {
    return false;
  }

  const val = process.env[gateKey]?.trim().toLowerCase();
  if (val && ["0", "false", "off", "disable", "disabled", "no"].includes(val)) {
    return false;
  }

  return true;
}

let gateEnabled = isGateInitiallyEnabled("PI_FETCH_GATE", "no-fetch-gate");

/**
 * Resolves the initial fetch engine setting from flags or environment variables.
 */
function getInitialEngine(pi?: ExtensionAPI): FetchEngine {
  const flagVal = pi?.getFlag("fetch-engine");
  if (typeof flagVal === "string") {
    const lower = flagVal.trim().toLowerCase();
    if (lower === "chrome" || lower === "got-scraping" || lower === "auto") return lower;
  }

  const argvArg = process.argv.find(a => a.startsWith("--fetch-engine="));
  if (argvArg) {
    const val = argvArg.split("=")[1]?.trim().toLowerCase();
    if (val === "chrome" || val === "got-scraping" || val === "auto") return val;
  }

  const envVal = process.env.PI_FETCH_ENGINE?.trim().toLowerCase();
  if (envVal === "chrome" || envVal === "got-scraping" || envVal === "auto") {
    return envVal;
  }

  return "auto";
}

let currentEngine: FetchEngine = getInitialEngine();

/**
 * Resolves npm packages from Pi's isolated package directory (~/.pi/agent/npm/).
 * Strictly adheres to Pi's isolated package architecture without touching global npm.
 */
function loadDependency<T = any>(name: string): T {
  try {
    const piNpmDir = path.join(os.homedir(), ".pi", "agent", "npm", "package.json");
    const piReq = createRequire(piNpmDir);
    return piReq(name);
  } catch {
    throw new Error(`Failed to load '${name}'. Please install it via 'npm --prefix ~/.pi/agent/npm install'`);
  }
}

let cachedDefuddle: any = null;
let cachedToMarkdown: any = null;
let cachedParseLinkedomHTML: any = null;
let cachedGotScraping: any = null;
let cachedPlaywright: any = null;

/**
 * Lazy loader for got-scraping anti-bot HTTP client (ESM module).
 */
async function getGotScraping() {
  if (!cachedGotScraping) {
    const directPath = path.join(os.homedir(), ".pi", "agent", "npm", "node_modules", "got-scraping", "dist", "index.js");
    const mod = await import(pathToFileURL(directPath).href);
    cachedGotScraping = mod.gotScraping;
  }
  return cachedGotScraping;
}

/**
 * Lazy loader for Playwright browser automation engine.
 */
function getPlaywright() {
  if (!cachedPlaywright) {
    cachedPlaywright = loadDependency("playwright-core").chromium;
  }
  return cachedPlaywright;
}

/**
 * Lazy loader for Defuddle HTML-to-Markdown parser.
 */
function getParsers() {
  if (!cachedDefuddle) {
    cachedDefuddle = loadDependency("./node_modules/defuddle/dist/defuddle.js").Defuddle;
  }
  if (!cachedToMarkdown) {
    cachedToMarkdown = loadDependency("./node_modules/defuddle/dist/markdown.js").toMarkdown;
  }
  if (!cachedParseLinkedomHTML) {
    cachedParseLinkedomHTML = loadDependency("./node_modules/defuddle/dist/utils/linkedom-compat.js").parseLinkedomHTML;
  }

  return {
    Defuddle: cachedDefuddle,
    toMarkdown: cachedToMarkdown,
    parseLinkedomHTML: cachedParseLinkedomHTML
  };
}

export interface SniffedContent {
  category: "html" | "image" | "svg" | "json" | "text" | "binary";
  mimeType: string;
  charset: string;
}

/**
 * 2-Tier Content Sniffer: Inspects Content-Type header and first 512 magic bytes.
 */
export function sniffContentType(buffer: Uint8Array, rawHeaderMime = ""): SniffedContent {
  const headerParts = rawHeaderMime.split(";");
  const headerMime = (headerParts[0] || "").trim().toLowerCase();

  let charset = "utf-8";
  for (let i = 1; i < headerParts.length; i++) {
    const part = headerParts[i].trim().toLowerCase();
    if (part.startsWith("charset=")) {
      charset = part.slice(8).replace(/["']/g, "").trim() || "utf-8";
      break;
    }
  }

  // 1. Magic Bytes for Raster Images
  if (buffer.length >= 4) {
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { category: "image", mimeType: "image/png", charset };
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { category: "image", mimeType: "image/jpeg", charset };
    }
    // GIF: 47 49 46 38 (GIF8)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return { category: "image", mimeType: "image/gif", charset };
    }
    // WebP: RIFF....WEBP (52 49 46 46 ... 57 45 42 50)
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return { category: "image", mimeType: "image/webp", charset };
    }
  }

  // 2. SVG (Vector XML)
  if (headerMime === "image/svg+xml") {
    return { category: "svg", mimeType: "image/svg+xml", charset };
  }

  // 3. Scan first 512 bytes for null bytes (\0) to detect disguised binary files
  const inspectLen = Math.min(buffer.length, 512);
  let hasNullByte = false;
  for (let i = 0; i < inspectLen; i++) {
    if (buffer[i] === 0x00) {
      hasNullByte = true;
      break;
    }
  }

  // Known image MIME types
  if (headerMime.startsWith("image/")) {
    return { category: "image", mimeType: headerMime, charset };
  }

  // Binary types or null-byte detection
  if (hasNullByte ||
      headerMime === "application/octet-stream" ||
      headerMime === "application/zip" ||
      headerMime === "application/x-tar" ||
      headerMime === "application/gzip" ||
      headerMime.startsWith("audio/") ||
      headerMime.startsWith("video/") ||
      headerMime === "application/pdf" ||
      headerMime === "application/x-executable" ||
      headerMime === "application/vnd.microsoft.portable-executable") {
    return { category: "binary", mimeType: headerMime || "application/octet-stream", charset };
  }

  // Sample initial text for HTML, JSON, or SVG cues
  let sampleText = "";
  try {
    const dec = new TextDecoder(charset);
    sampleText = dec.decode(buffer.subarray(0, Math.min(buffer.length, 1024))).trim();
  } catch {
    sampleText = new TextDecoder("utf-8").decode(buffer.subarray(0, Math.min(buffer.length, 1024))).trim();
  }

  if (headerMime === "text/html" || headerMime === "application/xhtml+xml" || /<!doctype\s+html|<html[\s>]/i.test(sampleText)) {
    return { category: "html", mimeType: "text/html", charset };
  }

  if (sampleText.startsWith("<svg") || (sampleText.startsWith("<?xml") && sampleText.includes("<svg"))) {
    return { category: "svg", mimeType: "image/svg+xml", charset };
  }

  if (headerMime === "application/json" || headerMime === "application/ld+json" || ((sampleText.startsWith("{") || sampleText.startsWith("[")) && (sampleText.endsWith("}") || sampleText.endsWith("]")))) {
    return { category: "json", mimeType: "application/json", charset };
  }

  return { category: "text", mimeType: headerMime || "text/plain", charset };
}

/**
 * Output truncation guard capping output to maxLines and maxBytes.
 */
export function truncateHead(content: string, options: { maxLines?: number; maxBytes?: number } = {}): {
  content: string;
  truncated: boolean;
} {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const totalBytes = Buffer.byteLength(content, "utf-8");
  const lines = content.split("\n");
  if (content.endsWith("\n")) lines.pop();

  if (lines.length <= maxLines && totalBytes <= maxBytes) {
    return { content, truncated: false };
  }

  const outputLinesArr: string[] = [];
  let outputBytesCount = 0;

  for (let i = 0; i < lines.length && i < maxLines; i++) {
    const line = lines[i];
    const lineBytes = Buffer.byteLength(line, "utf-8") + (i > 0 ? 1 : 0);
    if (outputBytesCount + lineBytes > maxBytes) {
      break;
    }
    outputLinesArr.push(line);
    outputBytesCount += lineBytes;
  }

  return {
    content: outputLinesArr.join("\n"),
    truncated: true
  };
}

/**
 * Formats tool output showing first X lines in collapsed view and full content on Ctrl+O.
 */
function formatToolOutput(content: string, theme?: any, expanded?: boolean, maxLines = COLLAPSED_PREVIEW_LINES): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  const lines = trimmed.split("\n");

  if (expanded || lines.length <= maxLines) {
    return lines.map((l: string) => theme ? theme.fg("toolOutput", l) : l).join("\n");
  }

  const preview = lines.slice(0, maxLines).map((l: string) => theme ? theme.fg("toolOutput", l) : l).join("\n");
  const remaining = lines.length - maxLines;
  const hint = theme
    ? theme.fg("muted", `\n\n... (${remaining} more lines, `) + theme.fg("accent", "ctrl+o") + theme.fg("muted", " to expand)")
    : `\n\n... (${remaining} more lines)`;
  return `${preview}${hint}`;
}

export const FetchUrlSchema = Type.Object({
  url: Type.String({
    description: "The URL of the web page, file, or image to fetch."
  })
});

export type FetchUrlParams = Static<typeof FetchUrlSchema>;

export interface PageImageItem {
  url: string;
  alt?: string;
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
  source?: "opengraph" | "article" | "content";
}

export interface FetchToolDetails {
  url?: string;
  title?: string;
  denied?: boolean;
  error?: string;
  durationMs?: number;
  engine?: string;
  fallbackReason?: string;
  isImage?: boolean;
  contentType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  usedBrowser?: boolean;
  viaCDP?: boolean;
  isUserSession?: boolean;
  imageCount?: number;
  fullContent?: string;
}

/**
 * Validates protocol and URL structure.
 */
function validateRemoteUrl(rawUrl: string | URL): URL {
  const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid protocol '${url.protocol}'. Only HTTP and HTTPS URLs are allowed.`);
  }
  if (!url.hostname) {
    throw new Error("URL must include a valid hostname.");
  }
  return url;
}

function getHeaderString(headers: Record<string, any>, key: string): string {
  const val = headers?.[key];
  if (Array.isArray(val)) return String(val[0] || "").toLowerCase();
  return typeof val === "string" ? val.toLowerCase() : "";
}

/**
 * Deterministic WAF & anti-bot response header inspection.
 */
export function detectWafHeaderBlock(headers: Record<string, any>, statusCode: number): string | null {
  if (!headers) return null;

  const cfMitigated = getHeaderString(headers, "cf-mitigated");
  const server = getHeaderString(headers, "server");
  if (cfMitigated.includes("challenge") || (server === "cloudflare" && (statusCode === 403 || statusCode === 503))) {
    return "Blocked by Cloudflare challenge";
  }

  const vercelMitigated = getHeaderString(headers, "x-vercel-mitigated");
  const vercelChallenge = getHeaderString(headers, "x-vercel-challenge");
  if (vercelMitigated.includes("challenge") || vercelChallenge === "1") {
    return "Blocked by Vercel Attack Challenge";
  }

  const amznWafAction = getHeaderString(headers, "x-amzn-waf-action");
  const amznErrType = getHeaderString(headers, "x-amzn-errortype");
  if (amznWafAction === "challenge" || amznWafAction === "captcha" || amznErrType.includes("waf")) {
    return "Blocked by AWS WAF challenge";
  }

  const datadome = getHeaderString(headers, "x-datadome");
  const datadomeRes = getHeaderString(headers, "x-datadome-response");
  const datadomeCid = getHeaderString(headers, "x-datadome-cid");
  if (datadome === "protected" || datadomeRes === "blocked" || (datadomeCid && (statusCode === 401 || statusCode === 403))) {
    return "Blocked by DataDome";
  }

  const xCdn = getHeaderString(headers, "x-cdn");
  if ((xCdn.includes("incapsula") || xCdn.includes("imperva")) && statusCode >= 400) {
    return "Blocked by Imperva/Incapsula";
  }

  const kasada = getHeaderString(headers, "x-kpsdk-ct");
  if (kasada && (statusCode === 403 || statusCode === 429)) {
    return "Blocked by Kasada";
  }

  return null;
}

/**
 * Fetches remote URL safely with redirect following (up to 5 hops), 5MB size ceiling, and anti-bot handling via got-scraping.
 */
async function fetchSafeRemote(
  rawUrl: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ rawBuffer: Uint8Array; contentType: string; finalUrl: string }> {
  const initialUrl = validateRemoteUrl(rawUrl);
  const gotScraping = await getGotScraping();

  let sizeLimitError: Error | null = null;

  const req = gotScraping(initialUrl.toString(), {
    responseType: "buffer",
    maxRedirects: 5,
    sessionToken: {},
    timeout: { request: timeoutMs },
    signal
  });

  // Upfront Content-Length (progress.total at transferred=0) & mid-stream transfer guard
  req.on("downloadProgress", (progress: { transferred: number; total?: number }) => {
    if (!progress || sizeLimitError) return;
    if (typeof progress.total === "number" && progress.total > MAX_FETCH_BYTES) {
      sizeLimitError = new Error(
        `Response Content-Length (${(progress.total / 1024 / 1024).toFixed(1)}MB) exceeds limit of ${MAX_FETCH_BYTES / 1024 / 1024}MB`
      );
      req.cancel();
    } else if (progress.transferred > MAX_FETCH_BYTES) {
      sizeLimitError = new Error(
        `Response size (${(progress.transferred / 1024 / 1024).toFixed(1)}MB) exceeds limit of ${MAX_FETCH_BYTES / 1024 / 1024}MB`
      );
      req.cancel();
    }
  });

  let res: any;
  try {
    res = await req;
  } catch (gotErr: any) {
    if (sizeLimitError) throw sizeLimitError;
    throw gotErr;
  }

  if (sizeLimitError) throw sizeLimitError;

  const responseStatus: number = res.statusCode;
  const contentType: string = res.headers["content-type"] || "";
  const rawBuffer = new Uint8Array(res.rawBody);
  const finalUrl = res.url || initialUrl.toString();

  // Check deterministic WAF / anti-bot mitigation headers
  const wafHeaderReason = detectWafHeaderBlock(res.headers, responseStatus);
  if (wafHeaderReason) {
    throw new Error(`${wafHeaderReason} (HTTP ${responseStatus})`);
  }

  if (responseStatus >= 400) {
    throw new Error(`HTTP ${responseStatus}: Request failed`);
  }

  return { rawBuffer, contentType, finalUrl };
}

/**
 * Resolves the default Google Chrome User Data Directory across operating systems.
 */
function getDefaultChromeUserDataDir(): string {
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "Google", "Chrome", "User Data");
  } else if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Google", "Chrome");
  } else {
    return path.join(home, ".config", "google-chrome");
  }
}

/**
 * Reads DevToolsActivePort from Chrome user data directory to discover active port and browser target GUID.
 */
async function getActiveChromeEndpoint(userDataDir?: string): Promise<{ wsEndpoint: string; port: number } | null> {
  const targetDir = userDataDir || getDefaultChromeUserDataDir();
  const portFile = path.join(targetDir, "DevToolsActivePort");

  try {
    const content = await fs.readFile(portFile, "utf8");
    const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const port = parseInt(lines[0], 10);
      const rawPath = lines[1];
      if (!isNaN(port) && port > 0 && rawPath.startsWith("/")) {
        return {
          port,
          wsEndpoint: `ws://127.0.0.1:${port}${rawPath}`
        };
      }
    }
  } catch {
    // Port file does not exist or cannot be read
  }
  return null;
}

let cachedBrowser: any = null;
let cdpIdleTimer: NodeJS.Timeout | null = null;
const CDP_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min idle before releasing CDP socket

function resetCdpIdleTimer(): void {
  if (cdpIdleTimer) clearTimeout(cdpIdleTimer);
  cdpIdleTimer = setTimeout(() => {
    disconnectCdpBrowser().catch(() => {});
  }, CDP_IDLE_TIMEOUT_MS);
  cdpIdleTimer.unref();
}

export async function disconnectCdpBrowser(): Promise<void> {
  if (cdpIdleTimer) {
    clearTimeout(cdpIdleTimer);
    cdpIdleTimer = null;
  }
  if (cachedBrowser) {
    try {
      await cachedBrowser.disconnect().catch(() => {});
    } catch {}
    cachedBrowser = null;
  }
}

/**
 * Retrieves an active persistent Chrome CDP connection, or establishes one.
 * Reusing the connection prevents Chrome from showing the "Allow remote debugging"
 * security prompt on every single fetch call.
 */
async function getOrCreateChromeCDPBrowser(
  chromium: any,
  onUpdate?: (update: any) => void,
  signal?: AbortSignal
): Promise<any> {
  if (signal?.aborted) {
    throw new Error("Request aborted");
  }
  if (cachedBrowser) {
    try {
      if (cachedBrowser.isConnected()) {
        resetCdpIdleTimer();
        return cachedBrowser;
      }
    } catch {
      cachedBrowser = null;
    }
  }

  // Auto-detect active user Chrome session via DevToolsActivePort
  const activeUserEndpoint = await getActiveChromeEndpoint();
  if (!activeUserEndpoint) {
    throw new Error(
      "Google Chrome is not running with remote debugging enabled. Please ensure Chrome is open with remote debugging active (chrome://inspect/#remote-debugging)."
    );
  }

  onUpdate?.({
    content: [{
      type: "text",
      text: 'Connecting to Chrome... Please click "Allow" on Chrome\'s remote debugging prompt if shown (waiting up to 30s)...'
    }]
  });

  let browser: any = null;
  try {
    const connectPromise = chromium.connectOverCDP(activeUserEndpoint.wsEndpoint, { timeout: 30000 });
    if (signal) {
      connectPromise.catch(() => {});
      browser = await Promise.race([
        connectPromise,
        new Promise((_, reject) => {
          if (signal.aborted) return reject(new Error("Request aborted"));
          signal.addEventListener("abort", () => reject(new Error("Request aborted")), { once: true });
        })
      ]);
    } else {
      browser = await connectPromise;
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err?.name || "";

    if (name === "TimeoutError" || msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed out")) {
      throw new Error(
        "Connection timed out after 30s waiting for user confirmation on Chrome's remote debugging prompt. Please click 'Allow' in Chrome when prompted."
      );
    }

    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("closed") ||
      msg.includes("1006") ||
      msg.includes("rejected") ||
      msg.includes("denied")
    ) {
      throw new Error(
        "Chrome remote debugging connection was declined or rejected in the browser."
      );
    }

    throw new Error(
      `Failed to attach to Chrome Remote Debugging: ${msg}`
    );
  }

  cachedBrowser = browser;

  browser.on("disconnected", () => {
    if (cachedBrowser === browser) {
      cachedBrowser = null;
    }
  });

  resetCdpIdleTimer();
  return browser;
}

/**
 * Event-driven Chrome page readiness pipeline:
 * 1. Detects active WAF / CAPTCHA challenges, brings the tab to front, and waits up to 60s across navigations for user completion.
 * 2. Auto-dismisses common consent / cookie banners.
 * 3. Uses an in-page MutationObserver (childList + characterData, no attributes) to resolve as soon as content hydrates and the DOM is quiet for `quietMs`.
 */
export async function waitForChromePageReady(
  page: any,
  options?: {
    signal?: AbortSignal;
    onUpdate?: (update: any) => void;
    challengeTimeoutMs?: number;
    settleTimeoutMs?: number;
    quietMs?: number;
  }
): Promise<void> {
  const signal = options?.signal;
  const challengeTimeoutMs = options?.challengeTimeoutMs ?? 60000;
  const settleTimeoutMs = options?.settleTimeoutMs ?? 8000;
  const quietMs = options?.quietMs ?? 500;

  const isContextDestroyedError = (err: any): boolean => {
    const msg = String(err?.message || err || "");
    return (
      msg.includes("Execution context was destroyed") ||
      msg.includes("Cannot find context with specified id") ||
      msg.includes("navigation") ||
      msg.includes("Target closed")
    );
  };

  // Detect whether the page is currently displaying a WAF / CAPTCHA interstitial
  const checkIsChallenge = async (): Promise<boolean> => {
    try {
      return await page.evaluate(() => {
        const title = document.title || "";
        if (
          /(just a moment|security checkpoint|checking your browser|attention required|verify you are human|human verification|ddos-guard|access denied.*cloudflare|browser verification)/i.test(
            title
          )
        ) {
          return true;
        }
        const hardSelector =
          '#challenge-running, #cf-challenge-running, #challenge-stage, #challenge-form, #turnstile-wrapper, .cf-turnstile, iframe[src*="challenges.cloudflare.com"], iframe[src*="captcha-delivery.com"], iframe[src*="datadome"], #amzn-captcha-modal, script[src*="awswaf"], iframe[src*="_Incapsula_Resource"], #px-captcha, #results-inprogress, .resultbox';
        if (document.querySelector(hardSelector)) return true;

        const bodyText = (document.body?.innerText || "").trim();
        if (
          /(verify (you are|that you are) human|checking your browser|checking that you're not a bot|enable javascript and cookies to continue)/i.test(
            bodyText
          )
        ) {
          return true;
        }

        if (
          bodyText.length < 800 &&
          document.querySelector('iframe[src*="hcaptcha.com"], iframe[src*="recaptcha/api2"], .g-recaptcha, .h-captcha')
        ) {
          return true;
        }
        return false;
      });
    } catch (err) {
      if (isContextDestroyedError(err)) return true;
      return false;
    }
  };

  // Stage 1: Challenge / CAPTCHA Gate (0ms if normal page, up to 60s if challenge detected)
  if (await checkIsChallenge()) {
    await page.bringToFront?.().catch(() => {});
    options?.onUpdate?.({
      content: [
        {
          type: "text",
          text: "🔒 Security challenge / CAPTCHA detected in Chrome — please complete it on screen (waiting up to 60s)..."
        }
      ]
    });

    const challengeStart = Date.now();
    let solved = false;
    while (Date.now() - challengeStart < challengeTimeoutMs) {
      if (signal?.aborted) throw new Error("Request aborted");
      const remaining = challengeTimeoutMs - (Date.now() - challengeStart);
      if (remaining <= 0) break;

      try {
        await page.waitForFunction(
          () => {
            const title = document.title || "";
            if (
              /(just a moment|security checkpoint|checking your browser|attention required|verify you are human|human verification|ddos-guard|access denied.*cloudflare|browser verification)/i.test(
                title
              )
            ) {
              return false;
            }
            const hardSelector =
              '#challenge-running, #cf-challenge-running, #challenge-stage, #challenge-form, #turnstile-wrapper, .cf-turnstile, iframe[src*="challenges.cloudflare.com"], iframe[src*="captcha-delivery.com"], iframe[src*="datadome"], #amzn-captcha-modal, script[src*="awswaf"], iframe[src*="_Incapsula_Resource"], #px-captcha, #results-inprogress, .resultbox';
            if (document.querySelector(hardSelector)) return false;

            const bodyText = (document.body?.innerText || "").trim();
            if (
              /(verify (you are|that you are) human|checking your browser|checking that you're not a bot|enable javascript and cookies to continue)/i.test(
                bodyText
              )
            ) {
              return false;
            }

            if (
              bodyText.length < 800 &&
              document.querySelector('iframe[src*="hcaptcha.com"], iframe[src*="recaptcha/api2"], .g-recaptcha, .h-captcha')
            ) {
              return false;
            }
            return true;
          },
          undefined,
          { timeout: Math.min(2500, remaining) }
        );

        await page.waitForLoadState?.("domcontentloaded", { timeout: 5000 }).catch(() => {});
        if (!(await checkIsChallenge())) {
          solved = true;
          break;
        }
      } catch (err: any) {
        if (signal?.aborted) throw new Error("Request aborted");
        if (isContextDestroyedError(err)) {
          // Solving the CAPTCHA triggered a navigation/reload; wait for new DOM and re-check
          await page.waitForLoadState?.("domcontentloaded", { timeout: 10000 }).catch(() => {});
          if (!(await checkIsChallenge())) {
            solved = true;
            break;
          }
          continue;
        }
      }
    }

    if (!solved && (await checkIsChallenge())) {
      throw new Error("Timed out waiting for CAPTCHA / security challenge in Chrome to be solved.");
    }
  }

  // Stage 2: Auto-dismiss common consent / age gate buttons if present
  try {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']"));
      const consentBtn = buttons.find((el) => {
        const txt = (el.textContent || (el as HTMLInputElement).value || "").trim();
        return /^(accept|accept all|i agree|allow all|yes|confirm|enter|agree|continue|ok|proceed)$/i.test(txt);
      });
      if (consentBtn) {
        (consentBtn as HTMLElement).click();
      }
    });
  } catch {}

  // Stage 2.5: Fast-path for non-HTML / static documents (JSON, plain text, images, media, PDF)
  try {
    const isStaticDoc = await page.evaluate(() => {
      const type = (document.contentType || "").toLowerCase();
      return (
        type.includes("json") ||
        type.startsWith("image/") ||
        type.startsWith("text/plain") ||
        type.startsWith("text/csv") ||
        type.startsWith("audio/") ||
        type.startsWith("video/") ||
        type === "application/pdf" ||
        type === "application/octet-stream"
      );
    });
    if (isStaticDoc) {
      return;
    }
  } catch {}

  // Stage 3: Navigation-safe MutationObserver DOM settler (childList + characterData)
  const settleStart = Date.now();
  while (Date.now() - settleStart < settleTimeoutMs) {
    if (signal?.aborted) throw new Error("Request aborted");
    const remaining = settleTimeoutMs - (Date.now() - settleStart);
    if (remaining <= 0) break;

    try {
      await page.waitForFunction(
        ({ debounceMs }: { debounceMs: number }) =>
          new Promise<boolean>((resolve) => {
            const hasMeaningfulContent = () => {
              // Ignore if major container is explicitly marked busy
              if (document.querySelector("[aria-busy='true']")) {
                const mainEl = document.querySelector("article, main, [role='main']") as HTMLElement | null;
                if (!mainEl || mainEl.getAttribute("aria-busy") === "true") return false;
              }

              const mainEl = document.querySelector("article, main, [role='main']") as HTMLElement | null;
              if (mainEl) {
                const mainText = (mainEl.innerText || mainEl.textContent || "").trim();
                return mainText.length >= 100 && !/^(loading|please wait|fetching|retrieving)\b/i.test(mainText);
              }
              if (!document.body) return false;
              let noiseLen = 0;
              const noiseEls = document.body.querySelectorAll(
                "#onetrust-consent-sdk, #CybotCookiebotDialog, [id*='cookie' i], [class*='cookie-banner' i], [class*='consent' i], nav, header, footer, .skeleton, [class*='skeleton' i], [class*='shimmer' i]"
              );
              for (const el of Array.from(noiseEls)) {
                noiseLen += ((el as HTMLElement).innerText || el.textContent || "").trim().length;
              }
              const bodyText = (document.body.innerText || document.body.textContent || "").trim();
              const netLen = bodyText.length - noiseLen;
              if (netLen >= 100 && !/^(loading|please wait|fetching|retrieving)\b/i.test(bodyText)) return true;
              if (netLen > 0 && document.readyState === "complete" && document.querySelectorAll("script").length === 0) {
                return true;
              }
              if (netLen > 0 && document.querySelector("pre, table") && !/^(loading|please wait|fetching)\b/i.test(bodyText)) return true;
              return false;
            };

            let timer: ReturnType<typeof setTimeout> | undefined;
            const armTimer = () => {
              if (timer !== undefined) clearTimeout(timer);
              if (!hasMeaningfulContent()) return;
              timer = setTimeout(() => {
                observer.disconnect();
                resolve(true);
              }, debounceMs);
            };

            const observer = new MutationObserver(() => {
              armTimer();
            });

            const root = document.body || document.documentElement;
            if (root) {
              observer.observe(root, {
                childList: true,
                subtree: true,
                characterData: true
              });
            }

            armTimer();
          }),
        { debounceMs: quietMs },
        { timeout: Math.max(remaining, quietMs + 50) }
      );
      break;
    } catch (err: any) {
      if (signal?.aborted) throw new Error("Request aborted");
      if (isContextDestroyedError(err)) {
        await page.waitForLoadState?.("domcontentloaded", { timeout: 5000 }).catch(() => {});
        continue;
      }
      // Timeout reached (e.g. very short page or continuous live ticker) — proceed with current DOM
      break;
    }
  }
}

/**
 * Browser renderer via Playwright connecting directly to live desktop Chrome via Remote Debugging.
 * Automatically piggybacks on the user's active Chrome session via DevToolsActivePort.
 */
async function fetchViaChromeCDP(
  rawUrl: string,
  options?: { signal?: AbortSignal; timeoutMs?: number; onUpdate?: (update: any) => void }
): Promise<{ rawBuffer: Uint8Array; contentType: string; finalUrl: string; pageTitle?: string; images?: Array<PageImageItem>; isUserSession?: boolean }> {
  const signal = options?.signal;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const validUrl = validateRemoteUrl(rawUrl);
  const chromium = getPlaywright();
  const browser = await getOrCreateChromeCDPBrowser(chromium, options?.onUpdate, signal);
  resetCdpIdleTimer();

  let page: any = null;

  try {
    // In CDP mode, use the default active browser context (contains all user logins, cookies, session state)
    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    page = await context.newPage();

    if (signal) {
      signal.addEventListener("abort", () => {
        page?.close().catch(() => {});
      }, { once: true });
    }

    let latestStatus = 0;
    let latestStatusText = "";
    let latestNavResponse: any = null;

    page.on?.("response", (res: any) => {
      try {
        if (res.request?.().isNavigationRequest?.() && res.frame?.() === page.mainFrame?.()) {
          latestStatus = res.status?.() ?? latestStatus;
          latestStatusText = res.statusText?.() ?? latestStatusText;
          latestNavResponse = res;
        }
      } catch {}
    });

    const initialNavResponse = await page.goto(validUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });

    if (initialNavResponse && !latestNavResponse) {
      latestNavResponse = initialNavResponse;
      latestStatus = initialNavResponse.status?.() ?? 0;
      latestStatusText = initialNavResponse.statusText?.() ?? "";
    }

    await waitForChromePageReady(page, { signal, onUpdate: options?.onUpdate });

    const navResponse = latestNavResponse || initialNavResponse;
    if (latestStatus >= 400) {
      const bodyLen = await page.evaluate(() => (document.body?.innerText || "").trim().length).catch(() => 0);
      if (bodyLen < 200) {
        throw new Error(`HTTP ${latestStatus}: ${latestStatusText || "Request failed"}`);
      }
    }

    const pageTitle = await page.title();
    const finalUrl = page.url();

    // Check if the response or document is an image, media, or binary file
    const navHeaders = navResponse ? navResponse.headers() : {};
    const navContentType = (navHeaders["content-type"] || "").toLowerCase();

    const docInfo = await page.evaluate(() => {
      const isImgDoc = document.contentType?.startsWith("image/") ||
        (document.body && document.body.children.length === 1 && document.querySelector("body > img") !== null);
      const imgEl = document.querySelector("body > img, img") as HTMLImageElement | null;
      return {
        contentType: document.contentType || "",
        isImageDoc: Boolean(isImgDoc),
        imgSrc: imgEl ? imgEl.src : null
      };
    }).catch(() => ({ contentType: "", isImageDoc: false, imgSrc: null }));

    const effectiveMime = navContentType || docInfo.contentType;
    const isImageResource = effectiveMime.startsWith("image/") || docInfo.isImageDoc;
    const isBinaryResource = isImageResource ||
      effectiveMime.startsWith("audio/") ||
      effectiveMime.startsWith("video/") ||
      effectiveMime === "application/pdf" ||
      effectiveMime === "application/octet-stream";
    const isJsonResource = effectiveMime.includes("application/json") || effectiveMime.includes("application/problem+json") || docInfo.contentType.includes("json");
    const isTextResource = effectiveMime.startsWith("text/plain") || effectiveMime.startsWith("text/csv") || docInfo.contentType.startsWith("text/plain");

    if (isImageResource && navResponse) {
      try {
        const bodyBuf = await navResponse.body();
        if (bodyBuf && bodyBuf.length > 0) {
          return {
            rawBuffer: new Uint8Array(bodyBuf),
            contentType: effectiveMime || "image/png",
            finalUrl,
            pageTitle,
            isUserSession: true
          };
        }
      } catch {}
    }

    if (isBinaryResource && navResponse) {
      try {
        const bodyBuf = await navResponse.body();
        if (bodyBuf && bodyBuf.length > 0) {
          return {
            rawBuffer: new Uint8Array(bodyBuf),
            contentType: effectiveMime || "application/octet-stream",
            finalUrl,
            pageTitle,
            isUserSession: true
          };
        }
      } catch {}
    }

    if (isJsonResource) {
      if (navResponse) {
        try {
          const bodyBuf = await navResponse.body();
          if (bodyBuf && bodyBuf.length > 0) {
            return {
              rawBuffer: new Uint8Array(bodyBuf),
              contentType: effectiveMime || "application/json",
              finalUrl,
              pageTitle,
              isUserSession: true
            };
          }
        } catch {}
      }
      const rawText = await page.evaluate(() => document.querySelector("pre")?.innerText || document.body?.innerText || "").catch(() => "");
      return {
        rawBuffer: new TextEncoder().encode(rawText),
        contentType: effectiveMime || "application/json",
        finalUrl,
        pageTitle,
        isUserSession: true
      };
    }

    if (isTextResource) {
      if (navResponse) {
        try {
          const bodyBuf = await navResponse.body();
          if (bodyBuf && bodyBuf.length > 0) {
            return {
              rawBuffer: new Uint8Array(bodyBuf),
              contentType: effectiveMime || "text/plain",
              finalUrl,
              pageTitle,
              isUserSession: true
            };
          }
        } catch {}
      }
      const rawText = await page.evaluate(() => document.querySelector("pre")?.innerText || document.body?.innerText || "").catch(() => "");
      return {
        rawBuffer: new TextEncoder().encode(rawText),
        contentType: effectiveMime || "text/plain",
        finalUrl,
        pageTitle,
        isUserSession: true
      };
    }

    const htmlContent = await page.content();

    const pageAssets = await page.evaluate(() => {
      const JUNK_REGEX = /(?:^data:image|\/avatar[s\/]|\/icon[s\/]|\/favicon|\/logo[s\/]|\blogo\b|badge|button|pixel|spacer|\b1x1\b|tracking|analytics|doubleclick|advertisement|banner-ad|share-button|social-icons?|spinner|loader|placeholder|footer-logo|header-logo)/i;

      // High-Quality Content Images
      const images: Array<{ url: string; alt?: string; title?: string; caption?: string; width?: number; height?: number; source?: "opengraph" | "article" | "content" }> = [];
      const seenImages = new Set<string>();

      function addImg(url: string, meta: { alt?: string; title?: string; caption?: string; width?: number; height?: number; source?: "opengraph" | "article" | "content" }) {
        if (!url || !url.startsWith("http")) return;
        const cleanUrl = url.split("#")[0];
        if (seenImages.has(cleanUrl) || JUNK_REGEX.test(cleanUrl)) return;
        seenImages.add(cleanUrl);
        images.push({ url: cleanUrl, ...meta });
      }

      // 1. OpenGraph & Twitter Card Hero Images (Guaranteed high quality)
      const ogImg = document.querySelector('meta[property="og:image"], meta[name="og:image"]')?.getAttribute("content");
      if (ogImg) addImg(ogImg, { source: "opengraph", alt: "Hero / Featured Image" });

      const twImg = document.querySelector('meta[name="twitter:image"], meta[name="twitter:image:src"]')?.getAttribute("content");
      if (twImg) addImg(twImg, { source: "opengraph", alt: "Preview Image" });

      // 2. Content Body Images
      const imgElements = document.querySelectorAll("article img, main img, [role='main'] img, figure img, .post-content img, .entry-content img, .article-body img, img");
      for (const el of imgElements) {
        if (images.length >= 15) break;
        const img = el as HTMLImageElement;
        const src = img.currentSrc || img.src || img.getAttribute("data-src") || "";
        if (!src || !src.startsWith("http")) continue;

        // Skip tiny icons, spacers, tracking pixels
        const w = img.naturalWidth || parseInt(img.getAttribute("width") || "0", 10) || 0;
        const h = img.naturalHeight || parseInt(img.getAttribute("height") || "0", 10) || 0;
        if ((w > 0 && w < 120) || (h > 0 && h < 120)) continue;

        // Skip if inside navigation, header, footer, or sidebar
        if (img.closest("nav, header, footer, aside, .nav, .menu, .sidebar, .comments, .ad, .social-share")) continue;

        const figcaption = img.closest("figure")?.querySelector("figcaption")?.textContent?.trim();
        const alt = img.alt?.trim();
        const title = img.title?.trim();

        addImg(src, {
          alt: alt || undefined,
          title: title || undefined,
          caption: figcaption || undefined,
          width: w > 0 ? w : undefined,
          height: h > 0 ? h : undefined,
          source: figcaption || alt ? "article" : "content"
        });
      }

      return { images };
    }).catch(() => ({ images: [] }));

    const rawBuffer = new TextEncoder().encode(htmlContent);
    return { rawBuffer, contentType: "text/html; charset=utf-8", finalUrl, pageTitle, images: pageAssets.images, isUserSession: true };
  } finally {
    // Only close the tab. The persistent CDP browser connection stays active in the pool.
    try {
      await page?.close().catch(() => {});
    } catch {}
  }
}


/**
 * Extracts high-value content images from static DOM while filtering out junk (icons, tracking pixels, UI glyphs).
 */
export function extractImagesFromHtml(document: any, baseUrl: string): Array<PageImageItem> {
  const JUNK_REGEX = /(?:^data:image|\/avatar[s\/]|\/icon[s\/]|\/favicon|\/logo[s\/]|\blogo\b|badge|button|pixel|spacer|\b1x1\b|tracking|analytics|doubleclick|advertisement|banner-ad|share-button|social-icons?|spinner|loader|placeholder|footer-logo|header-logo)/i;
  const images: Array<PageImageItem> = [];
  const seen = new Set<string>();

  function resolveUrl(relativeUrl: string): string | null {
    try {
      const u = new URL(relativeUrl, baseUrl).href.split("#")[0];
      return u.startsWith("http") ? u : null;
    } catch {
      return null;
    }
  }

  function addImg(rawUrl: string, meta: { alt?: string; title?: string; caption?: string; width?: number; height?: number; source?: "opengraph" | "article" | "content" }) {
    const url = resolveUrl(rawUrl);
    if (!url || seen.has(url) || JUNK_REGEX.test(url)) return;
    seen.add(url);
    images.push({ url, ...meta });
  }

  // 1. OpenGraph & Twitter Card
  const ogImg = document.querySelector?.('meta[property="og:image"], meta[name="og:image"]')?.getAttribute("content");
  if (ogImg) addImg(ogImg, { source: "opengraph", alt: "Hero / Featured Image" });

  const twImg = document.querySelector?.('meta[name="twitter:image"], meta[name="twitter:image:src"]')?.getAttribute("content");
  if (twImg) addImg(twImg, { source: "opengraph", alt: "Preview Image" });

  // 2. DOM Images
  const imgElements = document.querySelectorAll?.("article img, main img, figure img, [role='main'] img, img") || [];
  for (const el of imgElements) {
    if (images.length >= 15) break;
    const src = el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-original") || el.getAttribute("data-lazy-src") || "";
    if (!src) continue;

    const w = parseInt(el.getAttribute("width") || "0", 10);
    const h = parseInt(el.getAttribute("height") || "0", 10);
    if ((w > 0 && w < 120) || (h > 0 && h < 120)) continue;

    const alt = el.getAttribute("alt")?.trim();
    const title = el.getAttribute("title")?.trim();
    const figcaption = el.closest?.("figure")?.querySelector?.("figcaption")?.textContent?.trim();

    addImg(src, {
      alt: alt || undefined,
      title: title || undefined,
      caption: figcaption || undefined,
      width: w > 0 ? w : undefined,
      height: h > 0 ? h : undefined,
      source: figcaption || alt ? "article" : "content"
    });
  }

  return images;
}

/**
 * Converts raw HTML into clean Markdown via Defuddle.
 */
export function htmlToMarkdown(html: string, pageUrl: string): { title: string; markdown: string; images?: Array<PageImageItem> } {
  const { Defuddle, toMarkdown, parseLinkedomHTML } = getParsers();
  const document = parseLinkedomHTML(html, pageUrl);

  const docTitle = document.title?.trim() || "";
  const extractedImages = extractImagesFromHtml(document, pageUrl);

  const options = { url: pageUrl, markdown: true };
  const result = new Defuddle(document as unknown as Document, options).parse();
  toMarkdown(result, options, pageUrl);

  const title = result.title?.trim() || docTitle || pageUrl;
  const markdown = (result.content || "").trim();
  return { title, markdown, images: extractedImages };
}

/**
 * Mutex queue ensuring concurrent fetch_url calls present confirmation dialogs sequentially
 * rather than displacing/overwriting each other in Pi's single-slot editorContainer.
 */
let fetchDialogQueue: Promise<void> = Promise.resolve();

/**
 * Prompts user for confirmation before outbound network calls (30s auto-dismiss).
 * Chained sequentially across concurrent tool calls.
 */
async function promptPermission(
  ctx: ExtensionContext,
  title: string,
  message: string,
  signal?: AbortSignal
): Promise<boolean> {
  if (!gateEnabled) return true;

  if (!ctx.hasUI || !ctx.ui) {
    return false; // Refuse safely in non-interactive/headless environments
  }

  const g = globalThis as any;
  let releaseTurn: () => void = () => {};
  const currentTurn = new Promise<void>((r) => { releaseTurn = r; });
  const previousTurn: Promise<any> = g.__piDialogQueue || fetchDialogQueue;
  fetchDialogQueue = previousTurn.then(() => currentTurn, () => currentTurn);
  g.__piDialogQueue = fetchDialogQueue;

  try {
    await previousTurn;
    if (signal?.aborted) return false;
    return await ctx.ui.confirm(title, message, { timeout: CONFIRM_TIMEOUT_MS, signal });
  } catch {
    return false;
  } finally {
    releaseTurn();
  }
}

/**
 * Extension entrypoint registering tools and slash commands.
 */
export default function (pi: ExtensionAPI) {
  // ----------------------------------------------------
  // 0. CLI Flag Registration
  // ----------------------------------------------------
  pi.registerFlag("no-fetch-gate", {
    description: "Disable confirmation prompts for URL fetch",
    type: "boolean"
  });

  pi.registerFlag("fetch-engine", {
    description: "Set default retrieval engine ('auto' | 'chrome' | 'got-scraping')",
    type: "string"
  });

  gateEnabled = isGateInitiallyEnabled("PI_FETCH_GATE", "no-fetch-gate", pi);

  // ----------------------------------------------------
  // 1. Slash Commands: /fetch-gate & /fetch-engine
  // ----------------------------------------------------
  pi.registerCommand("fetch-gate", {
    description: "Toggle or inspect URL fetch permission gate (usage: /fetch-gate [status|on|off|toggle])",
    getArgumentCompletions(prefix: string) {
      const items = ["status", "on", "off", "toggle"];
      return items
        .filter((i) => i.startsWith(prefix.toLowerCase()))
        .map((i) => ({ value: i, label: i }));
    },
    handler: async (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (sub === "status" || sub === "info") {
        ctx.ui.notify(`Fetch Gate is currently: ${gateEnabled ? "ENABLED (Prompts by default)" : "DISABLED (Auto-approves)"}`, "info");
        return;
      }

      if (sub === "on" || sub === "enable") {
        gateEnabled = true;
      } else if (sub === "off" || sub === "disable") {
        gateEnabled = false;
      } else {
        gateEnabled = !gateEnabled;
      }

      const statusDesc = gateEnabled ? "ENABLED (Prompts for confirmation)" : "DISABLED (Bypassed)";
      ctx.ui.setStatus("fetch-gate", gateEnabled ? undefined : "🌐 Fetch-Gate: OFF");
      ctx.ui.notify(`Fetch Gate: ${statusDesc}`, gateEnabled ? "info" : "warning");
    }
  });

  pi.registerCommand("fetch-engine", {
    description: "Set or inspect fetch engine (usage: /fetch-engine [auto|chrome|got-scraping|status])",
    getArgumentCompletions(prefix: string) {
      const items = ["auto", "chrome", "got-scraping", "status"];
      return items
        .filter((i) => i.startsWith(prefix.toLowerCase()))
        .map((i) => ({ value: i, label: i }));
    },
    handler: async (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (!sub || sub === "status" || sub === "info") {
        ctx.ui.notify(`Current fetch engine: ${currentEngine.toUpperCase()}`, "info");
        return;
      }

      if (sub === "auto" || sub === "chrome" || sub === "got-scraping") {
        currentEngine = sub as FetchEngine;
        ctx.ui.setStatus("fetch-engine", currentEngine === "auto" ? undefined : `🌐 Fetch-Engine: ${currentEngine}`);
        ctx.ui.notify(`Fetch engine set to: ${currentEngine.toUpperCase()}`, "info");
      } else {
        ctx.ui.notify(`Invalid engine '${args}'. Choose from: auto, chrome, got-scraping`, "warning");
      }
    }
  });

  // ----------------------------------------------------
  // 2. Tool: fetch_url
  // ----------------------------------------------------
  pi.registerTool({
    name: "fetch_url",
    label: "Fetch URL",
    description: "Fetch and extract clean markdown from web pages, or view and visually analyze online image URLs (e.g. inspecting online documentation, visual flowcharts, or reference photos).",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true
    },
    parameters: FetchUrlSchema,

    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      return {
        url: typeof args.url === "string" ? args.url : ""
      };
    },

    async execute(_toolCallId, params: FetchUrlParams, signal, onUpdate, ctx) {
      const targetUrl = (params.url || "").trim();
      if (!targetUrl) {
        return {
          content: [{ type: "text", text: "[Fetch URL Error]: URL parameter is required." }],
          details: { error: "Empty URL" } as FetchToolDetails
        };
      }

      const effectiveEngine: FetchEngine = currentEngine;

      const startTime = Date.now();

      const allowed = await promptPermission(
        ctx,
        "🌐 Fetch URL Confirmation",
        `Allow agent to fetch remote content from:\n\n${targetUrl}\n\n(Auto-cancels in 30s)`,
        signal
      );

      if (!allowed) {
        return {
          content: [{ type: "text", text: `[Fetch URL Denied by User]: User declined permission to fetch "${targetUrl}".` }],
          details: { url: targetUrl, denied: true, engine: effectiveEngine } as FetchToolDetails
        };
      }

      if (signal?.aborted) {
        return {
          content: [{ type: "text", text: "[Fetch URL Aborted]" }],
          details: { url: targetUrl, error: "Aborted", engine: effectiveEngine } as FetchToolDetails
        };
      }

      onUpdate?.({ content: [{ type: "text", text: `Fetching ${targetUrl}...` }] });

      let fallbackReason: string | undefined;

      try {
        let rawBuffer: Uint8Array;
        let finalUrl = targetUrl;
        let usedBrowser = false;
        let viaCDP = false;
        let isUserSession = false;
        let pageTitle = "";
        let discoveredBrowserImages: Array<PageImageItem> = [];
        let rawHeaderMime = "";

        if (effectiveEngine === "chrome") {
          // Direct Chrome CDP path (forces browser, skips HTTP)
          onUpdate?.({ content: [{ type: "text", text: `Fetching ${targetUrl} via Chrome Remote Debugging (CDP)...` }] });
          try {
            const browserRes = await fetchViaChromeCDP(targetUrl, { signal, onUpdate });
            rawBuffer = browserRes.rawBuffer;
            finalUrl = browserRes.finalUrl;
            pageTitle = browserRes.pageTitle || "";
            discoveredBrowserImages = browserRes.images || [];
            rawHeaderMime = browserRes.contentType;
            usedBrowser = true;
            viaCDP = true;
            isUserSession = browserRes.isUserSession || false;
          } catch (cdpErr: any) {
            throw new Error(`Failed to retrieve page via Chrome CDP: ${cdpErr.message}`);
          }
        } else if (effectiveEngine === "got-scraping") {
          // Pure HTTP path (forces got-scraping, never uses Chrome)
          onUpdate?.({ content: [{ type: "text", text: `Fetching ${targetUrl} via got-scraping...` }] });
          const res = await fetchSafeRemote(targetUrl, signal);
          rawBuffer = res.rawBuffer;
          finalUrl = res.finalUrl;
          rawHeaderMime = res.contentType;
        } else {
          // Auto fallback path (got-scraping first, fallback to Chrome on failure)
          let fetchSuccess = false;
          let httpError = "";
          try {
            const res = await fetchSafeRemote(targetUrl, signal);
            rawBuffer = res.rawBuffer;
            finalUrl = res.finalUrl;
            rawHeaderMime = res.contentType;
            fetchSuccess = true;
          } catch (err: any) {
            fetchSuccess = false;
            httpError = err instanceof Error ? err.message : String(err);
          }

          // If anti-bot blocked (or empty response), fallback to real Chrome CDP
          if (!fetchSuccess || !rawBuffer! || rawBuffer!.length === 0) {
            fallbackReason = httpError || "Empty response from server";
            onUpdate?.({
              content: [{
                type: "text",
                text: `Fetch failed with got-scraping (${fallbackReason}); falling back to Chrome User Session (CDP)...`
              }]
            });
            try {
              const browserRes = await fetchViaChromeCDP(targetUrl, { signal, onUpdate });
              rawBuffer = browserRes.rawBuffer;
              finalUrl = browserRes.finalUrl;
              pageTitle = browserRes.pageTitle || "";
              discoveredBrowserImages = browserRes.images || [];
              rawHeaderMime = browserRes.contentType;
              usedBrowser = true;
              viaCDP = true;
              isUserSession = browserRes.isUserSession || false;
            } catch (cdpErr: any) {
              const cdpMsg = cdpErr instanceof Error ? cdpErr.message : String(cdpErr);
              throw new Error(`Failed to retrieve page: ${cdpMsg}`);
            }
          }
        }

        const sniffed = sniffContentType(rawBuffer!, rawHeaderMime);

        // ----------------------------------------------------
        // ROUTE 1: Multimodal Vision Image (.png, .jpg, .webp)
        // ----------------------------------------------------
        if (sniffed.category === "image") {
          let processedData = Buffer.from(rawBuffer!).toString("base64");
          let processedMime = sniffed.mimeType;

          // Convert WebP to PNG using Pi's built-in in-process Photon WASM engine
          if (processedMime === "image/webp") {
            const converted = await convertToPng(processedData, "image/webp");
            if (converted?.data) {
              processedData = converted.data;
              processedMime = "image/png";
            }
          }

          let dimNote = "";
          let finalW: number | undefined;
          let finalH: number | undefined;

          const imageBytes = new Uint8Array(Buffer.from(processedData, "base64"));
          const res = await resizeImage(imageBytes, processedMime, { maxWidth: 2000, maxHeight: 2000 });
          if (res) {
            processedData = res.data;
            processedMime = res.mimeType;
            finalW = res.width;
            finalH = res.height;
            const note = formatDimensionNote(res);
            if (note) dimNote = `\n${note}`;
          }

          const caption = `Image from ${finalUrl} (${processedMime})${dimNote}`;
          return {
            content: [
              { type: "image", data: processedData, mimeType: processedMime },
              { type: "text", text: caption }
            ],
            details: {
              url: finalUrl,
              isImage: true,
              contentType: processedMime,
              width: finalW,
              height: finalH,
              sizeBytes: rawBuffer!.length,
              durationMs: Date.now() - startTime,
              engine: effectiveEngine,
              fallbackReason,
              usedBrowser,
              viaCDP,
              isUserSession
            } as FetchToolDetails,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
          };
        }

        // ----------------------------------------------------
        // ROUTE 2: SVG Vector Graphics
        // ----------------------------------------------------
        if (sniffed.category === "svg") {
          let svgText = "";
          try {
            svgText = new TextDecoder(sniffed.charset).decode(rawBuffer!);
          } catch {
            svgText = new TextDecoder("utf-8").decode(rawBuffer!);
          }
          const formatted = `# SVG Graphic: ${finalUrl}\n**URL**: ${finalUrl}\n\n\`\`\`xml\n${svgText.trim()}\n\`\`\``;
          const truncation = truncateHead(formatted, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
          return {
            content: [{ type: "text", text: truncation.content }],
            details: {
              url: finalUrl,
              contentType: "image/svg+xml",
              durationMs: Date.now() - startTime,
              engine: effectiveEngine,
              fallbackReason,
              usedBrowser,
              viaCDP,
              isUserSession
            } as FetchToolDetails,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
          };
        }

        // ----------------------------------------------------
        // ROUTE 3: Binary Non-Text File
        // ----------------------------------------------------
        if (sniffed.category === "binary") {
          const fileName = path.basename(new URL(finalUrl).pathname) || "binary.bin";
          const sizeKb = (rawBuffer!.length / 1024).toFixed(1);
          return {
            content: [{ type: "text", text: `[Binary File Downloaded]: "${fileName}" (${sniffed.mimeType}, ${sizeKb} KB). URL: ${finalUrl}` }],
            details: {
              url: finalUrl,
              contentType: sniffed.mimeType,
              sizeBytes: rawBuffer!.length,
              durationMs: Date.now() - startTime,
              engine: effectiveEngine,
              fallbackReason,
              usedBrowser,
              viaCDP,
              isUserSession
            } as FetchToolDetails,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
          };
        }

        // ----------------------------------------------------
        // ROUTE 4: JSON Data
        // ----------------------------------------------------
        if (sniffed.category === "json") {
          let jsonText = "";
          try {
            jsonText = new TextDecoder(sniffed.charset).decode(rawBuffer!);
          } catch {
            jsonText = new TextDecoder("utf-8").decode(rawBuffer!);
          }
          try {
            const parsedObj = JSON.parse(jsonText);
            jsonText = JSON.stringify(parsedObj, null, 2);
          } catch {}
          const formatted = `# JSON Data: ${finalUrl}\n**URL**: ${finalUrl}\n\n\`\`\`json\n${jsonText.trim()}\n\`\`\``;
          const truncation = truncateHead(formatted, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
          return {
            content: [{ type: "text", text: truncation.content }],
            details: {
              url: finalUrl,
              contentType: "application/json",
              durationMs: Date.now() - startTime,
              engine: effectiveEngine,
              fallbackReason,
              usedBrowser,
              viaCDP,
              isUserSession
            } as FetchToolDetails,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
          };
        }

        // ----------------------------------------------------
        // ROUTE 5 & 6: HTML & Plain Text / Code
        // ----------------------------------------------------
        let rawContent = "";
        try {
          rawContent = new TextDecoder(sniffed.charset).decode(rawBuffer!);
        } catch {
          rawContent = new TextDecoder("utf-8").decode(rawBuffer!);
        }

        let title = pageTitle || finalUrl;
        let markdown = "";
        let discoveredImages: Array<PageImageItem> = [];

        if (sniffed.category === "html") {
          onUpdate?.({ content: [{ type: "text", text: `Parsing markdown from ${finalUrl}...` }] });
          let parsed = htmlToMarkdown(rawContent, finalUrl);

          const isChallengePage = /(?:browser verification|checking that you're not a bot|verify you are human|just a moment\.\.\.|security checkpoint|attention required)/i.test(
            (parsed.title || "") + " " + (parsed.markdown || "").slice(0, 500)
          );

          const isJsShell = !parsed.markdown ||
            (parsed.markdown.length < 200 && /enable\s+javascript|javascript\s+is\s+(?:required|disabled)|requires?\s+javascript/i.test(parsed.markdown)) ||
            isChallengePage;

          if (isJsShell && !usedBrowser) {
            const jsReason = isChallengePage
              ? "Security challenge / anti-bot interstitial detected"
              : "JavaScript rendering required (empty or unhydrated SPA shell)";
            if (effectiveEngine === "auto") {
              fallbackReason = jsReason;
              onUpdate?.({
                content: [{
                  type: "text",
                  text: `Fetch failed with got-scraping (${fallbackReason}); falling back to Chrome User Session (CDP)...`
                }]
              });
              try {
                const browserRes = await fetchViaChromeCDP(targetUrl, { signal, onUpdate });
                rawBuffer = browserRes.rawBuffer;
                finalUrl = browserRes.finalUrl;
                pageTitle = browserRes.pageTitle || "";
                discoveredBrowserImages = browserRes.images || [];
                rawHeaderMime = browserRes.contentType;
                usedBrowser = true;
                viaCDP = true;
                isUserSession = browserRes.isUserSession || false;

                const fallbackSniffed = sniffContentType(rawBuffer, rawHeaderMime);
                if (fallbackSniffed.category === "json") {
                  let jsonText = "";
                  try {
                    jsonText = new TextDecoder(fallbackSniffed.charset).decode(rawBuffer);
                  } catch {
                    jsonText = new TextDecoder("utf-8").decode(rawBuffer);
                  }
                  try {
                    const parsedObj = JSON.parse(jsonText);
                    jsonText = JSON.stringify(parsedObj, null, 2);
                  } catch {}
                  const formatted = `# JSON Data: ${finalUrl}\n**URL**: ${finalUrl}\n\n\`\`\`json\n${jsonText.trim()}\n\`\`\``;
                  const truncation = truncateHead(formatted, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
                  return {
                    content: [{ type: "text", text: truncation.content }],
                    details: {
                      url: finalUrl,
                      contentType: "application/json",
                      durationMs: Date.now() - startTime,
                      engine: effectiveEngine,
                      fallbackReason,
                      usedBrowser,
                      viaCDP,
                      isUserSession
                    } as FetchToolDetails,
                    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
                  };
                }

                rawContent = new TextDecoder(fallbackSniffed.charset).decode(rawBuffer);
                parsed = htmlToMarkdown(rawContent, finalUrl);
              } catch (cdpErr: any) {
                const cdpMsg = cdpErr instanceof Error ? cdpErr.message : String(cdpErr);
                throw new Error(`Failed to retrieve page: ${cdpMsg}`);
              }
            } else {
              throw new Error(jsReason);
            }
          }

          title = pageTitle || parsed.title;
          markdown = parsed.markdown;
          // Prefer browser-extracted images if available, otherwise static parsed images
          discoveredImages = (discoveredBrowserImages && discoveredBrowserImages.length > 0)
            ? discoveredBrowserImages
            : (parsed.images || []);
        } else {
          markdown = rawContent.trim();
        }

        // Filter out images that are already embedded inline in the markdown body
        const unreferencedImages = (discoveredImages || []).filter((img) => !markdown.includes(img.url));

        // Append unreferenced content images (e.g. OpenGraph hero images or off-body visuals) if present
        if (unreferencedImages.length > 0) {
          let imgSection = "\n\n---\n### 🖼️ Extracted Page Images\n";
          unreferencedImages.forEach((img, idx) => {
            let desc = img.caption || img.alt || img.title || "";
            if (!desc) {
              try {
                desc = path.basename(new URL(img.url).pathname) || "Image";
              } catch {
                desc = "Image";
              }
            }
            const dimStr = img.width && img.height ? ` — *${img.width}×${img.height}*` : "";
            const sourceStr = img.source === "opengraph" ? " — *Hero / OpenGraph*" : "";
            imgSection += `${idx + 1}. [${desc}](${img.url})${sourceStr || dimStr}\n`;
          });
          markdown += imgSection;
        }

        markdown = `# ${title}\n**URL**: ${finalUrl}\n\n${markdown}`;

        const truncation = truncateHead(markdown, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES
        });

        const durationMs = Date.now() - startTime;
        const usage = {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        };

        return {
          content: [{ type: "text", text: truncation.content }],
          details: {
            url: finalUrl,
            title,
            durationMs,
            engine: effectiveEngine,
            fallbackReason,
            usedBrowser,
            viaCDP,
            isUserSession,
            imageCount: discoveredImages.length,
            fullContent: markdown
          } as FetchToolDetails,
          usage
        };

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `[Fetch URL Error for ${targetUrl}]: ${msg}` }],
          details: { url: targetUrl, error: msg, engine: effectiveEngine, fallbackReason } as FetchToolDetails
        };
      }
    },

    renderCall(args: any, theme) {
      const u = typeof args?.url === "string" ? args.url : "Fetching URL...";
      return new Text(theme.fg("toolTitle", theme.bold("fetch_url")) + ` ${u}`, 0, 0);
    },

    renderResult(result, options, theme) {
      if (options?.isPartial) {
        const textBlock = result.content?.[0];
        const liveText = textBlock?.type === "text" ? textBlock.text : "Fetching URL...";
        return new Text(theme.fg("warning", `🌐 ${liveText}`), 0, 0);
      }

      const details = result.details as FetchToolDetails | undefined;
      const engineLabel = details?.viaCDP
        ? "Chrome User Session"
        : (details?.engine === "chrome" ? "Chrome User Session" : "got-scraping");
      const engineTag = ` [${engineLabel}]`;

      if (details?.denied) {
        return new Text(theme.fg("muted", `⊘ FETCH DENIED${engineTag}: ${details.url}`), 0, 0);
      }

      if (details?.error) {
        const fallbackMsg = details?.fallbackReason
          ? `${theme.fg("dim", `✗ FETCH FAILED: got-scraping failed (${details.fallbackReason})`)}\n${theme.fg("dim", "   Falling back to engine: Chrome")}\n`
          : "";
        return new Text(`${fallbackMsg}${theme.fg("warning", `✗ FETCH FAILED${engineTag}: ${details.error}`)}`, 0, 0);
      }

      const fallbackBlock = details?.fallbackReason
        ? `${theme.fg("dim", `✗ FETCH FAILED: got-scraping failed (${details.fallbackReason})`)}\n${theme.fg("dim", "   Falling back to engine: Chrome")}\n`
        : "";

      if (details?.isImage) {
        const timeStr = details?.durationMs ? ` (${(details.durationMs / 1000).toFixed(1)}s)` : "";
        const dimStr = details?.width && details?.height ? ` [${details.width}x${details.height}]` : "";
        const header = `${fallbackBlock}${theme.bold(theme.fg("success", "✓ IMAGE FETCHED"))}${theme.fg("dim", `${dimStr}${engineTag}${timeStr}`)}`;
        const textBlock = result.content?.find((c: any) => c.type === "text");
        const caption = textBlock?.text || `Image: ${details.url}`;
        return new Text(`${header}\n\n${caption}`, 0, 0);
      }

      const content = (options?.expanded && details?.fullContent)
        ? details.fullContent
        : (result.content?.[0]?.type === "text" ? result.content[0].text : "");

      if (!content) {
        return new Text(theme.fg("dim", "No content retrieved."), 0, 0);
      }

      const timeStr = details?.durationMs ? ` (${(details.durationMs / 1000).toFixed(1)}s)` : "";
      const header = `${fallbackBlock}${theme.bold(theme.fg("success", "✓ FETCH COMPLETED"))}${theme.fg("dim", `${engineTag}${timeStr}`)}`;
      const formattedBody = formatToolOutput(content, theme, options?.expanded, COLLAPSED_PREVIEW_LINES);

      return new Text(`${header}\n\n${formattedBody}`, 0, 0);
    }
  });

  // ----------------------------------------------------
  // 3. Lifecycle Events
  // ----------------------------------------------------
  pi.on("session_start", async (_event, ctx) => {
    fetchDialogQueue = Promise.resolve();
    (globalThis as any).__piDialogQueue = Promise.resolve();
    if (pi.getFlag("no-fetch-gate") === true) {
      gateEnabled = false;
    }
    if (!gateEnabled) {
      ctx.ui.setStatus("fetch-gate", "🌐 Fetch-Gate: OFF");
    }

    const engineFlag = pi.getFlag("fetch-engine");
    if (typeof engineFlag === "string" && ["auto", "chrome", "got-scraping"].includes(engineFlag.toLowerCase())) {
      currentEngine = engineFlag.toLowerCase() as FetchEngine;
    }
    if (currentEngine !== "auto") {
      ctx.ui.setStatus("fetch-engine", `🌐 Fetch-Engine: ${currentEngine}`);
    }
  });
}
