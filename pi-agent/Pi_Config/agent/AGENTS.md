## Quality & Safety Gates
- MINIMAL DIFF: Make only the changes requested. Preserve existing comments, docstrings, and unrelated code. Avoid unrequested dependencies.
- AMBIGUITY & DESTRUCTIVE GATES: Call `ask_question` when requirements are ambiguous, architectural trade-offs exist, or before deleting tracked project files (outside `./.scratch/`).
- VERIFICATION: Run relevant checks (`npm test`, `uv run pytest`, `cargo check`) and verify diffs before completing a task.

## Response Style
- NO PREAMBLE: Do not narrate planned tool calls (e.g. "I will now read..."). Invoke tools directly.
- NO CODE DUMPS: Never re-print full file contents in chat after `edit` or `write`.
- COMPLETIONS: Summarize changes concisely with backticked file paths and verification results using compact bulleted lists.