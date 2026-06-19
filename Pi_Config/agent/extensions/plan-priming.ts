import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let isPrimingEnabled = true;

  // Helper to parse tool arguments safely
  function parseToolArguments(args: unknown): Record<string, any> {
    if (typeof args === "string") {
      try {
        return JSON.parse(args);
      } catch {
        return {};
      }
    }
    return (args as Record<string, any>) ?? {};
  }

  // Register command to enable/disable or check status
  pi.registerCommand("plan_priming", {
    description: "Toggle or check status of PLAN.md context priming. Usage: /plan_priming [on|off]",
    handler: async (args: any, ctx: any) => {
      const isString = typeof args === "string";
      const hasOn = isString ? args.trim().toLowerCase() === "on" : Array.isArray(args) && args.includes("on");
      const hasOff = isString ? args.trim().toLowerCase() === "off" : Array.isArray(args) && args.includes("off");

      if (hasOn) {
        isPrimingEnabled = true;
        ctx?.ui?.notify?.("PLAN.md context priming is now ENABLED", "info");
      } else if (hasOff) {
        isPrimingEnabled = false;
        ctx?.ui?.notify?.("⚠️ PLAN.md context priming is now DISABLED", "warning");
      } else {
        isPrimingEnabled = !isPrimingEnabled;
        const status = isPrimingEnabled ? "ENABLED" : "DISABLED";
        const type = isPrimingEnabled ? "info" : "warning";
        ctx?.ui?.notify?.(`PLAN.md context priming is now ${status}`, type);
      }
    }
  });

  // Context hook: intercepts history and appends directives when PLAN.md is read or updated
  pi.on("context", async (event, ctx) => {
    if (!isPrimingEnabled || !event?.messages || event.messages.length === 0) return;

    const messages = event.messages as any[];

    // 1. Locate the last message in history (which must be a tool result)
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || (lastMsg.role !== "tool" && lastMsg.role !== "toolResult")) return;

    const callId = lastMsg.toolCallId || lastMsg.tool_call_id;
    if (!callId) return;

    // 2. Scan backwards to locate the matching assistant tool call
    let toolCallPart: any = null;
    for (let i = messages.length - 2; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        toolCallPart = msg.content.find((p: any) => 
          (p.type === "toolCall" || p.type === "functionCall") && 
          (p.id === callId || p.toolCallId === callId)
        );
        if (toolCallPart) break;
      }
    }
    if (!toolCallPart) return;

    // 3. Inspect tool name and arguments to see if a PLAN.md file was targeted
    const toolName = toolCallPart?.name || "";
    const args = toolCallPart?.arguments;
    let targetFile = "";

    if (args) {
      const parsed = parseToolArguments(args);
      targetFile = parsed.TargetFile || parsed.AbsolutePath || parsed.path || parsed.file || parsed.filename || "";
    }

    // Check if the targeted file matches PLAN.md (case-insensitive)
    if (typeof targetFile === "string" && targetFile.toLowerCase().endsWith("plan.md")) {
      const isWrite = /write|edit|replace|patch|create|update/i.test(toolName);

      // Priming directives aligned with plan-execute/SKILL.md instructions
      const directive = isWrite
        ? [
            "",
            "[System Directive (PLAN.md updated):",
            "1. Move the completed task from 'Current Focus' to 'Done'. Include a short note on the approach/library choices.",
            "2. If you encountered roadblocks, prerequisites, or new requirements, immediately add them under 'Discovered'.",
            "3. Promote the next task from 'Up Next' (or a blocking 'Discovered' task) to 'Current Focus'.",
            "4. If all tasks in Up Next/Discovered are empty:",
            "   - Run tests or validation commands to verify correctness.",
            "   - Perform a manual self-critique or run critic_review if available.",
            "   - Update the 'Goal' line in PLAN.md to reflect the final implementation before concluding.]"
          ].join("\n")
        : [
            "",
            "[System Directive (PLAN.md read):",
            "1. Identify the 'Current Focus' task. If empty, promote the top item from 'Up Next'.",
            "2. Check if EVOLUTION.md exists. If so, read it for relevant past lessons before writing code.",
            "3. Call `sequential_thinking` Step 1 to begin this task with these parameters:",
            "   * goal: Set to the Current Focus task text.",
            "   * exitInstruction: 'Mark task done in PLAN.md with a note on approach. Add any discovered tasks. Move next task to Current Focus. Check for EVOLUTION.md lessons. Then start next task.'",
            "   * observation: Describe the task and current repository context.",
            "   * reasoning: Outline your specific execution steps (1-3 sentences).",
            "4. If the task is too large (> 10 tool calls), break it down into smaller subtasks in PLAN.md now.]"
          ].join("\n");

      // Clone messages array to avoid side effects
      const modifiedMessages = [...messages];
      const newLastMsg = { ...lastMsg };

      if (typeof lastMsg.content === "string") {
        newLastMsg.content = lastMsg.content + directive;
      } else if (Array.isArray(lastMsg.content)) {
        newLastMsg.content = [...lastMsg.content, { type: "text", text: directive }];
      }

      modifiedMessages[messages.length - 1] = newLastMsg;
      return { messages: modifiedMessages };
    }
  });
}
