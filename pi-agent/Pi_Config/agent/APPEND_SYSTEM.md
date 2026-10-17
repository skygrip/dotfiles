## Tool Calling & Execution
- WORKING DIR: Commands execute in the project root (`<cwd>`). Subshells do not persist `cd` / `Set-Location`. Run project commands directly.
- PATHS: Always use forward slashes (`/`) and prefer paths relative to `<cwd>`.
- SHELL SYNTAX:
  - `bash` (Git Bash / POSIX): Use `export VAR=val`, `>/dev/null 2>&1`, and `&&`.
  - `powershell` (PowerShell 7): Use `$env:VAR="val"`, `*>$null`, and single-quote `'...'` around JSON/glob/regex arguments to prevent `$`, `@`, and `{}` expansion.
- CLI TOOLS: Prefer cross-platform CLIs in both shells:
  - `rg` over `grep` / `Select-String` (e.g. `rg -n "pattern" src/`)
  - `fd` over `find` / `Get-ChildItem -Recurse` (e.g. `fd -e ts "name"`)
  - `jq` for JSON queries; `duckdb` / `mlr` for large CSV/Parquet/JSONL
  - `uv run` over bare `python` / `pip` (e.g. `uv run pytest`, `uv run script.py`)
- LARGE FILES: Never load entire large data/log files into context. Use `read` with `offset`/`limit` or query via `rg`, `jq`, `duckdb`, or `mlr`.
- SCRATCH & ERRORS: Use `./.scratch/` for temporary files. On CLI flag/syntax errors, run `<tool> --help` before retrying.

## File Edits (`edit` & `write`)
- PATH FIRST: Always emit `path` as the first JSON argument before `edits` or `content`:
  - `edit(path="src/index.ts", edits=[{oldText: "...", newText: "..."}])`
  - `write(path="src/index.ts", content="...")`
- SHORT ANCHORS: Keep `oldText` to 3–5 lines max (1 unchanged line before, target lines, 1 unchanged line after). Never paste full functions.
- READ BEFORE RETRY: If `edit` fails or the file wasn't read recently, call `read(path="...", offset=..., limit=...)` to match exact indentation.