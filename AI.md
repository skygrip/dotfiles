# AI Tools & Configurations

This document serves as a centralized index for the system configurations, custom extensions, and specialized skills used by AI agents in this workspace.

> **Source of Truth**: All active configuration files, TypeScript extensions, and instruction sets have been moved to the [Pi_Config](./Pi_Config/agent/) directory for better organization and portability.

---

## Pi Coding Agent (`pi`)

[Pi Coding Agent](https://github.com/earendil-works/pi) is an autonomous developer agent harness. It supports local extensions, custom system personas, specialized skills, and local/cloud LLMs.

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
    *   `plan`: Architecture and planning framework.
    *   `plan_executor`: Autonomous execution engine for task lists.
    *   `audit`: Security and quality audit routine.

---

### Setup & Installation

#### 1. Dependencies
To install required plugins in the global Pi environment:
```bash
cd ~/.pi/agent/npm
npm install pi-mcp-adapter pi-web-access
```

#### 2. Restoring Extensions (PowerShell)
To sync the extensions from this repository to your global configuration directory:
```powershell
# Create the directory
New-Item -ItemType Directory -Force -Path "$HOME\.pi\agent\extensions"

# Copy extensions from Pi_Config
Copy-Item -Path ".\Pi_Config\agent\extensions\*" -Destination "$HOME\.pi\agent\extensions\" -Force
```

#### 3. Installing Bundled Extensions (Global Source)
Alternatively, you can install the official extensions directly from the global Pi installation or GitHub:

```powershell
# Copy the SSH Extension directly from your global node_modules installation
Copy-Item -Path "$env:APPDATA\npm\node_modules\@earendil-works\pi-coding-agent\examples\extensions\ssh.ts" -Destination "$HOME\.pi\agent\extensions\" -Force

# Copy the official Plan Mode Extension directly from global node_modules
Copy-Item -Path "$env:APPDATA\npm\node_modules\@earendil-works\pi-coding-agent\examples\extensions\plan-mode" -Destination "$HOME\.pi\agent\extensions\" -Recurse -Force
```

Alternatively, for macOS/Linux or direct downloads:

```bash
# macOS/Linux (Shell Commands)
mkdir -p ~/.pi/agent/extensions/plan-mode
curl -fLo ~/.pi/agent/extensions/ssh.ts https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/ssh.ts
curl -fLo ~/.pi/agent/extensions/plan-mode/index.ts https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/plan-mode/index.ts
curl -fLo ~/.pi/agent/extensions/plan-mode/utils.ts https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/examples/extensions/plan-mode/utils.ts
```

> **Note**: After syncing, type `/reload` in the Pi terminal to compile and load the extensions.

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
,path: