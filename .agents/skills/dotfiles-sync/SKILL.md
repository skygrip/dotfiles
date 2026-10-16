---
name: dotfiles-sync
description: Syncs agent configurations, skills, and extensions from this dotfiles repository to global Pi Agent (~/.pi/agent) and Antigravity (~/.gemini/config/skills) directories using basic native copy commands.
---

# Dotfiles Agent Sync Guide

This workspace skill provides simple, standalone copy commands to synchronize skills, extensions, prompts, and configurations from this `dotfiles` repository to your global agent runtimes.

---

## 📂 Source of Truth & Target Directories

* **Source of Truth (Repo):** `pi-agent\Pi_Config\agent\` (or `$HOME\Build\dotfiles\pi-agent\Pi_Config\agent\`)
* **Pi Agent Global Destination:** `$HOME\.pi\agent\`
* **Antigravity Global Skills Destination:** `$HOME\.gemini\config\skills\`

---

## ⚡ Direct Sync Commands

Whenever you create or modify any skill, extension, prompt, or configuration in this repository, run the native copy commands below:

### 1. Full Sync (PowerShell — Windows)

```powershell
# 1. Sync everything to Pi Agent
Copy-Item -Path "$HOME\Build\dotfiles\pi-agent\Pi_Config\agent\*" -Destination (Join-Path $HOME ".pi\agent") -Recurse -Force

# 2. Sync portable skills to Antigravity (excluding Pi-only batch/config skills)
Copy-Item -Path "$HOME\Build\dotfiles\pi-agent\Pi_Config\agent\skills\*" -Destination (Join-Path $HOME ".gemini\config\skills") -Exclude @("agent-config", "batch-automator") -Recurse -Force
```

### 2. Full Sync (Bash — Linux / macOS / WSL)

```bash
# 1. Sync everything to Pi Agent
rsync -av --delete "$HOME/Build/dotfiles/pi-agent/Pi_Config/agent/" "$HOME/.pi/agent/"

# 2. Sync portable skills to Antigravity
rsync -av --exclude="agent-config" --exclude="batch-automator" "$HOME/Build/dotfiles/pi-agent/Pi_Config/agent/skills/" "$HOME/.gemini/config/skills/"
```

---

## 🔍 Verification

Verify that files are identical across runtimes:

```powershell
Get-FileHash "c:\Users\Glen\Build\dotfiles\pi-agent\Pi_Config\agent\skills\image-prompt-builder\SKILL.md", `
             (Join-Path $HOME ".pi\agent\skills\image-prompt-builder\SKILL.md"), `
             (Join-Path $HOME ".gemini\config\skills\image-prompt-builder\SKILL.md") | Format-Table -Property Path, Hash
```
