# AI Tools & Configurations

This document centralizes system configurations, custom extensions, local LLM integrations, and developer workflows for AI agents across operating systems. It is fully self-sustained, containing the exact, raw contents of all active global configurations, plugins, extensions, instruction sheets, and skills.

---

## Pi Coding Agent (`pi`)

[Pi Coding Agent](https://github.com/earendil-works/pi) is an autonomous developer agent harness. It supports local extensions, custom system personas, specialized skills, and local/cloud LLMs.

### Global Configuration Directory

The global configuration, local node plugins, custom extensions, and agent instructions are stored in the user profile directory:
```text
~/.pi/agent/
```

---

### Model Configurations (`models.json`)
Defines the connection parameters for cloud and local LLM providers. Currently configured to support a high-context local model running via a custom LLaMA server (e.g. `llama.cpp` or similar).

```json
{
  "providers": {
    "local-llama": {
      "baseUrl": "http://127.0.0.1:8080/v1",
      "apiKey": "not-needed",
      "api": "openai-completions",
      "models": [
        {
          "id": "unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL",
          "name": "Gemma 4 12B (Multimodal)",
          "input": ["text", "image"],
          "contextWindow": 131072
        }
      ]
    }
  }
}
```

---

### Installed Plugins & Dependencies (npm commands)
To install the required plugins and dependencies within the global agent's local NodeJS environment, run:

```bash
cd ~/.pi/agent/npm
npm install pi-mcp-adapter pi-web-access
```

*   **`pi-mcp-adapter`**: Bridges Model Context Protocol (MCP) servers directly into Pi's tool inventory.
*   **`pi-web-access`**: Enables real-world search synthesis, page extraction, and web research capabilities.

---

### Custom TypeScript Extensions (`extensions/`)
Custom TypeScript scripts placed in the `extensions/` folder are compiled and registered as active tools in Pi's inventory.

*   **`extensions/permissions-gate.ts`**: Restricts the execution of dangerous command lines (PowerShell and Unix) and write/edit actions to sensitive folders and out-of-workspace directories.

```typescript
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let isGateEnabled = true;

  const dangerousBashPatterns = [
    // RM commands (recursive/force, Unix/Windows equivalents)
    /\brm\s+-[rRfF]+/i,
    /\b(Remove-Item|del|rm|ri)\b.*-(Recurse|Force)/i,
    /\bdel\b.*(\/s|\/q|\/f)/i,
    /\b(rmdir|rd)\b.*(\/s|-Recurse)/i,
    
    // Privilege escalation / admin / local accounts / user modification
    /\bsudo\b/i,
    /\bnet\s+(user|localgroup|group)\s+/i,
    /\b(passwd|useradd|groupadd|userdel|groupdel|usermod)\b/i,
    
    // Permissions and ACL modifications
    /\bchmod\b/i,
    /\bchown\b/i,
    /\bicacls\b/i,
    /\bcacls\b/i,
    /\btakeown\b/i,
    /\bchattr\b/i,
    
    // Git destructive operations
    /\bgit\s+reset\s+--(hard|mixed)/i,
    /\bgit\s+clean\s+-[fdx]+/i,
    /\bgit\s+push\b.*(--force|-f|\+)/i,
    /\bgit\s+branch\s+-[dD]\b/i,

    // Disk/Partition manipulation and destructive copying
    /\b(format|mkfs|fdisk|parted)\b/i,
    /\bdd\s+if=/i,

    // System Shutdown / Reboot
    /\b(shutdown|reboot|poweroff|init\s+0)\b/i,

    // Service and Registry manipulation
    /\b(sc\s+(config|create|delete|start|stop))\b/i,
    /\breg\s+(add|delete|import|export)\b/i,

    // Dangerous download & execution (Pipe-to-shell, WebClient IEX)
    /\|\s*(bash|sh|zsh|powershell|pwsh)\b/i,
    /\b(iex|Invoke-Expression)\b/i,
    /new-object\s+system\.net\.webclient/i
  ];

  function isSensitivePath(filePath: string): boolean {
    if (!filePath) return false;
    
    // Resolve relative paths to absolute to prevent directory traversal bypasses
    let absolutePath = filePath;
    try {
      absolutePath = path.resolve(filePath);
    } catch {
      // Fallback to raw path if resolve fails
    }

    const normalized = absolutePath.replace(/\\/g, "/").toLowerCase();
    
    // 1. Git internals (covers absolute, sub-directories, relative, and exact matches)
    if (
      normalized.includes("/.git/") || 
      normalized.startsWith(".git/") ||
      normalized === ".git" || 
      normalized.endsWith("/.git")
    ) return true;
    
    // 2. Sensitive env files
    if (
      normalized === ".env" || 
      normalized.startsWith(".env/") ||
      normalized.endsWith("/.env") || 
      normalized.includes("/.env/") ||
      normalized.includes(".env.")
    ) return true;
    
    // 3. Sensitive Windows folders (case insensitive, matches any drive letter)
    if (/^[a-z]:\/(windows|program files)/i.test(normalized)) return true;

    // 4. Sensitive Unix directories
    if (/^\/(etc|var|usr|bin|sbin|lib|sys|proc|dev|boot|root)\b/i.test(normalized)) return true;
    
    return false;
  }

  function isOutsideWorkspace(filePath: string): boolean {
    if (!filePath) return false;
    
    let absolutePath = filePath;
    try {
      absolutePath = path.resolve(filePath);
    } catch {
      // Fallback
    }

    const workspaceDir = path.resolve(process.cwd()).replace(/\\/g, "/").toLowerCase();
    const normalizedFile = absolutePath.replace(/\\/g, "/").toLowerCase();

    // Check if the path is exactly the workspace directory or inside it
    const isInside = normalizedFile === workspaceDir || normalizedFile.startsWith(workspaceDir + "/");
    return !isInside;
  }

  // Register a command to check status or toggle
  pi.registerCommand("gate", {
    description: "Toggle or check status of the permissions gate. Usage: /gate [on|off]",
    handler: async (args: any, ctx: any) => {
      const isString = typeof args === "string";
      const hasOn = isString ? args.trim().toLowerCase() === "on" : Array.isArray(args) && args.includes("on");
      const hasOff = isString ? args.trim().toLowerCase() === "off" : Array.isArray(args) && args.includes("off");

      if (hasOn) {
        isGateEnabled = true;
        ctx.ui.notify("Permissions Gate is now ENABLED", "info");
      } else if (hasOff) {
        isGateEnabled = false;
        ctx.ui.notify("⚠️ Permissions Gate is now DISABLED", "warning");
      } else {
        isGateEnabled = !isGateEnabled;
        const status = isGateEnabled ? "ENABLED" : "DISABLED";
        const type = isGateEnabled ? "info" : "warning";
        ctx.ui.notify(`Permissions Gate is now ${status}`, type);
      }
    }
  });

  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!isGateEnabled) return undefined;

    // Detect SSH mode. If active, bypass local file boundary constraints.
    const isSshActive = !!pi.getFlag("ssh");

    // 1. Bash command validation
    if (event.toolName === "bash") {
      const command = typeof event.input?.command === "string" ? event.input.command : "";
      const matchedPattern = dangerousBashPatterns.find((p) => p.test(command));

      if (matchedPattern) {
        if (!ctx.hasUI || !ctx.ui) {
          return { block: true, reason: `Dangerous command "${command}" blocked in headless mode (matched: ${matchedPattern}).` };
        }

        const choice = await ctx.ui.select(
          `⚠️ Dangerous command detected!\n\n  ${command}\n\nMatched Safety Pattern: ${matchedPattern}\nDo you want to allow this operation?`,
          ["No, Block it", "Yes, Allow it"]
        );

        if (choice !== "Yes, Allow it") {
          return { block: true, reason: `Blocked by user (matched dangerous pattern: ${matchedPattern})` };
        }
      }
    }

    // 2. Sensitive path or Out-of-Workspace validation (write / edit tools)
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = typeof event.input?.path === "string" ? event.input.path : "";

      if (filePath) {
        // Only run the out-of-workspace check if we are acting locally
        const isOutside = !isSshActive && isOutsideWorkspace(filePath);
        // We still check sensitive paths globally (Unix checks will catch remote, Windows checks will catch local)
        const isSensitive = isSensitivePath(filePath);

        if (isSensitive || isOutside) {
          if (!ctx.hasUI || !ctx.ui) {
            const reason = isSensitive 
              ? `Modification of sensitive path "${filePath}" blocked in headless mode.`
              : `Out-of-workspace file modification on "${filePath}" blocked in headless mode.`;
            return { block: true, reason };
          }

          const messageTitle = isSensitive
            ? `⚠️ Modification of sensitive path detected!\n\n  ${filePath}`
            : `⚠️ File modification OUTSIDE the project workspace detected!\n\n  ${filePath}`;

          const choice = await ctx.ui.select(
            `${messageTitle}\n\nDo you want to allow this operation?`,
            ["No, Block it", "Yes, Allow it"]
          );

          if (choice !== "Yes, Allow it") {
            const blockReason = isSensitive 
              ? "Blocked by user (sensitive path protection active)" 
              : "Blocked by user (out-of-workspace write protection active)";
            return { block: true, reason: blockReason };
          }
        }
      }
    }

    return undefined;
  });
}
```


*   **`extensions/sequential-thinking.ts`**: Provides a high-powered, step-by-step reasoning tree mechanism (`sequential_thinking` tool) to guide complex problem-solving, equipped with an automatic lazy-evaluated Branching Context Pruner to discard dead-end branches.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

interface ThoughtRecord {
  thoughtNumber: number;
  totalThoughts?: number;
  thought: string;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
}

// In-memory cache of thoughts, isolated by session to prevent cross-session bleeding
const thoughtHistoryMap = new Map<string, ThoughtRecord[]>();

function generateBranchingSummary(history: ThoughtRecord[]): string {
  let summary = "\n\n============================================================\n";
  summary += "🌲 BRANCHING THOUGHT TREE RECALL\n";
  summary += "============================================================\n";
  summary += "During this reasoning session, you explored alternative paths. Here is the full chronological record of all branches you evaluated (including pruned ones) to help you synthesize your final response:\n\n";

  for (const t of history) {
    let prefix = `- **Step #${t.thoughtNumber}**`;
    if (t.branchFromThought) {
      prefix += ` (Branch \`${t.branchId || "unnamed"}\` from Step #${t.branchFromThought})`;
    } else if (t.isRevision) {
      const target = t.revisesThought ?? (t.thoughtNumber - 1);
      prefix += ` (Revision of Step #${target})`;
    } else {
      prefix += ` (Main Path)`;
    }
    summary += `${prefix}: ${(t.thought || "").trim()}\n`;
  }
  summary += "\nUse this context to write a highly synthesis-driven final response detailing your explorations and findings.";
  return summary;
}

export default function (pi: ExtensionAPI) {
  // Clear thought history at the start of every user turn to prevent bleeding
  pi.on("agent_start", async (_event, ctx) => {
    const sessionKey = ctx?.sessionManager?.getSessionFile() ?? "ephemeral";
    thoughtHistoryMap.delete(sessionKey);
  });

  // 1. Register the high-powered, 8-parameter Sequential Thinking tool
  pi.registerTool({
    name: "sequential_thinking",
    label: "Sequential Thinking",
    description: "A versatile reasoning sandbox for step-by-step planning, brainstorming, root-cause debugging, managing active checklists, and evaluating multiple alternative designs before taking action. For high-uncertainty tasks, complex bugs, or architectural decisions, you are strongly encouraged to use branching thoughts (via branchFromThought and branchId) to explore alternative solutions in parallel.",
    promptSnippet: "Deep step-by-step reasoning tree mechanism to solve complex logic, architectural planning, and debugging tasks.",
    promptGuidelines: [
      "Use sequential_thinking ONLY when you hit genuine complexity, ambiguous design choices, deep code reviews, or tricky multi-layered bugs. Do NOT call this tool for straightforward, simple, or single-step edits/commands.",
      "Keep your thought sequences short, dynamic, and realistic. If a reasoning process only needs 2 or 3 steps, complete it there! Do NOT artificially pad your steps.",
      "totalThoughts is completely optional. If you are doing a quick planning pass or aren't sure of the exact number of steps, omit totalThoughts entirely. Do NOT default to 10 thoughts for minor problems.",
      "Proceed directly to execution tools (like write, edit, or bash) if a task is routine and does not require active reasoning, structured planning, or design brainstorming."
    ],
    parameters: Type.Object({
      thought: Type.String({ description: "The current thinking step containing analytical reasoning." }),
      thoughtNumber: Type.Integer({ description: "The current position index within this reasoning sequence." }),
      totalThoughts: Type.Optional(Type.Integer({ description: "The estimated total number of thoughts needed to solve the problem. Omit if the task is simple, organic, or total steps are unknown." })),
      nextThoughtNeeded: Type.Optional(Type.Boolean({ description: "Indicates whether another progressive thought step is required after this one. Defaults to true if thoughtNumber < totalThoughts, or false if totalThoughts is omitted." })),
      isRevision: Type.Optional(Type.Boolean({ description: "Set to true if this step actively refutes or modifies a previous hypothesis." })),
      revisesThought: Type.Optional(Type.Integer({ description: "The specific thought number index that is being reconsidered or updated." })),
      branchFromThought: Type.Optional(Type.Integer({ description: "The thought number index from which this alternative path branches off." })),
      branchId: Type.Optional(Type.String({ description: "Unique identifier for this specific branching path of reasoning." }))
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const sessionKey = (ctx as any)?.sessionManager?.getSessionFile() ?? "ephemeral";
      let thoughtHistory = thoughtHistoryMap.get(sessionKey);

      // Reset history on Step 1 to prevent bleeding between consecutive tasks in the same session
      if (!thoughtHistory || params.thoughtNumber === 1) {
        thoughtHistory = [];
        thoughtHistoryMap.set(sessionKey, thoughtHistory);
      }

      // Record the current thought to history
      thoughtHistory.push({
        thoughtNumber: params.thoughtNumber,
        totalThoughts: params.totalThoughts,
        thought: params.thought,
        isRevision: params.isRevision,
        revisesThought: params.revisesThought,
        branchFromThought: params.branchFromThought,
        branchId: params.branchId,
      });

      // Auto-calculate nextThoughtNeeded if omitted
      const nextNeeded = params.nextThoughtNeeded !== undefined 
        ? params.nextThoughtNeeded 
        : (params.totalThoughts !== undefined ? params.thoughtNumber < params.totalThoughts : false);

      // Format status prefix based on revision and branching flags (streamlined, no emojis)
      let statusPrefix = params.isRevision ? "[REVISION]" : "[THOUGHT]";
      if (params.branchFromThought) statusPrefix = `[BRANCH from #${params.branchFromThought}]`;

      const targeting = params.revisesThought ? ` (Updating Step #${params.revisesThought})` : "";
      const tracking = params.totalThoughts !== undefined 
        ? `[${params.thoughtNumber}/${params.totalThoughts}]`
        : `[Step ${params.thoughtNumber}]`;

      // Compose the rich visible display content
      let thoughtBlock = `${statusPrefix} ${tracking}${targeting}\n>>> ${params.thought}`;

      // If the thinking is ending AND we actually did some branching, inject the history recall summary
      if (!nextNeeded) {
        const hasBranches = thoughtHistory.some(t => t.branchId !== undefined || t.branchFromThought !== undefined);
        if (hasBranches) {
          const summaryBlock = generateBranchingSummary(thoughtHistory);
          thoughtBlock += summaryBlock;
        }
        // Prevent memory leak by cleaning up the active session
        thoughtHistoryMap.delete(sessionKey);
      }

      // Set directive to guide the agent loop safely and neutrally
      const loopDirective = nextNeeded 
        ? "Thought logged. Proceed to the next sequential thought step." 
        : "Thought process concluded. Proceed with task execution as instructed.";

      // Return both the actual thought block (for TUI rendering) and the loop directive (for agent instructions)
      return {
        content: [{ 
          type: "text", 
          text: `${thoughtBlock}\n\n*${loopDirective}*` 
        }],
        // Store the branchId in the tool result details so we can query it during the context hook
        details: { branchId: params.branchId }
      };
    }
  });

  // 2. Intercept and prune dead-end branches from the active LLM context window (Lazy Evaluation)
  pi.on("context", async (event, ctx) => {
    if (!event?.messages) return;

    // Instant microsecond guard: exit if branching tools are not present in this session
    const hasThinking = event.messages.some(m => 
      m?.role === "assistant" && Array.isArray(m?.content) && m?.content.some(p => p?.type === "toolCall" && p?.name === "sequential_thinking")
    );
    if (!hasThinking) return;

    // First pass: Map toolCall IDs to branch IDs and determine active branch ID
    const toolCallToBranchMap = new Map<string, string>();
    let activeBranchId: string | undefined = undefined;

    for (const msg of event.messages) {
      if (msg?.role === "assistant" && Array.isArray(msg?.content)) {
        for (const part of msg.content) {
          if (part?.type === "toolCall" && part?.name === "sequential_thinking") {
            let branchId = part.arguments?.branchId;
            if (typeof part.arguments === "string") {
              try {
                branchId = JSON.parse(part.arguments).branchId;
              } catch {}
            }
            const callId = part.id || part.toolCallId || part.tool_call_id;
            if (branchId && typeof branchId === "string") {
              if (callId) {
                toolCallToBranchMap.set(callId, branchId);
              }
              activeBranchId = branchId;
            }
          }
        }
      }
    }

    // If no branch is active, keep context unchanged
    if (!activeBranchId) return;

    // Second pass: Filter the message array to discard dead-end branches symmetrically
    const prunedMessages = event.messages.filter(msg => {
      if (msg?.role === "assistant") {
        if (Array.isArray(msg.content)) {
          const thinkingCall = msg.content.find(p => p?.type === "toolCall" && p?.name === "sequential_thinking");
          if (thinkingCall) {
            let branchId = thinkingCall.arguments?.branchId;
            if (typeof thinkingCall.arguments === "string") {
              try {
                branchId = JSON.parse(thinkingCall.arguments).branchId;
              } catch {}
            }
            if (branchId && branchId !== activeBranchId) {
              return false; // Prune inactive branch thought
            }
          }
        }
      } else if (msg?.role === "toolResult") {
        if (msg.toolName === "sequential_thinking") {
          const callId = msg.toolCallId || msg.tool_call_id;
          const msgBranchId = (callId ? toolCallToBranchMap.get(callId) : undefined) || (msg as any).details?.branchId;
          if (msgBranchId && msgBranchId !== activeBranchId) {
            return false; // Prune inactive branch result
          }
        }
      }

      return true;
    });

    return { messages: prunedMessages };
  });
}

```

*   **`extensions/critic-review.ts`**: Audits a text or code draft in an isolated session against strict rules to prevent bugs, style leaks, or guideline violations.

```typescript
import { complete } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "critic_review",
    label: "Critic Review",
    description: "An objective, isolated auditing sandbox to review drafts of code, markdown, or config files against strict rules, security anti-patterns, formatting guidelines, and privacy constraints to guarantee zero confirmation bias before making writes.",
    parameters: Type.Object({
      draft: Type.String({ description: "The raw draft of code, config, or markdown text to audit." }),
      rules: Type.Optional(Type.Array(Type.String(), { description: "Optional list of strict rules or guidelines that the draft must comply with. If omitted, a general quality, security, and bug audit is performed." }))
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const hasRules = params.rules && params.rules.length > 0;
      const rulesFormatted = hasRules
        ? params.rules!.map((rule, idx) => `${idx + 1}. ${rule}`).join("\n")
        : "None provided. Perform a general audit for code quality, design anti-patterns, functional bugs, security vulnerabilities, and formatting consistency.";

      const systemPrompt = `You are an elite, merciless, and highly pragmatic code and document auditor operating in an isolated sandbox. Your goal is to review the provided draft with absolute objectivity.

${hasRules ? `STRICT RULES TO ENFORCE:\n${rulesFormatted}` : `GENERAL AUDIT GUIDELINES:\n${rulesFormatted}`}

CRITICAL OUTPUT FORMATTING INSTRUCTIONS:
1. If the draft is of high quality, fully complies with all rules, and has no functional bugs, security vulnerabilities, or syntax errors, output exactly the word "PASS" in all capital letters with absolutely no other text.
2. If there are issues, you must output them grouped into exactly these two categories:
   * [BLOCKING]: Severe functional bugs, syntax errors, security risks, or explicit violations of the strict rules.
   * [ADVISORY]: Style improvements, performance optimizations, design smells, or minor optional suggestions.
3. Each issue must be formatted strictly as a list item starting with either the '* [BLOCKING]' or '* [ADVISORY]' prefix.
4. Every issue must be contextualized with a line number using the format '(Line X)' or '(Global)' if the issue spans the entire file.
5. All code modifications or replacements within a fix must be formatted inside explicit fenced markdown code blocks.
   Example format:
   * [BLOCKING] (Line 12): Description of the issue.
     -> Fix:
     \`\`\`typescript
     if (a === b) {
     \`\`\`
6. Do not invent pedantic nitpicks (e.g. demanding comments, complaining about double vs single quotes, or minor spacing differences) unless they are explicitly violated by a strict rule.
7. If there are no [BLOCKING] issues, you must end your entire output with a "PASS" recommendation on a new line.`;

      try {
        const model = ctx.model;
        if (!model) {
          throw new Error("No active model found in current context.");
        }

        if (!ctx.modelRegistry) {
          throw new Error("Model registry is not available in current context.");
        }

        const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
        if (!auth.ok) {
          throw new Error(`Authentication failed for model ${model.provider}/${model.id}: ${auth.error}`);
        }

        const auditMessages = [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: `System Instruction: ${systemPrompt}\n\nPlease audit this draft:\n\n${params.draft}` }
            ],
            timestamp: Date.now()
          }
        ];

        const response = await complete(
          model,
          { messages: auditMessages },
          {
            apiKey: auth.apiKey,
            headers: auth.headers,
            signal
          }
        );

        const reviewResult = response.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("\n")
          .trim();

        return {
          content: [{
            type: "text",
            text: `[CRITIC AUDIT RESULT]\n\n${reviewResult}`
          }],
          details: { review: reviewResult }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: "text",
            text: `[CRITIC ERROR] Isolated session failed: ${errorMessage}`
          }],
          details: { error: errorMessage }
        };
      }
    },

    renderCall(args, theme, _context) {
      const draft = typeof args.draft === "string" ? args.draft.trim() : "";
      const lines = draft.split("\n");
      const countLines = lines.length;
      
      const headerText = theme.fg("toolTitle", theme.bold("critic_review")) + 
                         theme.fg("dim", ` (${countLines} lines)`);
      
      const previewLines = lines.slice(0, 6).map(l => {
        const truncatedLine = l.length > 100 ? `${l.slice(0, 97)}...` : l;
        return `  ${theme.fg("muted", truncatedLine)}`;
      }).join("\n");
      
      let text = headerText + `\n${previewLines}`;
      if (countLines > 6) {
        text += `\n  ${theme.fg("dim", "...")}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as { review?: string; error?: string } | undefined;
      
      if (details?.error) {
        return new Text(theme.fg("warning", `✗ ERROR: ${details.error}`), 0, 0);
      }

      const review = details?.review?.trim() || "";
      if (!review) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (review === "PASS") {
        return new Text(theme.fg("success", "✓ PASS"), 0, 0);
      }

      // Semantic Line Highlight and No-Truncation!
      const lines = review.split("\n");
      const formattedLines = lines.map(line => {
        const lower = line.toLowerCase();
        if (lower.includes("[blocking]") || lower.includes("blocking:")) {
          // Style blocking issues in bold red/warning color
          return theme.fg("warning", theme.bold(`  ${line.trim()}`));
        } else if (lower.includes("[advisory]") || lower.includes("advisory:")) {
          // Style advisories in dynamic/accent color
          return theme.fg("accent", `  ${line.trim()}`);
        } else if (lower.includes("pass")) {
          return theme.fg("success", `  ${line.trim()}`);
        }
        return `  ${line}`;
      }).join("\n");

      const titleBlock = theme.fg("warning", theme.bold("✗ AUDIT ISSUES DETECTED\n")) +
                         theme.fg("dim", "  " + "─".repeat(50) + "\n");
      const footerBlock = theme.fg("dim", "\n  " + "─".repeat(50));
      
      return new Text(titleBlock + formattedLines + footerBlock, 0, 0);
    }
  });
}
```

*   **`extensions/ask-question.ts`**: Provides an interactive terminal-based question-asking mechanism (`ask_question` tool) supporting simple text prompts, yes/no confirmation gates, single-selection menus with countdown timeouts and option descriptions, and a multi-tabbed interactive questionnaire wizard.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

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

      if (params.type === "multi") {
        const qs = params.questions || [];
        if (qs.length === 0) {
          throw new Error("Parameters error: 'questions' list is required when type is 'multi'.");
        }

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

        const totalTabs = questions.length + 1;

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
          const editor = new Editor(tui, editorTheme);

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
    }
  });
}
```

#### Installing bundled extensions
By copying the extensions directly to your `~/.pi/agent/extensions/` directory, Pi will **automatically discover and load them on startup** across any project, with no CLI arguments needed.

To install or restore these extensions permanently, execute these commands natively in **PowerShell**:

```powershell
# Create the auto-discovery directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "$HOME\.pi\agent\extensions"

