---
name: batch-automator
description: Generates robust shell or Python scripts to automate batch operations across file glob patterns, providing instructions for the user.
---

# Skill: Batch Automator

Use this skill whenever the user requests a batch operation, repetitive edit, audit, or sequential task across a file glob pattern.

---

## 🎯 Target Use Cases & Solved Problems

* **🔗 Repository & Document Audits**: Scan 100+ Markdown files for broken links, typos, or security vulnerabilities without chat session history bloat (`--tools read`).
* **📝 Automated Documentation & Docstrings**: Batch-generate JSDoc/docstrings across all source files in a codebase (`--tools "read,write"`).
* **🌍 i18n & Documentation Translation**: Translate entire documentation directories into target languages while keeping code blocks intact.
* **🔄 Library & Breaking API Migrations**: Refactor deprecated method calls or config schemas across 50+ component files in a single pass.

---

## 🎯 Core Philosophy & Agent Role

The primary purpose of this skill is to **provide clear instructions and ready-to-use scripts directly to the user** so they can run the automation safely, transparently, and efficiently in their own terminal. 

Do NOT attempt to process files one-by-one inside our active conversation history. Instead, default to the **Shell/Python Loop approach** as the primary execution model, and guide the user on how to run it.

---

## 🛑 Anti-Self-Execution Guardrail

* **NEVER** run the commands in this skill file yourself; only instruct the user to run them.

---

## 🚦 Strategy Selection (Shell/Python is Default)

1. **The Default: Shell/Python Loop (Option B - Highly Recommended)**
   - **Why:** Zero-setup friction, massive speed advantage (especially on Windows), and supports parallel execution out of the box.
   - **How it works:** You write a robust Python script (`batch_runner.py`) or supply a Git Bash command, and instruct the user on how to run it.
   - **Read more/Get Templates:** See [shell-loop.md](./shell-loop.md) for full instructions and pre-written scripts.

2. **The Small-Batch Fallback: Direct Subagent Delegation (Option C)**
   - **Why:** Best for small batch counts (2 to 6 files or distinct tasks). Zero setup, zero scripts, zero extensions to clean up.
   - **How it works:** Spawns concurrent background subagents (`invoke_subagent`) that run in parallel threads and report findings directly back to the active conversation.
   - **Read more/Get Templates:** See [subagent-loop.md](./subagent-loop.md).

3. **The Advanced Fallback: In-Process Extension Loop (Option A)**
   - **Why:** Only use this if the task is highly complex, requires "Rolling Notes" (where file N+1 depends on findings from file N), or requires the subagent to interactively run compile/test commands to self-correct in-place.
   - **How it works:** Compiles a temporary TypeScript extension and loads it into the Pi environment via `/reload`.
   - **Read more/Get Templates:** See [extension-loop.md](./extension-loop.md).

---

## 📋 Agent Instruction Workflow (Default Path)

When a batch request is received, follow these exact steps to instruct and empower the user:

### Propose the Script & Pattern

Present the matched files (or glob pattern) and explain that you will create a standalone script in their workspace to execute the task.

### Write the Script to the Workspace

Write the robust python batch runner to `.pi/batch_runner.py` or a relative `scripts/batch_runner.py` using your write tool, pre-configuring it with the user's specific task prompt and glob patterns.
*(See [shell-loop.md](./shell-loop.md) for the pre-written, standard-library Python runner template).*

### Provide Execution Instructions

Provide a highly polished, step-by-step terminal execution instruction block to the user:
- How to perform a **dry run** to verify file matching.
- How to run **sequentially** (safely) or **in parallel** (fast, e.g. `-j 4`).
- Where the final markdown logs will be saved (`batch_run_report.md`).

### Keep the Workspace Clean

Remind the user that once the batch run is complete and verified, they can safely delete the temporary `batch_runner.py` file.
