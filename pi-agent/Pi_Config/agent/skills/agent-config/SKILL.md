---
name: agent-config
description: "Blueprints for modifying Pi Agent configs: '.pi/AGENTS.md', '.pi/APPEND_SYSTEM.md', extensions ('.ts'), skills ('SKILL.md'), 'settings.json', 'mcp.json', and prompt templates."
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

## 🔄 Cross-Platform Synchronization One-Liners

When editing configuration, skills, or extensions inside a repository / dotfiles working directory, use these one-liners to sync changes to the global Pi agent directory (`~/.pi/agent/`):

### Windows (PowerShell)
```powershell
# Sync all configuration, skills, and extensions from repo to global Pi agent
Copy-Item -Path ".\pi-agent\Pi_Config\agent\*" -Destination "$HOME\.pi\agent\" -Recurse -Force

# Sync skills only
Copy-Item -Path ".\pi-agent\Pi_Config\agent\skills\*" -Destination "$HOME\.pi\agent\skills\" -Recurse -Force
```

### Linux / macOS (Bash & Zsh)
```bash
# Sync all configuration, skills, and extensions with rsync
rsync -av --delete ./pi-agent/Pi_Config/agent/ ~/.pi/agent/

# Or via standard cp
cp -R ./pi-agent/Pi_Config/agent/* ~/.pi/agent/
```

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

#### Key Architectural Rule: Tool Registration vs Event Interception
* **`pi.registerTool({ name: "toolName", ... })`**: Defines a new LLM-callable tool or overrides a built-in tool. **Only ONE extension can register a tool with a given name**; multiple extensions attempting to register the same tool name will trigger a startup conflict error.
* **`pi.on("tool_call")` & `pi.on("tool_result")`**: Lifecycle event hooks. **Zero conflicts**—multiple extensions can listen to, patch arguments for, block, snapshot, or enrich the same tool execution simultaneously.

```typescript
/**
 * @fileoverview Custom Pi Coding Agent Extension Blueprint.
 * @description Demonstrates custom tools, commands, and non-conflicting event hooks.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, isWriteToolResult } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
  // 1. Register a custom tool (Unique name)
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

  // 3. Pre-execution Lifecycle Hook (tool_call: argument patching & safety checks)
  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("bash", event)) {
      if (event.input.command?.includes("dangerous_cmd")) {
        return { block: true, reason: "Blocked by safety policy." };
      }
    }
  });

  // 4. Post-execution Lifecycle Hook (tool_result: output enrichment)
  pi.on("tool_result", async (event, ctx) => {
    if (isWriteToolResult(event)) {
      // Non-destructively enrich or format tool output
    }
  });
}
```

---

## Extension Development & Introspection Playbook

Because Pi's runtime dependencies (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`) are installed in the global `node_modules`, you can use fast Node.js CLI one-liners to inspect exports, read ground-truth TypeScript definitions (`.d.ts`), and test TUI components headlessly in milliseconds without launching a full Pi session.

### 1. Live Runtime API & Export Inspection
Discover what methods, classes, and utilities are available at runtime:
```bash
# Inspect TUI components and helper exports (@earendil-works/pi-tui)
node -e "const tui = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui'); console.log(Object.keys(tui));"

# Inspect AI model registry, streaming, and auth methods (@earendil-works/pi-ai)
node -e "const ai = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai'); console.log(Object.keys(ai));"

# Inspect core Coding Agent exports (@earendil-works/pi-coding-agent)
node -e "const pi = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent'); console.log(Object.keys(pi));"
```
*(On Linux/macOS, replace `process.env.APPDATA + '/npm/node_modules/'` with `/usr/local/lib/node_modules/` or `~/.nvm/versions/node/$(node -v)/lib/node_modules/`)*

