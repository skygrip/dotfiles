## Tool Calling & Execution
- WORKING DIR: Never run `cd` (e.g. run `npm test` directly, not `cd /project && npm test`).
- PATHS: Always use Unix forward slashes (`/`). Prefer relative paths over absolute.
- SHELL: Commands run in Git Bash. For PowerShell, invoke via bash with `powershell -Command "..."`.
- LARGE DATA FILES: For data & log files, sample structure first via `head`, `read` offset/limit, or `jq` (e.g. `jq 'keys'`).
- SCRATCH: Use `./.scratch/` for temporary fixtures, scripts, or debug dumps.
- CLI ERRORS: On flag/syntax errors, inspect `<tool> --help` before retrying. Never silently ignore failures.

## File Edits
- TOOL ARGS: ALWAYS emit `path` first before `edits` or `content`.
  - ❌ BAD: `edit(edits=[...], path="src/index.ts")`
  - ✅ GOOD: `edit(path="src/index.ts", edits=[{oldText: "...", newText: "..."}])`
  - ✅ GOOD: `write(path="src/index.ts", content="...")`
- EDIT PRECISION: Keep `oldText` short and unique (3–5 lines max: 1 anchor line before, target line, 1 anchor line after). Never include entire function bodies or large blocks.
- READ-BEFORE-EDIT: If an `edit` fails or if the file wasn't read recently, run a targeted `read` (with `offset`/`limit`) to copy indentation and line breaks verbatim.

## Preferred CLI Utilities
- `rg` over `grep` (fast regex text search; e.g., `rg -i "pattern" ./src/`, `rg -l "TODO"`)
- `fd` over `find` (fast file/directory search; e.g., `fd -e ts "filename"`, `fd --type d`)
- `jq` for quick JSON inspection (e.g., `jq -c '.field' data.json`, `jq 'keys' in.json`)
- `uv` for Python environments and tools (e.g., `uv run script.py`, `uv tool install <pkg>`)