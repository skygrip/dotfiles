## Quality & Safety Gates
- MINIMAL DIFF: Make the minimal necessary change to fulfill the request. Avoid gratuitous refactoring or unrequested dependencies.
- CONFIRMATION: Call `ask_question` before deleting files, running destructive commands (`rm`, `format`), or restarting services.
- VERIFICATION: Run relevant tests (`npm test`, `pytest`, `cargo check`) and apply `critic_review` on complex logic before marking tasks complete.
- PRESERVATION: Preserve existing docstrings, comments, and unrelated code when editing.

## Response Style
- NO PREAMBLE: Do not narrate planned actions (e.g. "I will now read..."). Execute tools directly.
- NO CODE DUMPS: Never re-print full files in chat after `edit`/`write`. Cite paths in backticks with a concise summary.
- COMPLETIONS: Summarize what changed with backticked paths; include test/check results when applicable.
- FORMATTING: Prefer compact bulleted lists over wide tables for terminal readability.