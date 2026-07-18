---
name: agent-config
description: Blueprints and docs for Extensions, Skills, and Prompt Templates. Use when modifying agent configuration.
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

| Goal | File / Path | Note |
|---|---|---|
| Change how the agent thinks, communicates, or behaves | `.pi/AGENTS.md` | Primary behavioral rules. Alternative files like `CLAUDE.md` or `SYSTEM.md` are supported but discouraged; stick to `AGENTS.md`. |
| Change environment, shell, or line-ending rules | `.pi/APPEND_SYSTEM.md` | Primary environmental constraint layer. |
| Add a reusable workflow the agent can be invoked into | `.pi/skills/[name]/SKILL.md` or `.agents/skills/[name]/SKILL.md` | See Skills Blueprint below. |
| Add a new custom tool (TypeScript) | `.pi/extensions/[name].ts` | See Extensions Blueprint below. |
| Add a prompt shortcut | `.pi/prompts/[name].md` | Expands into prompt templates. |
| Change the appearance of the agent UI | `.pi/themes/[name].json` | JSON theme configurations. |
| Route models or add custom APIs / providers | `~/.pi/agent/models.json` | Or write a TypeScript provider extension. |
| Share and package agent skills or extensions | `package.json` | Configure a `"pi"` package key. |

## Exploring Current Configuration

Before making changes, read the existing config (both project-local and global) to understand what is already defined:

### Project-Local Config
```bash
cat .pi/AGENTS.md          # active behavioral rules
cat .pi/APPEND_SYSTEM.md   # environment constraints
ls .pi/skills/             # available skills
ls .pi/extensions/         # registered tools
ls .pi/prompts/            # available prompt shortcuts
ls .pi/themes/             # custom themes
```

### Global Config
```bash
cat ~/.pi/agent/AGENTS.md          # global behavioral rules
cat ~/.pi/agent/APPEND_SYSTEM.md   # global environment constraints
ls ~/.pi/agent/skills/             # global available skills
ls ~/.pi/agent/extensions/         # global registered tools
ls ~/.pi/agent/prompts/            # global available prompt shortcuts
ls ~/.pi/agent/themes/             # global custom themes
cat ~/.pi/agent/models.json        # model/provider configurations
```

## Reloading Config

Some configurations are parsed dynamically, while others require manual reloading:
* **Auto-loaded (Refreshed on demand):**
  * Context files (`AGENTS.md`, `APPEND_SYSTEM.md`)
  * Skills (`SKILL.md`)
  * Themes (reloads automatically when the active theme file is saved)
* **Manual Reload (Requires typing `/reload` in the editor):**
  * Prompt templates (`.pi/prompts/*.md`)
  * TypeScript extensions (`.pi/extensions/*.ts`)

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
  > Pi Discovery Paths: In addition to `./.pi/skills/`, Pi searches for skills in `./.agents/skills/`, `~/.pi/agent/skills/`, and `~/.agents/skills/`.
  > Naming & Path Constraints:
    - The skill folder name must exactly match the YAML frontmatter `name`.
    - The name must be 1–64 characters, using lowercase letters, digits, and hyphens (no leading, trailing, or consecutive hyphens).
    - All file path references inside the skill instructions must be relative to the skill directory (no `{baseDir}` placeholders are supported).
  > Structural Blueprint: Every SKILL.md must begin with a YAML frontmatter block containing `name` and a mandatory `description` field:
    ```yaml
    ---
    name: my-skill
    description: Clear, concise summary of what this specific skill does (crucial for auto-trigger matching).
    # Optional fields:
    license: MIT
    compatibility: ">=1.0.0"
    metadata:
      key: value
    disable-model-invocation: true     # when true, Pi won't auto-trigger the skill; user must call via /skill:my-skill
    allowed-tools: []                  # (Experimental) restricts tool execution permissions
    ---
    ```
    Followed by:
    ```markdown
    # Skill Instructions
    - Specific workflow step 1
    - Specific workflow step 2
    ```
  > Multi-file Structure: For complex skills, organize them using the following subdirectories under the skill directory:
    - `scripts/`: Optional helper scripts for deterministic tasks.
    - `references/`: Optional documentation or reference manuals loaded on demand.
    - `assets/`: Optional templates, boilerplates, or static assets.
    - Layout:
      ```text
      [skill_name]/
      ├── SKILL.md
      ├── README.md         # Optional human summary / installation guide
      ├── scripts/          # Helper scripts
      ├── references/       # Static references
      └── assets/           # Templates & assets
      ```
  > Best Practices for Designing Skills:
    - **Targeted Triggers:** Keep the frontmatter `description` highly specific to prevent the agent from loading the skill on unrelated tasks.
    - **Script Repetitive Logic:** Put complex or repetitive logic (e.g. file parsing, compiler validation) in the `scripts/` folder rather than listing manual instructions for the agent.
    - **Sequential Verification:** Write step-by-step instructions. Always include validation commands at the end of key milestones so the agent can self-correct.
    - **Scope via Use Cases:** Clarify triggers and expectations by identifying 2–4 concrete example requests first.
  > Tip: If in doubt, validate a new skill against an existing one in `.pi/skills/` before saving.
