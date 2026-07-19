# Extension Loop Approach (Advanced Fallback)

Use this skill whenever the user requests a batch operation, repetitive edit, or sequential task across a file glob pattern. 

Do NOT attempt to process these files or invoke tools step-by-step within our active conversation history thread. Instead, act as a compiler: generate a temporary runtime loop extension, instruct the user to reload the agent environment, and have them execute the batch execution thread safely inside JavaScript.

## Execution Checklist (Follow Exactly)

1. **Compile Extension**: Write a custom-tailored TypeScript file straight to `.pi/extensions/<descriptive_name>.ts` (e.g., `tmp_batch_runner.ts`) relative to the workspace root directory. Replace the `{{USER_GLOB_PATTERN}}`, `{{USER_FILE_TASK}}`, `{{USER_COMMAND_NAME}}`, and optional `{{USER_SKILLS}}` template placeholders.
   - Use a slugified version of your chosen `<descriptive_name>` for `{{USER_COMMAND_NAME}}` (e.g., if the file is `fix_imports.ts`, the command name should be `fix-imports`).
   - Replace `{{USER_SKILLS}}` with either the skill name as a string (e.g., `"rewrite-wiki-article"`) if the task requires rules from a specific workspace skill file, or an **empty string `""`** if no skill is needed. Do NOT substitute the literal word `undefined` — that would be treated as a skill named "undefined". Note that this is optional and may add unnecessary overhead for simple tasks.
   - Do NOT save the file outside the `.pi/extensions/` directory.
   - **Glob Pattern Reference** — use these as a guide when constructing `{{USER_GLOB_PATTERN}}`:

     | Goal | Pattern |
     |---|---|
     | All Markdown files | `**/*.md` |
     | All PHP files | `**/*.php` |
     | Multiple extensions | `**/*.{ts,tsx}` |
     | All files in a directory | `src/**/*` |
     | Root-level files only (no recursion) | `*.md` |
     | Specific named files | `{src/foo.ts,lib/bar.ts,README.md}` |
     | All files matching a name pattern | `**/index.ts` |

     **Exclusions** — common directories (`.git`, `node_modules`, `dist`, `build`, `.pi`) are already excluded by the `ignore` array in the template. To exclude additional folders or files, append patterns to that array in the generated TypeScript. Do NOT use `!` negation in the glob string itself.

     ```typescript
     // Example: also exclude tests/, legacy/, and any *.bak files
     ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**", "**/.pi/**", "**/tests/**", "**/legacy/**", "**/*.bak"]
     ```


2. **Instruct the User to Reload**: You cannot reload the environment yourself. You MUST instruct the user to run the `/reload` command in the chat to force the Pi framework runtime to hot-reload, compile, and register the temporary module.
3. **Instruct the User to Test**: Instruct the user to run `/{{USER_COMMAND_NAME}} --dry-run` to test matching files.
4. **Instruct the User to Execute**: Instruct the user to run `/{{USER_COMMAND_NAME}}` to execute the batch operation.
5. **Clean Up**: After the batch run is verified complete, instruct the user to delete the temporary extension file from `.pi/extensions/` and run `/reload` again to deregister the command.

## Crafting Effective Task Prompts

The `{{USER_FILE_TASK}}` is injected into every subagent's prompt as a direct instruction. The quality of this string is the single biggest factor in batch run consistency. When generating it, follow these rules:

**Do:**
- **Be specific and action-oriented.** Describe exactly what to change, add, or remove. Prefer concrete outcomes over vague intentions.
- **Specify the expected post-edit state** so the subagent can self-verify: *"After editing, confirm no `console.log` calls remain in the file."*
- **For audit tasks, define the output format precisely.** The subagent's response feeds directly into the log and optionally into rolling notes. Tell it exactly what to output: *"List only the function names that lack error handling, one per line. If none, output: NONE."*
- **Scope the change tightly.** Each subagent handles one file. The task should describe a single, well-defined change — not a general refactor.
- **Enforce Raw File Reading (Anti-Lazy Guardrail):** Although the prompt template starts with `Open file '${file}'.`, smaller LLM models can get "lazy" and try to summarize findings without actually reading/opening the file. You MUST explicitly instruct the subagent in the task prompt to use its `read` or `view_file` tool to inspect the file.
- **Chunked Reading for Large Files:** To prevent context truncation or attention fatigue in smaller LLMs, instruct the subagent to read files larger than 500 lines in sequential chunks (e.g., lines 1-500, 501-1000) and scan each chunk systematically.
- **Require Evidentiary Checklists:** Force the subagent to output a brief verification checklist of items scanned (e.g. listing the specific vulnerability classes checked, such as SQLi, XSS, RCE) to prevent confirmation bias or lazy "looks good" responses.
- **Optimize Auditing Outputs (Flagged vs. Clean):** Direct the subagent to begin its output with exactly `CLEAN` or `NO_CHANGE` if no issues are found, or `FLAGGED` if issues are detected. This allows the compiler template to log clean files in a single line while generating detailed logs for flagged ones.