### 2. Reading Ground-Truth TypeScript Definitions (`.d.ts`)
When writing extensions, inspect the exact TypeScript types and interfaces directly from the source:
```bash
# Check exact props and methods for SelectList or any TUI component
node -e "const fs = require('fs'); const p = process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui/dist/components/select-list.d.ts'; console.log(fs.readFileSync(p, 'utf8'));"

# Check Models interface, streamSimple, and createModels options
node -e "const fs = require('fs'); const p = process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/models.d.ts'; console.log(fs.readFileSync(p, 'utf8'));"

# Check Usage, Message, and AssistantMessageEvent types
node -e "const fs = require('fs'); const p = process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/types.d.ts'; console.log(fs.readFileSync(p, 'utf8'));"
```

### 3. Dry-Run Extension Compilation with JITI
Verify TypeScript syntax and imports from the command line in 0.2s without starting a full agent session:
```bash
node -e "const jiti = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti'); const load = jiti(__dirname); load('./my-extension.ts'); console.log('✓ Extension syntax & imports OK');"
```

### 4. Inspecting Configured Models from `models.json` & Providers
Check what models Pi resolves from `models.json` and active environment keys headlessly:
```bash
node -e "
const { createModels } = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai');
const models = createModels();
console.log(models.getModels().map(m => m.provider + '/' + m.id));
"
```

### 5. Headless TUI Component Testing
Test how your custom UI components, search filters, or selectors render in a simulated terminal width before running them in Pi:
```bash
node -e "
const { SelectList } = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui');

const items = [
  { value: 'item-1', label: 'First Item', description: 'Description 1' },
  { value: 'item-2', label: 'Second Item', description: 'Description 2' }
];

const mockTheme = {
  selectedPrefix: t => '> ' + t,
  selectedText: t => t,
  description: t => ' - ' + t,
  scrollInfo: t => '[' + t + ']',
  noMatch: t => 'No match: ' + t
};

const list = new SelectList(items, 5, mockTheme);
console.log(list.render(80).join('\n'));
"
```

### 6. Fast Security Pattern & Regex Benchmark Runner
When writing security rules (e.g. in `permissions-gate.ts`), test evasive command strings in bulk instantly:
```bash
node -e "
const regex = /git\s+clean\s+-[a-zA-Z]*f/i;
const tests = ['git clean -f', 'git clean -fdx', 'git clean -xdf', 'git clean -n'];
tests.forEach(cmd => console.log(cmd.padEnd(20), '->', regex.test(cmd) ? 'BLOCKED 🚨' : 'ALLOWED ✅'));
"
```

### 7. Direct Isolated Sub-Call Execution (`complete` & `streamSimple`)
Test how a specific local or cloud model responds to an isolated system prompt without running the main agent loop:
```bash
node -e "
const { createModels, complete } = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai');
const models = createModels();
const model = models.getModel('google', 'gemini-flash-latest');
complete(model, { messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }], timestamp: Date.now() }] })
  .then(res => console.log('Response:', res.content[0].text))
  .catch(console.error);
"
```

### 8. Checking Active Keybindings & Key Identifiers
Inspect exact keybinding names and default shortcut maps (`tui.select.confirm`, `app.tools.expand`):
```bash
node -e "
const { getKeybindings } = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui');
console.log(getKeybindings());
"
```

### 9. Terminal Color & Theme Palette Preview
Preview Pi's ANSI color styles (`theme.fg`, `theme.bg`) directly in the shell:
```bash
node -e "
const { theme } = require(process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js');
console.log(theme.fg('accent', 'Accent Color'));
console.log(theme.fg('success', 'Success Color'));
console.log(theme.fg('warning', 'Warning Color'));
console.log(theme.fg('muted', 'Muted Color'));
"
```

### 10. Reverse-Engineering Pi's Internal UI Implementations
Learn exact UI patterns by inspecting how Pi's built-in selectors and components are implemented:
```bash
# Check how Pi's official /model search and selector component works
node -e "const fs = require('fs'); const p = process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/model-selector.js'; console.log(fs.readFileSync(p, 'utf8'));"

# Check how Pi's tool execution wrapper and renderResult handler works
node -e "const fs = require('fs'); const p = process.env.APPDATA + '/npm/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/tool-execution.js'; console.log(fs.readFileSync(p, 'utf8'));"
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
