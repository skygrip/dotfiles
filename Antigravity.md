# Google Antigravity Configuration & Skill Synchronization

This guide documents the customization architecture for **Google Antigravity** (including the Antigravity CLI `agy`, Antigravity IDE, and Antigravity 2.0 desktop platform) and provides sync scripts to share your skill library between Pi Agent and Antigravity.

---

## 🧭 Customization Architecture & Discovery

Antigravity and Pi Agent share the exact same standard skill directory structure and YAML frontmatter specification:

```text
skills/<skill_name>/
├── SKILL.md          # Main instruction file with YAML frontmatter (name, description)
└── ...               # Optional subdirectories (scripts/, references/)
```

### Discovery Locations & Precedence in Antigravity:

| Scope | Location | Description |
| :--- | :--- | :--- |
| **Workspace (Highest Priority)** | `.agents/skills/` (or `.agent/skills/`) | Project-specific skills committed to repository root. |
| **Global Custom Skills** | `~/.gemini/config/skills/` | Machine-wide custom skills available across all projects. |
| **Built-in System Skills** | `~/.gemini/antigravity/builtin/skills/` | Default skills bundled with the Antigravity platform. |

---

## 🔄 Cross-Platform Synchronization (Sync All Except Pi-Specific)

By default, **all skills** in `pi-agent/Pi_Config/agent/skills/` are portable and synced to Antigravity's global custom skills directory (`~/.gemini/config/skills/`), **except for tools/configs specifically tied to Pi Agent CLI internals**.

### 🚫 Excluded Skills (Pi-Only)

| Excluded Skill | Reason for Exclusion |
| :--- | :--- |
| **`agent-config`** | Specific to Pi Agent's `.pi/` configuration layout (`models.json`, `settings.json`, themes, extensions, and Pi sync commands). Antigravity uses its own `~/.gemini/config/` structure and `.agents/` workspace format. |
| **`batch-automator`** | Specific to generating headless `pi -p` CLI shell loops. Antigravity uses its own native background task runners (`manage_task`) and subagents (`invoke_subagent`). |

*All other present and future skills (data tools, security scanners, prompt builders, language assistants, and workflow guides) are fully interoperable and synced automatically.*

---

## 💻 Automated Sync Scripts

The root of this repository includes automated synchronization scripts that sync skills, extensions, and configurations across both **Pi Agent** (`~/.pi/agent`) and **Antigravity** (`~/.gemini/config/skills`):

### 1. Windows (PowerShell)

Run from the root of your `dotfiles` repository:

```powershell
# Sync everything (Pi Agent configs + Antigravity skills)
.\Sync-AgentConfigs.ps1

# Optional flags:
.\Sync-AgentConfigs.ps1 -Target Antigravity   # Sync only Antigravity
.\Sync-AgentConfigs.ps1 -Target Pi            # Sync only Pi Agent
.\Sync-AgentConfigs.ps1 -DryRun               # Preview changes without modifying files
```

---

### 2. Linux / macOS (Bash)

Run from the root of your `dotfiles` repository:

```bash
# Make executable (first time only)
chmod +x ./sync-agent-configs.sh

# Sync everything
./sync-agent-configs.sh

# Target specific environment:
./sync-agent-configs.sh antigravity
./sync-agent-configs.sh pi
```

---

## 📂 Deploying Skills into a Project Workspace

To deploy all portable skills into a specific project repository so any team member using Antigravity or Pi Agent can use them:

```powershell
# From the target project root (Windows PowerShell):
$projectSkills = ".\.agents\skills"
if (!(Test-Path $projectSkills)) { New-Item -ItemType Directory -Path $projectSkills -Force | Out-Null }

Copy-Item -Path "$HOME\Build\dotfiles\pi-agent\Pi_Config\agent\skills\*" -Destination $projectSkills -Exclude @("agent-config", "batch-automator") -Recurse -Force
```
