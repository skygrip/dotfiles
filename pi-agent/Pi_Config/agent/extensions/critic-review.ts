import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { complete, calculateCost, type Message, type Model } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Mapping of common file extensions to programming languages for markdown formatting.
 */
const EXTENSION_MAP: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".ps1": "powershell",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".sql": "sql",
  ".html": "html",
  ".css": "css",
  ".md": "markdown"
};

function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || "text";
}

/**
 * Schema for the critic_review tool parameters exposed to the LLM.
 */
export const CriticReviewSchema = Type.Object({
  draft: Type.Optional(Type.String({
    description: "Proposed code snippet, refactor draft, architectural plan, or content to critique."
  })),
  filePath: Type.Optional(Type.String({
    description: "Path to an existing workspace file to audit."
  })),
  startLine: Type.Optional(Type.Integer({
    description: "Optional 1-based start line number when auditing a specific slice of a file."
  })),
  endLine: Type.Optional(Type.Integer({
    description: "Optional 1-based end line number when auditing a specific slice of a file."
  })),
  language: Type.Optional(Type.String({
    description: "Programming or markup language of the draft (e.g. 'typescript', 'python')."
  })),
  rules: Type.Optional(Type.Array(Type.String(), {
    description: "Optional list of project-specific rules, constraints, or invariants to enforce during audit."
  }))
});

export type CriticReviewParams = Static<typeof CriticReviewSchema>;

export interface CriticReviewDetails {
  auditorModel?: string;
  sourceTarget?: string;
  skipped?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  error?: string;
}

const CRITIC_SYSTEM_PROMPT = `You are a Principal Code Reviewer and Quality Auditor.
Your objective is to provide a rigorous, skeptical, and constructive technical review of the submitted draft or code slice.

Evaluation Dimensions:
1. Correctness: Logic bugs, off-by-one errors, null/undefined reference errors, race conditions, edge case failures.
2. Security: Path traversal, command injection, secret leakage, resource exhaustion, unsafe deserialization.
3. Robustness & Error Handling: Async rejection handling, resource cleanup in finally blocks, cancellation safety.
4. Architecture & Invariants: Adherence to specified constraints, clean typing, separation of concerns.

Review Rules:
- Slices: If reviewing a partial file slice, assume imports and types outside the slice are valid unless clearly broken.
- Anti-Flattery: Do not rubber-stamp. Actively look for subtle boundary bugs and unhandled error paths.

Format your review using these standard Markdown headers:
- If issues are found:
  ### 🚨 [BLOCKING] <Issue Title>
  - Line / Location: <exact line citation>
  - Cause: <concise explanation>
  - Remediation: <exact replacement code block>

  ### 💡 [ADVISORY] <Suggestion Title>
  - <non-blocking suggestions or optimizations>

- If no issues are found:
  ### ✅ [APPROVED]
  - <concise justification of why the code is sound>`;

/**
 * Prefixes each code line with 1-based line numbers to anchor review citations.
 */
