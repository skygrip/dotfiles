import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Text } from "@earendil-works/pi-tui";

/**
 * Default timeout for interactive UI dialogs in milliseconds (30 seconds).
 */
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Streamlined TypeBox Schema for `ask_question`.
 * Designed with 2 straightforward fields (question + optional options).
 */
export const AskQuestionSchema = Type.Object({
  question: Type.String({
    description: "The question or decision prompt to display to the user."
  }),
  options: Type.Optional(Type.Array(Type.String(), {
    description: "List of choices for selection. Provide 2 or more options for multi-choice; defaults to ['Yes', 'No'] if omitted."
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
 * Normalizes options passed by models (handles arrays, comma-delimited strings, and object lists).
 * Automatically strips leading numbering/bullets (e.g. "1. Option" -> "Option") to prevent double numbering.
 */
function normalizeOptions(rawOptions: unknown): string[] {
  if (!rawOptions) return [];

  const cleanItem = (item: string): string => {
    return item.trim().replace(/^(?:\d+[\.\)\-:]|\*|-|\u2022)\s*/, "").trim();
  };

  if (Array.isArray(rawOptions)) {
    return rawOptions
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
  if (typeof rawOptions === "string") {
    const trimmed = rawOptions.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeOptions(parsed);
      } catch {
        // Fall back to splitting
      }
    }
    return trimmed.split(/\r?\n|,/).map(s => cleanItem(s)).filter(Boolean);
  }
  return [];
}

/**
 * Extracts enumerated choices from question text if the model embedded options inside the prompt string.
 */
function extractOptionsFromQuestion(q: string): string[] {
  if (!q || typeof q !== "string") return [];
  const lines = q.split(/\r?\n/);
  const options: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Matches "1. Option", "1) Option", "- Option", "* Option", "A) Option"
    const match = trimmed.match(/^(?:(?:\d+|[a-zA-Z])[\.\)\-:]|\*|-|\u2022)\s+(.+)$/);
    if (match && match[1]) {
      options.push(match[1].trim());
    }
  }
  return options;
}

/**
 * Wraps a UI promise with a timeout and AbortSignal listener.
 */
function withTimeoutAndSignal<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
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
 * Extension module registering the streamlined `ask_question` tool.
 */
export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_question",
    label: "Ask Question",
    description: "Prompt the user with an interactive decision menu, choice selection, or yes/no confirmation dialog (e.g. when there is ambiguity on an architectural decision or confirming destructive operations).",
    parameters: AskQuestionSchema,

    /**
     * Pre-validation argument normalizer to withstand model parameter aliases.
     */
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      const copy = { ...args };

      // Normalize question aliases
      if (copy.question === undefined || copy.question === null) {
        const altQ = copy.prompt ?? copy.message ?? copy.query ?? copy.title ?? copy.text ?? copy.description;
        if (altQ !== undefined && altQ !== null) {
          copy.question = String(altQ);
        }
      } else if (typeof copy.question !== "string") {
        copy.question = String(copy.question);
      }

      // Normalize options aliases (supporting legacy 'choices', 'items', 'variants')
      const rawOptions = copy.options ?? copy.choices ?? copy.items ?? copy.variants ?? copy.candidates;
      if (rawOptions !== undefined) {
        copy.options = normalizeOptions(rawOptions);
      }

      // If options is missing, attempt to extract numbered/bulleted options from question text
      if ((!copy.options || copy.options.length === 0) && copy.question) {
        const extracted = extractOptionsFromQuestion(copy.question);
        if (extracted.length >= 2) {
          copy.options = extracted;
        }
      }

      // Fallback default question if completely empty
      if (!copy.question) {
        copy.question = copy.options && copy.options.length > 0 ? "Select an option:" : "Please make a decision:";
      }

      return copy;
    },

    async execute(_toolCallId, params: AskQuestionParams, signal, _onUpdate, ctx) {
      const question = (params.question || "").trim() || "Please make a decision:";
      let options = normalizeOptions(params.options);

      // Mode 2: If fewer than 2 options provided, default to binary confirmation ["Yes", "No"]
      if (options.length < 2) {
        options = ["Yes", "No"];
      }

      // ----------------------------------------------------
      // 1. Headless Mode Fallback -> Unified Error
      // ----------------------------------------------------
      if (!ctx.hasUI || !ctx.ui) {
        return {
          content: [{ type: "text", text: "Error: No selection made." }],
          details: { cancelled: true, error: "No selection made", headless: true } as AskQuestionDetails
        };
      }

      const dialogOptions = { timeout: DEFAULT_TIMEOUT_MS };

      // ----------------------------------------------------
      // 2. Interactive TUI Selection via Arrow Keys
      // ----------------------------------------------------
      try {
        const selection = await withTimeoutAndSignal(
          ctx.ui.select(question, options, dialogOptions),
          DEFAULT_TIMEOUT_MS,
          signal
        );

        if (selection === undefined) {
          return {
            content: [{ type: "text", text: "Error: No selection made." }],
            details: { cancelled: true, error: "No selection made" } as AskQuestionDetails
          };
        }

        return {
          content: [{ type: "text", text: `User selected: "${selection}". Decision confirmed — proceed with implementation using this direction.` }],
          details: { answer: selection, cancelled: false } as AskQuestionDetails
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const isTimeout = errMsg.toLowerCase().includes("timed out");
        return {
          content: [{ type: "text", text: "Error: No selection made." }],
          details: { cancelled: true, error: "No selection made", timedOut: isTimeout } as AskQuestionDetails
        };
      }
    },

    /**
     * Renders a preview block in the TUI console during the tool-calling pre-execution step.
     */
    renderCall(args: any, theme, _context) {
      const qText = typeof args?.question === "string" ? args.question.trim() : "";
      const truncatedQ = qText.length > 70 ? `${qText.slice(0, 67)}...` : qText;
      const opts = Array.isArray(args?.options) ? args.options : Array.isArray(args?.choices) ? args.choices : [];

      let text = theme.fg("toolTitle", theme.bold("ask_question"));
      if (truncatedQ) {
        text += theme.fg("muted", ` "${truncatedQ}"`);
      }

      if (opts.length > 0) {
        const preview = opts.slice(0, 3).map((c: string, i: number) => `${i + 1}. ${c}`).join(" | ");
        const suffix = opts.length > 3 ? ` (+${opts.length - 3} more)` : "";
        text += theme.fg("dim", `\n  Options: [${preview}${suffix}]`);
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

      if (details.error) {
        return new Text(theme.fg("warning", `✗ ${details.error.toUpperCase()}`), 0, 0);
      }

      if (details.cancelled) {
        return new Text(theme.fg("muted", `⊘ NO SELECTION MADE`), 0, 0);
      }

      const answer = details.answer !== undefined ? String(details.answer) : "";
      return new Text(theme.fg("success", `✓ ANSWERED: `) + theme.fg("text", `"${answer}"`), 0, 0);
    }
  });
}