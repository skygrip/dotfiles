import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

/**
 * TypeBox Schema definition for `ask_question` tool parameters.
 * Designed with a required question and clear constraints.
 */
export const AskQuestionSchema = Type.Object({
  question: Type.String({
    description: "The prompt or question to display to the user."
  }),
  type: StringEnum(["input", "confirm", "select"] as const, {
    description: "Interaction mode: 'confirm' for Yes/No, 'select' for menu list, 'input' for freeform text."
  }),
  choices: Type.Optional(Type.Array(Type.String(), {
    description: "List of options for the user to choose from (required when type is 'select')."
  })),
  timeoutMs: Type.Optional(Type.Integer({
    description: "Optional timeout in milliseconds. If omitted, waits indefinitely for user response."
  })),
  defaultValue: Type.Optional(Type.String({
    description: "Optional fallback value returned if prompt times out, is cancelled, or runs in headless mode."
  }))
});

export type AskQuestionParams = Static<typeof AskQuestionSchema>;

export interface AskQuestionDetails {
  answer?: string;
  cancelled?: boolean;
  timedOut?: boolean;
  headless?: boolean;
  error?: string;
}

/**
 * Normalizes choices passed by models (handles arrays, comma-delimited strings, and object lists).
 * Automatically strips leading numbering/bullets (e.g. "1. Option" -> "Option") to prevent double numbering in TUI.
 */
function normalizeChoices(rawChoices: unknown): string[] {
  if (!rawChoices) return [];

  const cleanItem = (item: string): string => {
    return item.trim().replace(/^(?:\d+[\.\)\-:]|\*|-|\u2022)\s*/, "").trim();
  };

  if (Array.isArray(rawChoices)) {
    return rawChoices
      .map(c => {
        if (typeof c === "string") return cleanItem(c);
        if (typeof c === "object" && c !== null) {
          const obj = c as Record<string, unknown>;
          return cleanItem(String(obj.label ?? obj.name ?? obj.value ?? JSON.stringify(obj)));
        }
        return cleanItem(String(c));
      })
      .filter(Boolean);
  }
  if (typeof rawChoices === "string") {
    const trimmed = rawChoices.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeChoices(parsed);
      } catch {
        // Fall back to splitting
      }
    }
    return trimmed.split(/\r?\n|,/).map(s => cleanItem(s)).filter(Boolean);
  }
  return [];
}

/**
 * Wraps a UI promise with an optional timeout and AbortSignal listener.
 */
