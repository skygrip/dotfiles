---
name: plan-execute
description: Plan-execute workflow for complex tasks. Creates a living PLAN.md to track progress. Use for multi-step tasks.
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
4. **Verify & Quality Gate** $\rightarrow$ Run the task's verification command (e.g. `npm test`, `pytest`). If `critic_review` is available, run it on modified files **(see `audit/SKILL.md`)**.
5. **Transition & Update PLAN.md** $\rightarrow$ Mark completed task Done with notes on any deviations, promote next task.

---

## Handling Roadblocks & Circuit Breakers

When a task fails verification or encounters an obstacle:

### Verification Circuit Breaker (3-Attempt Limit)
- **Attempts 1–2:** Inspect error output/logs, formulate an alternate fix with `sequential_thinking`, apply the fix, and re-verify.
- **Attempt 3+ (Circuit Breaker):** **STOP execution.** Do not loop indefinitely. Revert unstable changes, log a roadblock note in `PLAN.md`, and use `ask_question` to consult the user.

### Git-Aware Rollback Protocol
If an approach fails and must be abandoned:
1. Inspect working state: `git status` and `git diff`.
2. Cleanly revert uncommitted changes from the failed attempt:
   - For modified files: `git checkout -- <file>` or targeted editor revert.
   - For scratch files: delete them.
3. Verify clean state before starting an alternate path.

### Discoveries & Scope Guard
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

## Completion

When all tasks in `Up Next` are empty and `Discovered` has no remaining `[BLOCKER]` items:

1. Read through `Done` to verify all acceptance criteria were satisfied.
2. Run full test suite / build checks across the workspace.
3. Run an audit on all modified files **(see `audit/SKILL.md`)**.
4. Tell the user you are done and provide a concise summary of deliverables and any `[DEFERRED]` backlog items.
