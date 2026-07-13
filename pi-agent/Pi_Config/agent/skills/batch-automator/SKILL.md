---
name: batch-automator
description: Compiles and executes dynamic temporary Javascript loops over file glob patterns.
---

# Skill: Batch Automator

Use this skill whenever the user requests a batch operation, repetitive edit, or sequential task across a file glob pattern. 

Do NOT attempt to process these files or invoke tools step-by-step within our active conversation history thread. Instead, act as a compiler: generate a temporary runtime loop extension, instruct the user to reload the agent environment, and have them execute the batch execution thread safely inside JavaScript.

## Execution Checklist (Follow Exactly)

1. **Compile Extension**: Write a custom-tailored TypeScript file straight to `.pi/extensions/<descriptive_name>.ts` (e.g., `tmp_batch_runner.ts`) relative to the workspace root directory. Replace the `{{USER_GLOB_PATTERN}}`, `{{USER_FILE_TASK}}`, `{{USER_COMMAND_NAME}}`, and optional `{{USER_SKILLS}}` template placeholders.
   - Use a slugified version of your chosen `<descriptive_name>` for `{{USER_COMMAND_NAME}}` (e.g., if the file is `fix_imports.ts`, the command name should be `fix-imports`).
   - Replace `{{USER_SKILLS}}` with either the skill name as a string (e.g., `"rewrite-wiki-article"`) if the task requires rules from a specific workspace skill file, or `undefined` (or a blank string `""`) if no skill is needed. Note that this is optional and may add unnecessary overhead for simple tasks.
   - Do NOT save the file outside the `.pi/extensions/` directory.
2. **Instruct the User to Reload**: You cannot reload the environment yourself. You MUST instruct the user to run the `/reload` command in the chat to force the Pi framework runtime to hot-reload, compile, and register the temporary module.
3. **Instruct the User to Test**: Instruct the user to run `/{{USER_COMMAND_NAME}} --dry-run` to test matching files.
4. **Instruct the User to Execute**: Instruct the user to run `/{{USER_COMMAND_NAME}}` to execute the batch operation.

## Code Generation Guidelines

When compiling a temporary extension, follow these guidelines to prevent common execution errors (especially critical for smaller 14B models):

1. **COPY THE TEMPLATE EXACTLY:** Do NOT attempt to refactor, optimize, or shorten the TypeScript template below. Your only job is to copy this code and replace the `{{USER_GLOB_PATTERN}}`, `{{USER_FILE_TASK}}`, `{{USER_COMMAND_NAME}}`, and (if a specific skill is needed) `{{USER_SKILLS}}` variables.
2. **Do Not Change Promise Structures:** Do not change how `Promise` wrappers or timeouts are structured in the template.
3. **Keep the IPC Cleanup Routine Intact:** When listening to `SLASH_SUBAGENT_STARTED_EVENT` and `SLASH_SUBAGENT_RESPONSE_EVENT`, you must unsubscribe inside the `cleanup()` callback. Removing the cleanup routine causes memory leaks and duplicate responses on subsequent iterations.
4. **Do Not Change Agent Modes:** Do NOT change `agent: "worker"` (this selects the single-mode agent to bypass mode validation errors).
5. **Never Use `ctx.tools.execute` or Wrapper Functions:** The subagent API must be accessed *strictly* through the `pi.events` bus with `requestId` and IPC constants. Never assume helper methods like `ctx.tools.execute("Agent", ...)` exist; doing so causes runtime crash failures.
6. **Enforce Sequential Execution (No parallel `Promise.all`):** Always run subagents sequentially in a standard loop using `await`. Do NOT use `Promise.all` or parallel blocks; running multiple subagents in parallel violates concurrency limits and crashes the event bus.
7. **Avoid Strict Regex Summaries:** If your generated code parses subagent output text to compile counts or statistics (such as counting PASS vs. NEEDS_REVIEW verdicts), do NOT use strict regex literals like `/Verdict:\s*PASS/g`. Subagents format markdown dynamically and will wrap verdicts in bold text (`**Verdict:** PASS`), headers (`## Verdict: PASS`), or varying casing.
   - Always use formatting-insensitive regex patterns, such as `/[*#]*\s*Verdict:\s*[*#]*\s*PASS/gi`.
   - Explicitly guide the subagent inside the prompt template to follow a normalized structure, but still employ formatting-insensitive regexes as a fallback.
