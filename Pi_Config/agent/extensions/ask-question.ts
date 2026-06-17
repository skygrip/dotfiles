import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  wrapTextWithAnsi,
  Text,
} from "@earendil-works/pi-tui";

// ========================================================
// PARAMETERS & SCHEMA DEFINITIONS (Backward compatible)
// ========================================================

const SelectOptionSchema = Type.Object({
  label: Type.String({ description: "Display label for this option" }),
  description: Type.Optional(Type.String({ description: "Detailed description of what this option does" }))
});

const MultiQuestionSchema = Type.Object({
  id: Type.String({ description: "Unique identifier for this question" }),
  label: Type.Optional(Type.String({ description: "Short contextual label for tab bar, e.g. 'Scope', 'Priority'" })),
  prompt: Type.String({ description: "The full question text to display" }),
  type: StringEnum(["input", "confirm", "select"] as const, { description: "The interaction type for this tab" }),
  choices: Type.Optional(Type.Array(Type.Union([Type.String(), SelectOptionSchema]), {
    description: "The list of menu options to present. Required if type is 'select'."
  })),
  defaultValue: Type.Optional(Type.String({ description: "Default value if the tab is skipped or cancelled" }))
});

interface NormalizedOption {
  label: string;
  description?: string;
  value: string;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_question",
    label: "Ask Question",
    description: "Ask the user a clarifying question, request a choice from a menu, or ask for confirmation mid-execution without ending the current turn. Supports description selectors and multi-question tabbed forms.",
    promptSnippet: "Prompt the user for real-time clarifying input, menus, or yes/no confirmation.",
    promptGuidelines: [
      "Use ask_question ONLY when you hit a genuine branch, ambiguity, or critical design decision that requires immediate user steering to proceed.",
      "Use ask_question with type='select' and a list of 'choices' when presenting a distinct set of options.",
      "Use ask_question with type='confirm' for simple binary yes/no confirmation or safety checkpoints.",
      "Use ask_question with type='multi' and 'questions' if you need answers to multiple distinct clarifying points at once.",
      "Always provide a reasonable 'defaultValue' and a 'timeoutMs' (e.g., 15000 for 15s) so your execution doesn't hang indefinitely if the user is away."
    ],
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "The question, prompt, or menu title to present to the user (used for single questions)." })),
      type: StringEnum(["input", "confirm", "select", "multi"] as const, { 
        description: "The interaction mode: 'input' for freeform text, 'confirm' for Yes/No, 'select' to pick from a list, or 'multi' for a multi-question tabbed questionnaire." 
      }),
      choices: Type.Optional(Type.Array(Type.Union([Type.String(), SelectOptionSchema]), { 
        description: "The list of menu options to present (supports raw strings or objects with labels and descriptions). Required if type is 'select'." 
      })),
      questions: Type.Optional(Type.Array(MultiQuestionSchema, {
        description: "The list of multiple questions to present in a tabbed questionnaire. Required if type is 'multi'."
      })),
      timeoutMs: Type.Optional(Type.Integer({ 
        description: "Countdown timeout in milliseconds after which the dialog automatically dismisses." 
      })),
      defaultValue: Type.Optional(Type.String({ 
        description: "The default value returned if the user cancels or the dialog times out." 
      }))
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // ----------------------------------------------------
      // 1. Headless Fallback Mode
      // ----------------------------------------------------
      if (!ctx.hasUI || !ctx.ui) {
        if (params.type === "multi") {
          const answers: Record<string, string> = {};
          if (params.questions) {
            for (const q of params.questions) {
              answers[q.id] = q.defaultValue ?? "No response";
            }
          }
          return {
            content: [{ type: "text", text: `[Headless Mode Fallback]: Multi-question defaults applied.` }],
            details: { answers, error: "TUI Unavailable" }
          };
        }
        const fallback = params.defaultValue ?? "No response";
        return {
          content: [{ type: "text", text: `[Headless Mode Fallback]: ${fallback}` }],
          details: { answer: fallback, error: "TUI Unavailable" }
        };
      }

      const dialogOptions = params.timeoutMs ? { timeout: params.timeoutMs } : {};

      // ----------------------------------------------------
      // 2. Multi-Question Tabbed Questionnaire Mode
      // ----------------------------------------------------
      if (params.type === "multi") {
        const qs = params.questions || [];
        if (qs.length === 0) {
          throw new Error("Parameters error: 'questions' list is required when type is 'multi'.");
        }

        // Normalize Questions list
        const questions = qs.map((q, i) => ({
          id: q.id,
          label: q.label || `Q${i + 1}`,
          prompt: q.prompt,
          type: q.type,
          defaultValue: q.defaultValue || "",
          choices: (q.choices || []).map((c) => {
            if (typeof c === "string") return { label: c, value: c };
            return { label: c.label, description: c.description, value: c.label };
          })
        }));

        const totalTabs = questions.length + 1; // plus Submit tab

        const questionnaireResult = await ctx.ui.custom<{ answers: Record<string, string>; cancelled: boolean } | null>((tui, theme, _kb, done) => {
          let currentTab = 0;
          let optionIndex = 0;
          let cachedLines: string[] | undefined;
          
          const answers = new Map<string, string>();
          
          const editorTheme: EditorTheme = {
            borderColor: (s) => theme.fg("accent", s),
            selectList: {
              selectedPrefix: (t) => theme.fg("accent", t),
              selectedText: (t) => theme.fg("accent", t),
              description: (t) => theme.fg("muted", t),
              scrollInfo: (t) => theme.fg("dim", t),
              noMatch: (t) => theme.fg("warning", t),
            },
          };
          const editor = new Editor(editorTheme);

          function refresh() {
            cachedLines = undefined;
            tui.requestRender();
          }

          function currentQuestion() {
            return questions[currentTab];
          }

          function currentOptions() {
            const q = currentQuestion();
            if (!q) return [];
            if (q.type === "confirm") {
              return [
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" }
              ];
            }
            return q.choices;
          }

          function allAnswered() {
            return questions.every(q => answers.has(q.id));
          }

          function saveCurrentEditorState() {
            const q = currentQuestion();
            if (q && q.type === "input") {
              answers.set(q.id, editor.getText());
            }
          }

          function advanceAfterAnswer(ansValue: string) {
            const q = currentQuestion();
            if (q) {
              answers.set(q.id, ansValue);
            }
            if (currentTab < questions.length - 1) {
              currentTab++;
              optionIndex = 0;
              const nextQ = currentQuestion();
              if (nextQ && nextQ.type === "input") {
                editor.setText(answers.get(nextQ.id) || "");
              }
            } else {
              currentTab = questions.length;
            }
            refresh();
          }

          editor.onSubmit = (val) => {
            const q = currentQuestion();
            if (!q || q.type !== "input") return;
            const trimmed = val.trim() || q.defaultValue || "(no response)";
            advanceAfterAnswer(trimmed);
          };

          if (questions[0] && questions[0].type === "input") {
            editor.setText("");
          }

          function handleInput(data: string) {
            const q = currentQuestion();

            // 1. Tab & Arrow horizontal navigation (Always active, even in input mode)
            if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
              saveCurrentEditorState();
              currentTab = (currentTab + 1) % totalTabs;
              optionIndex = 0;
              const nextQ = currentQuestion();
              if (nextQ && nextQ.type === "input") {
                editor.setText(answers.get(nextQ.id) || "");
              }
              refresh();
              return;
            }
            if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
              saveCurrentEditorState();
              currentTab = (currentTab - 1 + totalTabs) % totalTabs;
              optionIndex = 0;
              const nextQ = currentQuestion();
              if (nextQ && nextQ.type === "input") {
                editor.setText(answers.get(nextQ.id) || "");
              }
              refresh();
              return;
            }

            // 2. Submit Tab handler
            if (currentTab === questions.length) {
              if (matchesKey(data, Key.enter) && allAnswered()) {
                const resObj: Record<string, string> = {};
                answers.forEach((v, k) => { resObj[k] = v; });
                done({ answers: resObj, cancelled: false });
              } else if (matchesKey(data, Key.escape)) {
                done(null);
              }
              return;
            }

            // 3. Input Mode key trapping (excluding navigation)
            const isInputMode = q && q.type === "input" && currentTab < questions.length;
            if (isInputMode) {
              if (matchesKey(data, Key.escape)) {
                done(null);
                return;
              }
              editor.handleInput(data);
              refresh();
              return;
            }

            // 4. List options navigate (for select/confirm tabs)
            const opts = currentOptions();
            if (matchesKey(data, Key.up)) {
              optionIndex = Math.max(0, optionIndex - 1);
              refresh();
              return;
            }
            if (matchesKey(data, Key.down)) {
              optionIndex = Math.min(opts.length - 1, optionIndex + 1);
              refresh();
              return;
            }

            if (matchesKey(data, Key.enter) && q) {
              if (opts.length > 0) {
                const sel = opts[optionIndex];
                advanceAfterAnswer(sel.value);
              }
              return;
            }

            if (matchesKey(data, Key.escape)) {
              done(null);
            }
          }

          function render(width: number): string[] {
            if (cachedLines) return cachedLines;
            const lines: string[] = [];
            const renderWidth = Math.max(1, width);
            const q = currentQuestion();
            const opts = currentOptions();

            lines.push(theme.fg("accent", "─".repeat(renderWidth)));

            const tabs: string[] = [" "];
            for (let i = 0; i < questions.length; i++) {
              const isActive = i === currentTab;
              const isAnswered = answers.has(questions[i].id);
              const box = isAnswered ? "■" : "□";
              const color = isAnswered ? "success" : "muted";
              const tabText = ` ${box} ${questions[i].label} `;
              const styled = isActive ? theme.bg("selectedBg", theme.fg("text", tabText)) : theme.fg(color, tabText);
              tabs.push(`${styled} `);
            }
            const canSubmit = allAnswered();
            const isSubmitTab = currentTab === questions.length;
            const submitText = " ✓ Submit ";
            const submitStyled = isSubmitTab
              ? theme.bg("selectedBg", theme.fg("text", submitText))
              : theme.fg(canSubmit ? "success" : "dim", submitText);
            tabs.push(`${submitStyled}`);
            lines.push(tabs.join(""));
            lines.push("");

            if (currentTab === questions.length) {
              lines.push(` ${theme.fg("accent", theme.bold("Ready to Submit Questionnaire"))}`);
              lines.push("");
              for (const question of questions) {
                const ans = answers.get(question.id) || theme.fg("warning", "(unanswered)");
                lines.push(`  ${theme.fg("muted", `${question.label}: `)}${theme.fg("text", ans)}`);
              }
              lines.push("");
              if (canSubmit) {
                lines.push(` ${theme.fg("success", "Press Enter to submit and return to agent")}`);
              } else {
                const missing = questions.filter(qu => !answers.has(qu.id)).map(qu => qu.label).join(", ");
                lines.push(` ${theme.fg("warning", `Please answer missing tabs: ${missing}`)}`);
              }
            } else if (q) {
              const promptLines = wrapTextWithAnsi(q.prompt, renderWidth - 2);
              for (const pl of promptLines) {
                lines.push(` ${theme.fg("text", pl)}`);
              }
              lines.push("");

              if (q.type === "input") {
                lines.push(`  ${theme.fg("muted", "Your answer:")}`);
                const editorLines = editor.render(Math.max(1, renderWidth - 4));
                for (const el of editorLines) {
                  lines.push(`  ${el}`);
                }
                lines.push("");
                lines.push(`  ${theme.fg("dim", "Enter to save answer and go to next tab")}`);
              } else {
                for (let i = 0; i < opts.length; i++) {
                  const opt = opts[i];
                  const selected = i === optionIndex;
                  const prefix = selected ? theme.fg("accent", "> ") : "  ";
                  const label = `${i + 1}. ${opt.label}`;
                  const color = selected ? "accent" : "text";

                  lines.push(`${prefix}${theme.fg(color, label)}`);
                  if (opt.description) {
                    const descLines = wrapTextWithAnsi(opt.description, renderWidth - 6);
                    for (const dl of descLines) {
                      lines.push(`     ${theme.fg("muted", dl)}`);
                    }
                  }
                }
              }
            }

            lines.push("");
            const helpStr = q && q.type === "input" && currentTab < questions.length
              ? "Tab/Shift+Tab navigate tabs • Esc cancel"
              : "Tab/Shift+Tab navigate tabs • ↑↓ select • Enter select • Esc cancel";
            lines.push(` ${theme.fg("dim", helpStr)}`);
            lines.push(theme.fg("accent", "─".repeat(renderWidth)));

            cachedLines = lines;
            return lines;
          }

          return { render, invalidate: () => { cachedLines = undefined; }, handleInput };
        });

        if (!questionnaireResult) {
          const fallbackAnswers: Record<string, string> = {};
          for (const q of questions) {
            fallbackAnswers[q.id] = q.defaultValue;
          }
          return {
            content: [{ type: "text", text: "User cancelled the questionnaire. Using defaults." }],
            details: { answers: fallbackAnswers, cancelled: true }
          };
        }

        const summaryText = Object.entries(questionnaireResult.answers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");

        return {
          content: [{ type: "text", text: `Questionnaire answers:\n${summaryText}` }],
          details: { answers: questionnaireResult.answers, cancelled: false }
        };
      }

      // ----------------------------------------------------
      // 3. Selection Option with Description Mode (Rich Select UI)
      // ----------------------------------------------------
      const rawChoices = params.choices || [];
      const hasDescriptions = rawChoices.some(c => typeof c === "object" && c !== null && "description" in c);

      if (params.type === "select" && hasDescriptions) {
        const normalizedChoices: NormalizedOption[] = rawChoices.map((c) => {
          if (typeof c === "string") return { label: c, value: c };
          return { label: c.label, description: c.description, value: c.label };
        });

        const dialogResult = await ctx.ui.custom<{ answer: string; index: number } | null>((tui, theme, _kb, done) => {
          let optionIndex = 0;
          let cachedLines: string[] | undefined;

          function refresh() {
            cachedLines = undefined;
            tui.requestRender();
          }

          function handleInput(data: string) {
            if (matchesKey(data, Key.up)) {
              optionIndex = Math.max(0, optionIndex - 1);
              refresh();
              return;
            }
            if (matchesKey(data, Key.down)) {
              optionIndex = Math.min(normalizedChoices.length - 1, optionIndex + 1);
              refresh();
              return;
            }
            if (matchesKey(data, Key.enter)) {
              const sel = normalizedChoices[optionIndex];
              done({ answer: sel.value, index: optionIndex + 1 });
              return;
            }
            if (matchesKey(data, Key.escape)) {
              done(null);
            }
          }

          function render(width: number): string[] {
            if (cachedLines) return cachedLines;
            const lines: string[] = [];
            const renderWidth = Math.max(1, width);

            lines.push(theme.fg("accent", "─".repeat(renderWidth)));
            
            const promptLines = wrapTextWithAnsi(params.question || "Select an option:", renderWidth - 2);
            for (const pl of promptLines) lines.push(` ${theme.fg("text", pl)}`);
            lines.push("");

            for (let i = 0; i < normalizedChoices.length; i++) {
              const opt = normalizedChoices[i];
              const selected = i === optionIndex;
              const prefix = selected ? theme.fg("accent", "> ") : "  ";
              const label = `${i + 1}. ${opt.label}`;
              const color = selected ? "accent" : "text";

              lines.push(`${prefix}${theme.fg(color, label)}`);
              if (opt.description) {
                const descLines = wrapTextWithAnsi(opt.description, renderWidth - 6);
                for (const dl of descLines) {
                  lines.push(`     ${theme.fg("muted", dl)}`);
                }
              }
            }

            lines.push("");
            lines.push(` ${theme.fg("dim", "↑↓ navigate • Enter to select • Esc to cancel")}`);
            lines.push(theme.fg("accent", "─".repeat(renderWidth)));

            cachedLines = lines;
            return lines;
          }

          return { render, invalidate: () => { cachedLines = undefined; }, handleInput };
        });

        if (!dialogResult) {
          const fallback = params.defaultValue ?? "";
          return {
            content: [{ type: "text", text: `User cancelled. Falling back to default: "${fallback}"` }],
            details: { answer: fallback, cancelled: true }
          };
        }
        return {
          content: [{ type: "text", text: `User selected: ${dialogResult.index}. ${dialogResult.answer}` }],
          details: { answer: dialogResult.answer, index: dialogResult.index, cancelled: false }
        };
      }

      try {
        if (params.type === "confirm") {
          const confirmed = await ctx.ui.confirm("Confirmation Gate", params.question || "Proceed?", dialogOptions);
          return {
            content: [{ type: "text", text: `User selected: ${confirmed ? "Yes" : "No"}` }],
            details: { answer: confirmed ? "Yes" : "No", cancelled: false }
          };
        }

        if (params.type === "select") {
          const simpleChoices = rawChoices.map(c => typeof c === "string" ? c : c.label);
          if (simpleChoices.length === 0) {
            throw new Error("Parameters error: 'choices' is required when type is 'select'.");
          }
          const selection = await ctx.ui.select(params.question || "Choose:", simpleChoices, dialogOptions);
          const finalValue = selection ?? params.defaultValue ?? simpleChoices[0];
          return {
            content: [{ type: "text", text: `User selected: "${finalValue}"` }],
            details: { answer: finalValue, cancelled: selection === undefined }
          };
        }

        const response = await ctx.ui.input(params.question || "Enter value:", "", dialogOptions);
        const finalResponse = response ?? params.defaultValue ?? "";
        return {
          content: [{ type: "text", text: `User response: "${finalResponse}"` }],
          details: { answer: finalResponse, cancelled: response === undefined }
        };

      } catch (error) {
        const fallback = params.defaultValue ?? "";
        return {
          content: [{ type: "text", text: `[User Prompt Cancelled / Error]: ${error instanceof Error ? error.message : String(error)}. Returning fallback: "${fallback}"` }],
          details: { answer: fallback, error: error instanceof Error ? error.message : String(error), cancelled: true }
        };
      }
    },

    renderCall(args, theme, _context) {
      const type = typeof args.type === "string" ? args.type : "input";
      const qText = typeof args.question === "string" ? args.question.trim() : "";
      const truncatedQ = qText.length > 60 ? `${qText.slice(0, 57)}...` : qText;
      
      let text = theme.fg("toolTitle", theme.bold("ask_question")) + 
                 theme.fg("dim", ` (mode: ❓ ${type})`);
      
      if (type === "multi" && Array.isArray(args.questions)) {
        text += theme.fg("muted", `\n  📝 Interactive Questionnaire with ${args.questions.length} questions`);
      } else if (truncatedQ) {
        text += theme.fg("muted", `\n  "${truncatedQ}"`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as any;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg("warning", `✗ ERROR: ${details.error}`), 0, 0);
      }

      if (details.cancelled) {
        return new Text(theme.fg("muted", "✓ CANCELLED (Using fallback defaults)"), 0, 0);
      }

      // If it's a questionnaire, render the key-value answers
      if (details.answers) {
        const lines = Object.entries(details.answers).map(([key, val]) => {
          return `  ${theme.fg("muted", `${key}: `)}${theme.fg("text", String(val))}`;
        }).join("\n");

        const header = theme.fg("success", theme.bold("✓ QUESTIONNAIRE COMPLETED\n")) +
                       theme.fg("dim", "  " + "─".repeat(40) + "\n");
        const footer = theme.fg("dim", "\n  " + "─".repeat(40));
        return new Text(header + lines + footer, 0, 0);
      }

      // Otherwise, render a single answer
      const answer = details.answer !== undefined ? String(details.answer) : "";
      return new Text(theme.fg("success", `✓ ANSWERED: `) + theme.fg("text", `"${answer}"`), 0, 0);
    }
  });
}