---
name: agent-config
description: Blueprints and docs for Extensions, Skills, Settings, MCP, and Prompt Templates. Use when modifying agent configuration.
---

# Agent Configuration Blueprint

This skill contains the configuration blueprint and documentation index for the Pi Coding Agent (`@earendil-works/pi-coding-agent`).

## When to Use This Skill
- Creating or editing `.pi/AGENTS.md` or `.pi/APPEND_SYSTEM.md`
- Writing a new skill (`SKILL.md`)
- Writing a new extension (`.ts` file) or registering tools/commands
- Writing a new prompt template (`.md` under `.pi/prompts/`)
- Configuring `settings.json`, `mcp.json`, or custom `models.json`
- Exploring what is currently configured

## Which File Do I Edit?

| Goal | File / Path | Note |
|---|---|---|
| Change how the agent thinks, communicates, or behaves | `.pi/AGENTS.md` | Primary behavioral rules. |
| Change environment, shell, or line-ending rules | `.pi/APPEND_SYSTEM.md` | Primary environmental constraint layer. |
| Configure global/project agent behavior, theme, editor | `~/.pi/agent/settings.json` or `.pi/settings.json` | Set `theme`, `defaultModel`, `externalEditor: "code --wait"`. |
| Connect Model Context Protocol (MCP) servers | `~/.pi/agent/mcp.json` or `.pi/mcp.json` | Configure external stdio/HTTP MCP tools. |
| Add a reusable workflow the agent can be invoked into | `.pi/skills/[name]/SKILL.md` or `.agents/skills/[name]/SKILL.md` | See Skills Blueprint below. |
| Add a new custom tool or command (TypeScript) | `.pi/extensions/[name].ts` | See Extensions Blueprint below. |
| Add a prompt shortcut | `.pi/prompts/[name].md` | Expands into prompt templates. |
| Change the appearance of the agent UI | `.pi/themes/[name].json` | JSON theme configurations. |
| Route models or add custom APIs / providers | `~/.pi/agent/models.json` | Local LLM and custom OpenAI-compatible endpoints. |
| Share and package agent skills or extensions | `package.json` | Configure a `"pi"` package key. |

## Exploring Current Configuration

Before making changes, read the existing config (both project-local and global) to understand what is already defined:

### Project-Local Config
```bash
cat .pi/AGENTS.md          # active behavioral rules
cat .pi/APPEND_SYSTEM.md   # environment constraints
cat .pi/settings.json      # local workspace settings
cat .pi/mcp.json           # local MCP servers
ls .pi/skills/             # available skills
ls .pi/extensions/         # registered tools
ls .pi/prompts/            # available prompt shortcuts
ls .pi/themes/             # custom themes
```

### Global Config
```bash
cat ~/.pi/agent/AGENTS.md          # global behavioral rules
cat ~/.pi/agent/APPEND_SYSTEM.md   # global environment constraints
cat ~/.pi/agent/settings.json      # global settings (theme, default model)
cat ~/.pi/agent/mcp.json           # global MCP servers
cat ~/.pi/agent/models.json        # custom model/provider endpoints
ls ~/.pi/agent/skills/             # global available skills
ls ~/.pi/agent/extensions/         # global registered tools
ls ~/.pi/agent/prompts/            # global available prompt shortcuts
ls ~/.pi/agent/themes/             # global custom themes
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
  * Settings & MCP updates (`settings.json`, `mcp.json`, `models.json`)

---

## Configuration File Blueprint

### 1. Project-Local Core Layers
- `./.pi/AGENTS.md`: Behavioral instruction layer (personas, development style, step-by-step methodologies, execution policies).
  > Loaded: Injected into the prompt stack at every chat turn to establish ongoing behavioral context.
- `./.pi/APPEND_SYSTEM.md`: Environmental constraint layer (platform shell defaults, tool rules, no-cd constraints).
  > Loaded: Appended directly into the core system instruction layer on every single LLM call.

### 2. Settings & MCP Configuration
- `settings.json` (`~/.pi/agent/settings.json` or `.pi/settings.json`):
  ```json
  {
    "theme": "my-theme",
    "defaultModel": "local-llama/unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL",
    "externalEditor": "code --wait",
    "quiet": false
  }
  ```
- `mcp.json` (`~/.pi/agent/mcp.json` or `.pi/mcp.json`):
  ```json
  {
    "mcpServers": {
      "openscad": {
        "command": "uv",
        "args": ["run", "openscad-mcp"],
        "env": {
          "OPENSCAD_PATH": "C:/Program Files/OpenSCAD/openscad.exe"
        }
      }
    }
  }
  ```

### 3. Model Providers Blueprint (`models.json`)
Configure local LLMs (Ollama, LM Studio, vLLM, llama.cpp) or custom OpenAI-compatible endpoints in `~/.pi/agent/models.json`:
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
          "name": "Local Gemma 4 12B",
          "input": ["text"],
          "contextWindow": 131072,
          "maxTokens": 4096
        }
      ]
    }
  }
}
```

