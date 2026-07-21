# VS Code Setup & Configuration

Setup, extension suite, and configuration settings for Visual Studio Code.

## Configuration Paths

- **Windows**: `%APPDATA%\Code\User\settings.json` (`$env:APPDATA\Code\User\settings.json`)
- **Linux / WSL**: `~/.config/Code/User/settings.json`
- **macOS**: `~/Library/Application Support/Code/User/settings.json`

## Recommended `settings.json`

```json
{
  // Disable AI Features, Copilot & Experiments
  "chat.disableAIFeatures": true,
  "chat.agent.enabled": false,
  "workbench.enableExperiments": false,
  "dataWrangler.experiments.copilot.enabled": false,
  "github.copilot.enable": {
    "*": false
  },
  "inlineChat.enable": false,
  "editor.inlineSuggest.enabled": false,

  // Privacy & Telemetry
  "telemetry.telemetryLevel": "off",
  "telemetry.feedback.enabled": false,
  "redhat.telemetry.enabled": false,

  // Git Settings
  "git.autofetch": true,
  "git.enableSmartCommit": true,
  "git.confirmSync": false,

  // UI & Appearance
  "workbench.colorTheme": "Dark Modern",
  "workbench.iconTheme": "material-icon-theme",
  "workbench.startupEditor": "none",
  "workbench.activityBar.compact": true,
  "editor.cursorBlinking": "smooth",
  "editor.smoothScrolling": true,
  "window.dialogStyle": "custom",

  // Bracket Pair Colorization & Guides
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": "active",

  // File Explorer & Navigation
  "workbench.tree.renderIndentGuides": "always",
  "explorer.confirmDelete": false,
  "explorer.confirmDragAndDrop": false,

  // Integrated Terminal
  "terminal.integrated.scrollback": 10000,
  "terminal.integrated.smoothScrolling": true,
  "terminal.integrated.cursorBlinking": true,

  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": false,

  // Python & Ruff Tuning
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.codeActionsOnSave": {
      "source.organizeImports": "explicit"
    }
  },
  // Extension Tuning & Noise Reduction
  "cSpell.diagnosticLevel": "Hint",
  "docker.showStartPage": false,
  "ruff.lint.select": ["E", "F"], // Only Syntax Errors and Pyflakes bugs
  "ruff.lint.ignore": ["E501"]    // Ignore line-length warnings
}
```

## Recommended Extensions

Run the following commands in PowerShell or Terminal to install the extension bundle:

```powershell
# UI & General Utilities
code --install-extension mechatroner.rainbow-csv
code --install-extension pkief.material-icon-theme
code --install-extension streetsidesoftware.code-spell-checker

# Document & File Viewers
code --install-extension ms-vscode.hexeditor
code --install-extension tomoki1207.pdf

# Markdown & Formatting
code --install-extension esbenp.prettier-vscode
code --install-extension bierner.markdown-mermaid
code --install-extension bierner.markdown-preview-github-styles

# Remote Development & WSL
code --install-extension ms-vscode-remote.remote-wsl

# Containers & Infrastructure
code --install-extension ms-azuretools.vscode-docker

# Shell Scripting & Tooling
code --install-extension timonwong.shellcheck

# Data Science & Analysis
code --install-extension ms-toolsai.vscode-data-wrangler

# Python Development (Ruff + Debugger)
code --install-extension charliermarsh.ruff
code --install-extension ms-python.python
code --install-extension ms-python.debugpy

# C / C++ & Microcontrollers
code --install-extension ms-vscode.cpptools

# PowerShell & Hardware Tools
code --install-extension ms-vscode.powershell
code --install-extension ms-vscode.vscode-serial-monitor
```
