---
name: ast-grep
description: Default structural AST search and syntax-aware code refactoring across languages (e.g. ast-grep run -p PATTERN -l LANG --json=stream, ast-grep run -p PATTERN -r REWRITE -U).
---

# `ast-grep` Structural AST Capabilities Reference

Fast, syntax-aware tool for structural code search, AST linting, codebase outline inspection, and in-place code rewrites across TypeScript, JavaScript, Python, Rust, Go, C/C++, Java, and more. Matches syntax trees regardless of whitespace, formatting, or comments.

---

## 1. Execution Primitives, Fast-Paths & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Interactive Prompt Hang** | Invoking `-i` prompts for user input at every match, hanging subshells | Always execute batch rewrites headlessly using `-U` (or `--update-all`) |
| **Silent Pattern Mismatch** | Subtle grammar differences (e.g. expressions vs. statements) return 0 matches | If pattern fails, inspect actual Tree-sitter AST nodes using `--debug-query=ast` or `--debug-query=cst` |
| **Multi-Node Argument Trap** | Using `$ARGS` matches only 1 argument; function calls with 0 or 3 args fail | Use `$$$ARGS` (triple dollar sign) to capture zero or more comma-delimited arguments |
| **Structured Output Format** | Default output includes ANSI colors and multi-line terminal formatting | Pass `--json=stream` (JSONL) when piping results to tools or agent reasoning steps |
| **Scope Boundary Leaks** | Unbounded rewrites touch vendored files, build directories, or tests | Always scope with `-g` or pass explicit directories: `ast-grep run -p PATTERN -l LANG -U src/` |

---

## 2. CLI Execution Flags & Metavariable Matrix

| Flag / Option | Shorthand | Purpose | Syntax Pattern |
| :--- | :--- | :--- | :--- |
| `--pattern PATTERN` | `-p` | Structural AST pattern to search for | `ast-grep run -p 'fetchData($$$ARGS)' -l ts` |
| `--rewrite REWRITE` | `-r` | AST replacement template for code transformation | `ast-grep run -p 'a && a.b()' -r 'a?.b()' -l ts -U` |
| `--update-all` | `-U` | Apply rewrites directly in-place across all files | `ast-grep run -p 'old($A)' -r 'new($A)' -l py -U src/` |
| `--lang LANG` | `-l` | Target language identifier (`ts`, `py`, `rs`, `go`, `c`) | `ast-grep run -p 'func($$$)' -l rust` |
| `--globs GLOB` | `-g` | Include or exclude files (`-g '!tests/**'`) | `ast-grep run -p 'run()' -l ts -g 'src/**'` |
| `--kind KIND` | `-k` | Filter matches to specific AST node kinds | `ast-grep run -k call_expression -l ts` |
| `--strictness` | | Mode: `smart` (default), `signature`, `template`, `relaxed`, `ast`, `cst` | `ast-grep run -p 'fn()' --strictness signature -l ts` |
| `--debug-query` | | Prints Tree-sitter AST/CST pattern structure | `ast-grep run -p '$A.connect()' --debug-query=ast` |
| `--json=stream` | | Emits structured JSONL for programmatic parsing | `ast-grep run -p 'fn()' -l ts --json=stream` |
| `outline` | | Subcommand: inspect symbols, imports, and classes | `ast-grep outline src/index.ts` |

| Syntax Token | AST Matching Capability | Behavioral Rule |
| :--- | :--- | :--- |
| **`$VAR`** | Single named AST node | Matches exactly **one** AST node (identifier, expression, literal). |
| **`$A == $A`** | Enforced equality constraint | Repeated identical meta-variables enforce AST subtree equality. |
| **`$$$ARGS`** | Multi-node wildcard | Matches **zero or more** comma-delimited nodes (arguments, statements). |
| **`$_`** | Non-capturing wildcard | Matches AST nodes without storing captures in memory (higher performance). |

---

## 3. Relational Rules & Strictness Matrix

Used in `--inline-rules` YAML strings or rule configurations:

| Relational Operator | Purpose | Behavioral Rule |
| :--- | :--- | :--- |
| **`inside`** | Enclosing parent constraint | Target pattern must reside inside specified ancestor AST node. |
| **`has`** | Descendant child constraint | Target pattern must contain specified child node anywhere in its subtree. |
| **`precedes` / `follows`** | Sibling order constraint | Target pattern must appear before or after specified sibling node. |
| **`not`** | Inverted predicate | Target node must **not** match specified sub-rule. |
| **`all` / `any`** | Logical AND / OR | All sub-rules must match (`all`) or at least one must match (`any`). |
| **`stopBy`** | Traversal boundary | Limits traversal depth for `inside` or `has` searches (`stopBy: end_of_function`). |

| Strictness Mode | Match Behavior | Supported Languages (`-l`) |
| :--- | :--- | :--- |
| **`smart`** *(Default)* | Matches all pattern nodes, skipping unnamed trivia and formatting differences. | `ts`, `tsx`, `js`, `jsx` |
| **`signature`** | Matches AST nodes except comments, ignoring exact text contents. | `python`, `py`, `rust`, `rs` |
| **`relaxed`** | Matches named AST nodes; ignores all comments, types, and punctuation. | `go`, `java`, `c`, `cpp` |
| **`cst`** | Exact match of every node in Concrete Syntax Tree (including trivia/punctuation). | `csharp`, `cs`, `html`, `css` |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: In-place AST refactor with argument restructuring and verification
ast-grep run -p 'oldFetch($URL, $CB, $OPTS)' -r 'newFetch($URL, { callback: $CB, options: $OPTS })' -l ts -U src/
ast-grep run -p 'oldFetch($$$ARGS)' -l ts src/ | wc -l

# Stage 2: Relational search: find dangerous SQL queries inside unauthenticated handlers
ast-grep run --inline-rules '
rule:
  pattern: db.query($SQL)
  inside:
    pattern: function $HANDLER($REQ, $RES) { $$$ }
    not:
      has:
        pattern: authMiddleware($$$)
' -l ts --json=stream

# Stage 3: Structural outline inspection of symbols and members in a file
ast-grep outline src/services/AuthService.ts
```
