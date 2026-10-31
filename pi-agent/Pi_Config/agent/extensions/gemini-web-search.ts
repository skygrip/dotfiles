import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Text } from "@earendil-works/pi-tui";

/**
 * Lean Gemini Web Search Extension for Pi Coding Agent
 *
 * Tools & Commands:
 * - `web_search`: Google Search grounding via Gemini API with parallel citation resolution.
 * - `/search-gate`: Slash command to toggle pre-request confirmation gate ([status|on|off|toggle]).
 *
 * Configuration & CLI Flags:
 * - Gemini API Key: Resolved from GEMINI_API_KEY / GOOGLE_API_KEY env vars or Pi ModelRegistry (google).
 * - `GEMINI_SEARCH_MODEL`: Grounding model override (default: "gemini-flash-lite-latest").
 * - `--no-search-gate`: CLI flag to disable confirmation prompts for web search.
 * - `PI_SEARCH_GATE`: Environment variable override (set to "0" or "false" to disable).
 * - `PI_GATES`: Master environment variable override (set to "0" or "false" to disable all gates).
 */

const DEFAULT_MODEL = "gemini-flash-lite-latest";
const DEFAULT_API_HOST = "https://generativelanguage.googleapis.com";
const CONFIRM_TIMEOUT_MS = 30000; // 30s confirmation auto-dismiss
const COLLAPSED_PREVIEW_LINES = 6;

export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50 KB output ceiling

// Rates for gemini-flash-lite-latest (USD per 1M tokens)
const INPUT_PRICE_PER_M = 0.075;
const OUTPUT_PRICE_PER_M = 0.30;

/**
 * Evaluates whether a gate should be active at startup based on CLI flags and environment variables.
 */
