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
    *   `permissions-gate.ts`: Pre-execution security barriers intercepting dangerous commands (bash & powershell), secret credential exfiltration (`.env`, `.ssh`, API keys), and out-of-workspace file operations across `read`, `write`, `edit`, `grep`, `find`, and `ls`.
    *   `gemini-web-search.ts`: Grounded Google web search powered by Gemini API with source citations and standard tool annotations (`openWorldHint`, `readOnlyHint`).
    *   `fetch-url.ts`: Web page, text, and multimodal asset retrieval with got-scraping, Chrome CDP browser fallback, Readability, and Turndown markdown parsing.
    *   `prompt-cleaner.ts`: Strips prompt boilerplate (`<tools>` and `<docs>` blocks) and anchors `path`-first argument ordering for local/open-weight models (e.g. Gemma, Qwen).
    *   `write-diff.ts`: Overrides native `write` tool using `createWriteToolDefinition` and dynamic `ctx.cwd`, rendering real-time syntax-highlighted unified diffs, new file previews, and no-change indicators.
    *   `ask-question.ts`: Interactive TUI-based decision dialogs with `model-only` exposure to prevent prompt bloat while remaining invokable.
    *   `sequential-thinking.ts`: Step-by-step reasoning scratchpad with idempotent read-only tool annotations.
*   **Workspace Skills (`skills/`)**: Checklists and instruction sets loaded via the `use` command.
    *   *Source Directory*: [Pi_Config/agent/skills/](./Pi_Config/agent/skills/)
    *   `agent-config`: Configuration blueprints, templates, and setup guidelines.
    *   `ast-grep`: Structural AST-based code search and in-place transformations across languages.
    *   `batch-automator`: Headless `pi -p` shell loops for bulk refactoring and docstring generation.
    *   `ck`: Fast lexical, hybrid, and semantic codebase search with Tree-sitter extraction.
    *   `doc-malware-triage`: Safely dissect malicious Office documents, stagers, and PDFs without host execution.
    *   `docling`: Convert PDFs, Office documents, and scans to clean Markdown or JSON chunks.
    *   `duckdb`: High-performance in-process SQL analytics on Parquet, CSV, JSONL, and SQLite.
    *   `gh`: GitHub CLI workflows for PRs, issues, Actions CI triage, and GraphQL queries.
    *   `image-prompt-builder`: Optical staging, Kelvin physics, and prompts across modern AI image engines.
    *   `log-analysis`: Triage, timeline correlation, and anomaly detection in large enterprise logs.
    *   `mlr`: Stream processing, statistics, and format conversion for CSV, TSV, and JSONL.
    *   `openscad`: Syntax reference, CSG modeling rules, and parametric templates for 3D parts.
    *   `pe-malware-triage`: Dissect Windows executables, Linux binaries, and payloads statically.
    *   `pii-detection`: Audit datasets, emails, and logs for sensitive personal information.
    *   `plan-execute`: Architecture, planning, and task execution framework with phase gates.
    *   `secret-scanning`: Detect and verify leaked API keys, tokens, and credentials via TruffleHog.
    *   `semgrep`: Multi-language static application security testing (SAST) and security linting.
    *   `snyk`: Dependency vulnerability scanning (SCA), container tests, and IaC security.
    *   `vt-cli`: VirusTotal threat intelligence, hash lookups, and IOC validation.
    *   `yq`: Query, mutate, and convert YAML, TOML, XML, and JSON preserving comments.

---

### Setup & Installation

#### Install Pi Coding Agent

Install Pi via the official managed installer:

**Windows (PowerShell):**
```powershell
powershell -c "irm https://pi.dev/install.ps1 | iex"
```

**Bash / Zsh (Linux / macOS):**
```bash
curl -fsSL https://pi.dev/install.sh | sh
```

To update Pi, its managed core runtime, and installed packages:
```bash
pi update --all
```

#### Add Binaries to PATH

The managed installer adds `~/.pi/agent/bin` (`$HOME\.pi\agent\bin`) to your user PATH automatically. If needed manually:

**PowerShell (Windows):**

```powershell
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";$HOME\.pi\agent\bin", "User")
```

**Bash / Zsh (Linux / macOS):**

```bash
echo 'export PATH="$HOME/.pi/agent/bin:$PATH"' >> ~/.bashrc
```

#### Install Extension Dependencies & Plugins

All runtime packages required by custom extensions (`turndown`, `got-scraping`, `linkedom`, `@mozilla/readability`, `playwright-core`) are tracked in `Pi_Config/agent/npm/package.json`. Install them into Pi's isolated npm environment:

**PowerShell (Windows):**
```powershell
npm --prefix (Join-Path $HOME ".pi\agent\npm") install --no-fund --no-audit
```

**Bash / Zsh (Linux / macOS):**
```bash
npm --prefix "$HOME/.pi/agent/npm" install --no-fund --no-audit
```

#### Syncing Skills, Extensions & Config

To sync all skills, extensions, prompts, configurations, and extension dependencies from `Pi_Config/agent/` to your global `~/.pi/agent` directory (and optionally Antigravity):

**Windows (PowerShell):**
```powershell
# 1. Sync everything to Pi Agent:
Copy-Item -Path ".\Pi_Config\agent\*" -Destination "$HOME\.pi\agent" -Recurse -Force

# 2. Sync portable skills to Antigravity:
Copy-Item -Path ".\Pi_Config\agent\skills\*" -Destination "$HOME\.gemini\config\skills" -Exclude @("agent-config", "batch-automator") -Recurse -Force

# 3. Ensure extension dependencies are installed:
npm --prefix (Join-Path $HOME ".pi\agent\npm") install --no-fund --no-audit
```