**Don't:**
- **Don't repeat the file-open frame.** The subagent prompt already begins with `Open file '${file}'.` — your task should jump straight to the action.
- **Don't use vague directives** like `"clean up"`, `"improve"`, or `"refactor"` without defining what that means in this context.
- **Don't ask for multiple unrelated changes** in one task. Split them into separate batch runs.

### Examples

#### 1. Mutation: Import Cleanup
* **Weak (❌):** `"Fix the imports"`
* **Strong (✅):**
  ```text
  1. Scan the file for any unused import statements.
  2. Remove only those unused imports. Do not alter any other lines of code.
  3. If no unused imports exist, output NO_CHANGE. Otherwise, output DONE followed by a brief description of what was removed.
  ```

#### 2. Mutation: Add Documentation
* **Weak (❌):** `"Add documentation"`
* **Strong (✅):**
  ```text
  1. Add a JSDoc comment block above every exported function. Do not modify any function signatures or bodies.
  2. If all exported functions already have JSDoc, output NO_CHANGE. Otherwise, output DONE.
  ```

#### 3. Audit: PHP Security Review
* **Weak (❌):** `"Check for PHP vulnerabilities"`
* **Strong (✅):**
  ```text
  Scan this PHP file for security issues.

  Checklist:
  - [ ] SQL Injection: Raw variables concatenated into database queries.
  - [ ] XSS: User input ($_GET/$_POST) echoed without htmlspecialchars escaping.
  - [ ] Webshells/Backdoors: Dynamic code execution (eval, assert) or command execution (exec, system, shell_exec, passthru) triggered by dynamic input, or obfuscated payloads (base64_decode, gzinflate, str_rot13).

  Output Instructions:
  If no vulnerabilities are found, output CLEAN.
  If issues are found, output FLAGGED followed by a markdown table of findings with columns: | Line | Vulnerability Type | Description |
  ```

#### 4. Audit: Secrets Scan
* **Weak (❌):** `"Review the file"`
* **Strong (✅):**
  ```text
  Identify any hardcoded credential strings (passwords, API keys, tokens) in the file.

  Checklist:
  - [ ] Hardcoded secret values assigned to configuration variables.
  - [ ] API keys or database passwords embedded in code strings.

  Output Instructions:
  If no credentials exist, output CLEAN.
  If found, output FLAGGED followed by the line number, key name, and type of credential.
  ```

## Code Generation Guidelines

When compiling a temporary extension, follow these guidelines to prevent common execution errors (especially critical for smaller 14B models):

