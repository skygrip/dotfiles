# Pi Coding Agent Config

---

## Pi Coding Agent (`pi`)

[Pi](https://github.com/earendil-works/pi) autonomous developer agent harness.

### Global Configuration & Local Source
The global configuration is typically stored in `~/.pi/agent/`. In this repository, the source files are managed in:
- **Local Path**: `./Pi_Config/agent/`

### Key Components

*   **Model Configurations (`models.json`)**: Defines connection parameters for LLM providers.
    *   *Source*: [Pi_Config/agent/models.json](./Pi_Config/agent/models.json)
*   **Core Behavioral Instructions (`AGENTS.md`)**: Defines the agent's persona, troubleshooting logic, and execution rules.
    *   *Source*: [Pi_Config/agent/AGENTS.md](./Pi_Config/agent/AGENTS.md)
*   **Environmental Constraints (`APPEND_SYSTEM.md`)**: Hardcodes platform-specific parameters (PowerShell defaults, line endings, etc.).
    *   *Source*: [Pi_Config/agent/APPEND_SYSTEM.md](./Pi_Config/agent/APPEND_SYSTEM.md)
*   **Custom TypeScript Extensions (`extensions/`)**: Tools that expand Pi's capabilities.
    *   *Source Directory*: [Pi_Config/agent/extensions/](./Pi_Config/agent/extensions/)
    *   `permissions-gate.ts`: Restricts dangerous commands and out-of-workspace writes.
    *   `sequential-thinking.ts`: Step-by-step reasoning tree mechanism.
    *   `critic-review.ts`: Objective auditing sandbox for code and markdown.
    *   `ask-question.ts`: Interactive TUI-based user prompts and menus.
    *   `ssh.ts`: Enables remote Linux management via SSH.
*   **Workspace Skills (`skills/`)**: Checklists and instruction sets loaded via the `use` command.
    *   *Source Directory*: [Pi_Config/agent/skills/](./Pi_Config/agent/skills/)
    *   `agent-config`: Configuration blueprints, templates, and setup guidelines.
    *   `plan-execute`: Architecture, planning, and task execution framework.
    *   `audit`: Security and quality audit routine.
    *   `openscad`: Syntax reference, CSG modeling rules, and parametric templates to help design 3D parts.

---

### Setup & Installation

#### Install Dependencies and Plugins

```bash
cd ~/.pi/agent/npm
pi install npm:pi-mcp-adapter
pi install npm:pi-subagents
pi install npm:pi-web-access
```

#### Sync Extensions

```powershell
# Create the directory
New-Item -ItemType Directory -Force -Path "$HOME\.pi\agent\extensions"

# Copy extensions from Pi_Config
Copy-Item -Path ".\Pi_Config\agent\extensions\*" -Destination "$HOME\.pi\agent\extensions\" -Force
```

#### Configure MCP Servers

Add the OpenSCAD MCP server configuration to your `mcp.json` configuration file (either globally at `~/.pi/agent/mcp.json` or project-locally at `.mcp.json`):

```json
{
  "mcpServers": {
    "openscad": {
      "command": "uv",
      "args": [
        "run",
        "--with",
        "git+https://github.com/quellant/openscad-mcp.git",
        "openscad-mcp"
      ],
      "env": {
        "OPENSCAD_PATH": "C:\\Program Files\\OpenSCAD (Nightly)\\openscad.exe"
      }
    }
  }
}
```

---

### General AI Skills Tool (`npx skills`)

The `npx skills` command allows you to dynamically fetch and run pre-configured visual diagram and charting tools.

```bash
# Pretty Mermaid - Render rich markdown diagrams in VS Code
npx skills add https://github.com/imxv/pretty-mermaid-skills --skill pretty-mermaid

# Chart Visualization - Render plots and charts via AntV
npx skills add antvis/chart-visualization-skills

# Tip: Search for more developer skills:
npx skills find <keyword>
```