# Copy the SSH Extension directly from your global node_modules installation
Copy-Item -Path "$env:APPDATA\npm\node_modules\@earendil-works\pi-coding-agent\examples\extensions\ssh.ts" -Destination "$HOME\.pi\agent\extensions\" -Force

# Copy the official Plan Mode Extension directly from global node_modules
Copy-Item -Path "$env:APPDATA\npm\node_modules\@earendil-works\pi-coding-agent\examples\extensions\plan-mode" -Destination "$HOME\.pi\agent\extensions\" -Recurse -Force
```

Alternatively

```bash
# macOS/Linux (Shell Commands)
mkdir -p ~/.pi/agent/extensions/plan-mode
curl -fLo ~/.pi/agent/extensions/ssh.ts https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/ssh.ts
curl -fLo ~/.pi/agent/extensions/plan-mode/index.ts https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/plan-mode/index.ts
curl -fLo ~/.pi/agent/extensions/plan-mode/utils.ts https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/plan-mode/utils.ts
```

> **Refresh Hook**: After adding files to your extensions folder, type `/reload` in your active Pi terminal to compile and load the new commands and hotkeys.

---

### Core Behavioral Instructions (`AGENTS.md`)
Defines the agent's core developer persona, step-by-step troubleshooting logic, communication style, self-evolution capabilities, and workspace execution rules. 

*   *Location:* `~/.pi/agent/AGENTS.md`

````markdown
# Configuration File Blueprint
The following files control the operational states, capabilities, and instruction boundaries of your engine within this workspace. If the .pi directory or any of these configuration files do not exist, create them natively.

## Project-Local Core Layers
- ./.pi/AGENTS.md: The behavioral and task instruction layer. Enforces project personas, development styles, step-by-step methodologies, self-evolution logic, and workspace execution policies. It shapes how the agent thinks, communicates, and navigates tasks in this repository. 
  > Loaded: Injected into the prompt stack at every chat turn to establish ongoing behavioral context.
- ./.pi/APPEND_SYSTEM.md: The environmental and runtime constraint layer. Hardcodes the underlying infrastructure parameters, platform-specific shell defaults (e.g., PowerShell syntax), strict file line-ending mechanics, compiler/linter rules, and absolute tool execution boundaries. It defines the rigid rules of what the environment permits.
  > Loaded: Appended directly into the core system instruction layer on every single LLM call.
- ./.pi/skills/[skill_name]/SKILL.md: Workspace-local skills. The user can manually create new project-specific skill directories and markdown instruction files here.
  > Loaded: Dynamically on demand when explicitly triggered using the use command.
  > Structural Blueprint: Every SKILL.md must begin with a YAML frontmatter block containing a mandatory description field to prevent skill conflicts:
    ---
    description: Clear, concise summary of what this specific skill does and when the engine should pull it into execution context.
    ---
    # Skill Instructions
    - Specific workflow step 1
    - Specific workflow step 2
- ./.pi/prompts/[prompt_name].md: Prompt templates are Markdown snippets that expand into full prompts. 
  > Loaded: Instantly expanded into the chat input stream when typing /[prompt_name]. Requires a /reload to register new template shortcuts.
- ./.pi/extensions/[extension_name].ts: Workspace-local TypeScript modules. The user can manually create or modify custom .ts script files here to compile and build new custom tools directly into the active tool inventory for this repository. 
  > Loaded: Compiled and registered into the active tool-calling inventory only after running the /reload command.
  > Structural Blueprint: Extensions must export a default factory function accepting ExtensionAPI, utilizing TypeBox for parameters, and sourcing core types strictly from the agent harness:
    import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
    import { Type } from "@sinclair/typebox";
    export default function (pi: ExtensionAPI) {
      pi.registerTool({
        name: "custom_tool_name",
        description: "What the tool does",
        parameters: Type.Object({ ... }),
        async execute(id, params, signal, update, ctx) { ... }
      });
    }

# Project-Local Self-Evolution
- ./EVOLUTION.md: Dynamic long-term memory layer containing automated environment adjustments written by the agent inside the active repository. 
  > Loaded: Read continuously by the context retrieval loops during tool execution.
- Monitor Redundant Failures: If you encounter an execution, configuration, or tool error more than once and identify a definitive fix unique to this repository, treat this as permanent project memory.
- Record Successful Custom Commands: If you discover or construct a non-obvious, complex, or highly effective command (e.g., unique database migrations, test runs, environment setups, or build pipelines) that succeeds, treat this as permanent project knowledge. Autonomously document it in ./EVOLUTION.md under a 'Useful Commands' section so it can be reused in future sessions without re-discovery.
- Update Local Workspace Memory: Autonomously use the write or edit tool to append the rule or command directly to the bottom of ./EVOLUTION.md inside the current working directory. If ./EVOLUTION.md does not exist yet, create it with a clean markdown title header.
- Multi-Layer Evolution Evaluation: When capturing a workflow fix, evaluate the structural complexity of the lesson to determine the best target path for expansion:
  - For standard runtime workarounds or tool line-matching adjustments, append directly to ./EVOLUTION.md.
  - If a skill file is currently being executed, prioritize updating that skill's markdown file first while preserving its mandatory frontmatter description layout.
  - For complex or highly structured multi-step recovery workflows, consider framing the solution by writing a brand new dedicated skill file in ./.pi/skills/ with valid frontmatter or an isolated prompt template inside ./.pi/prompts/.
- Formulating System-Level Evolution: For permanent, unbreakable environment laws, architecture dependencies, or platform-level constraints discovered during troubleshooting, consider making clean additions to ./.pi/APPEND_SYSTEM.md to lock those rules into the core system layer. For overarching changes to persona, communication strategies, development philosophies, or task navigation policies, make corresponding clean additions to ./.pi/AGENTS.md.
- Context Window and Resource Guardrails: To maintain engine performance and prevent file corruption during autonomous updates, you must adhere to these operational constraints:
  - Context Bloat Prevention: Do not append long, verbose troubleshooting histories or raw execution logs to system-level files like ./.pi/APPEND_SYSTEM.md or ./.pi/AGENTS.md. Because these are injected on every turn, keeping them highly concise, only editing them when essential, protects token availability and minimizes inference latency. Use ./EVOLUTION.md or dedicated skills for specific codebase fixes.
  - Output Token Conservation: When appending rules or workarounds, keep updates focused and modular. Writing massive text blocks or completely rewriting files at the end of a long debugging session risks hitting maximum output token limits mid-write, causing file truncation or corruption. Utilize targeted edit patches and concise bullet points.
- Compilation and Refresh Boundaries: Understand that markdown memory files (./EVOLUTION.md, ./.pi/AGENTS.md) and on-demand skills (via the use command) are processed dynamically without engine interruptions. However, if changes or additions are made to programmatic extensions (.ts tools) or prompt templates, explicitly request the user to execute the /reload command so the updates compile.
- Formatting Guidelines: Write rules as clean, project-specific bullet points under explicit markdown headers describing the problem space. Do not modify configuration files directly unless addressing permanent, baseline system layer or behavioral policy adjustments.
- Notification: Notify the user immediately after updating a local file or creating a new asset so they know a project-specific memory or tool extension has been committed to the repository.
````

---

### Environmental Constraints (`APPEND_SYSTEM.md`)
Hardcodes environmental parameters, terminal shells, linter requirements, and file writing syntax rules to ensure the agent operates strictly within the host system's bounds.

*   *Location:* `~/.pi/agent/APPEND_SYSTEM.md`

````markdown
# System Environment
- This machine runs Windows utilizing PowerShell 7 / Windows PowerShell.
- Use uv for all Python-related commands (e.g., uv run, uv pip, uv venv).
- When using the bash tool locally to run PowerShell cmdlets, always prefix with powershell -Command "...".
- Use native PowerShell cmdlets (e.g., Get-ChildItem instead of ls, Get-Content instead of cat, and Select-String instead of grep) ONLY when operating on the local Windows environment.
- Do not attempt to use Linux-specific bash pipeline syntax locally.
- **IMPORTANT**: If your Current Working Directory indicates you are operating "(via SSH: ...)", you are connected to a remote Linux machine. Disregard the Windows/PowerShell enforcement rules above and use standard Unix bash syntax.

# File Editing & Line Ending Rules
- When reading, writing, or using the edit tool on local files, assume the workspace utilizes standard Unix newlines (\n). 
- Do not match lines across multi-line blocks using explicit literal \r\n characters inside tool search blocks. 
- When generating replacement code blocks for files, ensure your text patches do not accidentally inject duplicate blank carriage returns. Keep line structures clean and predictable.
````

---

### Workspace Skills (`skills/`)
Specialized Markdown instruction checklists loaded dynamically on demand using the `use` command.

*   **`plan/SKILL.md`**: A checklist-driven architecture framework used to analyze requirements, map file impacts, design solutions, and outline step-by-step task lists before writing code.

````markdown
---
name: plan
description: A generic framework and blueprint for analyzing, proposing, structuring, and tracking the step-by-step execution of any engineering task.
---

# Generic Project Plan Framework

This skill provides a structured blueprint for creating and tracking project plans. It is meant to be loaded at the start of any complex engineering task and written as a localized file (e.g., `PLAN.md` or `.pi/skills/plan/SKILL.md`) to guide implementation.

## Plan Blueprint & Structure

Every project plan created using this blueprint should follow this structure:

### 1. Requirement Analysis
- **Goal**: Clear, measurable description of what is being built or modified.
- **Scope**: Boundaries of the task (what is included, and what is explicitly excluded).
- **Key Constraints**: Platform requirements, architectural rules, performance limits.

### 2. Impact Analysis
- **Files to Modify/Create**: Precise list of code locations that will be touched.
- **Dependencies**: Affected modules, imports, schemas, or APIs.
- **Risks**: Potential side-effects, regressions, or breaking changes.

### 3. Proposed Solution Design
- **Architecture**: Design patterns, data model definitions, or logic flow.
- **APIs/Interfaces**: Specifications of any new entry points or endpoints.
- **Mockups/Mock Data** (if applicable).

### 4. Step-by-Step Implementation Plan
Break down the implementation into discrete, sequentially dependent, and atomic tasks. Use standard markdown checkboxes:

- [ ] **Step 1**: Describe atomic task 1 (e.g., initial setup, basic types, or mock file).
- [ ] **Step 2**: Describe atomic task 2 (e.g., core logic implementation).
- [ ] **Step 3**: Describe atomic task 3 (e.g., interface wiring or CLI script).
- [ ] **Step 4**: Describe atomic task 4 (e.g., polishing, formatting, final checks).

### 5. Verification and Testing
For every checkbox step, define the explicit, repeatable verification check (e.g., a specific terminal command, lint script, or unit test run):
- **Test 1**: Verify Step 1 succeeds by running `...`.
- **Test 2**: Verify Step 2 succeeds by checking `...`.

### 6. Reflection & Self-Correction
- **At each step**: Reflect on any test errors or compilation failures. Leverage the `sequential_thinking` tool to systematically analyze complex failures before editing files. *Tip: Always list your active reasoning micro-checklist at the top of your thoughts and use `[ ]` and `[x]` to track your progress through the steps.*
- **Unblock High-Impact Ambiguities**: If you hit a high-stakes design branch (e.g., choosing a major framework or architectural pattern), a requirement contradiction, or a destructive environment step, **if the `ask_question` tool is active**, invoke it immediately to get user alignment. For low-impact choices (e.g., naming conventions, utility layouts, or standard refactors), make the call autonomously using your best judgment—do not nag the user for micro-decisions.
- **Pre-Write Critique**: Before calling `write` or `edit` on important code or configuration files, **if the `critic_review` tool is active in your current tool list**, pass your draft through it against the project guidelines (e.g. unnumbered headings and maximum privacy). If the tool is unavailable, perform an active, manual self-critique pass in your thoughts to check for strict constraints before writing.
- **Documentation**: Record lessons learned and project-specific memory adjustments directly into `EVOLUTION.md`.
````

*   **`plan_executor/SKILL.md`**: An autonomous execution playbook designed to methodically run task lists, verify each stage using local terminal checks, and track execution states.

````markdown
---
name: plan-executor
description: A generic, autonomous execution engine designed to methodically burn down checklists, verify each step using local tools, and persist progress state.
---

# Plan Executor Skill

This skill provides a highly disciplined, stateful loop for executing multi-step project plans. It is designed to act as a robust state machine, methodically carrying out each checkbox task sequentially, running verification commands, and updating the checklist state.

## Autonomous Execution Routine

When you enter autonomous execution mode for a plan, you must transition into this strict, noiseless loop. Avoid conversational filler or pauses. Let your tool calls do the work.

### The 5-Step Execution Loop

1. **Locate & Read the Plan**:
   - Locate the active checklist file in the workspace (e.g., `PLAN.md` or `.pi/skills/plan/SKILL.md`).
   - Call `read` on this file to parse its current state.

2. **Isolate the Target Checkbox**:
   - Identify the highest priority unmarked checkbox `[ ]` in the implementation sequence.
   - If all checkboxes are marked `[x]`, output a final success summary and gracefully exit the loop.

3. **Surgical Implementation**:
   - Focus 100% of your attention on implementing *only* the current step. Do not skip ahead or address future tasks.
   - Use `read` and the highly precise `edit` tool (with single/batched precise edits) to make the code changes required.
   - **Resolve Macro Blocks, Decide Micro Autonomously**: While implementing a step, use your own engineering judgment to make minor implementation decisions (naming, syntax, minor utilities) and keep building. Only invoke the `ask_question` tool if you hit a high-level blocker (e.g., introducing a heavy new library, missing sensitive credentials, or conflicting architectural requirements) where guessing could cause severe regressions.

4. **Verify the Step**:
   - Run the specified verification checks, compile commands, or unit tests using `bash` (e.g., executing a local testing script or platform check).
   - If the verification fails, do not blindly edit files. Leverage the `sequential_thinking` tool to analyze the error log, weigh alternative corrections, and design a clean fix before re-testing. *Tip: Write out your active reasoning checklist at the top of your thoughts and use `[ ]` and `[x]` to track your progress through each corrective step.*
   - Before writing the correction to disk, **if the `critic_review` tool is active in your current tool inventory**, pass the draft code through it against the active workspace rules and resolve any `[BLOCKING]` failures. If the tool is not available in this environment, perform a manual self-critique pass inside your thoughts to ensure compliance before writing. Do not mark the step complete until the test passes.

5. **Update and Recycle**:
   - Use the `edit` tool to change the current target checkbox from `[ ]` to `[x]`.
   - Immediately loop back to Step 1 by issuing another `read` tool call on the plan file to load the next state.

## Best Practices for Execution

- **Strict Task Bound**: Never implement parts of Step 3 while executing Step 2. Keep code diffs small, focused, and sequentially clean.
- **Fail Early**: If a compile check fails, do not proceed. Treat verification failures as blocking exceptions.
- **State Capture**: If you are interrupted or your session resets, the physical `[x]` markings in your plan file will allow you to instantly resume from the exact step you left off.
- **Dynamic Adaptability**: If a step reveals that subsequent steps are incorrect or unfeasible, modify the remaining checkboxes in the plan file using `edit`, and then continue.
````

*   **`audit/SKILL.md`**: Run a high-speed, isolated security, quality, and style audit on the active file or workspace.

````markdown
---
name: audit
description: Run a high-speed, isolated security, quality, and style audit on the active file or workspace.
---

# Audit Skill

This skill provides a highly disciplined auditing routine to inspect workspace code, configurations, and documentation drafts before making permanent writes. It is designed to be fully portable across any environment or repository.

## Audit Execution Routine

When you are asked to audit a file, project, or draft, load this skill and carry out these checks systematically.

### 1. Isolate the Target
- Identify the specific file, module, or code draft that needs to be audited.
- Read its contents to parse its current state.

### 2. Formulate the Constraints
Identify the active constraints for the audit. In any environment, you must check for these three core pillars:
- **Logical Correctness**: Syntax errors, broken imports, missing reference objects, or unhandled errors.
- **Security & Privacy Constraints**: Exposed secrets, private API keys, or personal identifying data (maximum privacy).
- **Style & Formatting Guidelines**: Project-local file preferences, carriage return formatting, or specific rules (such as avoiding numbered headings in Markdown).

### 3. Execute the Critique Pass
- **Automated Critique Option**: If the `critic_review` tool is active in your current tool inventory, execute it on your draft. **Crucially**, pass your code into the `draft` parameter, and pass your formulated constraints as an array of strings directly into the `rules` parameter.
- **Manual Self-Critique Fallback**: If no automated review tools are available in your current environment, perform a manual, structured self-critique pass within your thoughts, systematically grading your draft against each of the three core pillars.

### 4. Process Findings & Correct
- Group findings into two severity levels:
  - **Blocking**: Severe bugs, security vulnerabilities, or absolute guideline violations that must be corrected.
  - **Advisory**: General stylistic advice, minor performance optimizations, or optional feedback.
- If blocking errors are found, use the `sequential_thinking` tool to analyze alternative corrections, plan a surgical fix, and re-audit the updated draft.
````

---

### General AI Skills Tool (`npx skills`)

The `npx skills` command allows you to dynamically fetch and run pre-configured visual diagram and charting tools within your workspace.

```bash
# Pretty Mermaid - Render rich markdown diagrams in VS Code
npx skills add https://github.com/imxv/pretty-mermaid-skills --skill pretty-mermaid

# Chart Visualization - Render plots and charts via AntV
npx skills add antvis/chart-visualization-skills

# Tip: Search for more developer skills:
npx skills find <keyword>
```
