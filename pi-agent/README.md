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
    *   `permissions-gate.ts`: Restricts dangerous commands, secret credential leaks, and out-of-workspace writes.
    *   `gemini-web-search.ts`: Grounded web search and URL content fetcher powered by Google Gemini with SSRF guards.
    *   `critic-review.ts`: Objective auditing sandbox for code drafts, refactors, and markdown slices.
    *   `ask-question.ts`: Interactive TUI-based user prompts, select menus, and confirmation dialogs.
    *   `ssh.ts`: Enables remote Linux management via multiplexed in-memory SSH/SFTP sessions.
    *   `sequential-thinking.ts`: Step-by-step reasoning tree scratchpad.
*   **Workspace Skills (`skills/`)**: Checklists and instruction sets loaded via the `use` command.
    *   *Source Directory*: [Pi_Config/agent/skills/](./Pi_Config/agent/skills/)
    *   `agent-config`: Configuration blueprints, templates, and setup guidelines.
    *   `plan-execute`: Architecture, planning, and task execution framework.
    *   `audit`: Security and quality audit routine.
    *   `data-analysis`: Dataset exploration, schema discovery, and log searching using DuckDB and orjson.
    *   `openscad`: Syntax reference, CSG modeling rules, and parametric templates to help design 3D parts.

---

### Setup & Installation

#### Install Pi Coding Agent

Install Pi globally using `npm`:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

#### Add Binaries to PATH

Add `.pi\agent\bin` (`$HOME\.pi\agent\bin`) to your user PATH:

**PowerShell (Windows):**

```powershell
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";$HOME\.pi\agent\bin", "User")
```

**Bash / Zsh (Linux / macOS):**

```bash
echo 'export PATH="$HOME/.pi/agent/bin:$PATH"' >> ~/.bashrc
```

#### Install Extension Dependencies & Plugins

Install runtime packages required by custom extensions (`ssh2` for `ssh.ts`, `turndown` for `gemini-web-search.ts`) and global plugins:

```bash
cd ~/.pi/agent/npm
npm install ssh2 turndown
pi install npm:pi-subagents
```

#### Sync Extensions

```powershell
# Create the directory
New-Item -ItemType Directory -Force -Path "$HOME\.pi\agent\extensions"

# Copy extensions from Pi_Config
Copy-Item -Path ".\Pi_Config\agent\extensions\*" -Destination "$HOME\.pi\agent\extensions\" -Force
```

#### Running Extension Tests

Automated test suites for all non-trivial extensions are available under `./tests/`:

```bash
# 1. SSH Extension Tests (Offline unit + loopback server)
node tests/test_ssh.mjs
# Optional live remote host test:
# node tests/test_ssh.mjs --live user@hostname

# 2. Permissions Gate Safety Tests (Zero-Execution Invariant)
node tests/test_permissions_gate.mjs

# 3. Critic Review Auditor Tests (Model aliases + context isolation)
node tests/test_critic_review.mjs

# 4. Ask Question Interactive Tests (Modes + choice sanitization)
node tests/test_ask_question.mjs

# 5. Gemini Web Search & SSRF Guard Tests
node tests/test_gemini_web_search.mjs
```

#### Configure External Editor

To use VS Code as your external editor when pressing `Ctrl+G` in the Pi TUI, edit your global settings file (`~/.pi/agent/settings.json` or `%USERPROFILE%\.pi\agent\settings.json` on Windows) to include the `externalEditor` setting:

```json
{
  "externalEditor": "code --wait"
}
```

The `--wait` flag is required so that Pi pauses and waits for you to save and close the file/tab in VS Code before reading your input back into the terminal.

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
