import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Text } from "@earendil-works/pi-tui";

/**
 * Schema for sequential_thinking tool parameters.
 */
export const SequentialThinkingSchema = Type.Object({
  thought: Type.String({
    description: "Reasoning step, hypothesis, architectural plan, or analysis."
  })
});

export type SequentialThinkingParams = Static<typeof SequentialThinkingSchema>;

/**
 * Extension that registers the `sequential_thinking` tool.
 * 
 * Purpose:
 * Provides an intermediate reasoning scratchpad for the model. This allows the model
 * (especially smaller, highly capable SOTA models like Gemma) to decompose complex,
 * multi-step software engineering tasks, outline hypotheses, and reason step-by-step
 * before committing edits or executing commands.
 * 
 * @param pi - The ExtensionAPI instance provided by the pi-coding-agent harness.
 */
export default function initExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sequential_thinking",
    label: "Sequential Thinking",
    description: "For Step-by-step reasoning, test hypotheses, or to plan multi-file changes before editing code or executing actions (e.g. diagnosing subtle race conditions or planning complex refactors).",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    },
    parameters: SequentialThinkingSchema,

    /**
     * Pre-validation argument pass-through.
     */
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      return {
        thought: typeof args.thought === "string" ? args.thought : ""
      };
    },

    /**
     * Executes the reasoning step and returns a success confirmation back to the agent loop.
     */
    async execute(_toolCallId: string, params: SequentialThinkingParams) {
      const thought = typeof params.thought === "string" ? params.thought.trim() : "";
      return {
        content: [
          {
            type: "text",
            text: "Thought logged successfully. Consider if you have another thought to lodge, otherwise proceed with the next step."
          }
        ],
        details: { thought }
      };
    },

    renderCall(args: any, theme: any, context: any) {
      const thought = typeof args?.thought === "string" ? args.thought.trim() : "";
      const header = theme.fg("toolTitle", theme.bold("sequential_thinking"));
      if (!thought) return new Text(header, 0, 0);

      const lines = thought.split(/\r?\n/);
      const maxCollapsedLines = 10;

      if (!context?.expanded && lines.length > maxCollapsedLines) {
        const preview = lines.slice(0, maxCollapsedLines).join("\n");
        const remaining = lines.length - maxCollapsedLines;
        const hint = theme.fg("muted", `\n... (${remaining} more lines, `) +
          theme.fg("accent", "ctrl+o") +
          theme.fg("muted", " to expand)");
        return new Text(`${header}\n\n${theme.fg("toolOutput", preview)}${hint}`, 0, 0);
      }

      return new Text(`${header}\n\n${theme.fg("toolOutput", thought)}`, 0, 0);
    },

    renderResult(_result: any, _options: any, _theme: any, _context: any) {
      return new Text("", 0, 0);
    }
  });
}