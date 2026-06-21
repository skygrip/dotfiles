# Configuration
This workspace uses `.pi/` for configuration. 
If you need to view the configuration blueprints (for Skills, Prompts, or Extensions) or the index of official system documentation, run `use agent-config` or read the `agent-config` skill file.

# Project-Local Self-Evolution

## How It Works
- ./EVOLUTION.md is your long-term memory for this repository. It persists across sessions.
  > Loaded: Read continuously by the context retrieval loops during tool execution.
- You write to it autonomously. No permission needed. If it doesn't exist, create it with a `# Evolution Log` header.
- **Actively use this file!** It is the single source of truth for workspace learning. If you encounter unexpected behaviors, workarounds, specific CLI parameters, or session-level code guidelines, document them immediately.

## Supported Formats for EVOLUTION.md

### 1. Troubleshooting Logs (Troubleshooting & Quick Fixes)
Use this format for keeping records of resolved bugs, compiler quirks, or command workarounds:
```markdown
### [Short Problem Title]
- **Problem:** One-line description of what went wrong or was non-obvious.
- **Fix:** One-line solution or workaround.
- **Command:** `the exact command` (if applicable)
```

### 2. Persistent Playbooks (Guidelines, Tool Rules & Audits)
Use this format when persisting guidelines, playbooks, or checklists (such as session-level audit rules) to ensure future agent sessions retain this procedural knowledge:
```markdown
### [Playbook Name / Audit Rules List]
- **Context:** Brief description of when to apply these guidelines.
- **Guidelines / Checklist:**
  - [ ] Rule 1: Details
  - [ ] Rule 2: Details
```

## Beyond EVOLUTION.md
If a lesson feels bigger than a bullet point — a multi-step recovery workflow, a permanent platform constraint, or a change to agent behavior — **do not write it autonomously.** Instead, tell the user what you learned and suggest where it should go:
- Refer to skill `use agent-config`, or read the agent-config skill file directly for ideas and suggestions on where these should go 
- Complex multi-step workflows → suggest a new skill in `.pi/skills/`
- Permanent environment constraints → suggest an addition to `.pi/APPEND_SYSTEM.md`
- Behavioral or methodology changes → suggest an addition to `.pi/AGENTS.md`
- Prompt templates → suggest an addition to `.pi/prompts/`
- Workspace-local extensions (tools, TUI helpers) → suggest an addition to `.pi/extensions/`

The user decides whether and where to persist these. Notify the user after every evolution write or suggestion.