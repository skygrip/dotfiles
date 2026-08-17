---
name: batch-automator
description: Advise the user and generate copy-pasteable sequential 'pi -p' shell commands for the user to execute bulk refactoring, docstrings, or audits across 100+ files in their own terminal.
---

# Batch Automator Skill (Unix-Style Headless Automation)

This skill guides the agent on **advising the user and generating ready-to-run shell commands** so the human engineer can execute large-scale batch refactoring, audits, or migrations across hundreds of files using **headless `pi -p` execution**.

> [!IMPORTANT]
> **Agent Execution Policy (Anti-Self-Execution):**
> **Do NOT run these batch loops yourself.** 
> Your role is to inspect the user's workspace, verify the file pattern, and generate the exact, pre-configured PowerShell or Bash command for the **user to run in their own terminal**.

---

## 🎯 Industry Best Practice: The "Unix Philosophy for LLMs"

Industry tools (Simon Willison's `llm`, Anthropic's `claude -p`, Aider, Pi) have converged on headless shell loops over complex multi-agent frameworks for repository-wide batch migrations:

1. **Prevents "Context Melting"**: Processing 100 files in a single conversation history degrades LLM attention, causes hallucinations, and burns hundreds of thousands of tokens. A loop gives each file a fresh, focused ~2,000-token micro-context.
2. **Sequential by Default (Zero Concurrency)**: Running 1 file at a time prevents API rate-limiting, eliminates lock contention, keeps terminal output readable, and allows graceful `Ctrl+C` interruption.
3. **Safety & Verification via Git**: The loop runs on a dedicated git branch, making verification trivial using `git diff --stat` and automated test suites.

---

## 🛡️ Headless Fail-Safe Flags

To prevent headless hangs, infinite loops, and startup latency, all generated commands must include these flags:

| Flag / Environment Variable | Purpose |
| :--- | :--- |
| `PI_SKIP_VERSION_CHECK=1` | Disables online version checks on every iteration (speeds up loop startup). |
| `NODE_OPTIONS="--dns-result-order=ipv4first"` | Prevents IPv6 DNS lookup stalls on network requests. |
| `--approve` (`-a`) | Auto-approves project-local files and extensions without prompting. |
| `--no-session` | Prevents writing hundreds of junk `.jsonl` session files to disk. |
| `--exclude-tools ask_question` | Prevents the model from attempting interactive stdin prompts that hang subshells. |
| **Wall-Clock Timeout** (`90s`) | Prevents the entire loop from freezing if a single API call stalls. |

---

## 📋 Agent Workflow: How to Advise the User

When a user requests a bulk task across a codebase:

1. **Inspect Workspace Pattern**: Use your tools to check directory structure and confirm the file glob (e.g. `src/**/*.ts`, `docs/**/*.md`).
2. **Draft the Focused `pi -p` Prompt**: Craft a clear, single-purpose instruction for the micro-task (e.g. `"Add TypeScript 5 const type parameters to exported generics"`).
3. **Advise Git Branch Isolation**: Remind the user to run on a clean branch (`git checkout -b chore/batch-refactor`).
4. **Generate the Copy-Paste Command**: Provide a ready-to-run PowerShell (Windows) or Bash (Linux/macOS) snippet pre-populated with their exact paths, prompt, timeouts, and safety flags.
5. **Provide Verification Step**: Show them how to verify results with `git diff --stat` or test suites once the run finishes.

---

## 💻 Command Recipes to Generate for the User

### 1. Sequential File Transformation / Refactoring (Recommended Default)

#### Windows (PowerShell)
```powershell
# 1. Create a dedicated branch
git checkout -b chore/batch-refactor

# 2. Set startup network safeguards
$env:PI_SKIP_VERSION_CHECK = "1"
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

# 3. Run sequential micro-context refactoring loop
Get-ChildItem -Path src/ -Filter *.ts -Recurse | Where-Object { $_.FullName -notmatch "node_modules|\.git" } | ForEach-Object {
    $file = $_.FullName
    Write-Host "➡️ Processing: $($_.Name)"
    
    # Run with approve, no-session, and exclude interactive ask_question
    pi -p --approve --no-session --tools "read,write" --exclude-tools ask_question "@$file" "<USER_TASK_PROMPT_HERE>"
}

# 4. Verify changes
git diff --stat
```