1. **COPY THE TEMPLATE EXACTLY:** Do NOT attempt to refactor, optimize, or shorten the TypeScript template below. Your only job is to copy this code and replace the `{{USER_GLOB_PATTERN}}`, `{{USER_FILE_TASK}}`, `{{USER_COMMAND_NAME}}`, and (if a specific skill is needed) `{{USER_SKILLS}}` variables.
2. **Do Not Change Promise Structures:** Do not change how `Promise` wrappers or timeouts are structured in the template.
3. **Keep the IPC Cleanup Routine Intact:** When listening to `SLASH_SUBAGENT_STARTED_EVENT` and `SLASH_SUBAGENT_RESPONSE_EVENT`, you must unsubscribe inside the `cleanup()` callback. Removing the cleanup routine causes memory leaks and duplicate responses on subsequent iterations.
4. **Default Agent Role:** By default, use `AGENT_ROLE = "worker"` (this selects the single-mode agent to bypass mode validation errors). For read-only audits or investigatory tasks, change this to `"reader"` as described in the read-only section below.
5. **Never Use `ctx.tools.execute` or Wrapper Functions:** The subagent API must be accessed *strictly* through the `pi.events` bus with `requestId` and IPC constants. Never assume helper methods like `ctx.tools.execute("Agent", ...)` exist; doing so causes runtime crash failures.
6. **Enforce Sequential Execution (No parallel `Promise.all`):** Always run subagents sequentially in a standard loop using `await`. Do NOT use `Promise.all` or parallel blocks; running multiple subagents in parallel violates concurrency limits and crashes the event bus.
7. **Do Not Parse Subagent Outputs:** Do not attempt to use regex or string-matching to parse subagent outputs (e.g. `if (feedback === "CLEAN")`). LLMs format markdown dynamically and will wrap verdicts in bold text (`**Verdict:** PASS`), headers (`## Verdict: PASS`), or varying casing. The template is designed to append raw output directly into a markdown log—leave this logic intact.
8. **Escape User Input:** When injecting `{{USER_FILE_TASK}}` into the template string, you MUST escape any backticks (`) or string-breaking characters present in the user's prompt so that the resulting TypeScript file remains valid.
9. **File Paths Are Relative:** `fs.globSync` with `cwd: ctx.cwd` returns paths relative to the workspace root. The subagent worker shares the same working directory, so `Open file '${file}'` resolves correctly. Do not convert these to absolute paths.
10. **Default Error Handling Is Fail-and-Continue:** When a subagent fails (timeout, crash, or task error), the loop logs the failure and moves to the next file. This is correct for independent tasks (audit, per-file edits) but wrong for ordered/dependent tasks where file N+1 depends on file N succeeding. See the **Fail-Fast Mode** addendum below for a `break`-on-error variant.
11. **Abort Leaves Partial State:** If the user cancels mid-run (keyboard interrupt), the `signal.aborted` checkpoint stops spawning new subagents, but files already processed remain modified and the log is partial. There is no automatic rollback. For mutation tasks on version-controlled code, recommend the user commits or stashes before running.

## TypeScript Generation Template

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

// ==========================================
// BATCH RUN CONFIGURATION
// ==========================================
const COMMAND_NAME = "{{USER_COMMAND_NAME}}";
const GLOB_PATTERN = "{{USER_GLOB_PATTERN}}";
const FILE_TASK = `{{USER_FILE_TASK}}`;
const SKILLS = "{{USER_SKILLS}}";
const AGENT_ROLE = "worker"; // Default agent role. Change to "reader" (or a custom role) for read-only audits.

// Prompt generator function for the subagent (incorporating rules and target task)
const GET_PROMPT = (file: string) => `You MUST read the file '${file}' using your read tool. 

CRITICAL READ RULE: If the file is truncated, exceeds tool reading limits, or is too large to load in a single call, you MUST read it in sequential chunks (e.g., using line range arguments) to scan the entire file without missing any contents.

CRITICAL FINAL RESPONSE RULE: Begin your final concluding response (after all tool calls and edits are completed) with exactly one of: DONE (task completed successfully), CLEAN (no issues found/correct), FLAGGED (issues detected/vulnerabilities found), NO_CHANGE (file already correct or not applicable), or BLOCKED (unable to complete). Follow this with a highly compact, technical explanation of what was accomplished or found (either a short paragraph or a few brief bullet points). If there is nothing of note to report beyond the status, you may omit the explanation entirely. Avoid conversational filler or introductory prose.

CRITICAL AUTONOMOUS BLOCKED RULE: If you encounter an ambiguous requirement, corrupt file, or block, do NOT contact the supervisor or ask for clarification. Immediately return BLOCKED followed by a description of the issue.

##########
## TASK ##
##########

${FILE_TASK}
`;

// Subagent IPC Event Constants
const SLASH_SUBAGENT_REQUEST_EVENT = "subagent:slash:request";
const SLASH_SUBAGENT_STARTED_EVENT = "subagent:slash:started";
const SLASH_SUBAGENT_RESPONSE_EVENT = "subagent:slash:response";
const SLASH_SUBAGENT_CANCEL_EVENT = "subagent:slash:cancel";

export default function (pi: ExtensionAPI) {
    pi.registerCommand(COMMAND_NAME, {
        description: "Temporary automated file loop driven programmatically outside active chat cache",
        handler: async (args: any, ctx: any, signal?: AbortSignal) => {
            // Node v26.4.0 natively supports fs.globSync
            let files: string[] = [];
            try {
                files = fs.globSync(GLOB_PATTERN, { 
                    cwd: ctx.cwd,
                    // Exclude common build and git directories to prevent the subagent from auditing compiled binaries or history.
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

            const argList = typeof args === "string" ? args.split(/\s+/) : (Array.isArray(args) ? args : []);
            const isDryRun = argList.includes("--dry-run");
            if (isDryRun) {
                const displayFiles = files.slice(0, 50).map(f => `- ${f}`).join("\n");
                const overflow = files.length > 50 ? `\n...and ${files.length - 50} more files` : "";
                pi.sendUserMessage(`## 🔍 Dry Run Matched Files (${files.length} items)\n\n${displayFiles}${overflow}\n\nRun without \`--dry-run\` to execute.`, { deliverAs: "followUp" });
                return;
            }

            ctx.ui.notify(`Factory spawned. Processing ${files.length} files through sequential subagents...`, "info");
            
            const runId = randomUUID().slice(0, 8);
            const batchStartTime = Date.now();
            let processedCount = 0;
            let errorCount = 0;
            const logPath = path.resolve(ctx.cwd, `.pi/batch_log_${runId}.md`);
            
            const metadata = [
                `# Batch Run Log (${runId})`,
                `- **Date:** ${new Date().toISOString()}`,
                `- **Command:** \`/${COMMAND_NAME}\``,
                `- **Glob Pattern:** \`${GLOB_PATTERN}\``,
                `- **Total Files:** ${files.length}`,
                `\n### Task Description\n${FILE_TASK}`,
                `\n---\n\n## Summary of Audit Runs\n`
            ].join("\n");
            
            // Ensure the parent directory exists before writing the log file (handles fresh environments).
            const logDir = path.dirname(logPath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // Initialize the log file with header metadata before entering the loop to ensure it exists immediately.
            fs.writeFileSync(logPath, metadata, "utf-8");

            // The event bus cannot handle concurrent subagents. We must loop sequentially to prevent IPC cross-talk.
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Keyboard interrupt checkpoint
                if (signal?.aborted) break;
                
                let etaString = "calculating...";
                if (i > 0) {
                    // Estimate the remaining time based on the rolling average duration per file processed so far.
                    const elapsedMs = Date.now() - batchStartTime;
                    const msPerFile = elapsedMs / i;
                    const etaMs = msPerFile * (files.length - i);
                    const etaMins = Math.floor(etaMs / 60000);
                    const etaSecs = Math.floor((etaMs % 60000) / 1000);
                    etaString = etaMins > 0 ? `${etaMins}m ${etaSecs}s` : `${etaSecs}s`;
                }
                
                // Update the IDE status bar so the user has live progress feedback without cluttering the chat history.
                ctx.ui.setStatus("batch-loop", `Grinding [${i + 1}/${files.length}] (ETA: ${etaString}) | ${file}`);

                const subagentPrompt = GET_PROMPT(file);

                try {
                    // Promise wrapper for Cross-Extension IPC.
                    // Note: Subagent spawning requires the raw IPC event bus (pi.events). 
                    // Do not attempt to refactor to ctx.tools.execute, as it will fail across extension boundaries.
                    const result = await new Promise<any>((resolve, reject) => {
                        const requestId = randomUUID();
                        let done = false;
                        let unsubStarted = () => {};
                        let unsubResponse = () => {};

                        // Subagents may hang during initialization if the IDE is heavily loaded; this timeout forces a recovery.
                        const startTimeout = setTimeout(() => {
                            cleanup();
                            reject(new Error("Subagent execution timed out starting."));
                        }, 30000); // 30s — tune if subagents are slow to initialize

                        const executionTimeout = setTimeout(() => {
                            cleanup();
                            reject(new Error("Subagent execution timed out."));
                        }, 600000); // 10 minutes — tune based on expected task complexity

                        // The event bus is global. We must filter events by requestId to ensure 
                        // we only process responses meant for this specific loop iteration.
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

                        // We must explicitly unsubscribe from IPC events to prevent memory leaks 
                        // and prevent previous iterations from intercepting new responses.
                        const cleanup = () => {
                            done = true;
                            clearTimeout(startTimeout);
                            clearTimeout(executionTimeout);
                            unsubStarted();
                            unsubResponse();
                            abortCleanup?.();
                        };

                        // Fallbacks: ensure unsubscribe is always callable even if event registration returns undefined.
                        unsubStarted = pi.events.on(SLASH_SUBAGENT_STARTED_EVENT, onStarted) || (() => {});
                        unsubResponse = pi.events.on(SLASH_SUBAGENT_RESPONSE_EVENT, onResponse) || (() => {});
                        if (signal) {
                            if (signal.aborted) {
                                cleanup();
                                reject(new Error("Aborted"));
                                return;
                            }
                            const onAbort = () => {
                                pi.events.emit(SLASH_SUBAGENT_CANCEL_EVENT, { requestId });
                                cleanup();
                                reject(new Error("Aborted"));
                            };
                            signal.addEventListener("abort", onAbort, { once: true });
                            abortCleanup = () => signal.removeEventListener("abort", onAbort);
                        }

                        // Dispatch the payload to the Pi framework to wake up a new background subagent process.
                        pi.events.emit(SLASH_SUBAGENT_REQUEST_EVENT, {
                            requestId,
                            params: {
                                agent: AGENT_ROLE, // CRITICAL: DO NOT CHANGE. Target the configured agent constant.
                                task: subagentPrompt,
                                async: false,
                                context: "fresh",
                                clarify: false,
                                skill: SKILLS || undefined,
                            },
                            ctx,
                        });
                    });

                    // IPC responses can be raw strings or structured tool-call content arrays.
                    const feedback = typeof result === "string"
                        ? result.trim()
                        : (result?.content?.[0]?.text?.trim() || (result ? JSON.stringify(result) : "Success"));
                    
                    // Note: We deliberately avoid using string-matching (e.g. if (feedback === "CLEAN"))
                    // here because LLMs often wrap outputs in markdown. Appending the raw 
                    // output into the markdown log guarantees no findings are miscategorized.
                    fs.appendFileSync(logPath, `\n## ${file}\n${feedback}\n\n`, "utf-8");
                    processedCount++;
                    
                } catch (err: any) {
                    // If the loop was aborted by the user, break out immediately instead of recording a file failure.
                    if (signal?.aborted) break;
                    errorCount++;
                    fs.appendFileSync(logPath, `\n## ❌ ${file} FAILED\n${err.message || err}\n\n`, "utf-8");

                    // Alert the user in real-time if a specific subagent run fails or times out.
                    pi.sendUserMessage(`### ❌ Failed: \`${file}\`\n\n${err.message || err}`, { deliverAs: "followUp" });
                }
            }
            
            ctx.ui.setStatus("batch-loop", undefined);
            
            const totalSecs = ((Date.now() - batchStartTime) / 1000).toFixed(1);
            const logLink = `[batch_log_${runId}.md](${pathToFileURL(logPath).href})`;
            
            const statusEmoji = signal?.aborted ? "🛑" : "🏁";
            const statusText = signal?.aborted ? "Aborted" : "Complete";
            
            const logSummary = [
                `\n---\n`,
                `## Batch Run Summary`,
                `- **Status:** ${statusText} ${statusEmoji}`,
                `- **Processed Files:** ${processedCount}`,
                `- **Errors:** ${errorCount}`,
                `- **Time Taken:** ${totalSecs}s`
            ].join("\n");
            
            // Append the final execution summary to the log file so the report is self-contained.
            fs.appendFileSync(logPath, logSummary, "utf-8");
            
            // Notify the user of final completion or abort, rendering an execution summary and a direct markdown link to the log.
            pi.sendUserMessage(`## Batch Loop ${statusText} ${statusEmoji}\n\nProcessed **${processedCount}** files with **${errorCount}** errors in **${totalSecs}s**.\n\nFull execution trace: ${logLink}`, { deliverAs: "followUp" });
        }
    });
}
```

## Restricting Subagents to Read-Only

By default, the template spawns the `worker` agent, which is mutation-capable and possesses tools like `edit`, `write`, and `bash`. If the batch task is purely investigatory or auditing in nature, you can limit the subagent to read-only tools (such as `read`, `grep`, `find`, and `ls`) to guarantee no files are modified.

To accomplish this, create a custom agent definition file in the workspace at `.pi/agents/reader.md` (or `.agents/reader.md`):

```yaml
---
name: reader
description: Read-only codebase inspector
tools: read, grep, find, ls
thinking: low
systemPromptMode: replace
inheritProjectContext: true
---
You are a read-only subagent. Use the read-only tools (read, grep, find, ls) to examine files, search the codebase, and extract relevant information. Do not attempt to write or edit any files. If you encounter errors, corrupt files, or ambiguous contexts, immediately output "BLOCKED" and describe the issue rather than waiting for supervisor intervention.
```

After creating the file, update the configuration at the very top of the generated TypeScript code under `.pi/extensions/` to target this custom agent name:

```typescript
const AGENT_ROLE = "reader";
```

## Rolling Notes (Shared Context Across Iterations)

By default, each subagent receives no context about what previous subagents found or changed. For tasks where later files benefit from knowing what was discovered in earlier ones (e.g., accumulating a list of patterns, tracking a cross-file refactor, or building a report), you can opt into **rolling notes** — a short memory string that grows with each iteration and is injected into subsequent subagent prompts.

To add rolling notes, make the following additions to the generated TypeScript:

**1. Declare the variable before the loop:**
```typescript
let rollingNotes = "";
```

**2. Replace the `subagentPrompt` declaration inside the loop with this version:**
```typescript
const contextHeader = rollingNotes
    ? `\n\n### Shared Project Context (Lessons from previous files)\n${rollingNotes}`
    : "";

