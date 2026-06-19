# System Environment

## Local (Windows)
- This machine runs Windows with PowerShell 7 / Windows PowerShell.
- Use native PowerShell syntax: `Get-ChildItem` not `ls`, `Get-Content` not `cat`, `Select-String` not `grep`.
- Use `uv` for all Python-related commands (e.g., `uv run`, `uv pip`, `uv venv`).

## Remote (SSH)
- When your Current Working Directory shows "(via SSH: ...)", you are on a remote Linux machine. Use standard Unix bash syntax — all Windows/PowerShell rules above do not apply.

# File Editing & Line Ending Rules
- Assume Unix newlines (`\n`) for all local files.
- Do not use literal `\r\n` in edit tool search/replace blocks.
- Do not inject duplicate blank lines or carriage returns in replacement patches.