I want to implement the following feature or task: $@.

Load our `plan-execute` skill instructions. 

1. **Reconnaissance & Resume Check**:
   * If `PLAN.md` already exists in the workspace root, inspect it to understand current progress and resume the next incomplete task.
   * If starting fresh, explore the relevant codebase files using `rg` and `fd` to understand existing architecture and dependencies.

2. **Formulate Dependency-Ordered Plan**:
   * Create `PLAN.md` with clearly numbered, bite-sized tasks grouped into logical phases.
   * Explicitly define acceptance criteria and automated test/verification commands for each task.
   * Mark tasks with execution strategy: inline execution vs background subagents (`invoke_subagent`).

3. **Approval Gate**:
   * Present the implementation plan to me.
   * **STOP and wait for my explicit confirmation** before writing code or running modifying commands.

4. **Execution & Checkpointing**:
   * Upon approval, execute tasks strictly in dependency order.
   * Run verification tests and apply quality checks after each task.
   * Update `PLAN.md` after each step (`[x] Task`) to maintain real-time checkpoint state.