---
name: agent-config
description: Configure Pi Agent by modifying AGENTS.md, APPEND_SYSTEM.md, extensions (.ts), skills, settings.json, mcp.json, and prompt templates.
---

# Pi Agent Configuration & Architecture Blueprint

Complete configuration guide and lifecycle API reference for the Pi Coding Agent (`@earendil-works/pi-coding-agent`).

---

## 1. Configuration Layers & Placement Matrix

| Goal / Layer | File Path (Local / Global) | Load Behavior | Purpose / Capabilities |
| :--- | :--- | :--- | :--- |
| **Behavioral Rules** | `.pi/AGENTS.md`<br/>`~/.pi/agent/AGENTS.md` | Auto-loaded | Primary agent persona, development workflows, and step-by-step methodologies. |
| **Environment Layer** | `.pi/APPEND_SYSTEM.md`<br/>`~/.pi/agent/APPEND_SYSTEM.md` | Auto-loaded | Platform shell defaults, terminal constraints, line endings, and safety boundaries. |
| **Agent Settings** | `.pi/settings.json`<br/>`~/.pi/agent/settings.json` | `/reload` | Default model, theme selection, editor binding (`"code --wait"`), and quiet mode. |
| **MCP Tool Servers** | `.pi/mcp.json`<br/>`~/.pi/agent/mcp.json` | `/reload` | External stdio / HTTP Model Context Protocol tool integrations. |
| **Model Endpoints** | `~/.pi/agent/models.json` | `/reload` | Local LLM endpoints (Ollama, llama-swap, vLLM) and OpenAI-compatible APIs. |
| **Agent Skills** | `.pi/skills/<name>/SKILL.md`<br/>`.agents/skills/<name>/SKILL.md` | Auto-loaded | Domain workflows, tool capability matrices, and multi-file instructions. |
| **Custom Extensions** | `.pi/extensions/<name>.ts`<br/>`~/.pi/agent/extensions/<name>.ts` | `/reload` | TypeScript modules registering tools, slash commands, or event lifecycle hooks. |
| **Prompt Shortcuts** | `.pi/prompts/<name>.md`<br/>`~/.pi/agent/prompts/<name>.md` | `/reload` | Parameterized prompt templates expanded via `$@`, `$1`, `${1:-default}`. |
| **UI Themes** | `.pi/themes/<name>.json`<br/>`~/.pi/agent/themes/<name>.json` | Auto-loaded | Custom hex / ANSI-256 color palettes for terminal interface styling. |

---

## 2. Extensions API & Lifecycle Hooks Matrix

Compiled on-the-fly via JITI. Only **one** extension can register a specific tool name; multiple extensions can hook the same lifecycle events without conflict:

| API Method / Hook | Purpose | Behavioral Rule / Conflict Handling |
| :--- | :--- | :--- |
| **`pi.registerTool({...})`** | Registers new LLM-callable tool | **Unique name required.** Conflicting names trigger startup errors. Defines `parameters` (TypeBox), `execute`, and `renderCall`. |
| **`pi.registerCommand(name, {...})`**| Registers user slash command (`/name`) | Executes interactive UI commands, notifications, or branch switching. |
| **`pi.on("tool_call", async (e, ctx))`** | Pre-execution lifecycle hook | Zero conflicts. Inspects or blocks commands (`return { block: true, reason: "..." }`) and patches inputs. |
| **`pi.on("tool_result", async (e, ctx))`**| Post-execution lifecycle hook | Zero conflicts. Formats, enriches, or logs tool results non-destructively. |
| **`pi.on("session_start", async (e))`** | Session initialization hook | Runs setup scripts, verifies dependencies, or loads environment context. |

---

## 3. Cross-Platform Dotfiles Sync

Sync repository configurations to the global Pi Agent directory (`~/.pi/agent/`):

```powershell
# Windows (PowerShell)
Copy-Item -Path ".\pi-agent\Pi_Config\agent\*" -Destination "$HOME\.pi\agent\" -Recurse -Force
```

```bash
# Linux / macOS (Bash)
rsync -av --delete ./pi-agent/Pi_Config/agent/ ~/.pi/agent/
```

---

## 4. High-Leverage Composite Examples

### A. Local LLM Endpoint (`models.json`) & Settings
```json
// ~/.pi/agent/models.json
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

### B. Safety Permission Gate Hook (`.pi/extensions/security-gate.ts`)
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("bash", event)) {
      if (/git\s+clean\s+-[a-zA-Z]*f/i.test(event.input.command || "")) {
        return { block: true, reason: "Blocked: Untracked file deletion prohibited." };
      }
    }
  });
}
```

### C. Parameterized Prompt Template (`.pi/prompts/review.md`)
```markdown
---
description: Code review focused on security and performance
argument-hint: "[branch-or-commit]"
---
Perform a security and performance review of changes against ${1:-main}.
Check for unsanitized inputs, unindexed queries, and error handling.
```

---

## 5. References & Boilerplates

* [TypeScript Extension Blueprint](examples/extension_blueprint.ts): Starter extension with TypeBox schema, headless fallbacks, and UI rendering.
* [Extension Development Playbook](references/extension_playbook.md): Node CLI one-liners to inspect ground-truth types, test TUI components headlessly, and verify JITI compilation.


