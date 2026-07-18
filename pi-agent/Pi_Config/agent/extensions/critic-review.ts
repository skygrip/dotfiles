import { complete } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@earendil-works/pi-tui";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Maps a file extension to its corresponding language identifier.
 * Used to provide language context to the critic model when evaluating files.
 * 
 * @param filePath - The path to the file.
 * @returns The language name (e.g., "TypeScript", "Python"), or "Unknown".
 */
function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".py": "Python",
    ".sh": "Shell/Bash",
    ".bash": "Shell/Bash",
    ".md": "Markdown",
    ".json": "JSON",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".toml": "TOML",
    ".html": "HTML",
    ".css": "CSS",
    ".php": "PHP",
    ".rb": "Ruby",
    ".go": "Go",
    ".rs": "Rust",
    ".c": "C",
    ".h": "C",
    ".cpp": "C++",
    ".hpp": "C++",
    ".cs": "C#",
    ".java": "Java",
    ".sql": "SQL",
    ".lua": "Lua",
    ".dockerfile": "Dockerfile",
  };
  return map[ext] || (ext ? ext.slice(1).toUpperCase() : "Unknown");
}

/**
 * Extension module that registers the `critic_review` tool.
 * 
 * Purpose:
 * Renders an isolated quality gate tool that passes drafts or file contents to an
 * independent model call with a strict auditing prompt. This helps break the model's
 * confirmation bias during editing or plan-execute cycles by forcing it to verify
 * changes against project rules and coding standards.
 * 
 * @param pi - The ExtensionAPI instance provided by the pi-coding-agent harness.
 */
