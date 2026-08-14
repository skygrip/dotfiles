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

    promptSnippet: "Run a step-by-step reasoning loop to think through complex logic, hypotheses, or multi-file problems.",

    promptGuidelines: [
      "Use sequential_thinking to formulate complex architectural plans or multi-file refactors before executing edits.",
      "Keep thoughts structured, actionable, and focused on current task milestones."
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
    async execute(_toolCallId: string, _params: SequentialThinkingParams) {
      return {
        content: [
          {
            type: "text",
            text: "Thought logged successfully. Proceed with the next step."
          }
        ]
      };
    },

    renderCall(args: any, theme: any, _context: any) {
      const thought = typeof args.thought === "string" ? args.thought.trim() : "";
      const header = theme.fg("toolTitle", theme.bold("sequential_thinking")) + "\n";
      const indented = thought.split("\n").map(line => `  ${line}`).join("\n");
      return new Text(header + theme.fg("muted", indented), 0, 0);
    },

    renderResult(_result: any, _options: any, _theme: any, _context: any) {
      return new Text("", 0, 0);
    }
  });
}