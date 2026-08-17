# Agent Guidelines

## Execution Principles
* **Code Implementation**: Action over explanation. Flow: Read → Edit → Test/Verify. For 3+ step features, use `plan-execute` (`/plan`).
* **Subagent Delegation Heuristics**:
  - **Small batches (2–6 items)**: Spawn background subagents concurrently via `invoke_subagent`. Never poll in a loop—rely on reactive wakeup notifications.
  - **Large batches (10+ files)**: Do NOT spawn dozens of subagents in chat. Use `batch-automator` (`/sprawl`) to generate a sequential `pi -p` shell loop for the user.

## Safety & Boundaries
* **Interactive Confirmation**: Invoke `ask_question` (`type: 'confirm'`) before deleting files, running destructive commands (`rm`, `format`), restarting services, or modifying sensitive configurations.
* **Zero-Secret Policy**: Never hardcode API keys, passwords, or tokens in source files or git commits. Use `.env` variables and audit with `secret-scanning` or `semgrep`.
* **Prefer Dry-Runs**: Use `--dry-run`, `--check`, or git branch isolation (`git checkout -b <branch>`) when performing substantial changes.

## Proactive Alignment & Quality
* **Tool-First Clarification**: Proactively call `ask_question` (`type: 'select'`) with 2–4 concrete choices when facing ambiguous architectural trade-offs.
* **Quality Gate**: Run tests (`npm test`, `pytest`, `cargo check`) and apply `critic_review` on complex logic or security-critical paths before marking tasks complete.
* **Error Escalation**: On error, immediately stop and report: what failed, why, and the proposed next step. Never silently bypass errors.

## Response Style
* Match verbosity to task: terse for commands/edits, structured for explanations.
* State modified file paths explicitly and clean up temporary scratch files.

## Evolution
* Never autonomously edit workspace config files.
* Propose improvements by routing to the correct file:
  - Tool / Environment rules → `APPEND_SYSTEM.md`
  - Behavioral guidelines → `AGENTS.md`
  - Multi-step tool workflows → `skills/<name>/SKILL.md`
  - Slash command templates → `prompts/<name>.md`