### 4. Skills Blueprint (`SKILL.md`)
- `./.pi/skills/[skill_name]/SKILL.md`: Workspace-local skills.
  > Loaded: 
    - **Auto-Discovery**: Pi automatically indexes the `name` and `description` into the agent's system prompt at session start for autonomous invocation on relevant tasks.
    - **User Invocation**: Manually triggered in the TUI via `/skill:[skill_name] [arguments]`.
    - **Prompt Directives**: Can be referenced in prompts (e.g., "Use our `plan-execute` skill").
  > Discovery Paths: `./.pi/skills/`, `./.agents/skills/`, `~/.pi/agent/skills/`, `~/.agents/skills/`.
  > Naming & Path Constraints:
    - Folder name must exactly match the YAML frontmatter `name`.
    - Name must be 1–64 characters, lowercase letters, digits, and hyphens (no leading, trailing, or consecutive hyphens).
    - All file path references inside the skill instructions must be relative to the skill directory.
  > Structural Blueprint:
    ```yaml
    ---
    name: my-skill
    description: Clear, concise summary of what this specific skill does (crucial for auto-trigger matching).
    # Optional fields:
    license: MIT
    compatibility: ">=1.0.0"
    metadata:
      key: value
    disable-model-invocation: true     # when true, Pi won't auto-trigger; user calls via /skill:my-skill
    allowed-tools: []                  # restricts tool execution permissions
    ---
    ```
    Followed by:
    ```markdown
    # Skill Instructions
    - Step-by-step workflow steps
    ```
  > Multi-file Structure:
    ```text
    [skill_name]/
    ├── SKILL.md
    ├── README.md         # Optional human summary / setup guide
    ├── scripts/          # Deterministic helper scripts
    ├── references/       # Static documentation loaded on demand
    └── assets/           # Templates & boilerplates
    ```

### 5. Prompt Templates Blueprint (`.pi/prompts/[name].md`)
Prompt templates expand into full prompts in the chat stream:
```markdown
---
description: Review staged git changes
argument-hint: "[optional-arg] <required-arg>" # Autocomplete hint
---
Review the staged changes.
Arguments can be referenced via $1, $2, or $@ (all arguments joined).
Default values: ${1:-default_value}. Note: Pi uses bash-style parameter substitution ($@, $1); do not use {{args}}.
```

### 6. Themes Blueprint (`.pi/themes/[name].json`)
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

### 7. Extensions Blueprint (`.pi/extensions/[name].ts`)
TypeScript modules compiled dynamically by JITI. Used to register custom tools, commands, or lifecycle interceptors:
```typescript
/**
 * @fileoverview Custom Pi Coding Agent Extension.
 * @description Registers custom tools, commands, and tool interceptors.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
  // 1. Register a custom tool
  pi.registerTool({
    name: "custom_tool_name",
    label: "Custom Tool",
    description: "Executes custom analysis or action.",
    promptSnippet: "Summary injected into agent tool description.",
    promptGuidelines: ["Specific constraint or boundary rule for tool use."],
    parameters: Type.Object({
      inputPath: Type.String({ description: "Path to input file" }),
      dryRun: Type.Optional(Type.Boolean({ description: "If true, previews without modifying" }))
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Headless / CI fallback check
      if (!ctx.hasUI || !ctx.ui) {
        return {
          content: [{ type: "text", text: `Processed in headless mode: ${params.inputPath}` }],
          details: { handled: true }
        };
      }

      return {
        content: [{ type: "text", text: `Success: processed ${params.inputPath}` }],
        details: { status: "ok" }
      };
    },
    renderCall(args, theme, _ctx) {
      return new Text(theme.fg("toolTitle", "custom_tool_name") + `: ${args.inputPath}`, 0, 0);
    }
  });

  // 2. Register an interactive slash command
  pi.registerCommand("mycommand", {
    description: "Custom slash command. Usage: /mycommand [arg]",
    handler: async (args: any, ctx: any) => {
      ctx.ui.notify("Command executed successfully", "info");
    }
  });

  // 3. Register lifecycle interceptors
  pi.on("tool_call", async (event: any, ctx: any) => {
    // Intercept bash or file tools before execution
    if (event.toolName === "bash" && event.input?.command?.includes("dangerous_cmd")) {
      return { block: true, reason: "Blocked by safety policy." };
    }
    return undefined;
  });
}
```

---

## Official Documentation Index

These files are located inside the global `node_modules` directory of the `pi` installation under `@earendil-works/pi-coding-agent/docs/`.

### Finding the Documentation Directory
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
