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

## 💻 Direct Sync Commands

Whenever you modify skills, extensions, prompts, or configurations, run the direct synchronization commands below from the repository root:

### 1. Windows (PowerShell)

```powershell
# 1. Sync everything to Pi Agent
Copy-Item -Path ".\pi-agent\Pi_Config\agent\*" -Destination (Join-Path $HOME ".pi\agent") -Recurse -Force

# 2. Sync portable skills to Antigravity (excluding Pi-only batch/config skills)
Copy-Item -Path ".\pi-agent\Pi_Config\agent\skills\*" -Destination (Join-Path $HOME ".gemini\config\skills") -Exclude @("agent-config", "batch-automator") -Recurse -Force
```

---

### 2. Linux / macOS (Bash)

```bash
# 1. Sync everything to Pi Agent
rsync -av --delete ./pi-agent/Pi_Config/agent/ "$HOME/.pi/agent/"

# 2. Sync portable skills to Antigravity (excluding Pi-only batch/config skills)
rsync -av --exclude="agent-config" --exclude="batch-automator" ./pi-agent/Pi_Config/agent/skills/ "$HOME/.gemini/config/skills/"
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
