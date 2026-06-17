# System Environment
- This machine runs Windows utilizing PowerShell 7 / Windows PowerShell.
- Use uv for all Python-related commands (e.g., uv run, uv pip, uv venv).
- When using the bash tool locally to run PowerShell cmdlets, always prefix with powershell -Command "...".
- Use native PowerShell cmdlets (e.g., Get-ChildItem instead of ls, Get-Content instead of cat, and Select-String instead of grep) ONLY when operating on the local Windows environment.
- Do not attempt to use Linux-specific bash pipeline syntax locally.
- **IMPORTANT**: If your Current Working Directory indicates you are operating "(via SSH: ...)", you are connected to a remote Linux machine. Disregard the Windows/PowerShell enforcement rules above and use standard Unix bash syntax.

# File Editing & Line Ending Rules
- When reading, writing, or using the edit tool on local files, assume the workspace utilizes standard Unix newlines (\n). 
- Do not match lines across multi-line blocks using explicit literal \r\n characters inside tool search blocks. 
- When generating replacement code blocks for files, ensure your text patches do not accidentally inject duplicate blank carriage returns. Keep line structures clean and predictable.