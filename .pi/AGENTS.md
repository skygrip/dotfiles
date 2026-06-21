# Project-Local Agent Guidelines

This file governs behavioral policies, formatting guidelines, and development styles specifically for the `dotfiles` repository. It is loaded automatically into the active agent's prompt context at every chat turn to enforce repository-level rules.

---

## Mode Detection

### Programming Mode (Default)
Trigger: user asks to build, fix, add, remove, refactor, or implement something.
Behavior: Read → Edit → Run → Verify. Prefer action over explanation. "Done" means the relevant tests pass or manual verification succeeds — not just "the file was written."

### Exploratory Mode
Trigger: user asks how, why, what, can we, should we, or explore/investigate.
Behavior: Read → Summarize → Propose options → Wait for direction. No file edits without explicit user confirmation.
- Prefer read-only tool calls.
- Surface 2–3 concrete options with tradeoffs before committing to an approach.
- Do not create PLAN.md for pure investigation tasks.

---

## Safe Operations

- Never delete files or run destructive shell commands without explicit user confirmation.
- If a task requires overwriting more than 3 files, summarize what will change and ask before proceeding.
- "Done" means: the relevant tests pass or manual verification succeeds — not just "the file was written."

---

## Markdown Formatting Preferences

### Avoid Numbered Headings
*   **Rule:** When writing, editing, or refactoring Markdown files (such as `AI.md` or other system playbooks), **do not use numbered headings** (e.g., use `### Global Settings` instead of `### 1. Global Settings`).
*   **Purpose:** This keeps our documents modular, clean, easily reorganizable, and prevents manual numbering alignment overhead during edits.

---

## Sequential Thinking & Self-Evolution

### Leverage Action Loops
*   **Rule:** For complex tasks or debugging, do not treat the `sequential_thinking` tool as a one-off pre-planning phase. Interleave reasoning steps with action tool calls (e.g., run a shell command, read a file, or edit code, and immediately call `sequential_thinking` to analyze the result).
*   **Purpose:** This creates a strict, logical evaluate-act loop, keeping reasoning branches clean and preventing cognitive drift.
*   **Fallback:** If `sequential_thinking` is unavailable, write a `## Reasoning` block in your reply to externalize your thinking before acting on complex tasks.

### Self-Evolution in Execution Cycle
*   **Rule:** At the end of each task or thinking session (especially during plan updates or before concluding), run a self-evolution check. If you discovered any workarounds, succeeded with non-obvious terminal commands, or formulated new session rules (like audit lists), write them to `EVOLUTION.md` immediately using the matching format (Troubleshooting Log or Persistent Playbook).
*   **Purpose:** This guarantees that project-local memories and rule playbooks are captured and structured automatically.

---

## Scope Guard

If you discover new work during execution, always add it to Discovered in PLAN.md — never silently expand the current task's scope. If a discovery is critical and blocks completion, ask the user before pivoting.
