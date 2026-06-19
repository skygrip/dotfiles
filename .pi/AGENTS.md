# Project-Local Agent Guidelines

This file governs behavioral policies, formatting guidelines, and development styles specifically for the `dotfiles` repository. It is loaded automatically into the active agent's prompt context at every chat turn to enforce repository-level rules.

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

### Self-Evolution in Exit Instructions
*   **Rule:** When starting a thinking session, design your `exitInstruction` on Step 1 to explicitly include self-evolution checks. If the task yields new repository rules, workarounds, or successful commands, ensure the `exitInstruction` prompts you to write these to `EVOLUTION.md` or the appropriate configuration playbook before concluding.
*   **Purpose:** This guarantees that project-local memories are captured and structured automatically.
