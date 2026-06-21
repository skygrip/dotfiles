---
name: agent-config
description: Blueprints, templates, and documentation references for writing Extensions, custom Skills, and Prompt Templates. Use when creating or modifying Pi Coding Agent configurations.
---

# Agent Configuration Blueprint

This skill contains the configuration blueprint and documentation index for the Pi Coding Agent.

## When to Use This Skill
- Creating or editing `.pi/AGENTS.md` or `.pi/APPEND_SYSTEM.md`
- Writing a new skill (`SKILL.md`)
- Writing a new extension (`.ts` file)
- Writing a new prompt template (`.md` under `.pi/prompts/`)
- Exploring what is currently configured

## Which File Do I Edit?

| Goal | File |
|---|---|
| Change how the agent thinks, communicates, or behaves | `.pi/AGENTS.md` |
| Change environment, shell, or line-ending rules | `.pi/APPEND_SYSTEM.md` |
| Add a reusable workflow the agent can be invoked into | `.pi/skills/[name]/SKILL.md` |
| Add a new custom tool (TypeScript) | `.pi/extensions/[name].ts` |
| Add a prompt shortcut | `.pi/prompts/[name].md` |

## Exploring Current Configuration

Before making changes, read the existing config (both project-local and global) to understand what is already defined:

### Project-Local Config
```bash
cat .pi/AGENTS.md          # active behavioral rules
cat .pi/APPEND_SYSTEM.md   # environment constraints
ls .pi/skills/             # available skills
ls .pi/extensions/         # registered tools
ls .pi/prompts/            # available prompt shortcuts
```

### Global Config
```bash
cat ~/.pi/agent/AGENTS.md          # global behavioral rules
cat ~/.pi/agent/APPEND_SYSTEM.md   # global environment constraints
ls ~/.pi/agent/skills/             # global available skills
ls ~/.pi/agent/extensions/         # global registered tools
ls ~/.pi/agent/prompts/            # global available prompt shortcuts
```


---

## Configuration File Blueprint
The following files control the operational states, capabilities, and instruction boundaries of your engine within this workspace. If the `.pi` directory or any of these configuration files do not exist, create them natively.

### Project-Local Core Layers
- `./.pi/AGENTS.md`: The behavioral and task instruction layer. Enforces project personas, development styles, step-by-step methodologies, self-evolution logic, and workspace execution policies. It shapes how the agent thinks, communicates, and navigates tasks in this repository.
  > Loaded: Injected into the prompt stack at every chat turn to establish ongoing behavioral context.
- `./.pi/APPEND_SYSTEM.md`: The environmental and runtime constraint layer. Hardcodes the underlying infrastructure parameters, platform-specific shell defaults (e.g., PowerShell syntax), strict file line-ending mechanics, compiler/linter rules, and absolute tool execution boundaries. It defines the rigid rules of what the environment permits.
  > Loaded: Appended directly into the core system instruction layer on every single LLM call.
- `./.pi/skills/[skill_name]/SKILL.md`: Workspace-local skills. The user can manually create new project-specific skill directories and markdown instruction files here.
  > Loaded: Dynamically on demand when explicitly triggered using the `use` command.
  > Structural Blueprint: Every SKILL.md must begin with a YAML frontmatter block containing a mandatory `description` field to prevent skill conflicts:
    ```yaml
    ---
    description: Clear, concise summary of what this specific skill does and when the engine should pull it into execution context.
    ---
    ```
    Followed by:
    ```markdown
    # Skill Instructions
    - Specific workflow step 1
    - Specific workflow step 2
    ```
    > Tip: If in doubt, validate a new skill against an existing one in `.pi/skills/` before saving.
- `./.pi/prompts/[prompt_name].md`: Prompt templates are Markdown snippets that expand into full prompts.
  > Loaded: Instantly expanded into the chat input stream when typing `/[prompt_name]`. Requires a `/reload` to register new template shortcuts.
- `./.pi/extensions/[extension_name].ts`: Workspace-local TypeScript modules. The user can manually create or modify custom `.ts` script files here to compile and build new custom tools directly into the active tool inventory for this repository.
  > Loaded: Compiled and registered into the active tool-calling inventory only after running the `/reload` command.
  > Documentation: Refer to `@earendil-works/pi-coding-agent/docs/extensions.md` (located inside the global `node_modules` directory of the `pi` installation) for complete documentation on extension APIs, including registering commands, tool interceptors (`pi.on("tool_call")`), and TUI UI helpers.
  > Structural Blueprint: Extensions must export a default factory function accepting `ExtensionAPI`, utilizing TypeBox for parameters, and sourcing core types strictly from the agent harness. Validate against an existing extension in `.pi/extensions/` if unsure about the signature.
    ```typescript
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
    ```

---

## Official Documentation Index
For advanced customization, UI design, and session internals, refer to these files located inside the global `node_modules` directory of the `pi` installation (under `@earendil-works/pi-coding-agent/docs/`):
- **Core Architecture & TUI:** `docs/tui.md` (UI rendering), `docs/themes.md` (styling), `docs/keybindings.md` (shortcuts).
- **Session Lifecycle & Internals:** `docs/session-format.md` (message entry schemas), `docs/sessions.md` (branches, leaves), `docs/compaction.md` (pruning).
- **Configuration & Integration:** `docs/settings.md` (settings.json options), `docs/packages.md` (custom packaging), `docs/usage.md` (flags & CLI).
