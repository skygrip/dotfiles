---
name: audit
description: Run a high-speed, isolated security, quality, and style audit on the active file or workspace.
---

# Audit Skill

This skill provides a highly disciplined auditing routine to inspect workspace code, configurations, and documentation drafts before making permanent writes. It is designed to be fully portable across any environment or repository.

## Audit Execution Routine

When you are asked to audit a file, project, or draft, load this skill and carry out these checks systematically.

### 1. Isolate the Target
- Identify the specific file, module, or code draft that needs to be audited.
- Read its contents to parse its current state.

### 2. Formulate the Constraints
Identify the active constraints for the audit. In any environment, you must check for these three core pillars:
- **Logical Correctness**: Syntax errors, broken imports, missing reference objects, or unhandled errors.
- **Security & Privacy Constraints**: Exposed secrets, private API keys, or personal identifying data (maximum privacy).
- **Style & Formatting Guidelines**: Project-local file preferences, carriage return formatting, or specific rules (such as avoiding numbered headings in Markdown).

### 3. Execute the Critique Pass
- **Automated Critique Option**: If the `critic_review` tool is active in your current tool inventory, execute it on your draft. **Crucially**, pass your code into the `draft` parameter, and pass your formulated constraints as an array of strings directly into the `rules` parameter.
- **Manual Self-Critique Fallback**: If no automated review tools are available in your current environment, perform a manual, structured self-critique pass within your thoughts, systematically grading your draft against each of the three core pillars.

### 4. Process Findings & Correct
- Group findings into two severity levels:
  - **Blocking**: Severe bugs, security vulnerabilities, or absolute guideline violations that must be corrected.
  - **Advisory**: General stylistic advice, minor performance optimizations, or optional feedback.
- If blocking errors are found, use the `sequential_thinking` tool to analyze alternative corrections, plan a surgical fix, and re-audit the updated draft.
