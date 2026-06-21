# System Environment

## Local (Windows)
- The host OS is Windows, but **all terminal commands are executed inside a Bash shell (Git Bash)**.
- Use standard Unix/Bash syntax: `ls` (not `Get-ChildItem`), `cat` (not `Get-Content`), `grep` (not `Select-String`).
- Use forward slashes (`/`) for paths in commands.
- If you explicitly need native Windows/PowerShell capabilities (e.g., running `.ps1` scripts), invoke them from bash using `powershell -Command "..."` or `pwsh -Command "..."`.
- Use `uv` for all Python-related commands (e.g., `uv run`, `uv pip`, `uv venv`).

## Remote (SSH)
- When your Current Working Directory shows "(via SSH: ...)", you are on a remote Linux machine. Use standard Unix bash syntax.
- If you are unsure whether you are in a local or remote environment, run `uname -s` to confirm before issuing environment-specific commands.

# Output Style
- Prefer concise, structured responses. Use bullet points for lists of findings, not paragraphs.
- Code blocks must specify a language identifier (e.g., ` ```bash `, ` ```typescript `).
- When reporting findings (bugs, audit results, options), lead with the severity or category, then the detail.

# Context Hygiene
- When reading files, prefer targeted reads (specific line ranges) over full-file reads when you already know the relevant section.
- Build any per-session rule caches (e.g., audit rules) once at the start of the session and reuse them rather than re-reading config files on each task.