const subagentPrompt = GET_PROMPT(file) + contextHeader;
```

**3. Accumulate the feedback after each successful result:**
```typescript
rollingNotes += `\n* File ${file}: ${feedback}`;
```

> **Note:** Rolling notes increase prompt size with each iteration. For large file sets (50+), consider capping `rollingNotes` to the last N entries to avoid exceeding context limits.

## Adjusting Timeouts

The template includes two timeout values that may need tuning depending on task complexity:

| Timeout | Default | Controls |
|---|---|---|
| `startTimeout` | 30 seconds | How long to wait for the subagent process to initialize and emit its `started` event. Increase if your environment is slow to spawn processes. |
| `executionTimeout` | 10 minutes | Maximum wall-clock time for a single subagent to finish its task. Increase for heavy tasks (large-file refactors, lint+fix cycles). Decrease for trivial tasks to fail fast on stuck subagents. |

To change them, modify the millisecond values in the generated TypeScript:

```typescript
// Example: 60s start timeout, 20 minute execution timeout
}, 60000);  // startTimeout
}, 1200000); // executionTimeout
```

> **Tip:** For audit-only tasks with a read-only agent, 2–3 minutes (`120000`–`180000`) is typically sufficient. For mutation tasks that involve running tests or linters, 10–15 minutes is safer.

## Fail-Fast Mode

By default, the template uses a **fail-and-continue** strategy: when a subagent fails, the error is logged and the loop moves to the next file. This is appropriate for independent tasks where each file is self-contained.

For **ordered or dependent tasks** — where file N+1 depends on file N succeeding (e.g., a multi-step migration, a cross-file rename chain, or sequential config propagation) — you should switch to fail-fast by adding a `break` after the error handler:

```typescript
} catch (err: any) {
    // If the loop was aborted by the user, break out immediately instead of recording a file failure.
    if (signal?.aborted) break;
    errorCount++;
    fs.appendFileSync(logPath, `\n## ❌ ${file} FAILED\n${err.message || err}\n\n`, "utf-8");

    pi.sendUserMessage(`### ❌ Failed: \`${file}\`\n\n${err.message || err}\n\n⛔ Stopping batch run due to failure.`, { deliverAs: "followUp" });
    break; // FAIL-FAST: Stop processing remaining files
}
```

This stops the loop immediately, preserving the partial log and leaving unprocessed files untouched.

> **When to use which:**
> - **Fail-and-continue** (default) — audit tasks, per-file documentation, per-file lint fixes, any task where files are independent.
> - **Fail-fast** — ordered migrations, cross-file renames, tasks with shared state via rolling notes where gaps would corrupt the chain.

## Additional References

For details on subagent event structures, and IPC calls, refer to:
- **pi-subagents README:** [Local File](~/.pi/agent/npm/node_modules/pi-subagents/README.md) | [GitHub Web Page](https://github.com/nicobailon/pi-subagents/blob/main/README.md)
