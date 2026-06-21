import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

/**
 * Extension module that registers the custom `ask_question` tool.
 * 
 * Purpose:
 * Provides a synchronous-feeling bridge between the autonomous agent execution loop
 * and the user, allowing the agent to ask clarifying questions, request selections from
 * menus, or ask for binary confirmation without terminating the agent's turn.
 * 
 * Optimization Note:
 * This tool has been optimized to remove complex/nested schemas (like multi-question forms
 * or object-based choice lists) to make it safe, reliable, and token-efficient for
 * smaller, state-of-the-art models (such as Gemma 4 12B) that are sensitive to complex schemas.
 * 
 * @param pi - The ExtensionAPI instance provided by the pi-coding-agent harness.
 */
export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_question",
    label: "Ask Question",
    description: "Ask the user a clarifying question, request a choice from a menu, or ask for confirmation mid-execution without ending the current turn.",

    // Injected into the agent system prompt to advertise tool capability
    promptSnippet: "Prompt the user for real-time clarifying input, menus, or yes/no confirmation.",

    // Strict boundaries for the model to prevent over-use or bad parameterization
    promptGuidelines: [
      "Use ask_question ONLY when you hit a genuine branch, ambiguity, or critical design decision that requires immediate user steering to proceed.",
      "Use ask_question with type='select' and a list of 'choices' when presenting a distinct set of options.",
      "Use ask_question with type='confirm' for simple binary yes/no confirmation or safety checkpoints.",
      "Always provide a reasonable 'defaultValue' and a 'timeoutMs' (e.g., 15000 for 15s) so your execution doesn't hang indefinitely if the user is away."
    ],

    // TypeBox schema definition used by the LLM for argument construction
    parameters: Type.Object({
      question: Type.Optional(Type.String({
        description: "The question, prompt, or menu title to present to the user."
      })),
      type: StringEnum(["input", "confirm", "select"] as const, {
        description: "The interaction mode: 'input' for freeform text, 'confirm' for Yes/No, or 'select' to pick from a list."
      }),
      choices: Type.Optional(Type.Array(Type.String(), {
        description: "The list of menu options to present. Required if type is 'select'."
      })),
      timeoutMs: Type.Optional(Type.Integer({
        description: "Countdown timeout in milliseconds after which the dialog automatically dismisses."
      })),
      defaultValue: Type.Optional(Type.String({
        description: "The default value returned if the user cancels or the dialog times out."
      }))
    }),

    /**
     * Tool execution entry point.
     * 
     * @param toolCallId - Unique ID of the current tool execution.
     * @param params - Validated arguments conforming to the parameters schema.
     * @param signal - AbortSignal to handle execution cancellations.
     * @param onUpdate - Callback to send incremental updates back to the agent UI.
     * @param ctx - Session context containing active UI methods and environment states.
     */
    async execute(toolCallId, params, signal, onUpdate, ctx) {

      // ----------------------------------------------------
      // 1. Headless Fallback Mode
      // If the agent is running in a headless environment (e.g., CI pipelines, background tasks),
      // there is no terminal UI available. In this case, we immediately return the fallback defaults
      // to avoid hanging the process.
      // ----------------------------------------------------
      if (!ctx.hasUI || !ctx.ui) {
        let fallback = params.defaultValue;
        if (fallback === undefined) {
          fallback = params.type === "confirm" ? "No" : "No response";
        }
        return {
          content: [{ type: "text", text: `[Headless Mode Fallback]: ${fallback}` }],
          details: { answer: fallback, error: "TUI Unavailable" }
        };
      }

      // Extract dialog options such as timeouts if provided
      const dialogOptions = params.timeoutMs ? { timeout: params.timeoutMs } : {};
      const rawChoices = params.choices || [];

      // ----------------------------------------------------
      // 2. Standard Prompts Modes
      // Handles TUI interactions (Confirm modals, Select menus, and TextInput bars)
      // ----------------------------------------------------
      try {

        // Mode: Confirm (Binary Yes/No modal gate)
        if (params.type === "confirm") {
          const confirmed = await ctx.ui.confirm("Confirmation Gate", params.question || "Proceed?", dialogOptions);
          return {
            content: [{ type: "text", text: `User selected: ${confirmed ? "Yes" : "No"}` }],
            details: { answer: confirmed ? "Yes" : "No", cancelled: false }
          };
        }

        // Mode: Select (Vertical scroll option list)
        if (params.type === "select") {
          if (rawChoices.length === 0) {
            throw new Error("Parameters error: 'choices' is required when type is 'select'.");
          }
          const selection = await ctx.ui.select(params.question || "Choose:", rawChoices, dialogOptions);
          const finalValue = selection ?? params.defaultValue ?? rawChoices[0];
          return {
            content: [{ type: "text", text: `User selected: "${finalValue}"` }],
            details: { answer: finalValue, cancelled: selection === undefined }
          };
        }

        // Mode: TextInput (Freeform keyboard text entry)
        const response = await ctx.ui.input(params.question || "Enter value:", "", dialogOptions);
        const finalResponse = response ?? params.defaultValue ?? "";
        return {
          content: [{ type: "text", text: `User response: "${finalResponse}"` }],
          details: { answer: finalResponse, cancelled: response === undefined }
        };

      } catch (error) {
        // Fallback safety gate: returns defaultValue if user presses Escape or dialog times out
        const fallback = params.defaultValue ?? "";
        return {
          content: [{ type: "text", text: `[User Prompt Cancelled / Error]: ${error instanceof Error ? error.message : String(error)}. Returning fallback: "${fallback}"` }],
          details: { answer: fallback, error: error instanceof Error ? error.message : String(error), cancelled: true }
        };
      }
    },

    /**
     * Renders a preview block in the TUI console during the tool-calling pre-execution step.
     * Shows what question/mode the agent is currently requesting.
     * 
     * @param args - Arguments provided to the tool call.
     * @param theme - Active TUI color theme manager.
     * @param _context - Active UI layout context.
     */
    renderCall(args, theme, _context) {
      const type = typeof args.type === "string" ? args.type : "input";
      const qText = typeof args.question === "string" ? args.question.trim() : "";
      const truncatedQ = qText.length > 60 ? `${qText.slice(0, 57)}...` : qText;

      let text = theme.fg("toolTitle", theme.bold("ask_question")) +
        theme.fg("dim", ` (mode: ❓ ${type})`);

      if (truncatedQ) {
        text += theme.fg("muted", `\n  "${truncatedQ}"`);
      }
      return new Text(text, 0, 0);
    },

    /**
     * Renders the resolved results block in the TUI console history.
     * Shows whether the call succeeded, cancelled, or failed, along with the resolved value.
     * 
     * @param result - Result structure returned by the execute method.
     * @param _options - Additional renderer options.
     * @param theme - Active TUI color theme manager.
     * @param _context - Active UI layout context.
     */
    renderResult(result, _options, theme, _context) {
      const details = result.details as any;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      // Render Error state
      if (details.error) {
        return new Text(theme.fg("warning", `✗ ERROR: ${details.error}`), 0, 0);
      }

      // Render Cancelled / Timeout state
      if (details.cancelled) {
        return new Text(theme.fg("muted", "✓ CANCELLED (Using fallback defaults)"), 0, 0);
      }

      // Render successful answer resolved from user input
      const answer = details.answer !== undefined ? String(details.answer) : "";
      return new Text(theme.fg("success", `✓ ANSWERED: `) + theme.fg("text", `"${answer}"`), 0, 0);
    }
  });
}