8. **Escape User Input:** When injecting `{{USER_FILE_TASK}}` into the template string, you MUST escape any backticks (`) or string-breaking characters present in the user's prompt so that the resulting TypeScript file remains valid.

## TypeScript Generation Template

```typescript
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import { randomUUID } from "node:crypto";

// Subagent IPC Event Constants
const SLASH_SUBAGENT_REQUEST_EVENT = "subagent:slash:request";
const SLASH_SUBAGENT_STARTED_EVENT = "subagent:slash:started";
const SLASH_SUBAGENT_RESPONSE_EVENT = "subagent:slash:response";
const SLASH_SUBAGENT_CANCEL_EVENT = "subagent:slash:cancel";

export default function (pi: ExtensionAPI) {
    pi.registerCommand("{{USER_COMMAND_NAME}}", {
        description: "Temporary automated file loop driven programmatically outside active chat cache",
        handler: async (args: string, ctx: ExtensionContext, signal?: AbortSignal) => {
            // Node v26.4.0 natively supports fs.globSync
            let files: string[] = [];
            try {
                files = fs.globSync("{{USER_GLOB_PATTERN}}", { 
                    cwd: ctx.cwd,
                    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**", "**/.pi/**"]
                });
            } catch (err: any) {
                ctx.ui.notify(`Glob evaluation failed: ${err.message}`, "error");
                return;
            }

            if (files.length === 0) {
                ctx.ui.notify("No files matched the targeted glob pattern.", "warning");
                return;
            }

            const isDryRun = args.includes("--dry-run");
            if (isDryRun) {
                const filesList = files.map(f => `- ${f}`).join("\\n");
                pi.sendUserMessage(`## 🔍 Dry Run Matched Files (${files.length} items)\\n\\n${filesList}\\n\\nRun without \\\`--dry-run\\\` to execute.`, { deliverAs: "followUp" });
                return;
            }

            ctx.ui.notify(`Factory spawned. Processing ${files.length} files through sequential subagents...`, "info");
            
            let rollingNotes = "";
            const logPath = ".pi/extensions/tmp_run_log.md";
            
            fs.writeFileSync(logPath, "# Batch Run Log\\n\\n", "utf-8");

            // CRITICAL: Always run sequentially. Do NOT use Promise.all or run in parallel; doing so crashes the subagent event bus.
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Keyboard interrupt checkpoint
                if (signal?.aborted) break;
                
                ctx.ui.setStatus("batch-loop", `Grinding [${i + 1}/${files.length}]: ${file}`);

                const contextHeader = rollingNotes 
                    ? `\\n\\n### Shared Project Context (Lessons from previous files)\\n${rollingNotes}`
                    : "";

                const subagentPrompt = `Open file '${file}'. Execute this target adjustment: {{USER_FILE_TASK}}. 

INTERACTIVE DECISION RULE: If you encounter an ambiguous requirement, get blocked, or need a product decision, do NOT make assumptions. Instead, contact your supervisor directly using the contact_supervisor tool (with reason: "need_decision") to ask for clarification.

CRITICAL OUTPUT RULE: When finished executing the task and verifying, you must output a single-sentence, highly compact technical summary of what was accomplished (or found). Do not write introductory prose or elaborate conversational notes. Your response will be fed directly into the system memory bank for the next file iteration.${contextHeader}`;

                try {
                    // Promise wrapper for Cross-Extension IPC. CRITICAL: Do NOT use ctx.tools.execute here.
                    const result = await new Promise<any>((resolve, reject) => {
                        const requestId = randomUUID();
                        let done = false;

                        const startTimeout = setTimeout(() => {
                            cleanup();
                            reject(new Error("Subagent execution timed out starting."));
                        }, 30000);

                        const executionTimeout = setTimeout(() => {
                            cleanup();
                            reject(new Error("Subagent execution timed out."));
                        }, 600000); // 10 minutes limit

                        const onStarted = (data: any) => {
                            if (done || data?.requestId !== requestId) return;
                            clearTimeout(startTimeout);
                        };

                        const onResponse = (data: any) => {
                            if (done || data?.requestId !== requestId) return;
                            cleanup();
                            if (data.isError) reject(new Error(data.errorText || "Execution failed"));
                            else resolve(data.result);
                        };

                        let abortCleanup: (() => void) | undefined;

                        // CRITICAL: DO NOT REMOVE. Unsubscribing prevents memory leaks and duplicated responses on subsequent iterations.
                        const cleanup = () => {
                            done = true;
                            clearTimeout(startTimeout);
                            clearTimeout(executionTimeout);
                            unsubStarted();
                            unsubResponse();
                            abortCleanup?.();
                        };

                        const unsubStarted = pi.events.on(SLASH_SUBAGENT_STARTED_EVENT, onStarted) || (() => {});
                        const unsubResponse = pi.events.on(SLASH_SUBAGENT_RESPONSE_EVENT, onResponse) || (() => {});
                        if (signal) {
                            const onAbort = () => {
                                pi.events.emit(SLASH_SUBAGENT_CANCEL_EVENT, { requestId });
                                cleanup();
                                reject(new Error("Aborted"));
                            };
                            signal.addEventListener("abort", onAbort, { once: true });
                            abortCleanup = () => signal.removeEventListener("abort", onAbort);
                        }

                        pi.events.emit(SLASH_SUBAGENT_REQUEST_EVENT, {
                            requestId,
                            params: {
                                agent: "worker", // CRITICAL: DO NOT CHANGE. Selects the single-mode agent to bypass mode validation errors.
                                task: subagentPrompt,
                                async: false,
                                context: "fresh",
                                clarify: false,
                                skill: "{{USER_SKILLS}}" || undefined, // Optional: Bind a specific skill (e.g., "rewrite-wiki-article") or leave empty for default agent skills
                            },
                            ctx,
                        });
                    });

                    const feedback = result?.content?.[0]?.text?.trim() || "Success";
                    
                    rollingNotes += `\\n* File ${file}: ${feedback}`;
                    fs.appendFileSync(logPath, `## ✅ ${file}\\n${feedback}\\n\\n`, "utf-8");

                    pi.sendUserMessage(`### ✅ Processed: \`${file}\`\\n\\n${feedback}`, { deliverAs: "followUp" });
                    
                } catch (err: any) {
                    fs.appendFileSync(logPath, `## ❌ ${file} FAILED\\n${err.message || err}\\n\\n`, "utf-8");

                    pi.sendUserMessage(`### ❌ Failed: \`${file}\`\\n\\n${err.message || err}`, { deliverAs: "followUp" });
                }
            }
            
            ctx.ui.setStatus("batch-loop", undefined);
            
            pi.sendUserMessage(`## Batch Loop Structural Run Complete

Full execution trace logs: \\\`${logPath}\\\``, { deliverAs: "followUp" });
        }
    });
}
```
 
## Additional References

For details on subagent event structures, and IPC calls, refer to:
- **pi-subagents README:** [Local File](~/.pi/agent/npm/node_modules/pi-subagents/README.md) | [GitHub Web Page](https://github.com/nicobailon/pi-subagents/blob/main/README.md)
