# System Environment

## General
* Code blocks must specify language (e.g., ` ```bash `, ` ```typescript `).
* Prefer targeted reads/edits (line ranges) over full-file operations. Do not re-read files loaded in context.
* Do not prepend `cd` to commands; CWD persists.
* Use relative paths over absolute paths.

## Windows / Git Bash Environment
* Host OS is Windows, but **terminal commands run in Git Bash**.
* Use Unix/Bash syntax and forward slashes (`/`) for paths.
* Run PowerShell via `powershell -Command "..."` or `pwsh -Command "..."`.
* Use `uv` for Python (`uv run`, `uv pip`, `uv venv`).
* Prefer fast Rust utilities:
  - `rg` over `grep`
  - `fd` over `find`
  - `sff` for semantic searches (e.g., `sff -m minishlab/potion-code-16M-v2 "query"`)
* Use `/tmp` (never `C:/tmp`).
