import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { createRequire } from "node:module";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as net from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

/**
 * Lean Gemini Web Search Extension for Pi Coding Agent
 *
 * Tools & Commands:
 * - `web_search`: Google Search grounding via Gemini API with parallel citation resolution.
 * - `fetch_url`: Safe HTTP retrieval with SSRF protection, Readability/Turndown parsing, and optional summarization.
 * - `/web-gate`: Slash command to toggle pre-request confirmation gate ([status|on|off|toggle]).
 *
 * Configuration & CLI Flags:
 * - Gemini API Key: Resolved securely from Pi Model Registry or ~/.pi/agent/auth.json (google.key).
 * - `GEMINI_SEARCH_MODEL`: Grounding model override (default: "gemini-flash-lite-latest").
 * - `--no-web-gate`: CLI flag to disable confirmation prompts for web search and URL fetch.
 * - `PI_WEB_GATE`: Environment variable override (set to "0" or "false" to disable).
 * - `PI_GATES`: Master environment variable override (set to "0" or "false" to disable all gates).
 */

const DEFAULT_MODEL = "gemini-flash-lite-latest";
const DEFAULT_API_HOST = "https://generativelanguage.googleapis.com";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_FETCH_BYTES = 5 * 1024 * 1024; // 5 MB download limit
const CONFIRM_TIMEOUT_MS = 30000; // 30s confirmation auto-dismiss

export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50 KB output ceiling
const COLLAPSED_PREVIEW_LINES = 6;

// Rates for gemini-flash-lite-latest (USD per 1M tokens)
const INPUT_PRICE_PER_M = 0.075;
const OUTPUT_PRICE_PER_M = 0.30;

/**
 * Evaluates whether a gate should be active at startup based on CLI flags and environment variables.
 */