function withTimeoutAndSignal<T>(
  promise: Promise<T>,
  timeoutMs?: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(new Error("Operation aborted"));
  }

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        reject(new Error(`Prompt timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }
  });

  const abortPromise = new Promise<never>((_, reject) => {
    if (signal) {
      signal.addEventListener("abort", () => reject(new Error("Operation aborted")), { once: true });
    }
  });

  return Promise.race([promise, timeoutPromise, abortPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Extension module that registers the custom `ask_question` tool.
 * 
 * Purpose:
 * Provides a bridge between autonomous agent execution and the user, allowing the agent
 * to ask clarifying questions, request selections from menus, or ask for binary confirmation
 * without terminating the agent's turn.
 * 
 * @param pi - The ExtensionAPI instance provided by the pi-coding-agent harness.
 */
export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_question",
    label: "Ask Question",
    description: "Prompt user for input, menu selection, or yes/no confirmation.",

    promptSnippet: "Proactively prompt the user for clarifying choices, architectural trade-offs, yes/no approvals, or missing inputs.",

    promptGuidelines: [
      "Use 'select' to present 2-4 concrete options when facing architectural trade-offs, library choices, or design forks.",
      "Use 'confirm' before high-impact refactors, service restarts, or destructive operations.",
      "Use 'input' when requirements or configurations are ambiguous rather than making blind assumptions.",
      "Prefer calling ask_question with structured choices over asking questions in plain markdown text."
    ],

    parameters: AskQuestionSchema,

    /**
     * Pre-validation argument normalizer to withstand 12B model enum hallucinations.
     */
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      const copy = { ...args };

      // Normalize enum types
      if (typeof copy.type === "string") {
        const t = copy.type.toLowerCase().trim();
        if (["confirm", "confirmation", "boolean", "yes_no", "yesno"].includes(t)) {
          copy.type = "confirm";
        } else if (["select", "choice", "choices", "options", "menu", "multiple_choice"].includes(t)) {
          copy.type = "select";
        } else {
          copy.type = "input";
        }
      }

      // Normalize choice list
      if (copy.choices !== undefined) {
        copy.choices = normalizeChoices(copy.choices);
      }

      // Ensure question is a string
      if (copy.question === undefined || copy.question === null) {
        copy.question = copy.type === "confirm" ? "Proceed?" : copy.type === "select" ? "Choose an option:" : "Enter value:";
      } else if (typeof copy.question !== "string") {
        copy.question = String(copy.question);
      }

      return copy;
    },

    async execute(_toolCallId, params: AskQuestionParams, signal, _onUpdate, ctx) {
      const promptType = params.type || "input";
      const question = params.question.trim() || (promptType === "confirm" ? "Proceed?" : promptType === "select" ? "Choose an option:" : "Enter value:");
      const choices = normalizeChoices(params.choices);

      // ----------------------------------------------------
      // 1. Headless Fallback Mode
      // ----------------------------------------------------
      if (!ctx.hasUI || !ctx.ui) {
        let fallback = params.defaultValue;
        if (fallback === undefined) {
          fallback = promptType === "confirm" ? "No" : (promptType === "select" && choices.length > 0 ? choices[0] : "No response");
        }
        return {
          content: [{ type: "text", text: `[Headless Mode Fallback]: ${fallback}` }],
          details: { answer: fallback, headless: true } as AskQuestionDetails
        };
      }

      const dialogOptions = params.timeoutMs ? { timeout: params.timeoutMs } : {};

      // ----------------------------------------------------
      // 2. Interactive TUI Modes
      // ----------------------------------------------------
      try {
        // Mode: Confirm (Binary Yes/No modal gate)
        if (promptType === "confirm") {
          const confirmed = await withTimeoutAndSignal(
            ctx.ui.confirm("Confirmation", question, dialogOptions),
            params.timeoutMs,
            signal
          );
          const answer = confirmed ? "Yes" : "No";
          return {
            content: [{ type: "text", text: `User selected: "${answer}". Decision confirmed — proceed with implementation using this direction.` }],
            details: { answer, cancelled: false } as AskQuestionDetails
          };
        }

        // Mode: Select (Vertical scroll option list)
        if (promptType === "select") {
          if (choices.length === 0) {
            // Gracefully degrade to text input if model failed to provide choice items
            const textResponse = await withTimeoutAndSignal(
              ctx.ui.input(`${question} (Type your choice):`, "", dialogOptions),
              params.timeoutMs,
              signal
            );
            if (textResponse === undefined) {
              const fallback = params.defaultValue;
              return {
                content: [{ type: "text", text: fallback !== undefined ? `[User Cancelled Prompt]: Returning fallback "${fallback}"` : `[User Cancelled Prompt]: No selection made.` }],
                details: { answer: fallback, cancelled: true } as AskQuestionDetails
              };
            }
            const finalVal = textResponse.trim() || params.defaultValue || "";
            return {
              content: [{ type: "text", text: `User selected: "${finalVal}". Decision confirmed — proceed with implementation using this direction.` }],
              details: { answer: finalVal, cancelled: false } as AskQuestionDetails
            };
          }

          const selection = await withTimeoutAndSignal(
            ctx.ui.select(question, choices, dialogOptions),
            params.timeoutMs,
            signal
          );

          if (selection === undefined) {
            // User cancelled with Escape
            const fallback = params.defaultValue;
            return {
              content: [{ type: "text", text: fallback !== undefined ? `[User Cancelled Prompt]: Returning fallback "${fallback}"` : `[User Cancelled Prompt]: No selection made.` }],
              details: { answer: fallback, cancelled: true } as AskQuestionDetails
            };
          }

          return {
            content: [{ type: "text", text: `User selected: "${selection}". Decision confirmed — proceed with implementation using this direction.` }],
            details: { answer: selection, cancelled: false } as AskQuestionDetails
          };
        }

        // Mode: TextInput (Freeform keyboard text entry)
        const response = await withTimeoutAndSignal(
          ctx.ui.input(question, "", dialogOptions),
          params.timeoutMs,
          signal
        );

        if (response === undefined) {
          // User cancelled with Escape
          const fallback = params.defaultValue;
          return {
            content: [{ type: "text", text: fallback !== undefined ? `[User Cancelled Prompt]: Returning fallback "${fallback}"` : `[User Cancelled Prompt]: No input entered.` }],
            details: { answer: fallback, cancelled: true } as AskQuestionDetails
          };
        }

        const finalResponse = response.trim() || params.defaultValue || "";
        return {
          content: [{ type: "text", text: `User response: "${finalResponse}". Decision confirmed — proceed with implementation using this direction.` }],
          details: { answer: finalResponse, cancelled: false } as AskQuestionDetails
        };

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const isAbort = errMsg.toLowerCase().includes("aborted");
        const isTimeout = errMsg.toLowerCase().includes("timed out");

        if (isAbort) {
          return {
            content: [{ type: "text", text: `[Prompt Aborted]: Execution was interrupted by user.` }],
            details: { cancelled: true, error: "Aborted" } as AskQuestionDetails
          };
        }

        if (isTimeout) {
          const fallback = params.defaultValue ?? (promptType === "confirm" ? "No" : "");
          return {
            content: [{ type: "text", text: `[Prompt Timed Out]: No user interaction within timeout. Fallback: "${fallback}"` }],
            details: { answer: fallback, timedOut: true, cancelled: true } as AskQuestionDetails
          };
        }

        const fallback = params.defaultValue ?? "";
        return {
          content: [{ type: "text", text: `[Prompt Error]: ${errMsg}. Fallback: "${fallback}"` }],
          details: { answer: fallback, error: errMsg, cancelled: true } as AskQuestionDetails
        };
      }
    },

    /**
     * Renders a preview block in the TUI console during the tool-calling pre-execution step.
     */
    renderCall(args: any, theme, _context) {
      const type = typeof args?.type === "string" ? args.type : "input";
      const qText = typeof args?.question === "string" ? args.question.trim() : "";
      const truncatedQ = qText.length > 70 ? `${qText.slice(0, 67)}...` : qText;

      let text = theme.fg("toolTitle", theme.bold("ask_question")) +
        theme.fg("dim", ` (mode: ❓ ${type})`);

      if (args?.timeoutMs && args.timeoutMs > 0) {
        text += theme.fg("dim", ` [timeout: ${Math.round(args.timeoutMs / 1000)}s]`);
      }

      if (truncatedQ) {
        text += theme.fg("muted", `\n  "${truncatedQ}"`);
      }

      if (type === "select" && Array.isArray(args?.choices) && args.choices.length > 0) {
        const choicesPreview = args.choices.slice(0, 3).map((c: string, i: number) => `${i + 1}. ${c}`).join(" | ");
        const suffix = args.choices.length > 3 ? ` (+${args.choices.length - 3} more)` : "";
        text += theme.fg("dim", `\n  Choices: [${choicesPreview}${suffix}]`);
      }

      return new Text(text, 0, 0);
    },

    /**
     * Renders the resolved results block in the TUI console history.
     */
    renderResult(result, _options, theme, _context) {
      const details = result.details as AskQuestionDetails | undefined;
      if (!details) {
        const text = result.content?.[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.error && !details.cancelled) {
        return new Text(theme.fg("warning", `✗ ERROR: ${details.error}`), 0, 0);
      }

      if (details.headless) {
        return new Text(theme.fg("dim", `⚡ HEADLESS: Fallback "${details.answer ?? "No response"}"`), 0, 0);
      }

      if (details.timedOut) {
        return new Text(theme.fg("warning", `⏱ TIMED OUT: Fallback "${details.answer ?? "None"}"`), 0, 0);
      }

      if (details.cancelled) {
        const fallbackText = details.answer ? ` (Fallback: "${details.answer}")` : " (No input)";
        return new Text(theme.fg("muted", `⊘ CANCELLED${fallbackText}`), 0, 0);
      }

      const answer = details.answer !== undefined ? String(details.answer) : "";
      return new Text(theme.fg("success", `✓ ANSWERED: `) + theme.fg("text", `"${answer}"`), 0, 0);
    }
  });
}