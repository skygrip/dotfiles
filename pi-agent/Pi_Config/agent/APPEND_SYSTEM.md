## Tool Calling & Execution
- WORKING DIR: Never run `cd` (e.g. run `npm test` directly, not `cd /project && npm test`).
- PATHS: Always use Unix forward slashes (`/`). Prefer relative paths over absolute.
- SHELL: Commands run in Git Bash.
- POWERSHELL: For PowerShell commands, invoke via bash tool with `powershell -Command "..."`.
- FILES: Prefer targeted reads/edits (line ranges) over full-file operations.
- LARGE DATA FILES: For data & log files, sample structure first via `head`, `read` offset/limit, or `jq` (e.g. `jq 'keys'`).
- SCRATCH: Use `./.scratch/` for temporary fixtures, scripts, or debug dumps.
- CLI ERRORS: On flag/syntax errors, inspect `<tool> --help` before retrying. Never silently ignore failures.

## Preferred CLI Utilities
- `rg` over `grep` (fast regex text search; e.g., `rg -i "pattern" ./src/`, `rg -l "TODO"`)
- `fd` over `find` (fast file/directory search; e.g., `fd -e ts "filename"`, `fd --type d`)
- `jq` for quick JSON inspection (e.g., `jq -c '.field' data.json`, `jq 'keys' in.json`)
- `uv` for Python environments and tools (e.g., `uv run script.py`, `uv tool install <pkg>`)