---
description: Audit code, config, or documentation for bugs, security issues, and style violations. Uses critic_review for isolated objective review when available, with manual fallback. Use before committing changes or at the end of a plan-execute cycle.
---

# Audit

Run a quality gate on one or more files before committing changes.

## Single File Audit

### 1. Read the target file
Read the file you want to audit. You need its full contents.

### 2. Build your rules list
Check for project-specific constraints first:
- Read `.pi/APPEND_SYSTEM.md` for environment rules (line endings, shell syntax)
- Read `EVOLUTION.md` for known gotchas
- Check for linter configs (`.eslintrc`, `pyproject.toml`, `tsconfig.json`, etc.)

Combine with these defaults (skip any that don't apply to the file type):
- No syntax errors, broken imports, or undefined references
- No exposed secrets, API keys, tokens, or hardcoded credentials
- No unhandled errors or missing null checks on external input
- Consistent with existing code style in the project

### 3. Run the review
**If `critic_review` tool is available:**
```
critic_review(
  draft: <full file contents as string>,
  rules: [
    "No exposed secrets or hardcoded credentials",
    "All imports must resolve",
    "Handle null/undefined on external inputs",
    <any project-specific rules from step 2>
  ]
)
```

**If `critic_review` is not available:**
Do a manual self-critique. Check the file against each rule from step 2 and the defaults above. List findings in this format:
```
* [BLOCKING] (Line X): description of the issue → Fix: what to change
* [ADVISORY] (Line X): description of the suggestion
```

### 4. Act on findings
- **PASS or no BLOCKING issues:** You're done. Move on.
- **BLOCKING issues found:** Fix each one. Then re-run the audit on the fixed file to confirm the fix didn't introduce new issues. If a fix is non-trivial, use `sequential_thinking` to reason through the correction before editing.
- **ADVISORY issues (3 or fewer):** Fix if quick (< 1 minute each). Otherwise note them for the user and move on.
- **ADVISORY issues (4+):** Use `ask_question` with `type: 'select'` to present the list and let the user pick which ones matter. Don't spend time fixing advisories the user doesn't care about.

## Multi-File Audit

When auditing a set of changed files (e.g., at the end of a plan-execute cycle):

1. Identify which files were changed during the session.
2. Run the single file audit on each changed file.
3. Skip files that were only read, not modified.
4. Report a summary: how many files passed, how many had blocking issues, what was fixed.
