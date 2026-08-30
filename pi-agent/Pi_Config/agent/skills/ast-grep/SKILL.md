---
name: ast-grep
description: Structural AST-based code search and rewrites across languages (e.g. ast-grep run -p PATTERN -l LANG).
---

# `ast-grep` Structural AST Capabilities Reference

Fast, syntax-aware tool for structural code search, AST linting, codebase outline inspection, and in-place code rewrites across TypeScript, JavaScript, Python, Rust, Go, C/C++, Java, and more. Matches syntax trees regardless of whitespace, formatting, or comments.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`ast-grep`** (`sg`) | Canonical multi-language AST search and structural rewrite CLI |

---

## 2. CLI Execution Flags & Output Matrix

| Flag / Option | Shorthand | Purpose | Syntax Pattern |
| :--- | :--- | :--- | :--- |
| `--pattern <PAT>` | `-p` | Structural AST pattern to search for | `ast-grep run -p 'foo($$$ARGS)' -l ts` |
| `--rewrite <REW>` | `-r` | AST replacement template for code transformation | `ast-grep run -p 'a && a.b()' -r 'a?.b()' -l ts -U` |
| `--update-all` | `-U` | Apply rewrites directly in-place across all files | `ast-grep run -p '...' -r '...' -l py -U src/` |
| `--interactive` | `-i` | Interactive review (accept/reject per match) | `ast-grep run -p '...' -r '...' -l go -i` |
| `--lang <LANG>` | `-l` | Target language identifier (e.g. `ts`, `py`, `rs`, `go`) | `ast-grep run -p '...' -l rust` |
| `--globs <GLOB>` | `-g` | Include or exclude files (`-g '!tests/**'`) | `ast-grep run -p '...' -l ts -g 'src/**'` |
| `--kind <KIND>` | `-k` | Filter matches to specific AST node kinds | `ast-grep run -p '...' -k call_expression` |
| `--strictness` | | Mode: `smart` (default), `signature`, `template`, `relaxed`, `ast`, `cst` | `ast-grep run -p '...' --strictness signature` |
| `--debug-query` | | Prints Tree-sitter AST/CST pattern structure | `ast-grep run -p '$A.foo()' --debug-query=ast` |
| `--inline-rules` | | Execute complex multi-condition YAML rules on CLI | `ast-grep run --inline-rules 'rule: { ... }'` |
| `--json[=MODE]` | | Structured output: `stream` (JSONL), `compact`, `pretty` | `ast-grep run -p '...' -l ts --json=stream` |
| `outline` | | Subcommand: inspect symbols, imports, and classes | `ast-grep outline src/index.ts` |

---

## 3. Meta-Variable Syntax & Matching Matrix

| Syntax Token | AST Matching Capability | Behavioral Rule |
| :--- | :--- | :--- |
| **`$VAR`** | Single named AST node | Matches exactly **one** AST node (identifier, expression, argument, literal). |
| **`$A == $A`** | Enforced equality constraint | Repeated identical meta-variables enforce AST subtree equality. |
| **`$$$ARGS` / `$$$`** | Multi-node wildcard | Matches **zero or more** comma-delimited nodes (arguments, statements, parameters). |
| **`$$VAR`** | Unnamed token / punctuation | Captures unnamed punctuation or structural delimiters when required. |
| **`$_` / `$_NAME`** | Non-capturing wildcard | Matches AST nodes without storing captures in memory (higher performance). |

---

## 4. Relational Rules & Logical Operators Matrix

Used in `--inline-rules` YAML strings or rule configurations:

| Relational Operator | Purpose | Behavioral Rule |
| :--- | :--- | :--- |
| **`inside`** | Enclosing parent constraint | Target pattern must reside inside specified ancestor AST node (e.g. `inside: { pattern: 'class $C { $$$ }' }`). |
| **`has`** | Descendant child constraint | Target pattern must contain specified child node anywhere in its subtree. |
| **`precedes`** | Sibling order constraint | Target pattern must appear before specified sibling node in execution flow. |
| **`follows`** | Sibling order constraint | Target pattern must appear after specified sibling node. |
| **`not`** | Inverted predicate | Target node must **not** match specified sub-rule. |
| **`all` / `any`** | Logical AND / OR | All sub-rules must match (`all`) or at least one must match (`any`). |
| **`stopBy`** | Traversal boundary | Limits traversal depth for `inside` or `has` searches (e.g. `stopBy: end_of_function`). |

---

## 5. Strictness Modes & Language Identifiers Matrix

| Strictness Mode | Match Behavior |
| :--- | :--- |
| **`smart`** *(Default)* | Matches all pattern nodes, skipping unnamed trivia and formatting differences. |
| **`signature`** | Matches AST nodes except comments, ignoring exact text contents. |
| **`template`** | Matches text only, ignoring AST node kind distinctions. |
| **`relaxed`** | Matches named AST nodes; ignores all comments, types, and punctuation. |
| **`ast`** | Matches only named AST nodes across both pattern and target. |
| **`cst`** | Exact match of every node in Concrete Syntax Tree (including trivia/punctuation). |

| Language | Identifier (`-l`) | Language | Identifier (`-l`) |
| :--- | :--- | :--- | :--- |
| TypeScript / TSX | `ts`, `tsx` | Python | `python`, `py` |
| JavaScript / JSX | `js`, `jsx` | Rust | `rust`, `rs` |
| Go | `go` | C / C++ | `c`, `cpp` |
| Java | `java` | C# | `csharp`, `cs` |
| HTML / CSS / JSON | `html`, `css`, `json` | YAML / Bash | `yaml`, `bash` |

---

## 6. High-Leverage Composite Examples

```bash
# 1. In-place AST refactor: Modernize deprecated API with argument restructuring
ast-grep run -p 'oldFetch($URL, $CB, $OPTS)' -r 'newFetch($URL, { callback: $CB, ...$OPTS })' -l ts -U src/

# 2. Relational search: find dangerous SQL queries inside unauthenticated handlers
ast-grep run --inline-rules '
rule:
  pattern: db.query($SQL)
  inside:
    pattern: function $HANDLER($REQ, $RES) { $$$ }
    not:
      has:
        pattern: authMiddleware($$$)
' -l ts --json=stream

# 3. Structural outline inspection of symbols and members in a file
ast-grep outline src/services/AuthService.ts
```
