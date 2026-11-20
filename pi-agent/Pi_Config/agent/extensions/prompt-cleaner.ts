/**
 * @fileoverview Prompt Cleaner & In-Context Tool Normalizer Extension for Pi Coding Agent.
 *
 * Provides system prompt hygiene, OS/shell runtime anchoring, schema clarification, and
 * conversation history alignment to maximize tool-calling accuracy on local, open-weights,
 * and abliterated models (e.g. Gemma 4, Qwen).
 *
 * -------------------------------------------------------------------------------------
 * Core Capabilities & Architecture:
 * -------------------------------------------------------------------------------------
 * 1. System Prompt Boilerplate Stripping & OS Runtime Anchor (`before_agent_start`):
 *    - Strips the hardcoded <tools> XML block so native JSON Schema tool definitions drive behavior.
 *    - Injects a compact OS / shell / container runtime anchor (e.g. Windows 11 + PowerShell 7.x
 *      or Arch Linux Podman container + bash) so models don't mix Windows and POSIX shell syntax.
 *
 * 2. Autoregressive Attention Anchoring (`before_provider_request` & `context`):
 *    - Re-serializes tool call arguments in the conversation history so that target file
 *      identifiers (`path`, `filePath`, `file_path`) are guaranteed to appear as property #1.
 *    - On POSIX (Linux/macOS), normalizes accidental backslash separators in relative `path`
 *      arguments to forward slashes.
 *
 * 3. Cross-Format Argument Normalization:
 *    - Transparently handles OpenAI-style function calls (`tool_calls[].function.arguments`),
 *      Anthropic-style content blocks (`content[].input`), and Pi native AgentMessage blocks (`content[].arguments`).
 *
 * 4. OS-Gated Windows Path Normalization:
 *    - On Windows (`win32`), normalizes unescaped Windows backslashes in documentation paths,
 *      context instructions, and skill locations to forward slashes without mutating intentional
 *      Windows examples inside skills when running on Linux/macOS.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface RuntimeInfo {
  platform: NodeJS.Platform;
  osLabel: string;
  shellLabel: string;
  container?: "Podman" | "Docker" | "container";
}

/**
 * Detects the current OS version, shell version, and container runtime (if any).
 */
