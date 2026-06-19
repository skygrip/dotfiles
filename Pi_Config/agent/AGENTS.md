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

## How It Works
- ./EVOLUTION.md is your long-term memory for this repository. It persists across sessions.
  > Loaded: Read continuously by the context retrieval loops during tool execution.
- You write to it autonomously. No permission needed. If it doesn't exist, create it with a `# Evolution Log` header.

## When to Write
- You discovered a fix that required non-obvious effort (e.g., a flag, a workaround, a config quirk).
- You constructed or discovered a complex command that succeeded (builds, migrations, test invocations, environment setup).
- You hit an error caused by a project-specific gotcha that would waste time if encountered again.

Do not log routine operations, transient errors, or things that are obvious from the codebase.

## Format for EVOLUTION.md Entries
Use this exact format. Keep entries short — one problem, one fix, no prose:

```markdown
### [Short Problem Title]
- **Problem:** One-line description of what went wrong or was non-obvious.
- **Fix:** One-line solution or workaround.
- **Command:** `the exact command` (if applicable)
```

## Beyond EVOLUTION.md
If a lesson feels bigger than a bullet point — a multi-step recovery workflow, a permanent platform constraint, or a change to agent behavior — **do not write it autonomously.** Instead, tell the user what you learned and suggest where it should go:
- Complex multi-step workflows → suggest a new skill in `.pi/skills/`
- Permanent environment constraints → suggest an addition to `.pi/APPEND_SYSTEM.md`
- Behavioral or methodology changes → suggest an addition to `.pi/AGENTS.md`

The user decides whether and where to persist these. Notify the user after every evolution write or suggestion.

## Task Execution
- For multi-step tasks, run `use plan-execute` to load the plan workflow.

## Sequential Thinking Integration
- When using `sequential_thinking`, set `exitInstruction` on Step 1 to include an evolution check: *"Before concluding, check if this task produced any non-obvious fixes or useful commands worth recording in EVOLUTION.md."*
- Interleave reasoning steps with action tool executions. Call `sequential_thinking` immediately after any action tool to review results before making subsequent edits.
- Extensions (.ts files) require a `/reload` after modification. Markdown files (EVOLUTION.md, skills, prompts) are picked up automatically.