#### Linux / macOS (Bash)
```bash
# 1. Create a dedicated branch
git checkout -b chore/batch-refactor

# 2. Set startup network safeguards
export PI_SKIP_VERSION_CHECK=1
export NODE_OPTIONS="--dns-result-order=ipv4first"

# 3. Run sequential loop with 90-second per-file wall-clock timeout
find src/ -name "*.ts" -not -path "*/node_modules/*" | while read -r file; do
    echo "➡️ Processing: $file"
    timeout 90s pi -p --approve --no-session --tools "read,write" --exclude-tools ask_question "@$file" "<USER_TASK_PROMPT_HERE>"
done

# 4. Verify changes
git diff --stat
```

---

### 2. Hardened Auto-Resume Loop with Timeout (`.batch_done.txt`)

For large batches (50+ files), include this resume pattern so the user can pause (`Ctrl+C`) and resume anytime without re-running completed files:

#### Windows (PowerShell)
```powershell
$doneFile = ".batch_done.txt"
if (!(Test-Path $doneFile)) { New-Item $doneFile -ItemType File | Out-Null }

$env:PI_SKIP_VERSION_CHECK = "1"
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

Get-ChildItem -Path src/ -Filter *.ts -Recurse | Where-Object { 
    $done = Get-Content $doneFile
    $done -notcontains $_.FullName -and $_.FullName -notmatch "node_modules|\.git"
} | ForEach-Object {
    $file = $_.FullName
    Write-Host "Processing ($([System.IO.Path]::GetFileName($file)))..."
    
    # Execute with approve, no-session, and tools allowlist
    pi -p --approve --no-session --tools "read,write" --exclude-tools ask_question "@$file" "<USER_TASK_PROMPT_HERE>"
    
    if ($LASTEXITCODE -eq 0) {
        Add-Content -Path $doneFile -Value $file
    } else {
        Write-Warning "⚠️ Issue encountered on $file (Exit Code: $LASTEXITCODE)"
    }
}
```

#### Linux / macOS (Bash)
```bash
touch .batch_done.txt
export PI_SKIP_VERSION_CHECK=1
export NODE_OPTIONS="--dns-result-order=ipv4first"

find src/ -name "*.ts" -not -path "*/node_modules/*" | while read -r file; do
    if grep -Fxq "$file" .batch_done.txt; then
        echo "⏭️ Skipping (already completed): $file"
        continue
    fi
    echo "➡️ Processing: $file"
    
    if timeout 90s pi -p --approve --no-session --tools "read,write" --exclude-tools ask_question "@$file" "<USER_TASK_PROMPT_HERE>"; then
        echo "$file" >> .batch_done.txt
    else
        echo "⚠️ Timed out or failed on $file"
    fi
done
```

---

### 3. Read-Only Codebase Audit & Report Aggregation

When the user wants to audit security, syntax, or documentation without modifying files (`--tools read`):

#### Windows (PowerShell)
```powershell
$report = "audit_report.md"
"# Codebase Audit Report`n`n| File | Status | Issue |`n| :--- | :--- | :--- |" | Set-Content $report

$env:PI_SKIP_VERSION_CHECK = "1"
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

Get-ChildItem -Path src/ -Filter *.ts -Recurse | Where-Object { $_.FullName -notmatch "node_modules|\.git" } | ForEach-Object {
    $file = $_.FullName
    Write-Host "Scanning: $($_.Name)"
    $res = pi -p --approve --no-session --tools read --exclude-tools ask_question "@$file" "Audit this file for unhandled promise rejections or raw SQL strings. Output format: STATUS | DESCRIPTION (e.g. CLEAN | None or FLAGGED | Line 42: raw SQL query)."
    "| `$($_.Name)` | $res |" | Add-Content $report
}
```

---

### 4. Opt-In Parallelism (Only When User Explicitly Requests High Speed)

If the user explicitly asks for parallel execution:

#### Windows (PowerShell)
```powershell
$env:PI_SKIP_VERSION_CHECK = "1"
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

Get-ChildItem -Path src/ -Filter *.ts -Recurse | Where-Object { $_.FullName -notmatch "node_modules|\.git" } | ForEach-Object -ThrottleLimit 4 -Parallel {
    $file = $_.FullName
    Write-Host "⚡ Processing: $($_.Name)"
    pi -p --approve --no-session --tools "read,write" --exclude-tools ask_question "@$file" "<USER_TASK_PROMPT_HERE>"
}
```
