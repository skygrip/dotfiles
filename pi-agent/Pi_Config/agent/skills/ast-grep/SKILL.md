---
name: ast-grep
description: Structural AST-based code search and rewrites using ast-grep (sg). Use 'sg run -p "..." -l <lang>' to match syntax trees ignoring whitespace, or 'sg run -p "..." -r "..." -U' for safe AST rewrites.
---

# ast-grep (`sg`) Skill

`ast-grep` (`sg`) is a fast, syntax-aware tool for structural code search and AST rewrites across TypeScript, JavaScript, Python, Rust, Go, C/C++, Java, and more. It matches code by syntax tree structure rather than raw text or regex, automatically ignoring formatting, comments, and whitespace differences.

---

## Core CLI Usage

`ast-grep` is invoked via `ast-grep` or its alias `sg`.

```bash
# Basic structural search
sg run -p '<PATTERN>' -l <LANG> [PATH]

# In-place code rewrite across files
sg run -p '<PATTERN>' -r '<REWRITE>' -l <LANG> -U [PATH]

# Interactive rewrite review (prompt per match)
sg run -p '<PATTERN>' -r '<REWRITE>' -l <LANG> -i [PATH]
```

### Essential CLI Flags

| Flag | Shorthand | Description |
| :--- | :--- | :--- |
| `--pattern <PATTERN>` | `-p` | AST pattern template to search for |
| `--rewrite <REWRITE>` | `-r` | AST replacement template |
| `--lang <LANG>` | `-l` | Target language (`ts`, `tsx`, `js`, `jsx`, `python`, `rust`, `go`, etc.) |
| `--update-all` | `-U` | Apply rewrites directly to files in-place without prompting |
| `--interactive` | `-i` | Interactively inspect and accept/reject each rewrite |
| `--strictness <LEVEL>` | | Matching strictness: `smart` (default), `cst`, `ast`, `relaxed` |
| `--selector <KIND>` | | Target a specific AST node kind (e.g. `call_expression`, `decorator`) |
| `--inline-rules <YAML>`| | Define complex rule constraints (YAML string) on the CLI |
| `--json[=MODE]` | | Output JSON structure (`compact`, `pretty`, `stream`) |
| `--globs <GLOB>` | `-g` | Include/exclude specific files or directories |

---

## Pattern Syntax Cheat Sheet

* **Single Meta-Variable (`$VAR`)**: Matches exactly **one** named AST node (identifier, expression, argument, literal).
  * Repeated identical meta-variables enforce equality: `sg run -p '$A == $A' -l ts` matches self-comparisons.
* **Multi Meta-Variable (`$$$ARGS` or `$$$`)**: Matches **zero or more** AST nodes (arguments, statements, parameters, elements).
* **Unnamed Node Meta-Variable (`$$VAR`)**: Captures unnamed tokens or punctuation when necessary.
* **Non-Capturing Wildcard (`$_` or `$_NAME`)**: Matches nodes without storing captures (faster execution).

---

## Practical Search Workflows by Language

### 1. TypeScript & JavaScript
```bash
# Match React useState hooks with any initializer
sg run -p 'const [$VAL, $SET] = useState($$$INIT)' -l ts ./src/

# Find async functions with specific signatures
sg run -p 'async function $NAME($$$PARAMS): Promise<$RET> { $$$BODY }' -l ts

# Match all named imports from a package
sg run -p 'import { $$$IMPORTS } from "$PKG"' -l ts

# Find dynamic object property access
sg run -p '$OBJ[$KEY]($$$ARGS)' -l js
```

### 2. Python
```bash
# Find functions decorated with specific decorator
sg run -p '@$DECORATOR\ndef $FUNC($$$ARGS):\n    $$$BODY' -l python ./app/

# Find specific context manager usage
sg run -p 'with open($$$ARGS) as $F:\n    $$$BODY' -l python

# Find exception handling blocks targeting specific error types
sg run -p 'except $ERR as $E:\n    $$$BODY' -l python
```

### 3. Rust
```bash
# Find unchecked unwrap calls
sg run -p '$EXPR.unwrap()' -l rust ./src/

# Find trait implementations
sg run -p 'impl $TRAIT for $TYPE { $$$ITEMS }' -l rust

# Find match expressions handling Result or Option
sg run -p 'match $VAL { Ok($V) => $RES, Err($E) => $$$ }' -l rust
```

### 4. Go
```bash
# Find standard Go error checks
sg run -p 'if err != nil { return $$$RET }' -l go ./

# Find HTTP handler functions
sg run -p 'func $NAME(w http.ResponseWriter, r *http.Request) { $$$BODY }' -l go
```

---

## AST Rewriting Workflows (`-p`, `-r`, `-U`)

Rewrites replace matched syntax nodes while preserving untouched code structures and parameters safely.

```bash
# API Migration: rename function and wrap arguments in options object
sg run -p 'oldApi($ARG1, $ARG2)' -r 'newApi($ARG2, { legacy: $ARG1 })' -l ts -U ./src/

# Modernize null-checks to optional chaining
sg run -p '$A && $A.$B()' -r '$A?.$B()' -l ts -U ./src/

# Update Python logging calls
sg run -p 'logger.warn($MSG)' -r 'logger.warning($MSG)' -l python -U ./app/

# Clean up console debug statements
sg run -p 'console.log($$$ARGS)' -r '' -l js -U ./src/
```

---

## Advanced Relational Rules (`--inline-rules`)

For multi-condition checks, pass inline YAML rules with relational operators (`inside`, `has`, `not`, `follows`, `precedes`):

```bash
# Find raw SQL queries not using sanitizers inside async functions
sg run --inline-rules '
id: no-raw-queries
language: typescript
rule:
  pattern: db.query($SQL)
  inside:
    pattern: async function $FUNC($$$) { $$$ }
  not:
    has:
      pattern: sanitize($$$)
' ./src/
```

---

## JSON Output & Tool Pipelines

Pipe structured AST results into tools like `jq` for analysis or reporting:

```bash
# Extract classes and names into JSON
sg run -p 'class $NAME($$$PARENTS): $$$BODY' -l python --json=compact ./app/ | \
  jq '.[] | {file: .file, class: .metaVariables.singleCapture.NAME.text, line: .range.start.line}'

# Stream matching lines for large codebases
sg run -p 'TODO($$$)' -l rust --json=stream
```

---

## Strictness Modes (`--strictness`)

| Mode | Behavior | Best Used When |
| :--- | :--- | :--- |
| `smart` *(default)* | Matches all pattern nodes, automatically skipping unnamed trivia in target | General-purpose search & refactoring |
| `relaxed` | Matches named AST nodes; ignores all comments and unnamed tokens | Matching logic irrespective of comments/formatting |
| `ast` | Matches only named AST nodes across both pattern and target | Broad structural matching |
| `cst` | Exact matching of every node in Concrete Syntax Tree (no skipping) | Precise token/syntax matching |

---

## Language Identifiers (`-l` / `--lang`)

| Language | Identifier | Language | Identifier |
| :--- | :--- | :--- | :--- |
| TypeScript / TSX | `ts`, `tsx` | Python | `python`, `py` |
| JavaScript / JSX | `js`, `jsx` | Rust | `rust`, `rs` |
| Go | `go` | C / C++ | `c`, `cpp` |
| Java | `java` | C# | `csharp`, `cs` |
| HTML / CSS / JSON | `html`, `css`, `json` | YAML / Bash | `yaml`, `bash` |
