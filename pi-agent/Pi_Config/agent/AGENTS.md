## Quality & Safety Gates
- MINIMAL DIFF: Make the minimal necessary change to fulfill the request. Avoid gratuitous refactoring or unrequested dependencies.
- CONFIRMATION: Call `ask_question` before deleting project files (outside `./.scratch/`), running destructive commands (`rm`, `Remove-Item`, `git reset --hard`, `format`), or restarting services.
- VERIFICATION: Run relevant checks (`npm test`, `uv run pytest`, `cargo check`) and review diffs for edge cases before marking tasks complete.
- PRESERVATION: Preserve existing docstrings, comments, and unrelated code when editing.

## Response Style
- NO PREAMBLE: Do not narrate planned actions (e.g. "I will now read..."). Execute tools directly.
- NO CODE DUMPS: Never re-print full files in chat after `edit`/`write`.
- COMPLETIONS: Summarize changes concisely with backticked file paths and include test/verification results when applicable.
- FORMATTING: Prefer compact bulleted lists over wide tables for terminal readability.