function isGateEnabled(pi?: ExtensionAPI): boolean {
  if (pi && typeof pi.getFlag === "function" && pi.getFlag("no-search-gate") === true) {
    return false;
  }
  if (process.argv.includes("--no-search-gate") || process.argv.includes("--no-gates")) {
    return false;
  }

  const master = process.env.PI_GATES?.trim().toLowerCase();
  if (master && ["0", "false", "off", "disable", "disabled", "no"].includes(master)) {
    return false;
  }

  const val = process.env.PI_SEARCH_GATE?.trim().toLowerCase();
  if (val && ["0", "false", "off", "disable", "disabled", "no"].includes(val)) {
    return false;
  }

  return true;
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
 * Computes Pi Usage object from Gemini usageMetadata.
 */
export function computeGeminiUsage(usageMeta?: { promptTokenCount?: number; candidatesTokenCount?: number }) {
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
 * Formats tool output showing first X lines in collapsed view and full content on Ctrl+O.
 */
function formatToolOutput(content: string, theme?: any, expanded?: boolean, maxLines = COLLAPSED_PREVIEW_LINES): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  const lines = trimmed.split("\n");

  if (expanded || lines.length <= maxLines) {
    const body = lines.join("\n");
    return theme ? theme.fg("toolOutput", body) : body;
  }

  const preview = lines.slice(0, maxLines).join("\n");
  const coloredPreview = theme ? theme.fg("toolOutput", preview) : preview;
  const remaining = lines.length - maxLines;
  const hint = theme
    ? theme.fg("muted", `\n\n... (${remaining} more lines, `) + theme.fg("accent", "ctrl+o") + theme.fg("muted", " to expand)")
    : `\n\n... (${remaining} more lines)`;
  return `${coloredPreview}${hint}`;
}

export const WebSearchSchema = Type.Object({
  query: Type.String({
    description: "Descriptive natural language search query."
  })
});

export type WebSearchParams = Static<typeof WebSearchSchema>;

export interface SearchResultItem {
  title: string;
  url: string;
}

export interface WebSearchToolDetails {
  query?: string;
  model?: string;
  sources?: SearchResultItem[];
  denied?: boolean;
  error?: string;
  durationMs?: number;
  fullContent?: string;
}

/**
 * Resolves Gemini API key from environment variables or Pi ModelRegistry.
 */
export async function resolveApiKey(ctx: ExtensionContext): Promise<string | null> {
  const envKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (envKey) return envKey;

  if (ctx.modelRegistry) {
    if (typeof ctx.modelRegistry.getApiKeyForProvider === "function") {
      try {
        const key = await ctx.modelRegistry.getApiKeyForProvider("google");
        if (key) return key;
      } catch {}
    }

    if (typeof ctx.modelRegistry.getProviderAuth === "function") {
      try {
        const auth = await ctx.modelRegistry.getProviderAuth("google");
        if (auth?.auth?.apiKey) return auth.auth.apiKey;
      } catch {}
    }

    if (typeof ctx.modelRegistry.getApiKeyAndHeaders === "function") {
      try {
        const auth = await ctx.modelRegistry.getApiKeyAndHeaders({ provider: "google", id: DEFAULT_MODEL } as any);
        if (auth?.ok && auth.apiKey) return auth.apiKey;
      } catch {}
    }
  }

  return null;
}

/**
 * Resolves Google Grounding API redirect URLs to target destination URLs via HTTP HEAD.
 */
export async function resolveGroundingRedirect(proxyUrl: string, signal?: AbortSignal): Promise<string> {
  if (!proxyUrl.includes("vertexaisearch.cloud.google.com/grounding-api-redirect")) {
    return proxyUrl;
  }
  try {
    const timeoutSignal = AbortSignal.timeout(4000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const res = await fetch(proxyUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: combinedSignal
    });
    const location = res.headers.get("location");
    return location || proxyUrl;
  } catch {
    return proxyUrl;
  }
}

/**
 * Mutex queue ensuring concurrent tool calls present confirmation dialogs sequentially
 * rather than displacing/overwriting each other in Pi's single-slot editorContainer.
 */
let dialogQueue: Promise<void> = Promise.resolve();

/**
 * Prompts user for confirmation before outbound network calls (30s auto-dismiss).
 * Chained sequentially across concurrent tool calls.
 */
async function promptPermission(
  ctx: ExtensionContext,
  title: string,
  message: string,
  gateEnabled: boolean,
  signal?: AbortSignal
): Promise<boolean> {
  if (!gateEnabled) return true;

  if (!ctx.hasUI || !ctx.ui) {
    return false; // Refuse safely in non-interactive/headless environments
  }

  const g = globalThis as any;
  let releaseTurn: () => void = () => {};
  const currentTurn = new Promise<void>((r) => { releaseTurn = r; });
  const previousTurn: Promise<any> = g.__piDialogQueue || dialogQueue;
  dialogQueue = previousTurn.then(() => currentTurn, () => currentTurn);
  g.__piDialogQueue = dialogQueue;

  try {
    await previousTurn;
    return await ctx.ui.confirm(title, message, { timeout: CONFIRM_TIMEOUT_MS, signal });
  } catch {
    return false;
  } finally {
    releaseTurn();
  }
}

/**
 * Extension entrypoint registering web_search and /search-gate.
 */
export default function (pi: ExtensionAPI) {
  // ----------------------------------------------------
  // 0. CLI Flag Registration & Gate Initialization
  // ----------------------------------------------------
  pi.registerFlag("no-search-gate", {
    description: "Disable confirmation prompts for web search",
    type: "boolean"
  });

  let gateEnabled = isGateEnabled(pi);

  // ----------------------------------------------------
  // 1. Slash Command: /search-gate
  // ----------------------------------------------------
  const gateHandler = async (args: string, ctx: ExtensionContext) => {
    const sub = (args || "").trim().toLowerCase();

    if (sub === "status" || sub === "info") {
      ctx.ui.notify(`Search Gate is currently: ${gateEnabled ? "ENABLED (Prompts by default)" : "DISABLED (Auto-approves)"}`, "info");
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
    ctx.ui.setStatus("search-gate", gateEnabled ? undefined : "🔍 Search-Gate: OFF");
    ctx.ui.notify(`Search Gate: ${statusDesc}`, gateEnabled ? "info" : "warning");
  };

  pi.registerCommand("search-gate", {
    description: "Toggle or inspect web search permission gate (usage: /search-gate [status|on|off|toggle])",
    getArgumentCompletions(prefix: string) {
      const items = ["status", "on", "off", "toggle"];
      return items
        .filter((i) => i.startsWith(prefix.toLowerCase()))
        .map((i) => ({ value: i, label: i }));
    },
    handler: gateHandler
  });

  // ----------------------------------------------------
  // 2. Tool: web_search
  // ----------------------------------------------------
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search Google for current facts, live documentation, and API changes (e.g. researching unfamiliar CLI errors or recent framework updates).",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true
    },
    parameters: WebSearchSchema,

    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      const rawQuery = args.query ?? args.q ?? args.search ?? "";
      return {
        query: typeof rawQuery === "string" ? rawQuery : ""
      };
    },

    async execute(_toolCallId, params: WebSearchParams, signal, onUpdate, ctx) {
      const query = (params.query || "").trim();
      if (!query) {
        return {
          isError: true,
          content: [{ type: "text", text: "[Web Search Error]: Query cannot be empty." }],
          details: { error: "Empty query" } as WebSearchToolDetails
        };
      }

      const startTime = Date.now();

      const allowed = await promptPermission(
        ctx,
        "🌐 Web Search Confirmation",
        `Allow agent to search Google for:\n\n"${query}"\n\n(Auto-cancels in 30s)`,
        gateEnabled,
        signal
      );

      if (!allowed) {
        return {
          content: [{ type: "text", text: `[Web Search Denied by User]: User declined permission to search the web for "${query}".` }],
          details: { query, denied: true } as WebSearchToolDetails
        };
      }

      if (signal?.aborted) {
        return {
          isError: true,
          content: [{ type: "text", text: "[Web Search Aborted]" }],
          details: { query, error: "Aborted" } as WebSearchToolDetails
        };
      }

      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return {
          content: [{
            type: "text",
            text: "[Web Search Error]: Gemini API Key not found. Please set GEMINI_API_KEY or configure google in ~/.pi/agent/auth.json."
          }],
          details: { query, error: "Missing API Key" } as WebSearchToolDetails
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
        let answerText = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || "";

        if (!answerText.trim()) {
          if (data.promptFeedback?.blockReason) {
            answerText = `[Web Search Blocked]: Search query was blocked by Gemini safety filters (${data.promptFeedback.blockReason}).`;
          } else if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            answerText = `[Web Search]: Response ended with status '${candidate.finishReason}'.`;
          } else {
            answerText = "Information not found.";
          }
        }

        const rawChunks = candidate?.groundingMetadata?.groundingChunks || [];
        onUpdate?.({ content: [{ type: "text", text: `Resolving citations...` }] });

        // Pre-deduplicate by raw URI before issuing network HEAD requests
        const uriToTitle = new Map<string, string>();
        for (const chunk of rawChunks) {
          const uri = chunk.web?.uri?.trim();
          if (uri && !uriToTitle.has(uri)) {
            uriToTitle.set(uri, chunk.web?.title?.trim() || "Source");
          }
        }

        const resolvedUris = await Promise.all(
          Array.from(uriToTitle.keys()).map(async (uri) => ({
            resolvedUrl: await resolveGroundingRedirect(uri, signal),
            title: uriToTitle.get(uri)!
          }))
        );

        const uniqueSources: SearchResultItem[] = [];
        const seenUrls = new Set<string>();
        for (const { resolvedUrl, title } of resolvedUris) {
          if (resolvedUrl && !seenUrls.has(resolvedUrl)) {
            seenUrls.add(resolvedUrl);
            uniqueSources.push({ title, url: resolvedUrl });
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
            durationMs,
            fullContent: formattedOutput
          } as WebSearchToolDetails,
          usage
        };

      } catch (err: any) {
        if (signal?.aborted || err?.name === "AbortError") {
          return {
            isError: true,
            content: [{ type: "text", text: "[Web Search Aborted]" }],
            details: { query, error: "Aborted" } as WebSearchToolDetails
          };
        }
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `[Web Search Error]: ${msg}` }],
          details: { query, error: msg } as WebSearchToolDetails
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

      const details = result.details as WebSearchToolDetails | undefined;
      if (details?.denied) {
        return new Text(theme.fg("muted", `⊘ SEARCH DENIED: "${details.query}"`), 0, 0);
      }

      if (details?.error === "Aborted") {
        return new Text(theme.fg("muted", `⊘ SEARCH ABORTED: "${details.query}"`), 0, 0);
      }

      if (details?.error) {
        return new Text(theme.fg("warning", `✗ SEARCH FAILED: ${details.error}`), 0, 0);
      }

      const content = (options?.expanded && details?.fullContent)
        ? details.fullContent
        : (result.content?.[0]?.type === "text" ? result.content[0].text : "");

      if (!content) {
        return new Text(theme.fg("dim", "No search results returned."), 0, 0);
      }

      const timeStr = details?.durationMs ? ` (${(details.durationMs / 1000).toFixed(1)}s)` : "";
      const modelStr = details?.model ? ` [${details.model}]` : "";
      const header = theme.fg("success", "✓ SEARCH COMPLETED") + theme.fg("dim", `${modelStr}${timeStr}`);
      const formattedBody = formatToolOutput(content, theme, options?.expanded, COLLAPSED_PREVIEW_LINES);

      return new Text(`${header}\n\n${formattedBody}`, 0, 0);
    }
  });

  // ----------------------------------------------------
  // 3. Lifecycle Events
  // ----------------------------------------------------
  pi.on("session_start", async (_event, ctx) => {
    dialogQueue = Promise.resolve();
    (globalThis as any).__piDialogQueue = Promise.resolve();
    if (!gateEnabled) {
      ctx.ui.setStatus("search-gate", "🔍 Search-Gate: OFF");
    }
  });
}
