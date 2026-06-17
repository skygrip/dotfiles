import { complete } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "critic_review",
    label: "Critic Review",
    description: "An objective, isolated auditing sandbox to review drafts of code, markdown, or config files against strict rules, security anti-patterns, formatting guidelines, and privacy constraints to guarantee zero confirmation bias before making writes.",
    parameters: Type.Object({
      draft: Type.String({ description: "The raw draft of code, config, or markdown text to audit." }),
      rules: Type.Optional(Type.Array(Type.String(), { description: "Optional list of strict rules or guidelines that the draft must comply with. If omitted, a general quality, security, and bug audit is performed." }))
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const hasRules = params.rules && params.rules.length > 0;
      const rulesFormatted = hasRules
        ? params.rules!.map((rule, idx) => `${idx + 1}. ${rule}`).join("\n")
        : "None provided. Perform a general audit for code quality, design anti-patterns, functional bugs, security vulnerabilities, and formatting consistency.";

      const systemPrompt = `You are an elite, merciless, and highly pragmatic code and document auditor operating in an isolated sandbox. Your goal is to review the provided draft with absolute objectivity.

${hasRules ? `STRICT RULES TO ENFORCE:\n${rulesFormatted}` : `GENERAL AUDIT GUIDELINES:\n${rulesFormatted}`}

CRITICAL OUTPUT FORMATTING INSTRUCTIONS:
1. If the draft is of high quality, fully complies with all rules, and has no functional bugs, security vulnerabilities, or syntax errors, output exactly the word "PASS" in all capital letters with absolutely no other text.
2. If there are issues, you must output them grouped into exactly these two categories:
   * [BLOCKING]: Severe functional bugs, syntax errors, security risks, or explicit violations of the strict rules.
   * [ADVISORY]: Style improvements, performance optimizations, design smells, or minor optional suggestions.
3. Each issue must be formatted strictly as a list item starting with either the '* [BLOCKING]' or '* [ADVISORY]' prefix.
4. Every issue must be contextualized with a line number using the format '(Line X)' or '(Global)' if the issue spans the entire file.
5. All code modifications or replacements within a fix must be formatted inside explicit fenced markdown code blocks.
   Example format:
   * [BLOCKING] (Line 12): Soft equality used instead of strict equality.
     -> Fix:
     \`\`\`typescript
     if (a === b) {
     \`\`\`
6. Do not invent pedantic nitpicks (e.g. demanding comments, complaining about double vs single quotes, or minor spacing differences) unless they are explicitly violated by a strict rule.
7. If there are no [BLOCKING] issues, you must end your entire output with a "PASS" recommendation on a new line.`;

      try {
        const model = ctx.model;
        if (!model) {
          throw new Error("No active model found in current context.");
        }

        if (!ctx.modelRegistry) {
          throw new Error("Model registry is not available in current context.");
        }

        const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
        if (!auth.ok) {
          throw new Error(`Authentication failed for model ${model.provider}/${model.id}: ${auth.error}`);
        }

        const auditMessages = [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: `System Instruction: ${systemPrompt}\n\nPlease audit this draft:\n\n${params.draft}` }
            ],
            timestamp: Date.now()
          }
        ];

        const response = await complete(
          model,
          { messages: auditMessages },
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

    renderCall(args, theme, _context) {
      const draft = typeof args.draft === "string" ? args.draft.trim() : "";
      const lines = draft.split("\n");
      const countLines = lines.length;
      
      const headerText = theme.fg("toolTitle", theme.bold("critic_review")) + 
                         theme.fg("dim", ` (${countLines} lines)`);
      
      const previewLines = lines.slice(0, 6).map(l => {
        const truncatedLine = l.length > 100 ? `${l.slice(0, 97)}...` : l;
        return `  ${theme.fg("muted", truncatedLine)}`;
      }).join("\n");
      
      let text = headerText + `\n${previewLines}`;
      if (countLines > 6) {
        text += `\n  ${theme.fg("dim", "...")}`;
      }
      return new Text(text, 0, 0);
    },

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

      if (review === "PASS") {
        return new Text(theme.fg("success", "✓ PASS"), 0, 0);
      }

      // Semantic Line Highlight and No-Truncation!
      const lines = review.split("\n");
      const formattedLines = lines.map(line => {
        const lower = line.toLowerCase();
        if (lower.includes("[blocking]") || lower.includes("blocking:")) {
          // Style blocking issues in bold red/warning color
          return theme.fg("warning", theme.bold(`  ${line.trim()}`));
        } else if (lower.includes("[advisory]") || lower.includes("advisory:")) {
          // Style advisories in dynamic/accent color
          return theme.fg("accent", `  ${line.trim()}`);
        } else if (lower.includes("pass")) {
          return theme.fg("success", `  ${line.trim()}`);
        }
        return `  ${line}`;
      }).join("\n");

      const titleBlock = theme.fg("warning", theme.bold("✗ AUDIT ISSUES DETECTED\n")) +
                         theme.fg("dim", "  " + "─".repeat(50) + "\n");
      const footerBlock = theme.fg("dim", "\n  " + "─".repeat(50));
      
      return new Text(titleBlock + formattedLines + footerBlock, 0, 0);
    }
  });
}