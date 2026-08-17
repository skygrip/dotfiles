---
name: plan-execute
description: Multi-step task execution loop (3+ dependent steps). Creates and maintains a living 'PLAN.md' with phase checkboxes and interactive user confirmation gates.
---

# Plan & Execute

This skill implements a unified plan-execute loop. The plan is a living document — it changes as you work. You do not finish planning before you start executing.

## When NOT to Use This Skill

- **Read-only investigation** ("explain X", "how does auth work?", "find Y"): investigate directly and report findings. Do not create PLAN.md.
- **Single-task requests** (one file to edit, one command to run): execute directly without a plan.
- **Exploratory scoping** ("what would it take to add Z?"): summarize options and wait for direction. No PLAN.md until the user confirms an approach.

Use this skill only when the task has **3 or more distinct steps** that each depend on the previous one.

---

## Step 1: Orient

Complete each sub-step before moving on:

- [ ] Does `PLAN.md` exist? $\rightarrow$ If yes, read it. If no, create it from the template below.
- [ ] Are there multiple valid architectural approaches or trade-offs? $\rightarrow$ Proactively call `ask_question` (`type: 'select'`) with 2–4 concrete options so the user picks the direction before you write `PLAN.md`.
- [ ] Is the goal ambiguous? $\rightarrow$ If yes, ask focused questions via `ask_question` before writing the plan. (See "When the Task is Ambiguous" below.)
- [ ] Review the draft plan for correct dependency ordering and explicit verification commands before executing.

### Resuming or Re-planning
If `PLAN.md` already exists, or if you are resuming work from a previous attempt:
- **Do not clear the `Done` section.** Preserve the history of previously completed tasks.
- If some tasks were completed manually or in a previous session, document them in `Done` (e.g., `- [x] Previously Completed: Initial project setup`) so the plan reflects full scope.

### PLAN.md Format

Use this exact structure:

```markdown
# PLAN — [Brief Project/Feature Name]

> **Workflow:** Execute with `use plan-execute`. See `plan-execute/SKILL.md`.

## Goal
- **Original Goal:** [What success looks like at project start]
- **Deliverables & Acceptance Criteria:**
  - [ ] Requirement 1
  - [ ] Requirement 2

## Current Focus
- [ ] The single task you are working on right now [Verify: `<command or test file>`] [Artifacts: `<file paths>`]

## Up Next
- [ ] Second task [Verify: `<command>`]
- [ ] Third task [Verify: `<command>`]
- [ ] Fourth task [Verify: `<command>`]

## Discovered / Backlog
- [ ] [BLOCKER] Task discovered during execution that blocks Current Focus
- [ ] [DEFERRED] Non-blocking discovery or future improvement

## Done
- [x] Initial workspace setup and structure definition (Verified: `<result>`)
```

### Rules for Writing Tasks
- **Single Verifiable Artifact:** Every task must yield exactly one verifiable artifact: a file that exists, a test that passes, or a command that succeeds.
- **Explicit Verification Command:** Every task must include an inline `[Verify: <command>]` tag (e.g., `[Verify: npm test auth.test.ts]`).
- **Action-Oriented:** Write tasks as imperative actions: "Add JWT validation to auth middleware" not "Auth middleware needs JWT."
- **Dependency Ordered:** Place prerequisite tasks strictly before dependent tasks.

### When the Task is Ambiguous
If the user's request has genuine ambiguity — multiple valid interpretations, unclear scope, or a design decision that affects the whole plan — use `ask_question` before writing PLAN.md. Don't guess.

Examples:
- "Build auth" $\rightarrow$ ask: `type: 'select'`, choices: ["Session-based auth", "JWT/stateless auth", "OAuth with external provider"]
- "Refactor the API" $\rightarrow$ ask: `type: 'select'`, choices: ["Just clean up code style", "Restructure routes and handlers", "Full rewrite with new framework"]

---

## Step 2: Execute the Loop

```
[Orient / Draft PLAN.md]
          │
          ▼
┌──► [Read Current Focus]
│         │
│         ▼
│    [Formulate Approach (sequential_thinking)]
│         │
│         ▼
│    [Execute Edits / Commands]
│         │
│         ▼
│    [Verify & Audit Gate] ──(Fails < 3 attempts)──► [Diagnose, Fix & Re-verify]
│         │                                                   │
│         │ (Passes)                                 (Fails >= 3 attempts)
│         ▼                                                   │
│    [Update PLAN.md (Mark Done, Log Discoveries)]            ▼
│         │                                           [Circuit Breaker / Roadblock]
│         ▼
└─── [Promote Next Task] (Repeat until Up Next is empty)
          │
          ▼
     [Final Completion Gate & Summary]
```

