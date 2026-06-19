---
description: Plan-and-execute workflow for multi-task implementations. Creates a living PLAN.md and uses sequential_thinking to work through tasks one by one, updating the plan as reality changes. Use when starting a project, feature, or multi-step task.
---

# Plan & Execute

This skill implements a unified plan-execute loop. The plan is a living document — it changes as you work. You do not finish planning before you start executing.

## Step 1: Create or Read PLAN.md

If PLAN.md does not exist, create it. If it exists, read it.

Also read EVOLUTION.md if it exists. Check for any past lessons relevant to the current project or technology stack — they may save you from repeating a known mistake.

### PLAN.md Format

Use this exact structure:

```markdown
# PLAN — [Brief Project/Feature Name]

> **Workflow:** Execute with `use plan-execute` and `sequential_thinking`. See `plan-execute/SKILL.md`. Check `EVOLUTION.md` for past lessons before starting.

> **Goal:** One/Two-sentence description of what success looks like.

## Current Focus
- [ ] The single task you are working on right now

## Up Next
- [ ] Second task
- [ ] Third task
- [ ] Fourth task

## Discovered
_(tasks added during execution — roadblocks, prerequisites, new requirements)_

## Done
_(completed tasks moved here with inline notes on what changed)_
```

### Rules for Writing Tasks
- Each task should be completable in one sequential_thinking session (roughly 3-10 tool calls).
- If a task feels bigger than that, break it into subtasks now.
- Write tasks as actions, not descriptions: "Add JWT validation to auth middleware" not "Auth middleware needs JWT."
- Order tasks by dependency — things that must exist first go first.

### When the Task is Ambiguous
If the user's request has genuine ambiguity — multiple valid interpretations, unclear scope, or a design decision that affects the whole plan — use `ask_question` before writing PLAN.md. Don't guess.

Examples of when to ask:
- "Build auth" → ask: `type: 'select'`, choices: ["Session-based auth", "JWT/stateless auth", "OAuth with external provider"]
- "Refactor the API" → ask: `type: 'select'`, choices: ["Just clean up code style", "Restructure routes and handlers", "Full rewrite with new framework"]
- Unclear priority → ask: `type: 'confirm'`, question: "Should I prioritize speed of delivery or code quality?"

Do not ask about trivial implementation details. Only ask when the answer changes the plan structure.

## Step 2: Execute the Loop

For each task in PLAN.md, follow this cycle:

```
1. Read PLAN.md → identify the Current Focus task
2. Call sequential_thinking Step 1:
   - goal: the Current Focus task text
   - exitInstruction: "Mark task done in PLAN.md with a note on approach. 
     Add any discovered tasks. Move next task to Current Focus. 
     Check for EVOLUTION.md lessons. Then start next task."
   - observation: state the task and what you already know
   - reasoning: outline your approach (1-3 sentences, be specific)
3. Execute: edit a file, run a command, read code
4. Call sequential_thinking again:
   - observation: what the tool returned
   - reasoning: did it work? what's next?
5. Repeat steps 3-4 until the task is done
6. Call sequential_thinking with action: "conclude"
7. Follow your exitInstruction:
   - Update PLAN.md (see "Updating the Plan" below)
   - Check for EVOLUTION.md lessons
   - Start the next task (go to step 1)
```

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

## Handling Roadblocks

When you hit a problem mid-task:

1. **Small adjustment:** Update your reasoning in sequential_thinking and keep going. No plan change needed.
2. **Approach change:** Use `action: "rewind"` in sequential_thinking to try a different approach. The failed path is cleaned from context.
3. **Multiple valid approaches:** If you see 2+ viable paths and the choice has real consequences (performance, complexity, compatibility), use `ask_question` with `type: 'select'` to let the user pick. Don't burn time on an approach the user wouldn't have chosen.
4. **New dependency discovered:** Add it to Discovered in PLAN.md immediately (don't wait for conclude). Then decide:
   - If you can finish the current task without it → keep going, handle it later.
   - If it blocks the current task → conclude current task as blocked, promote the dependency to Current Focus.
5. **Task is bigger than expected:** Conclude the current session, break the task into subtasks in PLAN.md, and restart with the first subtask.

## Completion

When all tasks in Up Next are empty and Discovered has no remaining items:

1. Read through the Done section to verify nothing was skipped.
2. Run any relevant tests or validation commands.
3. If the `critic_review` tool is available, run it on each changed file with the project's active constraints. If not available, do a manual self-critique pass checking for logical correctness, security issues, and style violations. Fix any blocking findings before proceeding.
4. Review PLAN.md one final time — update the Goal line to reflect what was actually delivered (it often differs from the original).
5. Tell the user you're done and summarize what changed from the original plan.
