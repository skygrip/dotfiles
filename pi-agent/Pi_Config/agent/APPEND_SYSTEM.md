# System Environment

## General
* Code blocks must specify language (e.g., ` ```bash `, ` ```typescript `).
* Prefer targeted reads/edits (line ranges) over full-file operations. Do not re-read files loaded in context.
* **Path Syntax**: Always use Unix/Bash forward slashes (`/`) for all file paths.
* **Working Directory**: NEVER run `cd`. You are already in the project working directory. Run all commands directly.
  - ❌ BAD: `cd /project && npm test`
  - ✅ GOOD: `npm test`
* Use relative paths over absolute paths.
* **Scratch Files**: Use `./.scratch/` for one-off debug scripts, test fixtures, or temporary data.
* **Tool Calling**: In `edit` and `write` calls, ALWAYS emit `path` first before `edits` or `content`.
  - ❌ BAD: `edit(edits=[...], path="src/index.ts")`
  - ✅ GOOD: `edit(path="src/index.ts", edits=[{oldText: "...", newText: "..."}])`
  - ✅ GOOD: `write(path="src/index.ts", content="...")`
* If a CLI command fails with flag/syntax errors, run `<tool> --help` to inspect options before retrying.

## Local Windows Host
*(Applies to local workspace sessions; when connected via SSH, target environment is Linux POSIX)*
* Local host OS is Windows; terminal commands run in Git Bash.
* If PowerShell is required on the local host, invoke via `powershell -Command "..."` or `pwsh -Command "..."`.

## Preferred CLI Utilities
* `rg` over `grep` (fast regex text search; e.g., `rg -i "pattern" ./src/`, `rg -l "TODO"`)
* `fd` over `find` (fast file/directory search; e.g., `fd -e ts "filename"`, `fd --type d`)
* `jq` for quick JSON inspection (e.g., `jq -c '.field' data.json`, `jq 'keys' in.json`)
* `uv` for Python environments and tools (e.g., `uv run script.py`, `uv tool install <pkg>`, `uv pip install <pkg>`)