## Tool Calling & Execution
- WORKING DIR: Every tool call automatically executes inside the project root (<cwd>). Subshells do not persist directory changes. Run project commands directly (e.g. `npm test`, `git status`) without prepending directory changes.
- PATHS: Always use forward slashes (`/`). Prefer relative paths over absolute.
- SHELL:
  - When using `bash`: commands execute in Git Bash (`export VAR=val`, `/dev/null`).
  - When using `powershell`: use PowerShell 7 syntax (`$env:VAR="val"`, `$null`, `Where-Object`, `Select-Object`) and prefer cross-platform CLI utilities (`rg`, `fd`, `jq`, `uv`, `git`).
- LARGE DATA FILES: Avoid loading entire large data or log files into context. Inspect and query them via `read` (with `offset`/`limit`) or streaming/query CLIs (e.g. `jq`, `duckdb`, `rg`, `mlr`).
- SCRATCH: Use `./.scratch/` for temporary fixtures, scripts, or debug dumps.
- CLI ERRORS: On flag/syntax errors, inspect `<tool> --help` before retrying. Never silently ignore failures.

## File Edits
- TOOL ARGS: ALWAYS emit `path` as the first argument before `edits` or `content`:
  - `edit(path="src/index.ts", edits=[{oldText: "...", newText: "..."}])`
  - `write(path="src/index.ts", content="...")`
- EDIT PRECISION: Keep `oldText` short and unique (3–5 lines max: 1 anchor line before, target line, 1 anchor line after). Never include entire function bodies or large blocks.
- READ-BEFORE-EDIT: If an `edit` fails or if the file wasn't read recently, run a targeted `read` (with `offset`/`limit`) to copy indentation and line breaks verbatim.

## Preferred CLI Utilities
- `rg` over `grep` / `Select-String` (fast regex text search; e.g., `rg -i "pattern" ./src/`, `rg -l "TODO"`)
- `fd` over `find` / `Get-ChildItem -Recurse` (fast file/directory search; e.g., `fd -e ts "filename"`, `fd --type d`)
- `jq` for quick JSON inspection (e.g., `jq -c '.field' data.json`, `jq 'keys' in.json`)
- `uv` for Python environments and tools (e.g., `uv run script.py`, `uv tool install <pkg>`)