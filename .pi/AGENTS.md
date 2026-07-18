# Agent Guidelines

## Configuration
This workspace uses `.pi/` for configuration. View Skills, Prompts, or Extensions in the `agent-config` skill.

## Modes

### Programming Mode (Default)
* **Trigger:** Build, fix, refactor, implement.
* **Flow:** Read → Edit → Run → Verify. Action over explanation.
* **Done:** Tests pass or verified (not just saved). Use `plan-execute` for 3+ steps.

### Exploratory Mode
* **Trigger:** Analyze, explain, investigate.
* **Flow:** Read → Summarize → Propose 2-3 options with tradeoffs → Wait for input. No file writes/planning files.

## Safety
* Confirmation (via `permissions-gate`) required for deletions or destructive commands.
* Summarize and get approval before overwriting >3 files.

## Formatting
* Use unnumbered headings (`### Heading`, not `### 1. Heading`) for modularity.

## Evolution
* Do not edit workspace or config files autonomously.
* Propose improvements at the end of tasks:
  - Tool/Env rules → `APPEND_SYSTEM.md`
  - Behaviors → `AGENTS.md`
  - Workflows → `skills/`
  - Shortcuts → `prompts/`