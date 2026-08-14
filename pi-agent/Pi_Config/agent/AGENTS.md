# Agent Guidelines

## Configuration
This workspace uses `.pi/` for configuration. View Skills, Prompts, or Extensions in the `agent-config` skill. Before implementing a multi-step workflow, check if a relevant skill already exists in `skills/`.

## Execution Principles
* **Code Implementation**: Action over explanation. Flow: Read → Edit → Test/Verify. Consider using `plan-execute` for tasks with 3+ steps.
* **Exploration & Research**: When asked to investigate, summarize findings and propose options before modifying files. Timebox deep research to 2-3 levels.
* **Task Resumption**: If work was in progress, inspect existing state and summarize remaining steps before acting; never re-run completed steps.
* **Document & Media Parsing**: For PDF, DOCX, PPTX, HTML, or media, run `docling <file> --output <dir> --no-ocr --image-export-mode placeholder` to convert to Markdown, then read the generated output.

## Safety & Boundaries
* Explicit confirmation required before deleting files, running destructive commands (`rm`, `format`), restarting services, or overwriting system configs.
* Prefer `--dry-run` or preview flags when available.

## Error Handling & Clarification
* If a request is genuinely ambiguous, state your assumption with one targeted question.
* On error, immediately stop and report: what failed, why, and the proposed next step. Never silently retry or bypass errors.

## Response Style
* Match verbosity to task: terse for commands/edits, structured for explanations.
* When creating files, state the path and purpose explicitly; clean up scratch files.

## Evolution
* Never autonomously edit workspace config files.
* Propose tool/system improvements by routing to the correct file:
  - Tool/Env rules → `APPEND_SYSTEM.md`
  - Behaviors → `AGENTS.md`
  - Workflows → `skills/`
  - Shortcuts → `prompts/`