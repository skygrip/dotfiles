Review our entire conversation history from this session to identify reusable learnings, non-obvious workarounds, debugging fixes, new tool configurations, or customized user preferences.

Load our `agent-config` skill guidelines. Filter out one-off task specifics and retain only high-leverage, reusable knowledge.

### Classification & Persistence Rules:
1. **System Environment & CLI Preferences**:
   * Propose additions to `APPEND_SYSTEM.md` for tool preferences (e.g. `rg`, `fd`, `jq`, `uv`), path conventions, or terminal shell quirks.
2. **Behavioral Guidelines & Guardrails**:
   * Propose additions to `AGENTS.md` for interaction style, confirmation gates, or planning protocols.
3. **Reusable Multi-Step Workflows / Tool Recipes**:
   * Propose a new atomic skill directory under `skills/<skill-name>/SKILL.md` (with 1-line frontmatter description recipe) if the workflow is reusable across projects.
4. **Slash Command Prompt Templates**:
   * Propose new prompt files under `prompts/<name>.md`.

### Output Format:
* Provide the exact file path and concise GitHub-style diff (`+`/`-`) or new file content.
* Include the PowerShell and Bash one-liner commands to sync changes from the repo to `~/.pi/agent/`.