export function detectRuntimeInfo(): RuntimeInfo {
  const platform = process.platform;

  if (platform === "win32") {
    const release = os.release(); // e.g. "10.0.26100"
    const build = Number.parseInt(release.split(".")[2] || "0", 10);
    const winName = build >= 22000 ? "Windows 11" : "Windows 10";
    const osLabel = release ? `${winName} (${release})` : winName;

    let shellLabel = "PowerShell";
    try {
      const out = execFileSync("pwsh", ["--version"], {
        encoding: "utf8",
        timeout: 1500,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (out) shellLabel = out; // e.g. "PowerShell 7.5.0"
    } catch {
      try {
        const out = execFileSync(
          "powershell.exe",
          ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"],
          {
            encoding: "utf8",
            timeout: 1500,
            stdio: ["ignore", "pipe", "ignore"],
          }
        ).trim();
        if (out) shellLabel = `Windows PowerShell ${out}`;
      } catch {
        // Keep generic fallback
      }
    }

    return { platform, osLabel, shellLabel };
  }

  if (platform === "linux") {
    let osLabel = "Linux";
    try {
      const osRelease = fs.readFileSync("/etc/os-release", "utf8");
      const match = osRelease.match(/^PRETTY_NAME=(?:"([^"]+)"|([^\n]+))/m);
      if (match) osLabel = (match[1] || match[2]).trim();
    } catch {
      // Fallback to generic Linux
    }

    let container: RuntimeInfo["container"];
    if (fs.existsSync("/run/.containerenv") || process.env.container === "podman") {
      container = "Podman";
    } else if (fs.existsSync("/.dockerenv") || process.env.container === "docker") {
      container = "Docker";
    } else if (process.env.container) {
      container = "container";
    }

    const shellBin = process.env.SHELL ? path.basename(process.env.SHELL) : "bash";
    return { platform, osLabel, shellLabel: shellBin, container };
  }

  const shellBin = process.env.SHELL ? path.basename(process.env.SHELL) : "zsh";
  return {
    platform,
    osLabel: platform === "darwin" ? `macOS (${os.release()})` : `${platform} (${os.release()})`,
    shellLabel: shellBin,
  };
}

/**
 * Formats a concise 1-line runtime environment anchor for the system prompt.
 */
export function formatRuntimeAnchor(info: RuntimeInfo): string {
  if (info.platform === "win32") {
    return `- RUNTIME: ${info.osLabel}, ${info.shellLabel}. Use PowerShell syntax.`;
  }
  if (info.container) {
    return `- RUNTIME: ${info.osLabel} container (${info.container}, ${info.shellLabel}). Use POSIX/${info.shellLabel} syntax.`;
  }
  return `- RUNTIME: ${info.osLabel} (${info.shellLabel}). Use POSIX/${info.shellLabel} syntax.`;
}

/**
 * Normalizes tool call argument objects or JSON strings so that 'path' is always the first key.
 * On POSIX platforms, also normalizes accidental Windows backslash separators in relative paths.
 *
 * @param rawArgs - Raw tool arguments as a JSON string, object, or null/undefined.
 * @param platform - Target platform (defaults to process.platform).
 * @returns Reordered arguments with 'path' prioritized as the first property.
 */
export function prioritizePathFirst(rawArgs: any, platform: NodeJS.Platform = process.platform): any {
  if (!rawArgs) return rawArgs;
  const isString = typeof rawArgs === "string";
  let obj: any;

  try {
    obj = isString ? JSON.parse(rawArgs) : rawArgs;
  } catch {
    return rawArgs;
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return rawArgs;
  }

  // Always prioritize explicit path keys; only map generic aliases (target/file/src) when file-operation properties exist
  const STRICT_PATH_KEYS = ["path", "filePath", "file_path", "filename"];
  const CONTEXTUAL_ALIASES = ["target", "file", "src"];
  const hasFileOpPayload = "edits" in obj || "content" in obj || "oldText" in obj || "offset" in obj || "limit" in obj;
  const candidateKeys = hasFileOpPayload ? [...STRICT_PATH_KEYS, ...CONTEXTUAL_ALIASES] : STRICT_PATH_KEYS;

  const targetKey = candidateKeys.find(k => k in obj);
  if (!targetKey) {
    return rawArgs;
  }

  let targetVal = obj[targetKey];
  if (platform !== "win32" && typeof targetVal === "string" && targetVal.includes("\\") && !/^[a-zA-Z]:\\/.test(targetVal)) {
    targetVal = targetVal.replace(/\\/g, "/");
  }

  const { [targetKey]: _, ...rest } = obj;
  const reordered = { path: targetVal, ...rest };

  return isString ? JSON.stringify(reordered) : reordered;
}

/**
 * Traverses a message history array and normalizes all embedded tool calls to ensure 'path' is serialized first.
 *
 * @param messages - Array of conversation messages.
 * @param platform - Target platform (defaults to process.platform).
 * @returns The sanitized messages array.
 */
function sanitizeMessages(messages: any[], platform: NodeJS.Platform = process.platform): any[] {
  if (!Array.isArray(messages)) return messages;

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;

    // 1. OpenAI format tool_calls
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc?.function?.arguments) {
          tc.function.arguments = prioritizePathFirst(tc.function.arguments, platform);
        }
      }
    }

    // 2. Legacy / mock toolCalls array
    if (Array.isArray(msg.toolCalls)) {
      for (const tc of msg.toolCalls) {
        if (tc?.arguments) {
          tc.arguments = prioritizePathFirst(tc.arguments, platform);
        }
      }
    }

    // 3. Structured content blocks (Anthropic tool_use & Pi native toolCall)
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "tool_use" && block.input) {
          block.input = prioritizePathFirst(block.input, platform);
        }
        if (block?.type === "toolCall" && block.arguments) {
          block.arguments = prioritizePathFirst(block.arguments, platform);
        }
      }
    }
  }

  return messages;
}

/**
 * Normalizes unescaped Windows backslashes in documentation, context, and skill paths to forward slashes.
 *
 * @param text - The raw prompt text containing Windows file paths.
 * @returns The prompt text with normalized forward-slash paths.
 */
