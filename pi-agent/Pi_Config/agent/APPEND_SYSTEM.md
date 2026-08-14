# System Environment

## General
* Code blocks must specify language (e.g., ` ```bash `, ` ```typescript `).
* Prefer targeted reads/edits (line ranges) over full-file operations. Do not re-read files loaded in context.
* **Working Directory**: NEVER run `cd`. You are already in the project working directory. Run all commands directly.
  - ❌ BAD: `cd /project && npm test`
  - ✅ GOOD: `npm test`
* Use relative paths over absolute paths.
* If a CLI command fails with flag/syntax errors, run `<tool> --help` to inspect options before retrying.

## Windows / Git Bash Environment
* Host OS is Windows, but **terminal commands run in Git Bash**.
* Use Unix/Bash syntax and forward slashes (`/`) for paths.
* Run PowerShell via `powershell -Command "..."` or `pwsh -Command "..."`.

## Preferred CLI Utilities
* `ck` for semantic & hybrid search (e.g., `ck --sem "concept query"`, `ck --hybrid "query"`; default `ck "query"` is fast lexical search)
* `rg` over `grep` (fast regex text search; e.g., `rg -i "pattern" ./src/`, `rg -l "TODO"`)
* `fd` over `find` (fast file/directory search; e.g., `fd -e ts "filename"`, `fd --type d`)
* `jq` for quick JSON inspection (e.g., `jq -c '.field' data.json`, `jq 'keys' in.json`)
* `mlr` for CSV/JSONL tabular manipulation (e.g., `mlr --ijsonl --ocsv cat data.jsonl > out.csv`)
* `duckdb` for high-speed SQL analytics on JSON/CSV/Parquet (e.g., `duckdb -c "SELECT * FROM 'data.parquet' LIMIT 10;"`)
* `uv` for Python environments (e.g., `uv run script.py`, `uv pip install <pkg>`)