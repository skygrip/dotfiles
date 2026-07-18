import { Type } from "@sinclair/typebox";
import { Text } from "@earendil-works/pi-tui";

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
export default function initExtension(pi: any) {
    pi.registerTool({
        name: "sequential_thinking",
        label: "Sequential Thinking",
        description: "Run a step-by-step reasoning loop to think through complex logic or multi-file problems.",

        // Simple flat schema for tool-calling reliability
        parameters: Type.Object({
            thought: Type.String({
                description: "Reasoning step, hypothesis, or analysis."
            }),
        }),

        /**
         * Executes the reasoning step. Logs the thought to the TUI status bar (if active)
         * and returns a success confirmation back to the agent execution loop.
         */
        async execute(toolCallId: string, params: { thought: string }, signal: any, onUpdate: any, ctx: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Thought logged successfully. Proceed with the next step."
                    }
                ],
            };
        },

        renderCall(args: any, theme: any, _context: any) {
            const thought = typeof args.thought === "string" ? args.thought.trim() : "";
            const header = theme.fg("toolTitle", theme.bold("sequential_thinking")) + "\n";
            const indented = thought.split("\n").map(line => `  ${line}`).join("\n");
            return new Text(header + theme.fg("muted", indented), 0, 0);
        },

        /**
         * Renders the resolved results block in the TUI console history.
         */
        renderResult(result: any, _options: any, theme: any, _context: any) {
            return new Text("", 0, 0);
        }
    });
}