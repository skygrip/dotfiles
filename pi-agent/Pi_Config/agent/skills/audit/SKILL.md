---
description: Audit code, config, or documentation for bugs, security issues, and style violations. Uses critic_review for isolated objective review when available, with manual fallback. Use before committing changes or at the end of a plan-execute cycle.
---

# Audit

Run a quality gate on one or more files before committing changes.

## Session Rules Cache

**Build your rules list once per session** at the start of the first audit. For all subsequent audits in the same session, reuse this rules list without re-reading config files (unless `EVOLUTION.md` was updated during the session). Append your session rules list to `EVOLUTION.md` using the **Persistent Playbook** format (defined in `AGENTS.md`) to persist it for future sessions.

To build the session rules list, check:
- `EVOLUTION.md` for known gotchas.
- `.pi/APPEND_SYSTEM.md` for environment rules (line endings, shell syntax)
- Project linter configs (`.eslintrc`, `pyproject.toml`, `tsconfig.json`, etc.)

Then combine with the default rules below.

---

## Default Rules by File Type

Apply only the rules relevant to the file being audited:

| File Type | Key Checks |
|---|---|
| **TypeScript / JavaScript** | No `any` types, no unhandled promise rejections, no missing `await`, all imports resolve |
| **Python** | No bare `except`, no mutable default arguments, missing type hints on public functions |
| **Shell / Bash** | Unquoted variables (`$VAR` → `"$VAR"`), missing `set -e`, unvalidated external inputs |
| **Markdown** | Broken relative links, missing frontmatter if required by project convention |
| **JSON / YAML / TOML** | Trailing commas (JSON), duplicate keys, type mismatches |
| **All types** | No exposed secrets/API keys, no hardcoded credentials, no undefined references |

---

## Pre-Edit Audit (Exploratory)

Before modifying a file you're unfamiliar with, run a pre-edit audit:

1. Read the file.
2. Apply the default rules for its file type.
3. Note any existing issues — these are **not your bugs to fix**, but awareness prevents confusion later.
4. Report the pre-existing issue count to the user so they know the baseline quality before your changes.

---

## Single File Audit

### Step 1: Read the target file
Read the file you want to audit. You need its full contents.

### Step 2: Apply your rules list
Use the `[AUDIT RULES — session]` list if already built. If this is the first audit of the session, build it now (see "Session Rules Cache" above).

### Step 3: Run the review

**If `critic_review` is available:**
```
critic_review(
  filePath: <path to file>,
  language: <optional language type, e.g., "python" (inferred if omitted)>,
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

### Step 4: Act on findings
- **PASS or no BLOCKING issues:** You're done. Move on.
- **BLOCKING issues found:** Fix each one. Then re-run the audit on the fixed file to confirm the fix didn't introduce new issues. If a fix is non-trivial, use `sequential_thinking` to reason through the correction before editing.
- **ADVISORY issues (3 or fewer):** Fix if quick (< 1 minute each). Otherwise note them for the user and move on.
- **ADVISORY issues (4+):** Use `ask_question` with `type: 'select'` to present the list and let the user pick which ones matter. Don't spend time fixing advisories the user doesn't care about.

---

## Multi-File Audit

When auditing a set of changed files (e.g., at the end of a plan-execute cycle):

1. Build the session rules list once (if not already built).
2. Identify which files were changed during the session.
3. Run the single file audit on each changed file, reusing the same rules list.
4. Skip files that were only read, not modified.
5. Report a summary: how many files passed, how many had blocking issues, what was fixed.