For each task in PLAN.md, follow this cycle:

1. **Refresh Rules & Read PLAN.md** $\rightarrow$ Read `PLAN.md` to identify the `Current Focus` task and verification requirement.
2. **Formulate a plan** $\rightarrow$ Outline your specific approach. Use `sequential_thinking` for complex multi-file logic.
3. **Execute** $\rightarrow$ Modify files and implement the change.
4. **Verify & Quality Gate** $\rightarrow$ Run the task's verification command (e.g. `npm test`, `pytest`). If `critic_review` is available, run it on modified files to verify code quality and flag regressions before marking Done.
5. **Transition & Update PLAN.md** $\rightarrow$ Mark completed task Done with notes on any deviations, promote next task.

---

## 🤖 Subagent Task Offloading Heuristic

When planning and executing tasks in `PLAN.md`, use this heuristic to decide whether to execute in-context or spawn a background subagent:

| Task Characteristics | Execution Strategy | Rationale |
| :--- | :--- | :--- |
| **Sequential / Tightly Coupled** (File B depends on File A) | **Inline Execution** (Current Agent) | Preserves shared working memory and immediate feedback. |
| **Core Architecture & Refactoring** | **Inline Execution** | Avoids context fragmentation and merge conflicts. |
| **Independent Parallel Modules** (e.g. 3 distinct microservices) | **Background Subagent** (`invoke_subagent`) | High speed; each subagent operates in parallel without context bloat. |
| **Deep Read-Only Research & API Exploration** | **Research Subagent** (`TypeName: "research"`) | Prevents search dumps and large manual files from polluting chat history. |
| **Batch Test / Documentation Sweeps** | **Self Subagent** (`TypeName: "self"`) | Offloads repetitive writes; reports final summary back when done. |

---

## Handling Roadblocks, Blocked Tasks & Circuit Breakers

When a task fails verification or encounters an obstacle:

### 1. Verification Circuit Breaker (3-Attempt Limit)
- **Attempts 1–2:** Inspect error output/logs, formulate an alternate fix with `sequential_thinking`, apply the fix, and re-verify.
- **Attempt 3+ (Circuit Breaker):** **STOP execution.** Do not loop indefinitely. Revert unstable changes, log a roadblock note in `PLAN.md`, and use `ask_question` to consult the user.

### 2. Failure & Blocked Task Protocol (`[BLOCKED: reason]`)
If a task cannot proceed due to missing prerequisites, external dependency errors, or architectural conflicts:
1. Update `PLAN.md`:
   ```markdown
   ## Current Focus
   - [ ] [BLOCKED: Missing database migration script] Fix user auth route [Verify: npm test]
   ```
2. Add a resolution sub-task under `## Discovered / Backlog` or ask the user for guidance via `ask_question`.
3. If unblocking requires a pivot, document the pivot in `PLAN.md` before writing new code.

### 3. Git-Aware Rollback Protocol
If an approach fails and must be abandoned:
1. Inspect working state: `git status` and `git diff`.
2. Cleanly revert uncommitted changes from the failed attempt:
   - For modified files: `git checkout -- <file>` or targeted editor revert.
   - For scratch files: delete them.
3. Verify clean state before starting an alternate path.

### 4. Discoveries & Scope Guard
- If you discover new work, log it in `## Discovered / Backlog`. **Never silently expand the current task.**
- Mark items as `[BLOCKER]` (must be resolved before proceeding) or `[DEFERRED]` (nice-to-have, does not block completion).
- If `[BLOCKER]`, promote it to `Current Focus` and add a blocking note.

---

## Recovering from Context Compaction

If your conversation context was compacted or pruned:

1. Read `PLAN.md` — the `Done` section is the immutable historical truth of completed tasks.
2. **Assess Working Tree State:** Run `git status` to check whether `Current Focus` was partially modified before compaction.
3. Run the verification command for `Current Focus`:
   - If tests pass and artifacts exist $\rightarrow$ mark `Current Focus` Done and promote the next task.
   - If incomplete $\rightarrow$ formulate remaining sub-steps and proceed.
4. Do **not** re-execute tasks listed in `Done`.

---

## Completion Gate & Review

When all tasks in `Up Next` are empty and `Discovered` has no remaining `[BLOCKER]` items:

1. Read through `Done` to verify all acceptance criteria were satisfied.
2. Run full test suite / build checks across the workspace.
3. **Critic Review Gate**: Call `critic_review` on the full diff or modified files to verify no security or logic regressions were introduced.
4. Tell the user you are done and provide a concise summary of deliverables and any `[DEFERRED]` backlog items.
