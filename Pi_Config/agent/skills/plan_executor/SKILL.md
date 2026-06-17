---
name: plan-executor
description: A generic, autonomous execution engine designed to methodically burn down checklists, verify each step using local tools, and persist progress state.
---

# Plan Executor Skill

This skill provides a highly disciplined, stateful loop for executing multi-step project plans. It is designed to act as a robust state machine, methodically carrying out each checkbox task sequentially, running verification commands, and updating the checklist state.

## Autonomous Execution Routine

When you enter autonomous execution mode for a plan, you must transition into this strict, noiseless loop. Avoid conversational filler or pauses. Let your tool calls do the work.

### The 5-Step Execution Loop

1. **Locate & Read the Plan**:
   - Locate the active checklist file in the workspace (e.g., `PLAN.md` or `.pi/skills/plan/SKILL.md`).
   - Call `read` on this file to parse its current state.

2. **Isolate the Target Checkbox**:
   - Identify the highest priority unmarked checkbox `[ ]` in the implementation sequence.
   - If all checkboxes are marked `[x]`, output a final success summary and gracefully exit the loop.

3. **Surgical Implementation**:
   - Focus 100% of your attention on implementing *only* the current step. Do not skip ahead or address future tasks.
   - Use `read` and the highly precise `edit` tool (with single/batched precise edits) to make the code changes required.
   - **Resolve Macro Blocks, Decide Micro Autonomously**: While implementing a step, use your own engineering judgment to make minor implementation decisions (naming, syntax, minor utilities) and keep building. Only invoke the `ask_question` tool if you hit a high-level blocker (e.g., introducing a heavy new library, missing sensitive credentials, or conflicting architectural requirements) where guessing could cause severe regressions.

4. **Verify the Step**:
   - Run the specified verification checks, compile commands, or unit tests using `bash` (e.g., executing a local testing script or platform check).
   - If the verification fails, do not blindly edit files. Leverage the `sequential_thinking` tool to analyze the error log, weigh alternative corrections, and design a clean fix before re-testing. *Tip: Write out your active reasoning checklist at the top of your thoughts and use `[ ]` and `[x]` to track your progress through each corrective step.*
   - Before writing the correction to disk, **if the `critic_review` tool is active in your current tool inventory**, pass the draft code through it against the active workspace rules and resolve any `[BLOCKING]` failures. If the tool is not available in this environment, perform a manual self-critique pass inside your thoughts to ensure compliance before writing. Do not mark the step complete until the test passes.

5. **Update and Recycle**:
   - Use the `edit` tool to change the current target checkbox from `[ ]` to `[x]`.
   - Immediately loop back to Step 1 by issuing another `read` tool call on the plan file to load the next state.

## Best Practices for Execution

- **Strict Task Bound**: Never implement parts of Step 3 while executing Step 2. Keep code diffs small, focused, and sequentially clean.
- **Fail Early**: If a compile check fails, do not proceed. Treat verification failures as blocking exceptions.
- **State Capture**: If you are interrupted or your session resets, the physical `[x]` markings in your plan file will allow you to instantly resume from the exact step you left off.
- **Dynamic Adaptability**: If a step reveals that subsequent steps are incorrect or unfeasible, modify the remaining checkboxes in the plan file using `edit`, and then continue.
