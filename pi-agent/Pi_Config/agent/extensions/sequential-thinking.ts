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
    description: "Run a step-by-step reasoning loop to think through complex logic or multi-file problems.",

    promptGuidelines: [
      "Use sequential_thinking to structure multi-step reasoning, test hypotheses, and decompose complex logic before committing changes."
    ],

    parameters: SequentialThinkingSchema,

    /**
     * Pre-validation argument normalizer to handle 12B model property aliases.
     */
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      const copy = { ...args };

      if (copy.thought === undefined) {
        if (typeof copy.reasoning === "string") copy.thought = copy.reasoning;
        else if (typeof copy.steps === "string") copy.thought = copy.steps;
        else if (typeof copy.thoughtProcess === "string") copy.thought = copy.thoughtProcess;
        else if (typeof copy.text === "string") copy.thought = copy.text;
        else if (typeof copy.content === "string") copy.thought = copy.content;
      }

      if (copy.thought === undefined || copy.thought === null) {
        copy.thought = "";
      } else if (typeof copy.thought !== "string") {
        copy.thought = String(copy.thought);
      }

      return copy;
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

    renderCall(args: any, theme: any, _context: any) {
      const thought = typeof args?.thought === "string" ? args.thought.trim() : "";
      const preview = thought.length > 65 ? `${thought.slice(0, 62)}...` : thought;
      return new Text(
        theme.fg("toolTitle", theme.bold("sequential_thinking")) +
        (preview ? theme.fg("muted", ` "${preview}"`) : ""),
        0,
        0
      );
    },

    renderResult(result: any, options: any, theme: any, _context: any) {
      const thought = typeof result?.details?.thought === "string" ? result.details.thought : "";
      if (!thought) {
        return new Text(theme.fg("success", "🧠 THOUGHT LOGGED"), 0, 0);
      }

      const header = theme.fg("success", "🧠 THOUGHT");
      const lines = thought.split("\n");

      if (!options?.expanded) {
        const previewLines = lines.slice(0, 3).map((l: string) => `  ${theme.fg("dim", l)}`).join("\n");
        const remaining = lines.length - 3;
        const hint = remaining > 0
          ? theme.fg("muted", `\n  ... (${remaining} more lines, `) + theme.fg("accent", "ctrl+o") + theme.fg("muted", " to expand)")
          : "";
        return new Text(`${header}\n${previewLines}${hint}`, 0, 0);
      }

      const fullLines = lines.map((l: string) => `  ${theme.fg("toolOutput", l)}`).join("\n");
      return new Text(`${header}\n${fullLines}`, 0, 0);
    }
  });
}