- `./.pi/prompts/[prompt_name].md`: Prompt templates are Markdown snippets that expand into full prompts.
  > Loaded: Instantly expanded into the chat input stream when typing `/[prompt_name]`. Requires a `/reload` to register new template shortcuts.
  > Structural Blueprint:
    ```markdown
    ---
    description: Review staged git changes
    argument-hint: "[optional-arg] <required-arg>" # Optional hint for autocomplete dropdown
    ---
    Review the staged changes. Arguments can be referenced via $1, $2, or $@ (all arguments joined).
    Default values can be supplied: ${1:-default_value}.
    ```
  > Best Practices for Designing Prompts:
    - **Single-Action Focus:** Design templates for specific, repetitive tasks (e.g., `/review`, `/scaffold-component`) rather than generic conversation.
    - **Clear Argument Hints:** Always define `argument-hint` in the frontmatter using `<angle brackets>` for required parameters and `[square brackets]` for optional ones.
    - **Robust Argument Fallbacks:** Use `${1:-default}` to supply sensible default fallbacks when arguments are omitted.
    - **Positional vs. Global Arguments:** Use `$1`, `$2` for precise positioning, and `$@` or `$ARGUMENTS` when you want to pass all trailing user text directly to the prompt.
- `./.pi/themes/[theme_name].json`: Workspace-local JSON themes.
  > Loaded: Selected via `settings.json` or `/settings`. Hot-reloads dynamically upon file edits.
  > Structural Blueprint: Every theme must specify all required color tokens.
    ```json
    {
      "$schema": "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
      "name": "my-theme",
      "vars": {
        "primary": "#00aaff",
        "secondary": 242
      },
      "colors": {
        "accent": "primary",
        "border": "primary",
        "borderAccent": "#00ffff",
        "success": "#00ff00",
        "error": "#ff0000",
        "warning": "#ffff00",
        "muted": "secondary",
        "text": ""
      }
    }
    ```
- `./.pi/extensions/[extension_name].ts`: Workspace-local TypeScript modules. The user can manually create or modify custom `.ts` script files here to compile and build new custom tools directly into the active tool inventory for this repository.
  > Loaded: Compiled and registered into the active tool-calling inventory only after running the `/reload` command.
  > Documentation: Refer to `@earendil-works/pi-coding-agent/docs/extensions.md` (located inside the global `node_modules` directory of the `pi` installation) for complete documentation on extension APIs, including registering commands, tool interceptors (`pi.on("tool_call")`), and TUI UI helpers.
  > Structural Blueprint: Extensions must export a default factory function accepting `ExtensionAPI`, utilizing TypeBox for parameters, and sourcing core types strictly from the agent harness. Validate against an existing extension in `.pi/extensions/` if unsure about the signature.
    ```typescript
    /**
     * @fileoverview Example Pi Coding Agent Extension.
     * @description Registers custom tools, commands, UI renders, or lifecycle hooks.
     * @author [Author Name]
     * @version 1.0.0
     */

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

These files are located inside the global `node_modules` directory of the `pi` installation under `@earendil-works/pi-coding-agent/docs/`.

### Finding the Documentation Directory
Use the following references to locate the files on your system:
* **Locate via Terminal:** `npm root -g` (appends `/@earendil-works/pi-coding-agent/docs/`)
* **Default Windows Path:** `%AppData%\npm\node_modules\@earendil-works\pi-coding-agent\docs\`
* **Default Linux/macOS Path:** `/usr/local/lib/node_modules/@earendil-works/pi-coding-agent/docs/`
* **NVM Linux/macOS Path:** `~/.nvm/versions/node/v[version]/lib/node_modules/@earendil-works/pi-coding-agent/docs/`

Files:
- **Skills & Prompts:** `docs/skills.md` (Agent Skills), `docs/prompt-templates.md` (Prompt templates).
- **Extensions & API:** `docs/extensions.md` (TypeScript extensions), `docs/custom-provider.md` (Custom LLM providers), `docs/sdk.md` (Pi SDK).
- **Models & Routing:** `docs/models.md` (LLM configuration), `docs/providers.md` (API providers).
- **Core Architecture & TUI:** `docs/tui.md` (UI rendering), `docs/themes.md` (styling), `docs/keybindings.md` (shortcuts).
- **Session Lifecycle & Internals:** `docs/session-format.md` (message entry schemas), `docs/sessions.md` (branches, leaves), `docs/compaction.md` (pruning).
- **Configuration & Integration:** `docs/settings.md` (settings.json options), `docs/packages.md` (custom packaging), `docs/usage.md` (flags & CLI).