function isGateInitiallyEnabled(gateKey: string, flagName: string, pi?: ExtensionAPI): boolean {
  if (pi && typeof pi.getFlag === "function" && pi.getFlag(flagName) === true) {
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

let gateEnabled = isGateInitiallyEnabled("PI_WEB_GATE", "no-web-gate");

/**
 * Resolves npm packages from ~/.pi/agent/npm/node_modules or global paths
 * regardless of the current working directory.
 */
function loadDependency<T = any>(name: string): T {
  try {
    const req = createRequire(import.meta.url);
    return req(name);
  } catch {}

  try {
    const piNpmDir = path.join(os.homedir(), ".pi", "agent", "npm", "package.json");
    const piReq = createRequire(piNpmDir);
    return piReq(name);
  } catch {}

  try {
    const globalPath = path.join(process.env.APPDATA || "", "npm", "node_modules", "package.json");
    const globalReq = createRequire(globalPath);
    return globalReq(name);
  } catch {}

  throw new Error(`Failed to load '${name}'. Please install it in ~/.pi/agent/npm/ (e.g. npm i ${name})`);
}

let cachedReadability: any = null;
let cachedParseHTML: any = null;
let cachedTurndown: any = null;
let cachedResizeImage: any = null;
let cachedFormatDimensionNote: any = null;

/**
 * Lazy loader for Pi's built-in Rust/WASM Photon image resizing engine.
 */
function getImageResizer() {
  if (!cachedResizeImage) {
    try {
      const piAgent = loadDependency("@earendil-works/pi-coding-agent");
      if (typeof piAgent.resizeImage === "function") {
        cachedResizeImage = piAgent.resizeImage;
        cachedFormatDimensionNote = piAgent.formatDimensionNote;
      }
    } catch {}
  }
  return {
    resizeImage: cachedResizeImage,
    formatDimensionNote: cachedFormatDimensionNote
  };
}

/**
 * Lazy loader for Readability, LinkeDOM, and Turndown parsers.
 */
function getParsers() {
  if (!cachedReadability) {
    try {
      const readMod = loadDependency("@mozilla/readability");
      cachedReadability = readMod.Readability || readMod;
    } catch {}
  }
  if (!cachedParseHTML) {
    try {
      const linkeMod = loadDependency("linkedom");
      cachedParseHTML = linkeMod.parseHTML || linkeMod;
    } catch {}
  }
  if (!cachedTurndown) {
    try {
      const TurnClass = loadDependency("turndown");
      const instance = new TurnClass({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        hr: "---"
      });
      instance.remove(["script", "style", "noscript", "iframe", "svg"]);
      cachedTurndown = instance;
    } catch {}
  }

  return {
    Readability: cachedReadability,
    parseHTML: cachedParseHTML,
    turndown: cachedTurndown
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
 * Computes Pi-compatible Usage object from Gemini usageMetadata.
 */
function computeGeminiUsage(usageMeta?: { promptTokenCount?: number; candidatesTokenCount?: number }) {
  const input = usageMeta?.promptTokenCount ?? 0;
  const output = usageMeta?.candidatesTokenCount ?? 0;
  const inputCost = (input / 1_000_000) * INPUT_PRICE_PER_M;
  const outputCost = (output / 1_000_000) * OUTPUT_PRICE_PER_M;
  const totalCost = inputCost + outputCost;

  return {
    input,
    output,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: input + output,
    cost: {
      input: inputCost,
      output: outputCost,
      cacheRead: 0,
      cacheWrite: 0,
      total: totalCost
    }
  };
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
function formatToolOutput(content: string, expanded?: boolean, maxLines = COLLAPSED_PREVIEW_LINES): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  const lines = trimmed.split("\n");

  if (expanded || lines.length <= maxLines) {
    return lines.join("\n");
  }

  const preview = lines.slice(0, maxLines).join("\n");
  const remaining = lines.length - maxLines;
  return `${preview}\n... (${remaining} more lines)`;
}

export const WebSearchSchema = Type.Object({
  query: Type.String({
    description: "The search query to look up on the web."
  })
});

export type WebSearchParams = Static<typeof WebSearchSchema>;

export const FetchUrlSchema = Type.Object({
  url: Type.String({
    description: "The URL of the web page, file, or image to fetch."
  }),
  prompt: Type.Optional(Type.String({
    description: "Optional question or extraction goal (e.g. 'how to configure auth', 'what is in this diagram'). When provided, extracts only the relevant answer. Omit to fetch the full content."
  }))
});

export type FetchUrlParams = Static<typeof FetchUrlSchema>;

export interface SearchResultItem {
  title: string;
  url: string;
}

export interface WebToolDetails {
  query?: string;
  url?: string;
  title?: string;
  model?: string;
  sources?: SearchResultItem[];
  denied?: boolean;
  error?: string;
  durationMs?: number;
  summarized?: boolean;
  isImage?: boolean;
  contentType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

/**
 * Resolves Gemini API key from Pi ModelRegistry or ~/.pi/agent/auth.json.
 */
async function resolveApiKey(ctx: ExtensionContext): Promise<string | null> {
  if (typeof ctx.modelRegistry?.getApiKeyAndHeaders === "function") {
    try {
      const auth = await ctx.modelRegistry.getApiKeyAndHeaders({ provider: "google", id: DEFAULT_MODEL });
      if (auth?.apiKey) return auth.apiKey;
    } catch {}
  }

  if (typeof ctx.modelRegistry?.getProviderAuth === "function") {
    try {
      const auth = await ctx.modelRegistry.getProviderAuth("google");
      if (auth?.apiKey) return auth.apiKey;
    } catch {}
  }

  try {
    const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
    const raw = await fs.readFile(authPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.google?.key && typeof parsed.google.key === "string" && parsed.google.key.trim().length > 0) {
      return parsed.google.key.trim();
    }
  } catch {}

  return null;
}

/**
 * Checks if IPv4 address is private, loopback, link-local, or reserved.
 */
function isBlockedIPv4(address: string): boolean {
  const parts = address.split(".").map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;

  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10
    (a === 169 && b === 254) || // 169.254.0.0/16
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15
    a >= 224 // 224.0.0.0/4
  );
}

/**
 * Checks if IPv6 address is private, loopback, link-local, or reserved.
 */
function isBlockedIPv6(address: string): boolean {
  const norm = address.toLowerCase();
  if (norm === "::1" || norm === "::") return true;
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true;
  if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) return true;

  // Check IPv4-mapped IPv6 (::ffff:x.x.x.x or ::ffff:xxxx:xxxx)
  if (norm.startsWith("::ffff:")) {
    const rest = norm.slice(7);
    if (net.isIP(rest) === 4) {
      return isBlockedIPv4(rest);
    }
    const hexParts = rest.split(":");
    if (hexParts.length === 2) {
      const high = parseInt(hexParts[0], 16);
      const low = parseInt(hexParts[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        const b1 = (high >> 8) & 0xff;
        const b2 = high & 0xff;
        const b3 = (low >> 8) & 0xff;
        const b4 = low & 0xff;
        return isBlockedIPv4(`${b1}.${b2}.${b3}.${b4}`);
      }
    }
    return true; // Block unparseable or ambiguous mapped addresses
  }
  return false;
}

/**
 * Validates protocol, hostname, and resolves DNS to prevent SSRF against private networks.
 */
async function validateRemoteUrl(rawUrl: string | URL): Promise<URL> {
  const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid protocol '${url.protocol}'. Only HTTP and HTTPS URLs are allowed.`);
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname) throw new Error("URL must include a valid hostname.");

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(`Blocked internal hostname: ${hostname}`);
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) {
    if (isBlockedIPv4(hostname)) throw new Error(`Blocked private/internal IPv4 address: ${hostname}`);
    return url;
  }
  if (ipVersion === 6) {
    if (isBlockedIPv6(hostname)) throw new Error(`Blocked private/internal IPv6 address: ${hostname}`);
    return url;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dnsLookup(hostname, { all: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to resolve DNS for ${hostname}: ${msg}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`Failed to resolve DNS for ${hostname}: no IP addresses returned`);
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isBlockedIPv4(address)) {
      throw new Error(`Blocked private/internal IP address for ${hostname}: ${address}`);
    }
    if (family === 6 && isBlockedIPv6(address)) {
      throw new Error(`Blocked private/internal IP address for ${hostname}: ${address}`);
    }
  }

  return url;
}

/**
 * Fetches remote URL safely with redirect following (up to 5 hops), 5MB streaming cut, and SSRF validation.
 */
async function fetchSafeRemote(
  rawUrl: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ rawBuffer: Uint8Array; contentType: string; finalUrl: string }> {
  let currentUrl = await validateRemoteUrl(rawUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  try {
    for (let redirectCount = 0; redirectCount <= 5; redirectCount++) {
      const response = await fetch(currentUrl, {
        method: "GET",
        signal: combinedSignal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache"
        }
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`Received redirect ${response.status} with no Location header`);
        if (redirectCount === 5) throw new Error("Too many redirects (exceeded 5 hops)");

        const nextUrl = new URL(location, currentUrl);
        currentUrl = await validateRemoteUrl(nextUrl);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader) {
        const len = parseInt(contentLengthHeader, 10);
        if (Number.isFinite(len) && len > MAX_FETCH_BYTES) {
          throw new Error(`Response size (${Math.round(len / 1024 / 1024)}MB) exceeds limit of ${MAX_FETCH_BYTES / 1024 / 1024}MB`);
        }
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const arrayBuf = await response.arrayBuffer();
        const rawBuffer = new Uint8Array(arrayBuf);
        return { rawBuffer, contentType, finalUrl: currentUrl.toString() };
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          totalBytes += value.byteLength;
          if (totalBytes > MAX_FETCH_BYTES) {
            await reader.cancel();
            throw new Error(`Response exceeded maximum size of ${MAX_FETCH_BYTES / 1024 / 1024}MB`);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return { rawBuffer: merged, contentType, finalUrl: currentUrl.toString() };
    }

    throw new Error("Too many redirects fetching URL");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Converts raw HTML into clean Markdown via Readability and Turndown, with regex fallback.
 */
function htmlToMarkdown(html: string, pageUrl: string): { title: string; markdown: string } {
  const { Readability, parseHTML, turndown } = getParsers();

  if (parseHTML && Readability && turndown) {
    try {
      const { document } = parseHTML(html);
      const docTitle = document.title?.trim() || "";

      const reader = new Readability(document as unknown as Document);
      const article = reader.parse();

      if (article && article.content) {
        const md = turndown.turndown(article.content).trim();
        const title = article.title?.trim() || docTitle || pageUrl;
        return { title, markdown: md };
      }

      const bodyHtml = document.body?.innerHTML || html;
      const basicMd = turndown.turndown(bodyHtml).trim();
      return { title: docTitle || pageUrl, markdown: basicMd };
    } catch {}
  }

  // Regex fallback if DOM parser packages are not available
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : pageUrl;

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  return { title, markdown: stripped };
}

/**
 * Resolves Google Grounding API redirect URLs to target destination URLs via HTTP HEAD.
 */
async function resolveGroundingRedirect(proxyUrl: string, signal?: AbortSignal): Promise<string> {
  if (!proxyUrl.includes("vertexaisearch.cloud.google.com/grounding-api-redirect")) {
    return proxyUrl;
  }
  try {
    const res = await fetch(proxyUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000)
    });
    const location = res.headers.get("location");
    return location || proxyUrl;
  } catch {
    return proxyUrl;
  }
}

/**
 * Prompts user for confirmation before outbound network calls (30s auto-dismiss).
 */
async function promptPermission(
  ctx: ExtensionContext,
  title: string,
  message: string
): Promise<boolean> {
  if (!gateEnabled) return true;

  if (!ctx.hasUI || !ctx.ui) {
    return false; // Refuse safely in non-interactive/headless environments
  }

  try {
    return await ctx.ui.confirm(title, message, { timeout: CONFIRM_TIMEOUT_MS });
  } catch {
    return false;
  }
}

/**
 * Extension entrypoint registering tools and slash commands.
 */
export default function (pi: ExtensionAPI) {
  // ----------------------------------------------------
  // 0. CLI Flag Registration
  // ----------------------------------------------------
  pi.registerFlag("no-web-gate", {
    description: "Disable confirmation prompts for web search and URL fetch",
    type: "boolean"
  });

  gateEnabled = isGateInitiallyEnabled("PI_WEB_GATE", "no-web-gate", pi);

  // ----------------------------------------------------
  // 1. Slash Command: /web-gate
  // ----------------------------------------------------
  pi.registerCommand("web-gate", {
    description: "Toggle or inspect web search & URL fetch permission gate (usage: /web-gate [status|on|off|toggle])",
    handler: async (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (sub === "status" || sub === "info") {
        ctx.ui.notify(`Web Gate is currently: ${gateEnabled ? "ENABLED (Prompts by default)" : "DISABLED (Auto-approves)"}`, "info");
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
      ctx.ui.setStatus("web-gate", gateEnabled ? undefined : "🌐 Web-Gate: OFF");
      ctx.ui.notify(`Web Gate: ${statusDesc}`, gateEnabled ? "info" : "warning");
    }
  });

  // ----------------------------------------------------
  // 2. Tool: web_search
  // ----------------------------------------------------
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search Google for current information, documentation, and live web sources.",

    promptSnippet: "Search Google for live facts, recent documentation, or technical solutions.",

    promptGuidelines: [
      "Use web_search for current facts, library APIs released after knowledge cutoff, or live debugging references.",
      "Cite primary sources as markdown links when provided in the search results."
    ],

    parameters: WebSearchSchema,

    /**
     * Parameter normalizer for small-model aliases (e.g. q -> query).
     */
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      const copy = { ...args };

      if (copy.query === undefined) {
        if (typeof copy.q === "string") copy.query = copy.q;
        else if (typeof copy.search === "string") copy.query = copy.search;
        else if (typeof copy.text === "string") copy.query = copy.text;
        else if (typeof copy.prompt === "string") copy.query = copy.prompt;
      }

      return copy;
    },

    async execute(_toolCallId, params: WebSearchParams, signal, onUpdate, ctx) {
      const query = (params.query || "").trim();
      if (!query) {
        return {
          content: [{ type: "text", text: "[Web Search Error]: Query cannot be empty." }],
          details: { error: "Empty query" } as WebToolDetails
        };
      }

      const startTime = Date.now();

      const allowed = await promptPermission(
        ctx,
        "🌐 Web Search Confirmation",
        `Allow agent to search Google for:\n\n"${query}"\n\n(Auto-cancels in 30s)`
      );

      if (!allowed) {
        return {
          content: [{ type: "text", text: `[Web Search Denied by User]: User declined permission to search the web for "${query}".` }],
          details: { query, denied: true } as WebToolDetails
        };
      }

      if (signal?.aborted) {
        return {
          content: [{ type: "text", text: "[Web Search Aborted]" }],
          details: { query, error: "Aborted" } as WebToolDetails
        };
      }

      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return {
          content: [{
            type: "text",
            text: "[Web Search Error]: Gemini API Key not found. Please configure your Google provider key in ~/.pi/agent/auth.json or via Pi's model registry."
          }],
          details: { query, error: "Missing API Key" } as WebToolDetails
        };
      }

      const model = process.env.GEMINI_SEARCH_MODEL?.trim() || DEFAULT_MODEL;
      onUpdate?.({ content: [{ type: "text", text: `Searching Google with ${model} for "${query}"...` }] });

      try {
        const url = `${DEFAULT_API_HOST}/v1beta/models/${model}:generateContent`;
        const body = {
          contents: [{ role: "user", parts: [{ text: query }] }],
          systemInstruction: {
            parts: [{
              text: "Synthesize an accurate, factual, and complete answer to the query using Google Search grounding. If the query contains a false premise, misconception, or non-existent entity, directly clarify the correction using grounded facts. Always format code snippets in fenced code blocks with explicit language identifiers. Preserve version numbers, CLI flags, and configuration keys verbatim. Be direct and concise without conversational filler or pleasantries. If no relevant information exists, reply with 'Information not found.'"
            }]
          },
          tools: [{ google_search: {} }]
        };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify(body),
          signal
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Gemini API Error ${res.status}: ${errText.slice(0, 250)}`);
        }

        const data: any = await res.json();
        const candidate = data.candidates?.[0];
        const answerText = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || "";

        const rawChunks = candidate?.groundingMetadata?.groundingChunks || [];
        onUpdate?.({ content: [{ type: "text", text: `Resolving ${rawChunks.length} source citations...` }] });

        const sources: SearchResultItem[] = await Promise.all(
          rawChunks.map(async (chunk: any) => {
            const rawUri = chunk.web?.uri || "";
            const title = chunk.web?.title || "Source";
            const directUrl = await resolveGroundingRedirect(rawUri, signal);
            return { title, url: directUrl };
          })
        );

        const uniqueSources: SearchResultItem[] = [];
        const seenUrls = new Set<string>();
        for (const s of sources) {
          if (s.url && !seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            uniqueSources.push(s);
          }
        }

        let formattedOutput = answerText.trim();
        if (uniqueSources.length > 0) {
          formattedOutput += "\n\n### Sources\n" + uniqueSources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join("\n");
        }

        const truncation = truncateHead(formattedOutput, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES
        });

        const durationMs = Date.now() - startTime;
        const usage = computeGeminiUsage(data.usageMetadata);

        return {
          content: [{ type: "text", text: truncation.content }],
          details: {
            query,
            model,
            sources: uniqueSources,
            durationMs
          } as WebToolDetails,
          usage
        };

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `[Web Search Error]: ${msg}` }],
          details: { query, error: msg } as WebToolDetails
        };
      }
    },

    renderCall(args: any, theme) {
      const q = typeof args?.query === "string" ? args.query : "Searching...";
      return new Text(theme.fg("toolTitle", theme.bold("web_search")) + ` "${q}"`, 0, 0);
    },

    renderResult(result, options, theme) {
      if (options?.isPartial) {
        const textBlock = result.content?.[0];
        const liveText = textBlock?.type === "text" ? textBlock.text : "Searching Google...";
        return new Text(theme.fg("warning", `🔍 ${liveText}`), 0, 0);
      }

      const details = result.details as WebToolDetails | undefined;
      if (details?.denied) {
        return new Text(theme.fg("muted", `⊘ SEARCH DENIED: "${details.query}"`), 0, 0);
      }

      if (details?.error) {
        return new Text(theme.fg("warning", `✗ SEARCH FAILED: ${details.error}`), 0, 0);
      }

      const content = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      if (!content) {
        return new Text(theme.fg("dim", "No search results returned."), 0, 0);
      }

      const timeStr = details?.durationMs ? ` (${(details.durationMs / 1000).toFixed(1)}s)` : "";
      const header = theme.fg("success", "✓ SEARCH COMPLETED") + theme.fg("dim", timeStr);
      const formattedBody = formatToolOutput(content, options?.expanded, COLLAPSED_PREVIEW_LINES);

      return new Text(`${header}\n\n${formattedBody}`, 0, 0);
    }
  });

  // ----------------------------------------------------
  // 3. Tool: fetch_url
  // ----------------------------------------------------
  pi.registerTool({
    name: "fetch_url",
    label: "Fetch URL",
    description: "Fetch content from a URL on the internet (web pages, text, code, or images).",

    promptSnippet: "Fetch content from a URL on the internet (web pages, text, code, or images).",

    promptGuidelines: [
      "Use fetch_url to fetch web pages, documentation, raw files, or images from the internet.",
      "Images (PNG, JPEG, WebP, GIF, SVG) are returned as visual image attachments that you can inspect directly.",
      "Pass 'prompt' when you only need a specific answer or detail from a long page or image instead of loading the full content.",
      "Omit 'prompt' when you want to read the entire page, code, or view the full image."
    ],

    parameters: FetchUrlSchema,

    /**
     * Parameter normalizer for small-model aliases (e.g. link/target -> url).
     */
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      const copy = { ...args };

      if (copy.url === undefined) {
        if (typeof copy.link === "string") copy.url = copy.link;
        else if (typeof copy.uri === "string") copy.url = copy.uri;
        else if (typeof copy.target === "string") copy.url = copy.target;
        else if (typeof copy.path === "string") copy.url = copy.path;
      }

      if (copy.prompt === undefined) {
        if (typeof copy.q === "string") copy.prompt = copy.q;
        else if (typeof copy.query === "string") copy.prompt = copy.query;
        else if (typeof copy.question === "string") copy.prompt = copy.question;
      }

      return copy;
    },

    async execute(_toolCallId, params: FetchUrlParams, signal, onUpdate, ctx) {
      const targetUrl = (params.url || "").trim();
      if (!targetUrl) {
        return {
          content: [{ type: "text", text: "[Fetch URL Error]: URL parameter is required." }],
          details: { error: "Empty URL" } as WebToolDetails
        };
      }

      const startTime = Date.now();

      const allowed = await promptPermission(
        ctx,
        "🌐 Fetch URL Confirmation",
        `Allow agent to fetch remote content from:\n\n${targetUrl}\n\n(Auto-cancels in 30s)`
      );

      if (!allowed) {
        return {
          content: [{ type: "text", text: `[Fetch URL Denied by User]: User declined permission to fetch "${targetUrl}".` }],
          details: { url: targetUrl, denied: true } as WebToolDetails
        };
      }

      if (signal?.aborted) {
        return {
          content: [{ type: "text", text: "[Fetch URL Aborted]" }],
          details: { url: targetUrl, error: "Aborted" } as WebToolDetails
        };
      }

      onUpdate?.({ content: [{ type: "text", text: `Fetching ${targetUrl}...` }] });

      try {
        const { rawBuffer, contentType, finalUrl } = await fetchSafeRemote(targetUrl, signal);
        const sniffed = sniffContentType(rawBuffer, contentType);

        // ----------------------------------------------------
        // ROUTE 1: Unsupported Binary Denial
        // ----------------------------------------------------
        if (sniffed.category === "binary") {
          const sizeKb = (rawBuffer.length / 1024).toFixed(1);
          return {
            content: [{
              type: "text",
              text: `[Fetch URL Error for ${finalUrl}]: Unsupported binary content type '${sniffed.mimeType}' (${sizeKb} KB). Binary archives, executables, audio, and video cannot be parsed as text.`
            }],
            details: { url: finalUrl, error: `Unsupported binary content type: ${sniffed.mimeType}`, durationMs: Date.now() - startTime } as WebToolDetails
          };
        }

        // ----------------------------------------------------
        // ROUTE 2: Vector Graphics (SVG)
        // ----------------------------------------------------
        if (sniffed.category === "svg") {
          let svgText = "";
          try {
            svgText = new TextDecoder(sniffed.charset).decode(rawBuffer);
          } catch {
            svgText = new TextDecoder("utf-8").decode(rawBuffer);
          }
          const formatted = `# Vector SVG: ${finalUrl}\n**Type**: image/svg+xml | **Size**: ${(rawBuffer.length / 1024).toFixed(1)} KB\n\n\`\`\`xml\n${svgText.trim()}\n\`\`\``;
          const truncation = truncateHead(formatted, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
          return {
            content: [{ type: "text", text: truncation.content }],
            details: { url: finalUrl, contentType: "image/svg+xml", durationMs: Date.now() - startTime } as WebToolDetails,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
          };
        }

        // ----------------------------------------------------
        // ROUTE 3: Multimodal Raster Images (PNG, JPEG, WebP, GIF)
        // ----------------------------------------------------
        if (sniffed.category === "image") {
          const extractPrompt = params.prompt?.trim();
          if (extractPrompt) {
            // Multimodal Flash-Lite Vision extraction
            const apiKey = await resolveApiKey(ctx);
            if (apiKey) {
              onUpdate?.({ content: [{ type: "text", text: `Analyzing image with Gemini Flash-Lite Vision for: "${extractPrompt}"...` }] });
              const model = process.env.GEMINI_SEARCH_MODEL?.trim() || DEFAULT_MODEL;
              const summarizeUrl = `${DEFAULT_API_HOST}/v1beta/models/${model}:generateContent`;
              const base64Data = Buffer.from(rawBuffer).toString("base64");

              const res = await fetch(summarizeUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({
                  contents: [{
                    role: "user",
                    parts: [
                      { text: `<instruction>${extractPrompt}</instruction>\n<source_url>${finalUrl}</source_url>` },
                      { inlineData: { mimeType: sniffed.mimeType, data: base64Data } }
                    ]
                  }],
                  systemInstruction: {
                    parts: [{
                      text: "Extract and answer the instruction using ONLY the provided image. Provide direct answers, format code snippets in fenced code blocks with language identifiers, preserve tables verbatim, and do not add conversational preambles. If the requested information is not found in the image, reply with 'Information not found in the provided image.'"
                    }]
                  }
                }),
                signal
              });

              if (res.ok) {
                const data: any = await res.json();
                const usage = computeGeminiUsage(data.usageMetadata);
                const visualText = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || "";
                if (visualText.trim()) {
                  const markdown = `### Visual Analysis for: "${extractPrompt}"\n**Source**: [Image](${finalUrl})\n\n${visualText.trim()}`;
                  return {
                    content: [{ type: "text", text: markdown }],
                    details: { url: finalUrl, title: finalUrl, durationMs: Date.now() - startTime, summarized: true, isImage: true } as WebToolDetails,
                    usage
                  };
                }
              }
            }
          }

          // Direct Image Return with Pi WASM Resizer
          const { resizeImage, formatDimensionNote } = getImageResizer();
          let imageOutput: any = {
            data: Buffer.from(rawBuffer).toString("base64"),
            mimeType: sniffed.mimeType,
            width: 0,
            height: 0,
            originalWidth: 0,
            originalHeight: 0,
            wasResized: false
          };

          if (typeof resizeImage === "function") {
            try {
              const resized = await resizeImage(rawBuffer, sniffed.mimeType, {
                maxWidth: 1024,
                maxHeight: 1024,
                maxBytes: 384 * 1024
              });
              if (resized?.data) {
                imageOutput = resized;
              }
            } catch {}
          }

          const dimNote = typeof formatDimensionNote === "function" ? formatDimensionNote(imageOutput) : undefined;
          const noteText = dimNote ? `\n${dimNote}` : "";
          const caption = `### Image: ${finalUrl}\n**Type**: ${imageOutput.mimeType} | **Size**: ${(rawBuffer.length / 1024).toFixed(1)} KB${noteText}`;

          return {
            content: [
              { type: "text", text: caption },
              { type: "image", data: imageOutput.data, mimeType: imageOutput.mimeType }
            ],
            details: {
              url: finalUrl,
              contentType: imageOutput.mimeType,
              isImage: true,
              width: imageOutput.width,
              height: imageOutput.height,
              durationMs: Date.now() - startTime
            } as WebToolDetails,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
          };
        }

        // ----------------------------------------------------
        // ROUTE 4: JSON Data
        // ----------------------------------------------------
        if (sniffed.category === "json") {
          let jsonText = "";
          try {
            jsonText = new TextDecoder(sniffed.charset).decode(rawBuffer);
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
            details: { url: finalUrl, contentType: "application/json", durationMs: Date.now() - startTime } as WebToolDetails,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
          };
        }

        // ----------------------------------------------------
        // ROUTE 5 & 6: HTML & Plain Text / Code
        // ----------------------------------------------------
        let rawContent = "";
        try {
          rawContent = new TextDecoder(sniffed.charset).decode(rawBuffer);
        } catch {
          rawContent = new TextDecoder("utf-8").decode(rawBuffer);
        }

        let title = finalUrl;
        let markdown = "";

        if (sniffed.category === "html") {
          onUpdate?.({ content: [{ type: "text", text: `Parsing markdown from ${finalUrl}...` }] });
          const parsed = htmlToMarkdown(rawContent, finalUrl);
          title = parsed.title;
          markdown = parsed.markdown;
        } else {
          markdown = rawContent.trim();
        }

        const extractPrompt = params.prompt?.trim();
        let wasSummarized = false;
        let summarizeUsage: any = null;

        if (extractPrompt && markdown.length > 200) {
          const apiKey = await resolveApiKey(ctx);
          if (apiKey) {
            onUpdate?.({ content: [{ type: "text", text: `Extracting answers with Gemini Flash-Lite for prompt: "${extractPrompt}"...` }] });

            const model = process.env.GEMINI_SEARCH_MODEL?.trim() || DEFAULT_MODEL;
            const summarizeUrl = `${DEFAULT_API_HOST}/v1beta/models/${model}:generateContent`;

            const promptText = [
              `<instruction>${extractPrompt}</instruction>`,
              `<source_title>${title}</source_title>`,
              `<source_url>${finalUrl}</source_url>`,
              `<webpage_content>\n${markdown.slice(0, 40000)}\n</webpage_content>`
            ].join("\n\n");

            const res = await fetch(summarizeUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                systemInstruction: {
                  parts: [{
                    text: "Extract and answer the instruction using ONLY the provided webpage content. Provide direct answers, format code snippets in fenced code blocks with language identifiers, preserve tables and CLI flags verbatim, and do not add conversational preambles. If the requested information is not found in the content, reply with 'Information not found in the provided document.'"
                  }]
                }
              }),
              signal
            });

            if (res.ok) {
              const data: any = await res.json();
              summarizeUsage = computeGeminiUsage(data.usageMetadata);
              const summarizedText = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n");
              if (summarizedText && summarizedText.trim().length > 0) {
                markdown = `### Extracted Summary for: "${extractPrompt}"\n**Source**: [${title}](${finalUrl})\n\n${summarizedText.trim()}`;
                wasSummarized = true;
              }
            }
          }
        }

        if (!wasSummarized) {
          markdown = `# ${title}\n**URL**: ${finalUrl}\n\n${markdown}`;
        }

        const truncation = truncateHead(markdown, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES
        });

        const durationMs = Date.now() - startTime;
        const usage = summarizeUsage || {
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
            summarized: wasSummarized
          } as WebToolDetails,
          usage
        };

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `[Fetch URL Error for ${targetUrl}]: ${msg}` }],
          details: { url: targetUrl, error: msg } as WebToolDetails
        };
      }
    },

    renderCall(args: any, theme) {
      const u = typeof args?.url === "string" ? args.url : "Fetching URL...";
      let text = theme.fg("toolTitle", theme.bold("fetch_url")) + ` ${u}`;
      if (args?.prompt) {
        text += theme.fg("dim", ` (prompt: "${args.prompt}")`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, options, theme) {
      if (options?.isPartial) {
        const textBlock = result.content?.[0];
        const liveText = textBlock?.type === "text" ? textBlock.text : "Fetching URL...";
        return new Text(theme.fg("warning", `🌐 ${liveText}`), 0, 0);
      }

      const details = result.details as WebToolDetails | undefined;
      if (details?.denied) {
        return new Text(theme.fg("muted", `⊘ FETCH DENIED: ${details.url}`), 0, 0);
      }

      if (details?.error) {
        return new Text(theme.fg("warning", `✗ FETCH FAILED: ${details.error}`), 0, 0);
      }

      if (details?.isImage && !details?.summarized) {
        const timeStr = details?.durationMs ? ` (${(details.durationMs / 1000).toFixed(1)}s)` : "";
        const dimStr = details?.width && details?.height ? ` [${details.width}x${details.height}]` : "";
        const header = theme.fg("success", "✓ IMAGE FETCHED") + theme.fg("dim", `${dimStr}${timeStr}`);
        const textBlock = result.content?.find((c: any) => c.type === "text");
        const caption = textBlock?.text || `Image: ${details.url}`;
        return new Text(`${header}\n\n${caption}`, 0, 0);
      }

      const content = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      if (!content) {
        return new Text(theme.fg("dim", "No content retrieved."), 0, 0);
      }

      const timeStr = details?.durationMs ? ` (${(details.durationMs / 1000).toFixed(1)}s)` : "";
      const sumTag = details?.summarized ? " [Summarized]" : "";
      const header = theme.fg("success", "✓ FETCH COMPLETED") + theme.fg("dim", `${sumTag}${timeStr}`);
      const formattedBody = formatToolOutput(content, options?.expanded, COLLAPSED_PREVIEW_LINES);

      return new Text(`${header}\n\n${formattedBody}`, 0, 0);
    }
  });

  // ----------------------------------------------------
  // 4. Lifecycle Events
  // ----------------------------------------------------
  pi.on("session_start", async (_event, ctx) => {
    if (typeof pi.getFlag === "function" && pi.getFlag("no-web-gate") === true) {
      gateEnabled = false;
    }
    if (!gateEnabled) {
      ctx.ui.setStatus("web-gate", "🌐 Web-Gate: OFF");
    }
  });
}