export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "critic_review",
    label: "Critic Review",
    description: "Run an isolated code/document audit against optional rules before writing files.",

    // Schema parameters definition for LLM tool call generation
    parameters: Type.Object({
      draft: Type.Optional(Type.String({
        description: "Raw text to audit. Required if filePath is omitted."
      })),
      filePath: Type.Optional(Type.String({
        description: "Optional file path to audit."
      })),
      startLine: Type.Optional(Type.Integer({
        description: "1-based start line (file mode only)."
      })),
      endLine: Type.Optional(Type.Integer({
        description: "1-based end line (file mode only)."
      })),
      language: Type.Optional(Type.String({
        description: "Target language/extension. Auto-detected if omitted."
      })),
      rules: Type.Optional(Type.Array(Type.String(), {
        description: "Strict rules to enforce. Defaults to general audit."
      }))
    }),

    /**
     * Tool execution entry point.
     * Reads target files/ranges (if applicable), sets up the auditor prompt,
     * calls the active model registry to execute a raw LLM text completion,
     * and returns the critique results.
     */
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      let draftText = params.draft || "";

      // ----------------------------------------------------
      // 1. File Reading & Line Slicing
      // If filePath is specified, load contents. Supports both
      // local safe boundary validation and remote SSH reads.
      // Line range slicing is supported to minimize prompt tokens.
      // ----------------------------------------------------
      if (params.filePath) {
        try {
          let fileContent = "";
          const sshArg = pi.getFlag("ssh") as string | undefined;

          if (sshArg) {
            // --------------------------------------------------
            // 1.A. Remote SSH Read Mode
            // --------------------------------------------------
            let remoteStr = "";
            let remoteCwd = "";
            const idx = sshArg.indexOf(":");
            if (idx !== -1) {
              remoteStr = sshArg.slice(0, idx);
              remoteCwd = sshArg.slice(idx + 1);
            } else {
              remoteStr = sshArg;
            }
            const remoteArgs = remoteStr.split(/\s+/).filter(Boolean);

            if (!remoteCwd) {
              const pwdRes = await pi.exec("ssh", [...remoteArgs, "pwd"]);
              remoteCwd = pwdRes.stdout.trim();
            }

            const normalizedLocal = path.resolve(ctx.cwd).replace(/\\/g, "/").toLowerCase();
            const normalizedRemote = remoteCwd.replace(/\\/g, "/");

            let translatedPath = params.filePath;
            if (!translatedPath.startsWith("/")) {
              const resolved = path.resolve(params.filePath).replace(/\\/g, "/");
              const normalizedResolved = resolved.toLowerCase();
              if (normalizedResolved.startsWith(normalizedLocal)) {
                const relativePart = resolved.slice(normalizedLocal.length);
                translatedPath = (normalizedRemote + relativePart).replace(/\/+/g, "/");
              } else {
                translatedPath = resolved;
              }
            }

            const shellEscape = (arg: string) => "'" + arg.replace(/'/g, "'\\''") + "'";
            const catRes = await pi.exec("ssh", [...remoteArgs, `cat ${shellEscape(translatedPath)}`]);
            if (catRes.exitCode !== 0) {
              throw new Error(`SSH cat failed (exit: ${catRes.exitCode}): ${catRes.stderr}`);
            }
            fileContent = catRes.stdout;

          } else {
            // --------------------------------------------------
            // 1.B. Local Safe Read Mode
            // --------------------------------------------------
            const absolutePath = path.resolve(ctx.cwd, params.filePath);
            const normalized = absolutePath.replace(/\\/g, "/").toLowerCase();

            // Sensitive path protection
            const isSensitive =
              normalized.includes("/.git/") ||
              normalized.startsWith(".git/") ||
              normalized === ".git" ||
              normalized.endsWith("/.git") ||
              normalized === ".env" ||
              normalized.startsWith(".env/") ||
              normalized.endsWith("/.env") ||
              normalized.includes("/.env/") ||
              normalized.includes(".env.") ||
              /^[a-z]:\/(windows|program files)/i.test(normalized) ||
              /^\/(etc|var|usr|bin|sbin|lib|sys|proc|dev|boot|root)\b/i.test(normalized);

            // Workspace boundary protection
            const workspaceDir = path.resolve(process.cwd()).replace(/\\/g, "/").toLowerCase();
            const isOutside = normalized !== workspaceDir && !normalized.startsWith(workspaceDir + "/");

            if (isSensitive) {
              throw new Error(`Access denied: "${params.filePath}" matches a sensitive system path pattern.`);
            }
            if (isOutside) {
              throw new Error(`Access denied: "${params.filePath}" is outside the active project workspace.`);
            }

            fileContent = await fs.readFile(absolutePath, "utf-8");
          }

          if (params.startLine !== undefined || params.endLine !== undefined) {
            const lines = fileContent.split(/\r?\n/);
            const start = params.startLine !== undefined ? Math.max(1, params.startLine) - 1 : 0;
            const end = params.endLine !== undefined ? Math.min(lines.length, params.endLine) : lines.length;
            draftText = lines.slice(start, end).join("\n");
          } else {
            draftText = fileContent;
          }
        } catch (error) {
          const errMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: "text",
              text: `[CRITIC ERROR] Failed to read file '${params.filePath}': ${errMessage}`
            }],
            details: { error: `Failed to read file: ${errMessage}` }
          };
        }
      }

      // Check if draft content exists
      if (!draftText.trim()) {
        return {
          content: [{
            type: "text",
            text: `[CRITIC ERROR] No draft content provided. You must specify either 'draft' or a valid 'filePath' with content.`
          }],
          details: { error: "No draft content provided." }
        };
      }

      // ----------------------------------------------------
      // 2. Rules Setup & Language Mapping
      // Format the checklist rules and determine file type context.
      // ----------------------------------------------------
      const hasRules = params.rules && params.rules.length > 0;
      const rulesFormatted = hasRules
        ? params.rules!.map((rule, idx) => `${idx + 1}. ${rule}`).join("\n")
        : "None provided. Perform a general audit for code quality, design anti-patterns, functional bugs, security vulnerabilities, and formatting consistency.";

      const targetLanguage = params.language
        ? params.language
        : params.filePath
          ? getLanguageFromPath(params.filePath)
          : "Detect from context";

      // ----------------------------------------------------
      // 3. Isolated Auditor Prompt Setup
      // Prepares a strict system instruction for the critic model.
      // Enforces distinct categorization of issues: BLOCKING vs ADVISORY.
      // ----------------------------------------------------
      const isSnippet = params.startLine !== undefined || params.endLine !== undefined;
      const snippetNotice = isSnippet
        ? `\nNOTE: This is a partial snippet (lines ${params.startLine ?? 1}–${params.endLine ?? "end"}). Do NOT flag missing imports, incomplete surrounding context, or issues that exist outside the provided range.`
        : "";

      const systemPrompt = `You are an elite, merciless, and highly pragmatic code and document auditor operating in an isolated sandbox. Your goal is to review the provided draft with absolute objectivity. Err on the side of passing — only flag issues you are confident about.

TARGET LANGUAGE: ${targetLanguage}
${params.filePath ? `TARGET FILE PATH: ${params.filePath}` : ""}${snippetNotice}

${hasRules ? `STRICT RULES TO ENFORCE:\n${rulesFormatted}` : `GENERAL AUDIT GUIDELINES:\n${rulesFormatted}`}

OUTPUT FORMAT:
1. Categorize every issue as exactly one of:
   * [BLOCKING]: Functional bugs, syntax errors, security vulnerabilities, or explicit violations of the strict rules above.
   * [ADVISORY]: Style improvements, performance optimizations, design smells, or minor optional suggestions.
2. Format each issue as a list item with the prefix '* [BLOCKING]' or '* [ADVISORY]'.
3. Contextualize each issue with '(Line X)' or '(Global)' if it spans the entire file.
4. Include a suggested fix inside a fenced markdown code block when applicable.
   Example:
   * [BLOCKING] (Line 12): Soft equality used instead of strict equality.
     -> Fix:
     \`\`\`typescript
     if (a === b) {
     \`\`\`
5. Do not invent pedantic nitpicks (e.g. demanding comments, complaining about quote style, or minor spacing differences) unless they explicitly violate a strict rule.

VERDICT:
- If there are zero issues of any kind, output exactly: PASS
- If there are [ADVISORY] issues but zero [BLOCKING] issues, list the advisories then output: PASS
- If there are any [BLOCKING] issues, list all issues then output: FAIL`;

      // ----------------------------------------------------
      // 4. API Query Execution
      // Extract headers/keys for the active model and send the audit prompt.
      // ----------------------------------------------------
      try {
        const model = ctx.model;
        if (!model) {
          throw new Error("No active model found in current context.");
        }

        if (!ctx.modelRegistry) {
          throw new Error("Model registry is not available in current context.");
        }

        // Authenticate using session API keychain context
        const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
        if (!auth.ok) {
          throw new Error(`Authentication failed for model ${model.provider}/${model.id}: ${auth.error}`);
        }

        const auditMessages = [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: `Audit this draft:\n\n${draftText}` }
            ],
            timestamp: Date.now()
          }
        ];

        // Execute isolated, context-free LLM completion call via pi-ai module.
        // The systemPrompt is passed via Context.systemPrompt (system role), not embedded
        // in the user message, ensuring proper instruction authority and true isolation
        // from the main agent's conversation history.
        const response = await complete(
          model,
          { systemPrompt, messages: auditMessages },
          {
            apiKey: auth.apiKey,
            headers: auth.headers,
            signal
          }
        );

        const reviewResult = response.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("\n")
          .trim();

        return {
          content: [{
            type: "text",
            text: `[CRITIC AUDIT RESULT]\n\n${reviewResult}`
          }],
          details: { review: reviewResult }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: "text",
            text: `[CRITIC ERROR] Isolated session failed: ${errorMessage}`
          }],
          details: { error: errorMessage }
        };
      }
    },

    /**
     * Renders a preview block in the TUI console during the tool-calling pre-execution step.
     * Shows file paths, line numbers, target language, and a snippet of the draft.
     */
    renderCall(args, theme, _context) {
      let previewHeader = "";
      let lines: string[] = [];

      const parts: string[] = [];
      if (args.filePath) {
        let filePart = `File: ${args.filePath}`;
        if (args.startLine !== undefined || args.endLine !== undefined) {
          filePart += ` L${args.startLine ?? 1}-${args.endLine ?? ""}`;
        }
        parts.push(filePart);
      }
      if (args.language) {
        parts.push(`Lang: ${args.language}`);
      }

      if (parts.length > 0) {
        previewHeader = `${theme.fg("toolTitle", theme.bold("critic_review"))} [${parts.join(", ")}]`;
      } else {
        previewHeader = theme.fg("toolTitle", theme.bold("critic_review"));
      }

      const draft = typeof args.draft === "string" ? args.draft.trim() : "";
      if (draft) {
        lines = draft.split("\n");
      }

      const countLines = lines.length;
      const headerText = previewHeader + (countLines > 0 ? theme.fg("dim", ` (${countLines} lines)`) : "");

      let text = headerText;
      if (countLines > 0) {
        const previewLines = lines.slice(0, 6).map(l => {
          const truncatedLine = l.length > 100 ? `${l.slice(0, 97)}...` : l;
          return `  ${theme.fg("muted", truncatedLine)}`;
        }).join("\n");
        text += `\n${previewLines}`;
        if (countLines > 6) {
          text += `\n  ${theme.fg("dim", "...")}`;
        }
      } else if (args.filePath) {
        text += `\n  ${theme.fg("dim", "(Loading file contents for audit...)")}`;
      } else {
        text += `\n  ${theme.fg("dim", "(No draft or file specified)")}`;
      }
      return new Text(text, 0, 0);
    },

    /**
     * Renders the resolved results block in the TUI console history.
     * Displays the raw critic output — the calling agent interprets the content.
     */
    renderResult(result, _options, theme, _context) {
      const details = result.details as { review?: string; error?: string } | undefined;

      if (details?.error) {
        return new Text(theme.fg("warning", `✗ ERROR: ${details.error}`), 0, 0);
      }

      const review = details?.review?.trim() || "";
      if (!review) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      return new Text(review, 0, 0);
    }
  });
}