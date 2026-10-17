/**
 * @fileoverview Prompt Cleaner & In-Context Tool Normalizer Extension for Pi Coding Agent.
 *
 * Provides system prompt hygiene, schema clarification, and conversation history alignment
 * to maximize tool-calling accuracy on local, open-weights, and abliterated models (e.g. Gemma 4, Qwen).
 *
 * -------------------------------------------------------------------------------------
 * Core Capabilities & Architecture:
 * -------------------------------------------------------------------------------------
 * 1. System Prompt Boilerplate Stripping (`before_agent_start`):
 *    - Intercepts the generated system prompt before LLM dispatch and strips Pi's hardcoded
 *      "Available tools: ..." text blocks.
 *    - Enables API-native JSON Schema tool definitions to drive model behavior directly,
 *      eliminating prompt contradiction and reclaiming valuable context window tokens.
 *
 * 2. Autoregressive Attention Anchoring (`before_provider_request` & `context`):
 *    - Re-serializes tool call arguments in the conversation history so that target file
 *      identifiers (`path`, `filePath`, `file_path`) are guaranteed to appear as property #1.
 *    - Breaks the "Poisoned History" feedback loop: prevents smaller or abliterated models
 *      from copying their own prior alphabetical key-ordering habits (`{"edits": ..., "path": ...}`).
 *    - Conditions the model's self-attention on the target file path *before* it begins generating
 *      code replacement tokens, preventing exact whitespace, indentation, and newline mismatches.
 *
 * 3. Cross-Format Argument Normalization:
 *    - Transparently handles OpenAI-style function calls (`tool_calls[].function.arguments`),
 *      Anthropic-style tool invocations (`toolCalls[].arguments`), and raw content blocks (`content[].input`).
 *
 * 4. Windows Path Normalization (Issue #8841):
 *    - Normalizes unescaped Windows backslashes in documentation paths, context instructions,
 *      and skill locations to forward slashes.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Normalizes tool call argument objects or JSON strings so that 'path' is always the first key.
 *
 * @param rawArgs - Raw tool arguments as a JSON string, object, or null/undefined.
 * @returns Reordered arguments with 'path' prioritized as the first property.
 */
function prioritizePathFirst(rawArgs: any): any {
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

  const targetVal = obj[targetKey];
  const { [targetKey]: _, ...rest } = obj;
  const reordered = { path: targetVal, ...rest };

  return isString ? JSON.stringify(reordered) : reordered;
}

/**
 * Traverses a message history array and normalizes all embedded tool calls to ensure 'path' is serialized first.
 *
 * @param messages - Array of conversation messages.
 * @returns The sanitized messages array.
 */
function sanitizeMessages(messages: any[]): any[] {
  if (!Array.isArray(messages)) return messages;

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;

    // 1. OpenAI format tool_calls
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc?.function?.arguments) {
          tc.function.arguments = prioritizePathFirst(tc.function.arguments);
        }
      }
    }

    // 2. Anthropic / custom format toolCalls
    if (Array.isArray(msg.toolCalls)) {
      for (const tc of msg.toolCalls) {
        if (tc?.arguments) {
          tc.arguments = prioritizePathFirst(tc.arguments);
        }
      }
    }

    // 3. Structured content blocks
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "tool_use" && block.input) {
          block.input = prioritizePathFirst(block.input);
        }
      }
    }
  }

  return messages;
}

/**
 * Normalizes Windows drive-letter paths in the system prompt to forward slashes.
 * Fixes issue #8841: unnormalized backslashes in documentation, context, and skill paths.
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

/**
 * Default export entrypoint for the Prompt Cleaner extension.
 *
 * @param pi - Pi Extension API instance.
 */
export default function (pi: ExtensionAPI) {
  // 1. Clean system prompt boilerplate & normalize Windows paths
  pi.on("before_agent_start", async (event) => {
    let prompt = event.systemPrompt;

    // Remove the hardcoded "<tools>...</tools>" block, "<docs>...</docs>" block, or legacy "Available tools: ..." block
    prompt = prompt.replace(
      /(?:<tools>[\s\S]*?<\/tools>\s*|<docs>[\s\S]*?<\/docs>\s*|Available tools:\s*[\s\S]*?In addition to the tools above[^\n]*\n+)/g,
      ""
    );

    // Normalize Windows backslashes in system prompt paths (issue #8841)
    prompt = normalizeWindowsPaths(prompt);

    return { systemPrompt: prompt };
  });

  // 2. Intercept outgoing provider payload (OpenAI chat completions / llama-swap)
  pi.on("before_provider_request", async (event) => {
    const payload: any = event.payload;
    if (payload && Array.isArray(payload.messages)) {
      for (const msg of payload.messages) {
        if (msg && (msg.role === "system" || msg.role === "developer") && typeof msg.content === "string") {
          msg.content = normalizeWindowsPaths(msg.content);
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

