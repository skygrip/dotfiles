---
name: plan
description: A generic framework and blueprint for analyzing, proposing, structuring, and tracking the step-by-step execution of any engineering task.
---

# Generic Project Plan Framework

This skill provides a structured blueprint for creating and tracking project plans. It is meant to be loaded at the start of any complex engineering task and written as a localized file (e.g., `PLAN.md` or `.pi/skills/plan/SKILL.md`) to guide implementation.

## Plan Blueprint & Structure

Every project plan created using this blueprint should follow this structure:

### 1. Requirement Analysis
- **Goal**: Clear, measurable description of what is being built or modified.
- **Scope**: Boundaries of the task (what is included, and what is explicitly excluded).
- **Key Constraints**: Platform requirements, architectural rules, performance limits.

### 2. Impact Analysis
- **Files to Modify/Create**: Precise list of code locations that will be touched.
- **Dependencies**: Affected modules, imports, schemas, or APIs.
- **Risks**: Potential side-effects, regressions, or breaking changes.

### 3. Proposed Solution Design
- **Architecture**: Design patterns, data model definitions, or logic flow.
- **APIs/Interfaces**: Specifications of any new entry points or endpoints.
- **Mockups/Mock Data** (if applicable).

### 4. Step-by-Step Implementation Plan
Break down the implementation into discrete, sequentially dependent, and atomic tasks. Use standard markdown checkboxes:

- [ ] **Step 1**: Describe atomic task 1 (e.g., initial setup, basic types, or mock file).
- [ ] **Step 2**: Describe atomic task 2 (e.g., core logic implementation).
- [ ] **Step 3**: Describe atomic task 3 (e.g., interface wiring or CLI script).
- [ ] **Step 4**: Describe atomic task 4 (e.g., polishing, formatting, final checks).

### 5. Verification and Testing
For every checkbox step, define the explicit, repeatable verification check (e.g., a specific terminal command, lint script, or unit test run):
- **Test 1**: Verify Step 1 succeeds by running `...`.
- **Test 2**: Verify Step 2 succeeds by checking `...`.

### 6. Reflection & Self-Correction
- **At each step**: Reflect on any test errors or compilation failures. Leverage the `sequential_thinking` tool to systematically analyze complex failures before editing files. *Tip: Always list your active reasoning micro-checklist at the top of your thoughts and use `[ ]` and `[x]` to track your progress through the steps.*
- **Unblock High-Impact Ambiguities**: If you hit a high-stakes design branch (e.g., choosing a major framework or architectural pattern), a requirement contradiction, or a destructive environment step, **if the `ask_question` tool is active**, invoke it immediately to get user alignment. For low-impact choices (e.g., naming conventions, utility layouts, or standard refactors), make the call autonomously using your best judgment—do not nag the user for micro-decisions.
- **Pre-Write Critique**: Before calling `write` or `edit` on important code or configuration files, **if the `critic_review` tool is active in your current tool list**, pass your draft through it against the project guidelines (e.g. unnumbered headings and maximum privacy). If the tool is unavailable, perform an active, manual self-critique pass in your thoughts to check for strict constraints before writing.
- **Documentation**: Record lessons learned and project-specific memory adjustments directly into `EVOLUTION.md`.
