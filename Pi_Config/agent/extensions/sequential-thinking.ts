/**
 * Sequential Thinking & Acting Extension for Pi Coding Agent
 * 
 * Overview:
 * This script implements a sandbox-based reasoning and execution harness for the Pi Coding Agent.
 * It is designed to facilitate guided, structured thinking and runtime context management when the agent
 * is executing complex tasks, evaluating design choices, or debugging multi-layered problems.
 * 
 * Goals & Capabilities:
 * 1. Guided & Structured Reasoning:
 *    - Registers the `sequential_thinking` tool, allowing the agent to break down its reasoning into
 *      structured observation/reasoning pairs with explicit goals, exit instructions, and rewind paths.
 *    - Keeps the agent highly focused by forcing it to re-analyze its state after interleaved action tool
 *      calls (e.g. edits or bash command runs) using active session prompts.
 * 
 * 2. Runtime Context Control & Branch Isolation:
 *    - Implements alternative branch paths via the `rewind` action (rewinding to a prior step to try
 *      a different approach). Branch IDs are auto-generated from the rewind target.
 *    - Dynamically filters the active LLM context window while a session is active (`isThinkingActive === true`)
 *      to isolate the current active branch and temporarily hide inactive or discarded branches.
 *    - Hiding dead ends prevents the LLM from being biased by failed hypotheses, wrong code drafts, or error logs.
 *    - Restores the full message history (all paths and branches explored) once thinking concludes to ensure
 *      the permanent conversation history is never destructively altered.
 * 
 * 3. History Compaction & Summarization:
 *    - If summarization is enabled (`isPruningEnabled === true`), once reasoning concludes, intermediate thoughts
 *      and actions on the path are pruned from the active prompt context and replaced with a structured,
 *      deterministic recall summary covering all reasoning steps and interleaved tool calls/file changes.
 * 
 * TUI Console Commands:
 * - `/context_summarisation [on|off|<number>]`: Toggle or configure the step count threshold for concluded session compaction.
 * - `/branch_isolation [on|off]`: Toggle active-turn branch isolation to prevent reasoning bias.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

interface ThoughtRecord {
  thoughtNumber: number;
  observation: string;
  reasoning: string;
  action: "continue" | "rewind" | "conclude";
  rewindToStep?: number;
  branchId?: string;      // Auto-generated from rewindToStep, never set by the model directly
  exitInstruction?: string;
  goal?: string;
}

// Lightweight interfaces for message shapes to replace `any` in hot paths
interface MessagePart {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  toolCallId?: string;
  arguments?: unknown;
  thought?: string;            // Gemini 2.0 internal thought
  thought_signature?: string;  // Gemini 2.0 thought signature
}

interface Message {
  role: string;
  content: string | MessagePart[];
  timestamp?: number;
  toolCallId?: string;
  tool_call_id?: string;
  thought_signature?: string;
}

// In-memory cache of thoughts, isolated by session to prevent cross-session bleeding
const thoughtHistoryMap = new Map<string, ThoughtRecord[]>();

// Cache for generated summaries so we don't rebuild them on every context assembly after a session concludes
const summaryCache = new Map<string, string>();

// Sentinel marker used to locate the summary injection point in tool responses.
// Must match the prefix of the loopDirective text rendered by execute() for the 'conclude' action.
// The tool wraps loopDirective in `*...*` so the marker starts with `*Thought process concluded`.
const CONCLUSION_MARKER = "*Thought process concluded";

// Safely parse tool call arguments that may arrive as a string or an object
function parseToolArguments(args: unknown): Record<string, unknown> {
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return (args as Record<string, unknown>) ?? {};
}

// Extract the toolCallId from a message, checking common property names
function getToolCallId(msg: Message): string | undefined {
  return msg.toolCallId || msg.tool_call_id || undefined;
}

// Count total tool call steps within a message range (shared by analyzeContextMessages and context hook)
function countSessionSteps(messages: Message[], startIndex: number, endIndex: number): number {
  let total = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    const msg = messages[i];
    if (msg?.role === "assistant" && Array.isArray(msg?.content)) {
      for (const part of msg.content as MessagePart[]) {
        if (part?.type === "toolCall") {
          total++;
        }
      }
    }
  }
  return total;
}

// Format a single thought record into a readable summary entry
function formatThoughtEntry(t: ThoughtRecord): string {
  return `  - **Observation:** ${t.observation.trim()}\n  - **Reasoning:** ${t.reasoning.trim()}`;
}

// Try to extract a meaningful file path or subject from tool call arguments for display in the action summary
function extractActionSubject(_name: string, args: string): string {
  try {
    const parsed = JSON.parse(args);
    // Common patterns across write/edit/read tools
    const path = parsed.TargetFile || parsed.AbsolutePath || parsed.path || parsed.file || parsed.filename;
    if (path && typeof path === "string") {
      // Trim to basename for brevity
      return path.split(/[\\/]/).pop() ?? path;
    }
    // For command tools, show the command prefix
    if (parsed.CommandLine && typeof parsed.CommandLine === "string") {
      return parsed.CommandLine.slice(0, 60) + (parsed.CommandLine.length > 60 ? "…" : "");
    }
  } catch { }
  // Fall back to raw args (truncated)
  return args.length > 80 ? args.slice(0, 80) + "…" : args;
}

// Summary Generator for Branching thoughts
function generateBranchingSummary(history: ThoughtRecord[], _uniqueBranches: Set<string>): string {
  let summary = "\n\n============================================================\n";
  summary += "🌲 BRANCHING THOUGHT TREE RECALL\n";
  summary += "============================================================\n";
  summary += "During this reasoning session, you explored alternative paths. Here is the full chronological record of all branches you evaluated (including pruned ones) to help you synthesize your final response:\n\n";

  for (const t of history) {
    let prefix = `- **Step #${t.thoughtNumber}**`;
    if (t.branchId) {
      const rewindNote = t.rewindToStep ? `, rewound from Step #${t.rewindToStep}` : "";
      prefix += ` (Branch \`${t.branchId}\`${rewindNote})`;
    } else {
      prefix += ` (Main Path)`;
    }
    summary += `${prefix}:\n${formatThoughtEntry(t)}\n`;
  }

  summary += "\nUse this context to inform your next actions. Incorporate findings from explored branches into your execution plan.";
  return summary;
}

// Summary Generator for Sequential thoughts
function generateSequentialSummary(history: ThoughtRecord[]): string {
  let summary = "\n\n============================================================\n";
  summary += "💬 SEQUENTIAL THINKING RECALL\n";
  summary += "============================================================\n";
  summary += `During this reasoning session, you followed a sequential thinking path of ${history.length} steps. Here is the chronological record of your thoughts:\n\n`;

  for (const t of history) {
    const prefix = `- **Step #${t.thoughtNumber}** (Main Path)`;
    summary += `${prefix}:\n${formatThoughtEntry(t)}\n`;
  }

  summary += "\nUse this context to inform your next actions and verify that all goals have been met.";
  return summary;
}

// Classify a tool call into a display category for the action summary
function classifyAction(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("write") || n.includes("create") || n.includes("new")) return "WRITE";
  if (n.includes("edit") || n.includes("replace") || n.includes("update") || n.includes("patch")) return "EDIT";
  if (n.includes("read") || n.includes("view") || n.includes("list") || n.includes("get")) return "READ";
  if (n.includes("run") || n.includes("exec") || n.includes("command") || n.includes("bash")) return "RUN";
  if (n.includes("delete") || n.includes("remove")) return "DELETE";
  return "ACTION";
}

// Build a structured record of interleaved action tool calls and their outcomes
function buildActionSummary(messages: Message[], firstThinkingIndex: number, lastThinkingIndex: number): string {
  const toolCallMap = new Map<string, { name: string; args: string; response?: string }>();

  // 1. Gather all action tool calls in the session span
  for (let i = firstThinkingIndex; i <= lastThinkingIndex; i++) {
    const msg = messages[i];
    if (msg?.role === "assistant" && Array.isArray(msg?.content)) {
      for (const part of msg.content as MessagePart[]) {
        if ((part?.type === "toolCall" || part?.type === "functionCall") && part?.name !== "sequential_thinking") {
          let argsStr = "";
          if (part.arguments) {
            argsStr = typeof part.arguments === "string" ? part.arguments : JSON.stringify(part.arguments);
          }
          const callId = part.id || part.toolCallId;
          // Only index calls with a valid ID to prevent collisions on empty keys
          if (callId) {
            toolCallMap.set(callId, { name: part.name!, args: argsStr });
          }
        }
      }
    }
  }

  // 2. Map their outcomes — bounded scan to avoid attributing unrelated responses
  const responseScanEnd = Math.min(messages.length, lastThinkingIndex + toolCallMap.size + 5);
  for (let i = firstThinkingIndex; i < responseScanEnd; i++) {
    const msg = messages[i];
    if (msg?.role === "tool" || msg?.role === "toolResult" || msg?.role === "user") {
      const callId = getToolCallId(msg);
      if (callId && toolCallMap.has(callId)) {
        const call = toolCallMap.get(callId)!;
        let raw = "";
        if (typeof msg.content === "string") {
          raw = msg.content;
        } else if (Array.isArray(msg.content)) {
          raw = msg.content
            .filter((c: any) => c?.type === "text")
            .map((c: any) => c?.text ?? "")
            .join("\n");
        } else {
          raw = JSON.stringify(msg.content);
        }
        // Collapse multiple spaces/newlines to a single space and truncate to keep summary compact
        const collapsed = raw.replace(/\s+/g, " ").trim();
        call.response = collapsed.length > 120 ? collapsed.slice(0, 120) + "…" : collapsed;
      }
    }
  }

  if (toolCallMap.size === 0) return "";

  let actionSummary = "\n\n============================================================\n";
  actionSummary += "🛠️ ACTIONS & CHANGES\n";
  actionSummary += "============================================================\n";

  for (const call of toolCallMap.values()) {
    const category = classifyAction(call.name);
    const subject = extractActionSubject(call.name, call.args);
    const outcome = call.response
      ? (call.response.toLowerCase().includes("error") || call.response.toLowerCase().includes("fail")
        ? ` ❌ ${call.response}`
        : ` ✅ ${call.response}`)
      : " ⏳ (no response recorded)";
    actionSummary += `- **[${category}]** \`${call.name}\` → **${subject}**${outcome}\n`;
  }

  return actionSummary;
}

// Build a complete procedural recall summary: reasoning path + actions/changes
function buildRecallSummary(
  history: ThoughtRecord[],
  messages: Message[],
  firstThinkingIndex: number,
  lastThinkingIndex: number
): string {
  const uniqueBranches = new Set(
    history.map(t => t.branchId).filter((id): id is string => id !== undefined && id !== "")
  );
  const thoughtSummary = uniqueBranches.size > 0
    ? generateBranchingSummary(history, uniqueBranches)
    : generateSequentialSummary(history);
  const actionSummary = buildActionSummary(messages, firstThinkingIndex, lastThinkingIndex);
  return thoughtSummary + (actionSummary ? "\n" + actionSummary : "");
}

// Sweeps messages to map branch associations and active thinking state
interface ContextAnalysis {
  messageBranchMap: Map<Message, string | undefined>;
  activeBranchId: string | undefined;
  isThinkingActive: boolean;
  intermediateThoughts: Set<Message>;
  firstThinkingIndex: number;
  lastThinkingIndex: number;
  lastThinkingToolCallId: string | undefined;
  totalSessionSteps: number;
}

function analyzeContextMessages(messages: Message[], maxThinkingSize: number): ContextAnalysis {
  const messageBranchMap = new Map<Message, string | undefined>();
  const intermediateThoughts = new Set<Message>();
  let currentBranchId: string | undefined = undefined;
  let isThinkingActive = false;

  // Track the indices of sequential_thinking assistant messages to establish the session span
  let firstThinkingIndex = -1;
  let lastThinkingIndex = -1;
  let lastThinkingToolCallId: string | undefined = undefined;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg?.role === "assistant" && Array.isArray(msg?.content)) {
      for (const part of msg.content as MessagePart[]) {
        if ((part?.type === "toolCall" || part?.type === "functionCall") && part?.name === "sequential_thinking") {
          const parsed = parseToolArguments(part.arguments);
          const action = parsed.action as string | undefined;
          const rewindToStep = parsed.rewindToStep as number | undefined;

          // Only update branch context when a rewind is initiated.
          // For continue/conclude steps, inherit currentBranchId from the preceding step
          // so all steps within a branch are correctly attributed to it.
          if (rewindToStep) {
            currentBranchId = `branch-from-${rewindToStep}`;
          }
          isThinkingActive = action === "continue" || action === "rewind";

          if (firstThinkingIndex === -1) {
            firstThinkingIndex = i;
          }
          lastThinkingIndex = i;
          lastThinkingToolCallId = part.id || part.toolCallId || undefined;
        }
      }
    }
    messageBranchMap.set(msg, currentBranchId);
  }

  // Count total session steps once, shared by all callers
  const totalSessionSteps = firstThinkingIndex !== -1
    ? countSessionSteps(messages, firstThinkingIndex, lastThinkingIndex)
    : 0;

  // If thinking is concluded, mark intermediate messages for pruning
  if (!isThinkingActive && firstThinkingIndex !== -1 && lastThinkingIndex > firstThinkingIndex) {
    const hasBranches = Array.from(messageBranchMap.values()).some(id => id !== undefined && id !== "");
    const isLongSession = totalSessionSteps > maxThinkingSize;

    // Only prune if we actually need a recall summary (branches or > step limit)
    if (hasBranches || isLongSession) {
      const prunedToolCallIds = new Set<string>();
      const keptToolCallIds = new Set<string>();

      // 1. Identify tool IDs belonging to the anchor message (the one we keep)
      const anchorMsg = messages[lastThinkingIndex];
      if (anchorMsg?.role === "assistant" && Array.isArray(anchorMsg.content)) {
        for (const part of anchorMsg.content as MessagePart[]) {
          const id = part.id || part.toolCallId;
          if (id) keptToolCallIds.add(id);
        }
      }

      // 2. Identify tool IDs for all assistant messages in the session span (excluding anchor)
      for (let i = firstThinkingIndex; i < lastThinkingIndex; i++) {
        const msg = messages[i];
        if (msg.role === "assistant" && Array.isArray(msg.content)) {
          for (const part of msg.content as MessagePart[]) {
            const id = part.id || part.toolCallId;
            if (id) prunedToolCallIds.add(id);
          }
          intermediateThoughts.add(msg);
        }
      }

      // 3. Mark tool responses for pruning.
      // Gemini 2.0 400 errors occur if we prune an assistant message but leave its tool response,
      // or vice versa. We must ensure every tool call ID is either fully kept or fully pruned.
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role === "tool" || msg.role === "toolResult" || (msg.role === "user" && getToolCallId(msg))) {
          const callId = getToolCallId(msg);
          if (callId) {
            // If the ID belongs to a pruned assistant message, prune the response too.
            // UNLESS the same ID is also in the kept anchor (unlikely, but safe).
            if (prunedToolCallIds.has(callId) && !keptToolCallIds.has(callId)) {
              intermediateThoughts.add(msg);
            }
          }
        }
      }

      // 4. Mark any remaining non-assistant messages within the session span for pruning.
      // This includes interleaved user messages or tool results that were missed.
      for (let i = firstThinkingIndex; i < lastThinkingIndex; i++) {
        const msg = messages[i];
        if (!intermediateThoughts.has(msg) && msg !== anchorMsg) {
          intermediateThoughts.add(msg);
        }
      }
    }
  }

  return {
    messageBranchMap,
    activeBranchId: currentBranchId,
    isThinkingActive,
    intermediateThoughts,
    firstThinkingIndex,
    lastThinkingIndex,
    lastThinkingToolCallId,
    totalSessionSteps,
  };
}

export default function (pi: ExtensionAPI) {
  let isPruningEnabled = false;
  let isBranchIsolationEnabled = false; // Default OFF to prevent Gemini 2.0 thought_signature errors
  let maxThinkingSize = 10; // Default limit for total thoughts + actions before summaries/pruning occur

  // UI-exposed command to toggle context pruning and configure step limit
  pi.registerCommand("context_summarisation", {
    description: "Toggle or configure sequential thinking context pruning and summarization threshold. Usage: /context_summarisation [on|off|<number>]",
    handler: async (args: any, ctx: any) => {
      const isString = typeof args === "string";
      const argStr = isString ? args.trim().toLowerCase() : "";

      const argsArray = Array.isArray(args) ? args : (isString ? args.split(/\s+/) : []);
      const parsedNum = argsArray.map(a => parseInt(a, 10)).find(num => !isNaN(num));

      if (parsedNum !== undefined && parsedNum > 0) {
        maxThinkingSize = parsedNum;
        isPruningEnabled = true;
        ctx.ui.notify(`Sequential Thinking context summarization is ENABLED (summarizing sessions larger than ${maxThinkingSize} total steps/actions)`, "info");
        return;
      }

      const hasOn = argsArray.includes("on") || argStr === "on";
      const hasOff = argsArray.includes("off") || argStr === "off";

      if (hasOn) {
        isPruningEnabled = true;
        ctx.ui.notify(`Sequential Thinking context summarization is ENABLED (summarizing sessions larger than ${maxThinkingSize} total steps/actions)`, "info");
      } else if (hasOff) {
        isPruningEnabled = false;
        ctx.ui.notify("Sequential Thinking context summarization is now DISABLED (history left untouched)", "info");
      } else {
        // Toggle
        isPruningEnabled = !isPruningEnabled;
        if (isPruningEnabled) {
          ctx.ui.notify(`Sequential Thinking context summarization is ENABLED (summarizing sessions larger than ${maxThinkingSize} total steps/actions)`, "info");
        } else {
          ctx.ui.notify("Sequential Thinking context summarization is now DISABLED (history left untouched)", "info");
        }
      }
    }
  });

  // UI-exposed command to toggle branch isolation
  pi.registerCommand("branch_isolation", {
    description: "Toggle thinking branch isolation. Usage: /branch_isolation [on|off]",
    handler: async (args: any, ctx: any) => {
      const isString = typeof args === "string";
      const argStr = isString ? args.trim().toLowerCase() : "";
      const argsArray = Array.isArray(args) ? args : (isString ? args.split(/\s+/) : []);

      const hasOn = argsArray.includes("on") || argStr === "on";
      const hasOff = argsArray.includes("off") || argStr === "off";

      if (hasOn) {
        isBranchIsolationEnabled = true;
        ctx.ui.notify("Sequential Thinking branch isolation is ENABLED", "info");
      } else if (hasOff) {
        isBranchIsolationEnabled = false;
        ctx.ui.notify("Sequential Thinking branch isolation is DISABLED", "info");
      } else {
        isBranchIsolationEnabled = !isBranchIsolationEnabled;
        const status = isBranchIsolationEnabled ? "ENABLED" : "DISABLED";
        ctx.ui.notify(`Sequential Thinking branch isolation is now ${status}`, "info");
      }
    }
  });

  // Clear thought history at the start of every user turn to prevent bleeding.
  // Note: We do NOT clear summaryCache here because if the next turn does not use
  // sequential thinking, the context hook still needs to inject the previously
  // compiled summary block without rebuilding it from the cleared thought history.
  // The summaryCache is cleared in execute() when a new thinking session starts (Step 1).
  pi.on("agent_start", async (_event, ctx) => {
    const sessionKey = (ctx as any)?.sessionManager?.getSessionFile() ?? "ephemeral";
    thoughtHistoryMap.delete(sessionKey);
  });

  // 1. Register the Sequential Thinking tool with structured observation/reasoning schema
  pi.registerTool({
    name: "sequential_thinking",
    label: "Sequential Thinking & Acting",
    description: "A structured reasoning and execution sandbox for complex planning, debugging, and design evaluation. Each step separates observation (what you learned) from reasoning (what it means). Supports rewinding to a prior step to try an alternative approach — failed paths are automatically cleaned from context.",
    promptSnippet: "Structured observation/reasoning steps with rewind-based branching and interleaved execution for complex planning, debugging, and implementation tasks.",
    promptGuidelines: [
      "Use sequential_thinking for complex planning, debugging, design evaluation, or multi-step implementation tasks. Skip it for simple, single-step actions.",
      "On your first step, set `goal` to describe what you are solving and `exitInstruction` to describe what to do when done (e.g. 'mark task complete in PLAN.md and proceed to the next task').",
      "In `observation`, state what you just learned — tool output, code you read, errors you saw, or the initial problem statement. In `reasoning`, analyze what it means and what approach to take.",
      "Use `action: 'rewind'` with `rewindToStep` if your current approach hit a dead end. The failed path will be cleaned from context so you can try fresh.",
      "Use `action: 'conclude'` when you have enough information to execute. Do not pad extra steps.",
      "You may interleave action tools (edits, commands) between thinking steps to test a hypothesis. After any action tool, call sequential_thinking to analyze the result before taking further action."
    ],
    parameters: Type.Object({
      observation: Type.String({ description: "What you just learned, noticed, or received from a tool result. On Step 1, state the problem or task." }),
      reasoning: Type.String({ description: "Your analysis: what this means, what options exist, what you will try next." }),
      action: Type.Union([
        Type.Literal("continue"),
        Type.Literal("rewind"),
        Type.Literal("conclude"),
      ], { description: "'continue' for more steps, 'rewind' to abandon the current path and try from an earlier step, 'conclude' when done thinking." }),
      rewindToStep: Type.Optional(Type.Integer({ description: "When action is 'rewind', the step number to branch from. A new alternative path starts from here." })),
      goal: Type.Optional(Type.String({ description: "High-level objective for this reasoning session. Set on Step 1. Persisted in the system prompt as a reminder while the session is active." })),
      exitInstruction: Type.Optional(Type.String({ description: "What to do immediately after concluding (e.g. 'update PLAN.md, then run the next task skill'). Set on Step 1. Surfaced as the directive when action is 'conclude'." })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const sessionKey = (ctx as any)?.sessionManager?.getSessionFile() ?? "ephemeral";
      let thoughtHistory = thoughtHistoryMap.get(sessionKey) ?? [];

      // Determine branch context:
      // - On rewind: start a new branch from the rewind target
      // - On continue/conclude: inherit the branch from the last recorded thought so all
      //   steps within a branch are correctly tagged, not just the initial rewind step
      const lastThought = thoughtHistory[thoughtHistory.length - 1];
      let branchId: string | undefined = lastThought?.branchId;
      if (params.action === "rewind" && params.rewindToStep) {
        branchId = `branch-from-${params.rewindToStep}`;
      }

      // Filter history to determine the step number in the current active path of reasoning.
      // Step numbers are global across the session (main + current branch) so branches
      // continue numbering from where the main path left off, keeping the timeline unambiguous.
      const activePath = thoughtHistory.filter(t =>
        t.branchId === undefined || t.branchId === "" || t.branchId === branchId
      );
      const thoughtNumber = activePath.length + 1;

      // Reset history on Step 1 to prevent bleeding between consecutive tasks in the same session
      if (thoughtNumber === 1) {
        thoughtHistory = [];
        thoughtHistoryMap.set(sessionKey, thoughtHistory);
        // Invalidate any cached summary from a prior session
        summaryCache.delete(sessionKey);
      }

      // Record the current thought to history
      thoughtHistory.push({
        thoughtNumber,
        observation: params.observation,
        reasoning: params.reasoning,
        action: params.action,
        rewindToStep: params.rewindToStep,
        branchId,
        exitInstruction: params.exitInstruction,
        goal: params.goal,
      });
      thoughtHistoryMap.set(sessionKey, thoughtHistory);

      // Format status prefix for the TUI display
      let statusPrefix: string;
      if (params.action === "rewind" && params.rewindToStep) {
        statusPrefix = `[REWIND → Branch from #${params.rewindToStep}]`;
      } else if (branchId) {
        statusPrefix = `[BRANCH ${branchId}]`;
      } else {
        statusPrefix = "[THOUGHT]";
      }
      const tracking = `[Step ${thoughtNumber}]`;

      // Compose the structured display content
      const thoughtBlock = [
        `${statusPrefix} ${tracking}`,
        `> **Observation:** ${params.observation}`,
        `> **Reasoning:** ${params.reasoning}`,
      ].join("\n");

      // Scan history for any custom exit instruction and goal
      const customExit = thoughtHistory.find(t => t.exitInstruction)?.exitInstruction;

      // Set directive based on the action type
      let loopDirective: string;
      switch (params.action) {
        case "continue":
          loopDirective = "Thought logged. Proceed to the next step, or interleave an action tool to test your hypothesis.";
          break;
        case "rewind":
          loopDirective = `Rewinding to Step #${params.rewindToStep ?? "?"}. Previous path isolated from context. Continue reasoning on this new branch.`;
          break;
        case "conclude":
          loopDirective = customExit
            ? `Thought process concluded. Next action: ${customExit}`
            : "Thought process concluded. Return to the user's original request and proceed with execution.";
          break;
        default:
          loopDirective = "Thought logged. Proceed to the next step.";
          break;
      }

      return {
        content: [{
          type: "text",
          text: `${thoughtBlock}\n\n*${loopDirective}*`
        }],
        details: { branchId }
      };
    }
  });

  // 2. Context hook: handles active-session branch isolation AND concluded-session compaction.
  //    These are two distinct concerns but share the same message scan, so they're co-located
  //    in one hook with clearly labelled blocks to avoid redundant iteration.
  pi.on("context", async (event, ctx) => {
    if (!event?.messages) return;

    // Instant guard: exit if sequential_thinking was never used in this session
    const hasThinking = event.messages.some((m: Message) =>
      m?.role === "assistant" && Array.isArray(m?.content) && (m.content as MessagePart[]).some(p => (p?.type === "toolCall" || p?.type === "functionCall") && p?.name === "sequential_thinking")
    );
    if (!hasThinking) return;

    const analysis = analyzeContextMessages(event.messages as Message[], maxThinkingSize);
    const {
      messageBranchMap, activeBranchId, isThinkingActive, intermediateThoughts,
      firstThinkingIndex, lastThinkingIndex, lastThinkingToolCallId, totalSessionSteps
    } = analysis;

    const sessionKey = (ctx as any)?.sessionManager?.getSessionFile() ?? "ephemeral";

    // ─── ACTIVE SESSION: Branch isolation + system prompt injection ───
    if (isThinkingActive) {
      // Shallow-clone the array so we don't mutate the original event.messages
      let filteredMessages = isBranchIsolationEnabled
        ? event.messages.filter((msg: Message) => {
          const msgBranchId = messageBranchMap.get(msg);
          return msgBranchId === undefined || msgBranchId === activeBranchId;
        })
        : [...event.messages];

      // Inject active thinking session reminder into a cloned system message
      const thoughtHistory = thoughtHistoryMap.get(sessionKey);
      const customGoal = thoughtHistory?.find(t => t.goal)?.goal;
      const customExit = thoughtHistory?.find(t => t.exitInstruction)?.exitInstruction;
      const goalLine = customGoal ? `\nGoal: ${customGoal}` : "";
      const exitLine = customExit ? `\nOn conclusion: ${customExit}` : "";

      const reminder =
        `\n\n[ACTIVE THINKING SESSION]${goalLine}${exitLine}\n` +
        "You are mid-reasoning. After executing any action tool, call sequential_thinking next to analyze " +
        "the result before taking further action. Use action 'conclude' when ready to exit this session.";

      const systemIdx = filteredMessages.findIndex((m: Message) => m?.role === "system");
      if (systemIdx !== -1) {
        // Clone the system message before mutating to avoid affecting other extensions/framework references
        const original = filteredMessages[systemIdx];
        if (typeof original.content === "string") {
          filteredMessages[systemIdx] = { ...original, content: original.content + reminder };
        } else if (Array.isArray(original.content)) {
          filteredMessages[systemIdx] = {
            ...original,
            content: [...(original.content as MessagePart[]), { type: "text", text: reminder }]
          };
        }
      } else {
        filteredMessages.unshift({
          role: "system",
          content: reminder,
          timestamp: Date.now()
        } as Message);
      }

      return { messages: filteredMessages };
    }

    // ─── CONCLUDED SESSION: Pruning + summary generation ───
    if (!isPruningEnabled) {
      // If pruning/compaction is disabled, clean up memory and return original messages untouched
      thoughtHistoryMap.delete(sessionKey);
      summaryCache.delete(sessionKey);
      return { messages: event.messages };
    }

    if (firstThinkingIndex !== -1 && lastThinkingIndex > firstThinkingIndex && lastThinkingToolCallId) {
      const thoughtHistory = thoughtHistoryMap.get(sessionKey) ?? [];
      // Derive hasBranches from the messageBranchMap (already computed) rather than in-memory
      // thoughtHistory which may have been cleared by a concurrent agent_start event
      const hasBranches = Array.from(messageBranchMap.values()).some(id => id !== undefined && id !== "");
      const isLongSession = totalSessionSteps > maxThinkingSize;

      if (hasBranches || isLongSession) {
        // Use cached summary if available; otherwise build and cache (purely procedural — no LLM call)
        let summaryBlock = summaryCache.get(sessionKey);
        if (!summaryBlock && thoughtHistory.length > 0) {
          summaryBlock = buildRecallSummary(
            thoughtHistory,
            event.messages as Message[],
            firstThinkingIndex,
            lastThinkingIndex
          );
          if (summaryBlock) {
            summaryCache.set(sessionKey, summaryBlock);
            if (ctx?.ui?.notify) {
              const customExit = thoughtHistory.find(t => t.exitInstruction)?.exitInstruction;
              const nextActionText = customExit
                ? `\n\n🎯 **Next Action:** ${customExit}`
                : `\n\n🎯 **Next Action:** Return to the user's original request and proceed with execution.`;
              ctx.ui.notify((summaryBlock + nextActionText).trim(), "info");
            }
          }
        }

        // Only prune and inject if we have a summary block to replace the pruned messages
        if (summaryBlock) {
          const prunedMessages = event.messages.filter((msg: Message) => !intermediateThoughts.has(msg));
          const responseIdx = prunedMessages.findIndex((msg: Message) =>
            (msg?.role === "tool" || msg?.role === "toolResult") && getToolCallId(msg) === lastThinkingToolCallId
          );

          if (responseIdx !== -1) {
            // Clone the tool response before injecting the summary to avoid mutating shared objects
            const original = prunedMessages[responseIdx];
            if (typeof original.content === "string") {
              // Inject summary before the conclusion directive using the shared constant marker
              const markerIdx = original.content.indexOf(CONCLUSION_MARKER);
              if (markerIdx !== -1) {
                prunedMessages[responseIdx] = {
                  ...original,
                  content: original.content.slice(0, markerIdx) + summaryBlock + original.content.slice(markerIdx)
                };
              } else {
                prunedMessages[responseIdx] = {
                  ...original,
                  content: original.content + summaryBlock
                };
              }
            } else if (Array.isArray(original.content)) {
              prunedMessages[responseIdx] = {
                ...original,
                content: [...(original.content as MessagePart[]), { type: "text", text: summaryBlock }]
              };
            }
          }

          // Clean up thought history since we successfully summarized
          thoughtHistoryMap.delete(sessionKey);
          return { messages: prunedMessages };
        }
      }
    }

    // Clean up thought history for concluded session
    thoughtHistoryMap.delete(sessionKey);
    // Note: summaryCache is intentionally NOT deleted here so subsequent context assemblies
    // within the same concluded session reuse the cached summary without rebuilding it.

    return { messages: event.messages };
  });
}