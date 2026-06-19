import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let isWorkflowEnforced = true;

  // Register command to enable/disable or check status
  pi.registerCommand("workflow_enforce", {
    description: "Toggle strict workflow enforcement. Usage: /workflow_enforce [on|off]",
    handler: async (args: any, ctx: any) => {
      const isString = typeof args === "string";
      const hasOn = isString ? args.trim().toLowerCase() === "on" : Array.isArray(args) && args.includes("on");
      const hasOff = isString ? args.trim().toLowerCase() === "off" : Array.isArray(args) && args.includes("off");

      if (hasOn) {
        isWorkflowEnforced = true;
        ctx?.ui?.notify?.("Strict workflow enforcement is now ENABLED", "info");
      } else if (hasOff) {
        isWorkflowEnforced = false;
        ctx?.ui?.notify?.("⚠️ Strict workflow enforcement is now DISABLED", "warning");
      } else {
        isWorkflowEnforced = !isWorkflowEnforced;
        const status = isWorkflowEnforced ? "ENABLED" : "DISABLED";
        const type = isWorkflowEnforced ? "info" : "warning";
        ctx?.ui?.notify?.(`Strict workflow enforcement is now ${status}`, type);
      }
    }
  });

  /**
   * Scans the session history to verify if the assistant has interacted with a plan file
   * (e.g. PLAN.md or implementation_plan.md) during this session.
   * 
   * Interaction counts if the assistant used file-handling tools (view, write, etc.) on
   * a plan file, or ran command-line tools (bash, run_command) that explicitly target plan.md.
   * 
   * @param entries - The historical session entries of the agent.
   * @returns true if the plan has been read or written, false otherwise.
   */
  function hasInteractedWithPlan(entries: any[]): boolean {
    for (const entry of entries) {
      if (entry.type === "message" && entry.message?.role === "assistant") {
        const parts = Array.isArray(entry.message.content) ? entry.message.content : [];
        for (const part of parts) {
          if (part.type === "toolCall" || part.type === "functionCall") {
            const name = part.name || "";
            const args = part.arguments;

            const isWriteOrRead = /write|edit|replace|patch|create|update|read|view/i.test(name);
            const isBash = name.toLowerCase() === "bash" || name.toLowerCase() === "run_command";

            if (isWriteOrRead || isBash) {
              let targetFile = "";
              if (args) {
                try {
                  const parsed = typeof args === "string" ? JSON.parse(args) : args;
                  if (parsed) {
                    if (isWriteOrRead) {
                      targetFile = parsed.TargetFile || parsed.AbsolutePath || parsed.path || parsed.file || parsed.filename || "";
                    } else if (isBash) {
                      const cmd = (parsed.command || parsed.CommandLine || "").toLowerCase();
                      if (cmd.includes("plan.md")) {
                        return true;
                      }
                    }
                  }
                } catch {
                  // Ignore parsing failures
                }
              }
              if (typeof targetFile === "string" && targetFile.toLowerCase().endsWith("plan.md")) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Enforces the Interleaved Thinking rule to prevent consecutive modifying actions 
   * (write tools or command line execution) without intermediate planning or analysis.
   * 
   * Exclusions:
   * - Command line steps targeting plan, task, or todo files are treated as thinking steps.
   * - Writes to plan.md, task.md, or todo.md files are counted as thinking/planning.
   * - Consecutive bash/run_command steps are allowed (to support building/compiling chains).
   * 
   * @param entries - The historical session entries of the agent.
   * @param currentTool - The name of the tool currently being requested.
   * @returns an object indicating validity and the block reason if invalid.
   */
  function checkInterleavedThinking(entries: any[], currentTool: string): { valid: boolean; reason?: string } {
    const currentIsWrite = /write|edit|replace|patch|create|update/i.test(currentTool);
    const currentIsBash = currentTool.toLowerCase() === "bash" || currentTool.toLowerCase() === "run_command";

    if (!currentIsWrite && !currentIsBash) return { valid: true };

    let lastAction = "";
    let foundThinking = false;

    // Find the last assistant entry and count how many tool responses follow it.
    // This allows us to track the current index in a parallel tool call sequence.
    let lastAssistantEntryIdx = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "message" && entry.message?.role === "assistant") {
        lastAssistantEntryIdx = i;
        break;
      }
    }

    let executedToolCallsCount = 0;
    if (lastAssistantEntryIdx !== -1) {
      for (let i = lastAssistantEntryIdx + 1; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.type === "message" && (
          entry.message?.role === "tool" || 
          entry.message?.role === "toolResult"
        )) {
          executedToolCallsCount++;
        }
      }
    }

    // Scan backward to find the previous action and any thinking steps in between
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "message" && entry.message?.role === "assistant") {
        const parts = Array.isArray(entry.message.content) ? entry.message.content : [];
        
        // Extract all tool calls in this assistant message
        const toolCallParts: any[] = [];
        for (const part of parts) {
          if (part.type === "toolCall" || part.type === "functionCall") {
            toolCallParts.push(part);
          }
        }

        // Determine starting index of tool calls to scan in this message.
        // We only scan tool calls that have executed prior to the current tool call.
        let startIndex = toolCallParts.length - 1;
        if (i === lastAssistantEntryIdx) {
          startIndex = executedToolCallsCount - 1;
        }

        for (let j = startIndex; j >= 0; j--) {
          const part = toolCallParts[j];
          const name = part.name || "";
          if (name === "sequential_thinking") {
            foundThinking = true;
          } else if (/write|edit|replace|patch|create|update|bash|run_command/i.test(name)) {
            let isPlanMd = false;
            const isBashCmd = name.toLowerCase() === "bash" || name.toLowerCase() === "run_command";
            
            if (part.arguments) {
              try {
                const parsed = typeof part.arguments === "string" ? JSON.parse(part.arguments) : part.arguments;
                if (parsed) {
                  const targetFile = parsed.TargetFile || parsed.AbsolutePath || parsed.path || parsed.file || parsed.filename || "";
                  if (typeof targetFile === "string") {
                    const lower = targetFile.toLowerCase();
                    if (lower.endsWith("plan.md") || lower.endsWith("task.md") || lower.endsWith("todo.md")) {
                      isPlanMd = true;
                    }
                  }
                  if (isBashCmd) {
                    const cmd = (parsed.command || parsed.CommandLine || "").toLowerCase();
                    if (cmd.includes("plan.md") || cmd.includes("task.md") || cmd.includes("todo.md")) {
                      isPlanMd = true;
                    }
                  }
                }
              } catch {}
            }

            if (isPlanMd) {
              foundThinking = true; // Updating a plan/task/todo file acts as an interstitial thinking step
            } else {
              lastAction = name.toLowerCase();
              break;
            }
          }
        }
        if (lastAction) break;
      }
    }

    if (lastAction && !foundThinking) {
      const lastIsWrite = /write|edit|replace|patch|create|update/i.test(lastAction);
      const lastIsBash = lastAction === "bash" || lastAction === "run_command";

      // Block transitions: Write->Write, Write->Bash, Bash->Write (allow consecutive Bash->Bash)
      if ((lastIsWrite && currentIsWrite) || (lastIsWrite && currentIsBash) || (lastIsBash && currentIsWrite)) {
        return {
          valid: false,
          reason: `Workflow Violation: Shifting between actions requires intermediate analysis. Please call 'sequential_thinking' to log observations and plan your approach before calling '${currentTool}'.`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Ensures that the agent runs tests, compilation checks, or requests a critic review
   * after editing project source files, before concluding the task.
   * 
   * Exclusions:
   * - Edits to meta files like plan.md, task.md, or todo.md are ignored so they don't
   *   invalidate previous verification runs (e.g., checking off tasks at the end of a session).
   * 
   * @param entries - The historical session entries of the agent.
   * @returns an object indicating validity and the block reason if invalid.
   */
  function checkVerificationBeforeConclude(entries: any[]): { valid: boolean; reason?: string } {
    let lastWriteIndex = -1;
    let lastVerificationIndex = -1;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.type === "message" && entry.message?.role === "assistant") {
        const parts = Array.isArray(entry.message.content) ? entry.message.content : [];
        for (const part of parts) {
          if (part.type === "toolCall" || part.type === "functionCall") {
            const name = (part.name || "").toLowerCase();

            if (/write|edit|replace|patch|create|update/i.test(name)) {
              // Ignore writes to PLAN.md, task.md, and todo.md
              let targetFile = "";
              if (part.arguments) {
                try {
                  const parsed = typeof part.arguments === "string" ? JSON.parse(part.arguments) : part.arguments;
                  if (parsed) {
                    targetFile = parsed.TargetFile || parsed.AbsolutePath || parsed.path || parsed.file || parsed.filename || "";
                  }
                } catch {}
              }
              if (typeof targetFile === "string") {
                const lower = targetFile.toLowerCase();
                const isMetaFile = lower.endsWith("plan.md") || lower.endsWith("task.md") || lower.endsWith("todo.md");
                if (!isMetaFile) {
                  lastWriteIndex = i;
                }
              }
            } else if (name.includes("critic") || name === "bash" || name === "run_command") {
              // Note: Running commands (bash) acts as verification (compiling, testing, running)
              lastVerificationIndex = i;
            }
          }
        }
      }
    }

    if (lastWriteIndex !== -1 && lastVerificationIndex < lastWriteIndex) {
      return {
        valid: false,
        reason: "Workflow Violation: You have modified project files but have not run critic_review or any validation/test commands since the last edit. You must verify your changes before concluding."
      };
    }

    return { valid: true };
  }

  /**
   * Registers a tool interceptor hook that dynamically blocks tool calls violating
   * quality gates (Plan-First Gate, Interleaved Thinking, and Verification Before Conclude).
   */
  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!isWorkflowEnforced) return undefined;

    const entries = ctx?.sessionManager?.getEntries() || [];
    const toolName = event.toolName || "";

    // 1. Enforce Verification before Conclude
    if (toolName === "sequential_thinking") {
      const action = event.input?.action;
      if (action === "conclude") {
        const verification = checkVerificationBeforeConclude(entries);
        if (!verification.valid) {
          return { block: true, reason: verification.reason };
        }
      }
      return undefined;
    }

    // 2. Enforce Plan and Interleaved Thinking on Modifying Tools
    const isWrite = /write|edit|replace|patch|create|update/i.test(toolName);
    const isBash = toolName.toLowerCase() === "bash" || toolName.toLowerCase() === "run_command";

    if (isWrite || isBash) {
      let targetFile = "";
      if (isWrite && event.input) {
        targetFile = event.input.TargetFile || event.input.AbsolutePath || event.input.path || event.input.file || event.input.filename || "";
      }

      // If the target file is plan.md, task.md, or todo.md, let the read/write pass through
      if (typeof targetFile === "string") {
        const lower = targetFile.toLowerCase();
        if (lower.endsWith("plan.md") || lower.endsWith("task.md") || lower.endsWith("todo.md")) {
          return undefined;
        }
      }

      // If it's a bash command operating on planning/meta files, let it pass
      if (isBash) {
        const cmd = (event.input?.command || event.input?.CommandLine || "").toLowerCase();
        if (cmd && (cmd.includes("plan.md") || cmd.includes("task.md") || cmd.includes("todo.md"))) {
          return undefined;
        }
      }

      // Rule 2.1: Enforce Plan (PLAN.md must have been read or written first)
      if (!hasInteractedWithPlan(entries)) {
        return {
          block: true,
          reason: "Workflow Violation: You must read or create PLAN.md using the plan-execute workflow before editing project files or running commands. Please read/create PLAN.md first."
        };
      }

      // Rule 2.2: Enforce Interleaved Thinking
      const thinking = checkInterleavedThinking(entries, toolName);
      if (!thinking.valid) {
        return { block: true, reason: thinking.reason };
      }
    }

    return undefined;
  });
}
