---
name: audit
description: Audit code, config, or docs for bugs, security vulnerabilities, edge cases, and style issues. Use before committing changes or completing tasks.
---

# Audit Skill

Run a rigorous quality gate on code, configuration, or documentation changes to prevent regressions, bugs, and security vulnerabilities.

---

## Severity Criteria

Classify every audit finding strictly into one of two tiers:

| Tier | Definition | Action Required |
|---|---|---|
| **`[BLOCKING]`** | Functional bugs, syntax/type errors, security vulnerabilities, unhandled null/exceptions, data corruption risks, broken imports/contracts, or explicit project constraint violations. | **MUST fix immediately.** Re-audit until PASS. |
| **`[ADVISORY]`** | Minor style suggestions, optional refactoring, non-critical performance optimizations, naming improvements, or docstring additions. | Fix if trivial (<1 min), batch ask, or report in final summary. |

---

## Session Rules Cache

**Build your rules list once per session** during the first audit. Reuse it across subsequent audits without re-reading unchanged configs.

### Rules Discovery Checklist:
1. **Environment & Behaviors:** `.pi/AGENTS.md`, `.pi/APPEND_SYSTEM.md` (or workspace-local equivalents).
2. **Project Tooling:** `tsconfig.json`, `pyproject.toml`, `.eslintrc*`, `biome.json`, `Cargo.toml`.
3. **Language & Security Defaults:** Combine with the checklist below.

> [!NOTE]
> If context compaction occurs or project configuration files are modified, rebuild the rules cache.

---

## Core Review Checklists

### 1. Universal Security & Robustness Checklist (All Files)
- [ ] **No Secrets:** No hardcoded API keys, tokens, passwords, or private endpoints.
- [ ] **Injection Prevention:** Parameterized SQL queries, safe shell execution (no unsanitized string interpolation in `exec`/`spawn`), safe HTML escaping.
- [ ] **Path Safety:** Validate file paths against path traversal (`../` or escaping workspace root).
- [ ] **Null & Boundary Safety:** Check null/undefined on external inputs, empty collections, zero values, and off-by-one boundary conditions.
- [ ] **Async & Resource Safety:** No unhandled promise rejections, dangling subscriptions, or unclosed file/socket streams.

### 2. Language-Specific Rules

| File Type | Critical Checks |
|---|---|
| **TypeScript / JavaScript** | Strict typing (no `any`), handle `null`/`undefined`, all `Promise` calls awaited or caught, no unhandled event emitters, imports resolve. |
| **Python** | Explicit exception handling (no bare `except`), no mutable default arguments (`def f(x=[])`), type annotations on public APIs, context managers (`with`) for resources. |
| **Rust / Go** | Proper error propagation (no unhandled `err`, avoid unvetted `.unwrap()`), concurrency sync (data races, channel deadlocks). |
| **Shell / Bash** | Double-quote all variables (`"$VAR"`), set strict flags (`set -euo pipefail`), validate external CLI inputs. |
| **Markdown / Docs** | Valid relative links, accurate command flags, up-to-date code examples. |
| **JSON / YAML / TOML** | Strict schema validity, no duplicate keys, no trailing commas in strict JSON. |
| **Docker / IaC** | Pinned base image tags, non-root user execution, no exposed sensitive build arguments. |

---

## Audit Workflows

### Fast Path: Deterministic Check (Always First)
Before running AI review, execute fast deterministic validation if available:
```bash
# Examples:
npm test / npx tsc --noEmit
pytest / uv run ruff check .
cargo check / cargo test
```
*If deterministic tests fail, fix them first before requesting AI review.*

---

### Single-File / Changed-Chunk Audit

#### Option A: Using `critic_review` (Recommended)
Pass `filePath` directly without pre-reading the entire file into main context (the tool reads from disk in an isolated sub-session):

```
critic_review(
  filePath: "src/auth/token.ts",
  startLine: 45,       # (Optional) restrict to modified range for large files
  endLine: 120,
  rules: [
    "No exposed credentials or unvalidated tokens",
    "Must handle expired or malformed JWTs gracefully",
    <project-specific rules from session cache>
  ]
)
```

*For uncommitted in-memory edits, use `draft: "<content>"`.*

#### Option B: Manual Self-Critique (Fallback)
If `critic_review` is unavailable, review changes against the checklist and format findings:
```text
* [BLOCKING] (Line 42): Unsanitized user input passed directly to exec() -> Fix: Use execFile with args array.
* [ADVISORY] (Line 88): Redundant array allocation inside loop -> Fix: Hoist array outside loop.
```

---

### Acting on Findings

1. **PASS (Zero Blocking Issues):** Proceed with task completion.
2. **BLOCKING Issues Found:**
   - Fix all blocking issues.
   - For complex fixes, use `sequential_thinking` to reason through the solution.
   - Re-audit the modified lines to verify the fix.
3. **ADVISORY Issues:**
   - **≤ 3 issues:** Fix if trivial (<1 minute each); otherwise list in the final response.
   - **≥ 4 issues:** Do not ask one-by-one. Use `ask_question` with batched choices:
     ```
     ask_question(
       type: "select",
       question: "Found 4 advisory improvements. How would you like to proceed?",
       choices: [
         "Fix all advisories automatically",
         "Proceed without advisory fixes (report in summary)",
         "Show details and let me choose"
       ],
       defaultValue: "Proceed without advisory fixes (report in summary)"
     )
     ```

---

## Multi-File Audit (Pre-Commit / Plan-Execute Milestone)

1. **Discover Changed Files:**
   ```bash
   git status -s
   # or: git diff --name-only HEAD
   ```
2. **Filter:** Exclude generated files, lockfiles, and unmodified reads.
3. **Run Quality Gate:** Run deterministic linters/tests, then run Single-File Audit on each modified source file.
4. **Summary Report:** Provide a concise status:
   - **Files Audited:** Count and paths.
   - **Blocking Issues:** Fixed and verified.
   - **Advisories:** Applied or noted for follow-up.
