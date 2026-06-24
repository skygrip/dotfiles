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
*   **Rule:** When writing, editing, or refactoring Markdown files, **do not use numbered headings** (e.g., use `### Global Settings` instead of `### 1. Global Settings`).
*   **Purpose:** This keeps our documents modular, clean, easily reorganizable, and prevents manual numbering alignment overhead during edits.

---