function formatWithLineNumbers(code: string, startLine = 1): string {
  const lines = code.split("\n");
  const maxLineNum = startLine + lines.length - 1;
  const padding = String(maxLineNum).length;

  return lines
    .map((line, idx) => {
      const lineNum = String(startLine + idx).padStart(padding, " ");
      return `${lineNum} | ${line}`;
    })
    .join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "critic_review",
    label: "Critic Review",
    description: "Perform an isolated technical audit on code drafts, plans, or file snippets.",

    promptSnippet: "Request an independent technical audit of code drafts, plans, or file slices.",

    promptGuidelines: [
      "Use critic_review before applying complex refactors, security-critical changes, or large migrations.",
      "Provide either filePath (with optional startLine/endLine) or inline draft text for review."
    ],

    parameters: CriticReviewSchema,

    /**
     * Pre-validation argument normalizer to handle 12B model property aliases.
     */
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      const copy = { ...args };

      // Normalize filePath aliases
      if (copy.filePath === undefined) {
        if (typeof copy.path === "string") copy.filePath = copy.path;
        else if (typeof copy.file === "string") copy.filePath = copy.file;
        else if (typeof copy.target === "string") copy.filePath = copy.target;
      }

      // Normalize draft aliases
      if (copy.draft === undefined) {
        if (typeof copy.code === "string") copy.draft = copy.code;
        else if (typeof copy.content === "string") copy.draft = copy.content;
        else if (typeof copy.snippet === "string") copy.draft = copy.snippet;
        else if (typeof copy.text === "string") copy.draft = copy.text;
      }

      return copy;
    },

    async execute(_toolCallId, params: CriticReviewParams, signal, onUpdate, ctx) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "[Critic Review Aborted]" }], details: { error: "Aborted" } };
      }

      // ----------------------------------------------------
      // 1. Resolve Target Code / Content
      // ----------------------------------------------------
      let codeToReview = "";
      let resolvedLang = params.language || "text";
      let targetDesc = "";

      if (params.filePath) {
        targetDesc = params.filePath;
        resolvedLang = params.language || getLanguageFromPath(params.filePath);

        try {
          const rawContent = await fs.readFile(params.filePath, "utf8");
          const lines = rawContent.split("\n");

          const start = Math.max(1, params.startLine ?? 1);
          const end = Math.min(lines.length, params.endLine ?? lines.length);

          if (start > lines.length) {
            return {
              content: [{ type: "text", text: `[Critic Error]: startLine ${start} exceeds total file lines (${lines.length})` }],
              details: { error: "Invalid line range" }
            };
          }

          const slicedLines = lines.slice(start - 1, end);
          // Limit to max 2000 lines to prevent context blowouts
          const cappedLines = slicedLines.slice(0, 2000);
          codeToReview = formatWithLineNumbers(cappedLines.join("\n"), start);

          if (params.startLine || params.endLine) {
            targetDesc += ` (lines ${start}-${end})`;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `[Critic Error reading file]: ${msg}` }],
            details: { error: msg }
          };
        }
      } else if (params.draft) {
        targetDesc = "Inline Draft";
        codeToReview = params.draft;
      } else {
        return {
          content: [{ type: "text", text: "[Critic Error]: Must provide either 'draft' or 'filePath'." }],
          details: { error: "Missing draft or filePath" }
        };
      }

      // ----------------------------------------------------
      // 2. Point-of-Use Auditor Model Selection (TUI with 10s Countdown)
      // ----------------------------------------------------
      let selectedModel: Model | undefined = ctx.model;

      if (ctx.hasUI && ctx.ui) {
        try {
          const sessionModelDesc = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "Active Model";
          const allModels = ctx.modelRegistry
            ? (typeof ctx.modelRegistry.getAvailable === "function"
                ? ctx.modelRegistry.getAvailable()
                : typeof ctx.modelRegistry.getAll === "function"
                  ? ctx.modelRegistry.getAll()
                  : [])
            : [];

          const choices: string[] = [
            `1. Session Model (${sessionModelDesc}) [Default]`
          ];

          const seen = new Set<string>();
          if (ctx.model) seen.add(`${ctx.model.provider}/${ctx.model.id}`);

          for (const m of allModels) {
            const key = `${m.provider}/${m.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              choices.push(`${choices.length + 1}. ${m.provider}/${m.id}`);
            }
            if (choices.length >= 8) break; // Keep menu concise
          }

          choices.push("Skip this review");

          // 10-second native timed countdown
          const choice = await ctx.ui.select(
            "Select Auditor Model for Critic Review:",
            choices,
            { timeout: 10000 }
          );

          if (choice === undefined) {
            // Timed out or Escape: default to session model
            selectedModel = ctx.model;
          } else if (choice === "Skip this review") {
            return {
              content: [{ type: "text", text: "[CRITIC SKIPPED by User]" }],
              details: { skipped: true } as CriticReviewDetails
            };
          } else if (choice.startsWith("1.")) {
            selectedModel = ctx.model;
          } else {
            // Find selected model in registry
            const match = choice.replace(/^\d+\.\s*/, "").trim();
            const [prov, ...idParts] = match.split("/");
            const modId = idParts.join("/");
            const found = allModels.find(m => m.provider === prov && m.id === modId);
            selectedModel = found ?? ctx.model;
          }
        } catch (err) {
          ctx.ui?.notify?.(`Critic model selection error: ${err instanceof Error ? err.message : String(err)}`, "warning");
          // On any UI failure, fall back to session model
          selectedModel = ctx.model;
        }
      }

      if (!selectedModel) {
        return {
          content: [{ type: "text", text: "[Critic Error]: No active model configured to perform review." }],
          details: { error: "No model available" }
        };
      }

      const auditorModelName = `${selectedModel.provider}/${selectedModel.id}`;

      // ----------------------------------------------------
      // 3. Assemble Audit Messages
      // ----------------------------------------------------
      let userPrompt = `Please audit the following ${resolvedLang} code (${targetDesc}):\n\n`;
      if (params.rules && params.rules.length > 0) {
        userPrompt += `Project Constraints & Invariants:\n${params.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\n`;
      }
      userPrompt += `\`\`\`${resolvedLang}\n${codeToReview}\n\`\`\``;

      const messages: Message[] = [
        {
          role: "user",
          content: [{ type: "text", text: userPrompt }],
          timestamp: Date.now()
        }
      ];

      // ----------------------------------------------------
      // 4. Execute Sub-Call
      // ----------------------------------------------------
      onUpdate?.({
        content: [{ type: "text", text: `Auditing ${targetDesc} with ${auditorModelName}...` }]
      });

      try {
        let auth: { apiKey?: string; headers?: Record<string, string> } | undefined;
        if (typeof ctx.modelRegistry?.getApiKeyAndHeaders === "function") {
          auth = await ctx.modelRegistry.getApiKeyAndHeaders(selectedModel);
        } else if (typeof ctx.modelRegistry?.getProviderAuth === "function") {
          auth = await ctx.modelRegistry.getProviderAuth(selectedModel.provider);
        }

        let reviewText = "";
        let thinkingText = "";
        let usage: any = undefined;

        // 1. Attempt live streaming via streamSimple
        if (typeof ctx.modelRegistry?.streamSimple === "function") {
          const eventStream = ctx.modelRegistry.streamSimple(
            selectedModel,
            {
              systemPrompt: CRITIC_SYSTEM_PROMPT,
              messages
            },
            {
              apiKey: auth?.apiKey,
              headers: auth?.headers,
              signal
            }
          );

          for await (const event of eventStream) {
            if (signal?.aborted) break;

            if (event.type === "thinking_delta" && event.delta) {
              thinkingText += event.delta;
              const lastSnippet = thinkingText.slice(-120).replace(/\r?\n/g, " ").trim();
              onUpdate?.({
                content: [{
                  type: "text",
                  text: `Auditing ${targetDesc} with ${auditorModelName}...\n🧠 *Thinking (${thinkingText.length} chars):* ${lastSnippet}...`
                }]
              });
            } else if (event.type === "text_delta" && event.delta) {
              reviewText += event.delta;
              onUpdate?.({
                content: [{
                  type: "text",
                  text: `### Independent Critic Review (${auditorModelName}) [Live]\n**Target**: \`${targetDesc}\`\n\n${reviewText}`
                }]
              });
            } else if (event.type === "done") {
              usage = (event as any).message?.usage;
            } else if (event.type === "error") {
              throw (event as any).error ?? new Error("Stream error occurred during critic review");
            }
          }
        } else {
          // 2. Fallback to complete
          const response = await complete(
            selectedModel,
            {
              systemPrompt: CRITIC_SYSTEM_PROMPT,
              messages
            },
            {
              apiKey: auth?.apiKey,
              headers: auth?.headers,
              signal
            }
          );

          usage = response.usage;
          for (const block of response.content) {
            if (block.type === "text" && block.text) {
              reviewText += block.text;
            } else if ((block as any).type === "thought" && (block as any).thought && !reviewText) {
              reviewText += (block as any).thought;
            }
          }
        }

        // If no text was produced but thinking was, fallback to thinking
        if (!reviewText.trim() && thinkingText.trim()) {
          reviewText = thinkingText;
        }

        let calculatedCost = 0;
        try {
          if (typeof calculateCost === "function" && usage) {
            const costObj = calculateCost(selectedModel, usage);
            calculatedCost = typeof costObj === "number" ? costObj : costObj?.total ?? 0;
          }
        } catch {
          // Ignore cost calculation errors
        }

        const formattedResult = `### Independent Critic Review (${auditorModelName})\n**Target**: \`${targetDesc}\`\n\n${reviewText.trim()}`;

        return {
          content: [{ type: "text", text: formattedResult }],
          details: {
            auditorModel: auditorModelName,
            sourceTarget: targetDesc,
            skipped: false,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            cost: calculatedCost
          } as CriticReviewDetails
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `[Critic Execution Error with ${auditorModelName}]: ${msg}` }],
          details: { error: msg, auditorModel: auditorModelName } as CriticReviewDetails
        };
      }
    },

    renderCall(args: any, theme, _context) {
      const target = args?.filePath ?? (args?.draft ? "Inline Draft" : "Unknown");
      let text = theme.fg("toolTitle", theme.bold("critic_review")) +
        theme.fg("dim", ` target: ${target}`);
      if (args?.startLine || args?.endLine) {
        text += theme.fg("muted", ` [lines ${args.startLine ?? 1}-${args.endLine ?? "end"}]`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as CriticReviewDetails | undefined;
      if (!details) {
        const text = result.content?.[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg("warning", `✗ CRITIC FAILED: ${details.error}`), 0, 0);
      }

      if (details.skipped) {
        return new Text(theme.fg("muted", `⊘ CRITIC SKIPPED by user`), 0, 0);
      }

      return new Text(
        theme.fg("success", `✓ AUDITED: `) +
        theme.fg("dim", `(${details.auditorModel ?? "Auditor"}) on ${details.sourceTarget ?? "Target"}`),
        0,
        0
      );
    }
  });
}