export function normalizeWindowsPaths(text: string): string {
  if (!text || typeof text !== "string") return text;

  // 1. Normalize XML attributes and tags (<location> and <project_instructions path="...">)
  text = text.replace(
    /<location>([a-zA-Z]:\\[^<]+)<\/location>/g,
    (_, p) => `<location>${p.replace(/\\/g, "/")}</location>`
  );
  text = text.replace(
    /<project_instructions path="([a-zA-Z]:\\[^"]+)">/g,
    (_, p) => `<project_instructions path="${p.replace(/\\/g, "/")}">`
  );

  // 2. Normalize documentation paths and general unquoted Windows drive-letter paths
  text = text.replace(
    /([a-zA-Z]:\\[^\s"'<>]+)/g,
    (match) => match.replace(/\\/g, "/")
  );

  return text;
}

let cachedRuntimeAnchor: string | null = null;
function getRuntimeAnchor(): string {
  if (!cachedRuntimeAnchor) {
    cachedRuntimeAnchor = formatRuntimeAnchor(detectRuntimeInfo());
  }
  return cachedRuntimeAnchor;
}

/**
 * Normalizes line endings, collapses multi-line <description> tags, strips <tools>,
 * and injects the runtime anchor cleanly inside <addendum> (or falls back to <env>).
 */
export function cleanSystemPrompt(
  prompt: string,
  runtimeAnchor: string,
  isWindows: boolean = process.platform === "win32"
): string {
  if (!prompt || typeof prompt !== "string") return prompt;

  // 1. Normalize CRLF / CR line endings to LF across the entire system prompt (incl. <addendum>)
  prompt = prompt.replace(/\r\n?/g, "\n");

  // 2. Remove hardcoded <tools> block
  prompt = prompt.replace(/<tools>[\s\S]*?<\/tools>\s*/g, "");

  // 3. Collapse multi-line / trailing-newline <description> tags (e.g. pi-subagents skill) to single-line
  prompt = prompt.replace(
    /<description>([\s\S]*?)<\/description>/g,
    (_, desc) => `<description>${desc.replace(/\s+/g, " ").trim()}</description>`
  );

  // 3b. Scope Pi's global <skills> path instruction so models don't misread it as applying to workspace tool calls
  prompt = prompt.replace(
    /Use absolute paths in tool calls\b/g,
    "Use absolute paths when referencing skill-relative files"
  );

  // 4. Normalize Windows backslashes only on Windows hosts so Linux skill docs aren't mutated
  if (isWindows) {
    prompt = normalizeWindowsPaths(prompt);
  }

  // 5. Inject concise OS / shell / container anchor inside <addendum> (idempotent)
  if (runtimeAnchor && !prompt.includes("- RUNTIME:")) {
    if (/<\/addendum>/.test(prompt)) {
      prompt = prompt.replace(/\n?<\/addendum>/, `\n${runtimeAnchor}\n</addendum>`);
    } else {
      prompt = `${prompt.trimEnd()}\n<env>\n${runtimeAnchor}\n</env>\n`;
    }
  }

  return prompt;
}

/**
 * Default export entrypoint for the Prompt Cleaner extension.
 *
 * @param pi - Pi Extension API instance.
 */
export default function (pi: ExtensionAPI) {
  const isWindows = process.platform === "win32";
  const runtimeAnchor = getRuntimeAnchor();

  // 1. Clean system prompt boilerplate, line endings, <description> tags, and inject OS/shell anchor
  pi.on("before_agent_start", async (event) => {
    const prompt = cleanSystemPrompt(event.systemPrompt, runtimeAnchor, isWindows);
    return { systemPrompt: prompt };
  });

  // 2. Intercept outgoing provider payload (OpenAI chat completions / llama-swap)
  pi.on("before_provider_request", async (event) => {
    const payload: any = event.payload;
    if (payload && Array.isArray(payload.messages)) {
      for (const msg of payload.messages) {
        if (msg && (msg.role === "system" || msg.role === "developer") && typeof msg.content === "string") {
          msg.content = msg.content.replace(/\r\n?/g, "\n");
          if (isWindows) {
            msg.content = normalizeWindowsPaths(msg.content);
          }
        }
      }
      sanitizeMessages(payload.messages);
    }
    return payload;
  });

  // 3. Intercept context message transformations
  pi.on("context", async (event) => {
    if (Array.isArray(event.messages)) {
      sanitizeMessages(event.messages);
    }
    return { messages: event.messages };
  });
}