**Linux / macOS (Bash):**
```bash
# 1. Sync everything to Pi Agent (excluding node_modules):
rsync -av --exclude="node_modules" --exclude="package-lock.json" ./Pi_Config/agent/ "$HOME/.pi/agent/"

# 2. Sync portable skills to Antigravity:
rsync -av --exclude="agent-config" --exclude="batch-automator" ./Pi_Config/agent/skills/ "$HOME/.gemini/config/skills/"

# 3. Ensure extension dependencies are installed:
npm --prefix "$HOME/.pi/agent/npm" install --no-fund --no-audit
```

#### Running Extension Tests

Automated test suites for all custom extensions are available under `./tests/`:

```bash
# Run all extension test suites:
node tests/run_all_tests.mjs

# Fast offline unit tests (<1.5s, skips external API & network scraping):
node tests/run_all_tests.mjs --offline

# Run specific suite(s) by pattern filter:
node tests/run_all_tests.mjs ask
node tests/run_all_tests.mjs gate search

# Or run individual suites directly:
node tests/test_permissions_gate.mjs
node tests/test_ask_question.mjs
node tests/test_gemini_web_search.mjs
node tests/test_fetch_url.mjs
node tests/test_prompt_cleaner.mjs
node tests/test_write_diff.mjs
node tests/test_sequential_thinking.mjs
```

#### Extension CLI Flags, Environment Variables & Slash Commands

Custom extensions register first-class command-line flags, environment variables, and interactive slash commands with tab-completions:

##### CLI Flags & Environment Overrides
*   `--no-permissions-gate` (or `PI_PERMISSIONS_GATE=0`): Disables safety confirmation prompts for automated/unattended runs.
*   `--no-fetch-gate` (or `PI_FETCH_GATE=0`): Disables confirmation prompts when fetching remote web pages or assets via `fetch_url`.
*   `--fetch-engine <auto|chrome|got-scraping>` (or `PI_FETCH_ENGINE`): Sets the content retrieval engine (`got-scraping`, Chrome CDP, or auto fallback).
*   `--no-search-gate` (or `PI_SEARCH_GATE=0`): Disables confirmation prompts for grounded Gemini Google searches.
*   `PI_GATES=0`: Master environment variable disabling all confirmation gates simultaneously for headless CI, scripting, and batch automations.

##### Interactive Slash Commands
*   `/permissions-gate [status|on|off|toggle]`: Inspect or toggle dangerous command, secret file, and out-of-workspace confirmation gates mid-session.
*   `/search-gate [status|on|off|toggle]`: Inspect or toggle Google Search grounding confirmation prompts mid-session (supports Tab autocompletion).
*   `/fetch-gate [status|on|off|toggle]`: Inspect or toggle URL fetch confirmation prompts mid-session.
*   `/fetch-engine [auto|chrome|got-scraping|status]`: Switch the active web retrieval engine dynamically mid-session.

#### Configure External Editor & TUI Mode

Edit your global settings file (`~/.pi/agent/settings.json` or `%USERPROFILE%\.pi\agent\settings.json` on Windows):

```json
{
  "externalEditor": "code --wait",
  "tuiMode": "fullscreen"
}
```

*   `externalEditor`: Allows pressing `Ctrl+G` in the Pi TUI to edit prompts in VS Code (`--wait` ensures Pi pauses until you save and close).
*   `tuiMode`: Defaults to `"fullscreen"`. Set to `"regular"` if you prefer the standard inline terminal layout (or use the `--tui-mode regular` flag).

#### Configure MCP Servers

Pi has native built-in support for the [Model Context Protocol](https://modelcontextprotocol.io) (stdio and streamable HTTP).

##### Configuration Files
*   **Global / User-level**: `~/.pi/agent/mcp.json`
*   **Project-level**: `.pi/mcp.json` (Note: project configs require project trust via `pi --approve` or interactive confirmation).

##### Tool Exposure Modes
MCP tools use the `exposure` property to control how tools reach the model:
*   `"codemode"` *(default)*: Tools are callable from scripts or dynamically searched, saving prompt context.
*   `"direct"`: Declared directly in the LLM system prompt like built-in tools (`read`, `bash`). **Recommended for primary tools like OpenSCAD.**
*   `"deferred"`: Loaded on-demand when discovered via tool search.
*   `"hidden"`: Connected but unreachable.

##### Example `mcp.json` Configuration
To configure the OpenSCAD MCP server with direct tool exposure, add it to `~/.pi/agent/mcp.json` (or `.pi/mcp.json`):

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
      "exposure": "direct",
      "env": {
        "OPENSCAD_PATH": "C:\\Program Files\\OpenSCAD (Nightly)\\openscad.exe"
      }
    }
  }
}
```

##### MCP CLI & TUI Commands
*   **Manage via CLI**:
    ```bash
    # Add a stdio server globally
    pi mcp add openscad -- uv run --with git+https://github.com/quellant/openscad-mcp.git openscad-mcp

    # Add to project config (.pi/mcp.json)
    pi mcp add -l openscad --exposure direct -- uv run openscad-mcp

    # List active servers, connection status, and discovered tools
    pi mcp list

    # Remove a server
    pi mcp remove openscad

    # Run Pi with MCP temporarily disabled
    pi --no-mcp
    ```
*   **Interactive TUI (`/mcp`)**: Run `/mcp` inside an interactive Pi session to inspect live servers, review tool schemas, reconnect failed processes, toggle exposure modes, or perform OAuth authentication.

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
