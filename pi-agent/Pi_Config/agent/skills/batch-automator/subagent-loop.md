# Subagent Delegation Approach (Small Batch Fallback)

For small batch requests (2 to 6 files or distinct tasks), invoking subagents directly within the active conversation session is the fastest approach. It requires zero setup, no python script generation, and no extension compiling.

---

## 🎯 When to Use Subagent Delegation

* **Small Batch Size (2–6 items)**: Ideal for a small set of target files or components.
* **Concurrent Background Execution**: Subagents run in parallel background threads while you continue working.
* **Direct Conversation Reporting**: Results feed directly back into the primary agent conversation once completed.

> ⚠️ **Warning for 10+ Files**: Do NOT use subagent delegation for large batch counts (10+ files). Spawning dozens of subagents in a single session causes API rate-limiting and conversation history context bloat. Use the [Shell/Python Loop](./shell-loop.md) for 10+ files.

---

## 🛠️ Tool Invocation Syntax (`invoke_subagent`)

To run small batch tasks concurrently, invoke multiple subagents in a single `invoke_subagent` tool call:

```json
{
  "Subagents": [
    {
      "TypeName": "research",
      "Role": "Auth Security Auditor",
      "Model": "flash",
      "Workspace": "inherit",
      "Prompt": "Open file 'src/auth.py'. Use your read/view tool to inspect it. Audit for hardcoded secrets or unescaped queries. Output CLEAN if clean, or FLAGGED with line numbers and vulnerability descriptions."
    },
    {
      "TypeName": "research",
      "Role": "Tokens Security Auditor",
      "Model": "flash",
      "Workspace": "inherit",
      "Prompt": "Open file 'src/tokens.py'. Use your read/view tool to inspect it. Audit for JWT validation bugs or weak secret keys. Output CLEAN if clean, or FLAGGED with line numbers and vulnerability descriptions."
    },
    {
      "TypeName": "research",
      "Role": "Session Security Auditor",
      "Model": "flash",
      "Workspace": "inherit",
      "Prompt": "Open file 'src/session.py'. Use your read/view tool to inspect it. Audit for session fixation or insecure cookies. Output CLEAN if clean, or FLAGGED with line numbers and vulnerability descriptions."
    }
  ]
}
```

### Key Parameters:
- **`Model`**: Use `"flash"` for fast, cost-effective read audits; use `"pro"` or `"inherit"` for complex code refactoring/rewriting.
- **`Workspace`**: Default to `"inherit"` to allow subagents to read/write directly in the main workspace directory.

---

## ⚡ Asynchronous Execution & Reactive Wakeup

* **No Polling Required**: After calling `invoke_subagent`, do **NOT** poll or loop checking status.
* **Automatic Resume Notification**: The system automatically pauses and resumes your execution with a notification as soon as subagents complete their tasks.
* **Synthesize Results**: Once notifications arrive, aggregate the findings from each subagent into a clean markdown summary table for the user.

---

## 📋 Subagent Prompt Crafting Checklist

When writing prompts for each subagent in the `Subagents` array, follow these guardrails:

1. **Explicit File Target**: Start with `Open file '<path>'`.
2. **Anti-Lazy Guardrail**: Force the subagent to use `read` or `view_file` (e.g., *"Inspect the raw file using your read tool before generating findings"*).
3. **Structured Outputs**: Mandate prefix keywords:
   - `CLEAN` / `NO_CHANGE`: If no issues or modifications are needed.
   - `FLAGGED` / `DONE`: Followed by a markdown table of findings or changes.
4. **Tightly Scoped Task**: One file or specific component per subagent.

---

## 📊 Result Synthesis Template

When subagents finish, present the aggregated results to the user in a consolidated format:

```markdown
## 🔍 Batch Subagent Audit Results

| File Path | Status | Findings / Actions Taken |
| :--- | :--- | :--- |
| `src/auth.py` | 🟢 `CLEAN` | No security issues detected. |
| `src/tokens.py` | 🔴 `FLAGGED` | Line 42: Weak JWT signing secret key (`"secret123"`). |
| `src/session.py` | 🔴 `FLAGGED` | Line 88: Missing `HttpOnly` flag on session cookie. |

### Summary & Recommendations
- **Files Audited:** 3
- **Action Required:** Fix security vulnerabilities in `tokens.py` and `session.py`.
```

---

## 🔗 Related Documentation & Skill Links

* [Shell/Python Loop Guide (`shell-loop.md`)](./shell-loop.md) — Primary runner for 10+ files.
* [Extension Loop Guide (`extension-loop.md`)](./extension-loop.md) — Advanced fallback for in-process TS extensions.
