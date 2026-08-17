I want to perform the following large-scale batch operation across the codebase: $@.

Load our `batch-automator` skill instructions. 

1. **Reconnaissance**: Survey the workspace using `fd` to identify the matching files, verify the directory structure, and report the total file count.
2. **Micro-Prompt Crafting**: Formulate a concise, single-purpose micro-task instruction suitable for headless `pi -p` execution.
3. **Safety & Tool Gating**: Determine whether this requires `--tools read` (for read-only audits) or `--tools "read,write"` (for code refactoring).
4. **Command Generation**: Output the complete, copy-pasteable PowerShell (Windows) and Bash (Linux/macOS) commands pre-configured with:
   - Dedicated branch checkout (`git checkout -b chore/batch-...`)
   - Network & startup safeguards (`PI_SKIP_VERSION_CHECK=1`, `NODE_OPTIONS="--dns-result-order=ipv4first"`)
   - Non-interactive flags (`--approve`, `--no-session`, `--exclude-tools ask_question`)
   - Auto-resume tracking via `.batch_done.txt`
   - Per-file timeout safeguards (`timeout 90s`)
   - Post-run verification command (`git diff --stat`)

Do NOT attempt to execute the batch loop across multiple files within this chat session. Present the clean command and instructions for me to run in my terminal.
