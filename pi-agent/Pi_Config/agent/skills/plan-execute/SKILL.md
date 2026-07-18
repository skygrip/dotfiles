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

- [ ] Does `PLAN.md` exist? → If yes, read it. If no, create it from the template below.
- [ ] Is the goal ambiguous? → If yes, ask focused questions before writing the plan. (See "When the Task is Ambiguous" below.)
- [ ] Review the draft plan for correct dependency ordering before executing.

### Resuming or Re-planning
If `PLAN.md` already exists, or if you are resuming work from a previous attempt:
- **Do not clear the `Done` section.** Preserve the history of previously completed tasks.
- If some tasks were completed manually or in a previous session, document them in `Done` (e.g., `- [x] Previously Completed: Initial project setup`) so the plan reflects full scope.

### PLAN.md Format

Use this exact structure:

```markdown
# PLAN — [Brief Project/Feature Name]

> **Workflow:** Execute with `use plan-execute`. See `plan-execute/SKILL.md`.

> ## Goal
- [ ] What success looks like.
- [ ] Other key requirements. Ask questions to expand on requirements if you are unsure.

## Current Focus
- [ ] The single task you are working on right now

## Up Next
- [ ] Second task
- [ ] Third task
- [ ] Fourth task

## Discovered
_(tasks added during execution — roadblocks, prerequisites, new requirements)_

## Done
- [x] Previously Completed: Initial workspace setup and structure definition
```

### Rules for Writing Tasks
- A task should produce exactly one verifiable artifact: a file that exists, a test that passes, or a command that succeeds.
- If a task feels larger than that, break it into subtasks now.
- Write tasks as actions, not descriptions: "Add JWT validation to auth middleware" not "Auth middleware needs JWT."
- Order tasks by dependency — things that must exist first go first.

### When the Task is Ambiguous
If the user's request has genuine ambiguity — multiple valid interpretations, unclear scope, or a design decision that affects the whole plan — use `ask_question` before writing PLAN.md. Don't guess.

Examples of when to ask:
- "Build auth" → ask: `type: 'select'`, choices: ["Session-based auth", "JWT/stateless auth", "OAuth with external provider"]
- "Refactor the API" → ask: `type: 'select'`, choices: ["Just clean up code style", "Restructure routes and handlers", "Full rewrite with new framework"]
- Unclear priority → ask: `type: 'confirm'`, question: "Should I prioritize speed of delivery or code quality?"

Do not ask about trivial implementation details. Only ask when the answer changes the plan structure.

### Plan Verification
Once PLAN.md is created or significantly revised, perform a review pass on the plan itself. If the `critic_review` tool is available, run it on `PLAN.md` to check for missing edge cases, logical gaps, and correct dependency ordering before starting execution.

---

## Step 2: Execute the Loop

For each task in PLAN.md, follow this cycle:

1. **Refresh Rules & Read PLAN.md** → Run `use plan-execute` to refresh this workflow's instructions in your active context (especially important if a compaction occurred). Then, read `PLAN.md` to identify the Current Focus task.
2. **Formulate a plan** → Outline your specific approach for the current task. If helpful, use the `sequential_thinking` tool to log your thoughts or break down complex logic.
3. **Execute** → Modify files, run build/test commands, and verify results.
4. **Verify & Critique** → Run relevant build/test commands to ensure correctness. If the `critic_review` tool is available, run it on all modified files to catch bugs, logic flaws, or style violations **(run `use audit` or read `audit/SKILL.md` for rules-building and audit guidelines)** before marking the task as completed.
5. **Transition** → Proceed to update PLAN.md (see "Updating the Plan" below) and start the next task.

---

## Step 3: Updating the Plan

After each task concludes, update PLAN.md. This is not optional.

### Mark Done
Move the completed task from Current Focus to Done. Add a short note if the approach changed:

```markdown
## Done
- [x] Add JWT validation to auth middleware — used jose library instead of jsonwebtoken (smaller, ESM native)
```

### Add Discovered Tasks
If you found new work during execution, add it to Discovered:

```markdown
## Discovered
- [ ] Add rate limiting to /api/auth — no throttling exists, found during JWT work
- [ ] Fix user.test.ts flaky timeout — noticed intermittent failure when running test suite
```

### Scope Guard
If you discover new work, always add it to Discovered — **never silently expand the current task**. If the discovery is critical and blocks completion, ask the user before pivoting.

### Promote Next Task
Move the top item from Up Next to Current Focus. If a Discovered task blocks the next planned task, promote the blocker instead and add a note:

```markdown
## Current Focus
- [ ] Add rate limiting to /api/auth (blocking: JWT endpoint is exposed without throttle)
```

### Revise Tasks
If a task turned out to be unnecessary or was solved by another task, remove it with a note in Done:

```markdown
## Done
- [x] ~~Migrate session store to Redis~~ — unnecessary, switched to stateless JWT instead
```

---

## Handling Roadblocks

When you hit a problem mid-task:

1. **Small adjustment:** Adjust your approach and keep going. No plan change needed.
2. **Approach change:** Pivot to a different approach. Clean up any temporary changes from the failed path if needed.
3. **Multiple valid approaches:** If you see 2+ viable paths and the choice has real consequences (performance, complexity, compatibility), use `ask_question` with `type: 'select'` to let the user pick. Don't burn time on an approach the user wouldn't have chosen.
4. **New dependency discovered:** Add it to Discovered in PLAN.md immediately. Then decide:
   - If you can finish the current task without it → keep going, handle it later.
   - If it blocks the current task → mark the current task as blocked, promote the dependency to Current Focus.
5. **Task is bigger than expected:** Break the task into subtasks in PLAN.md, and start with the first subtask.

---

## Recovering from Context Compaction

If your message history appears truncated, or you feel uncertain about what has been completed:

1. Run `use plan-execute` to reload this workflow.
2. Read `PLAN.md` — the `Done` section is the canonical record of what was completed.
3. Do **not** re-execute tasks that appear in `Done`. Start from `Current Focus`.
4. If `PLAN.md` does not exist or seems incomplete, ask the user what was completed before resuming.

---

## Completion

When all tasks in Up Next are empty and Discovered has no remaining items:

1. Read through the Done section to verify nothing was skipped.
2. Run any relevant tests or validation commands.
3. If the `critic_review` tool is available, run it on each changed file with the project's active constraints **(see `audit/SKILL.md` for details)**. If not available, do a manual self-critique pass checking for logical correctness, security issues, and style violations. Fix any blocking findings before proceeding.
4. Review PLAN.md one final time — update the Goal line to reflect what was actually delivered (it often differs from the original).
5. Tell the user you're done and summarize what changed from the original plan.
