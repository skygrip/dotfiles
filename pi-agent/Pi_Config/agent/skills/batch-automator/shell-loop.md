# Shell/Python Loop Approach

For fast audits, file rewrites/edits, one-shot queries, quick scans, or highly parallelized execution, looping at the terminal or scripting level is often more efficient and carries less setup friction than compiling temporary TypeScript extensions.

This guide provides practical shell one-liners and standard python scripts to automate batch operations cleanly outside Pi's internal chat session.

---

## ⚡ Lightweight Terminal One-Liners

Use these lightweight terminal commands for quick tasks (both read-only audits and file rewrites/edits) that do not require complex state management or parallel execution.

*Note: All examples below use `--no-session` to prevent workspace session history pollution and the environment variable `PI_SKIP_VERSION_CHECK=1` to disable slow startup version checks.*

### Codebase File Scanning & Rewriting Loops

#### Git Bash / Linux (Bash)
```bash
# Read-Only Audit: Scan files and output report
PI_SKIP_VERSION_CHECK=1 find . -name "*.md" -not -path "*/node_modules/*" -exec sh -c 'echo "## $1"; pi -p --no-session --tools read "@$1" "Check for typos"; echo ""' _ {} \; > audit_report.md

# File Mutation: Rewrite markdown files using a specific skill
PI_SKIP_VERSION_CHECK=1 find . -name "*.md" -not -path "*/node_modules/*" -exec pi -p --no-session --tools "read,write" --skills "technical-writer" "@{}" "Read this file, rewrite it following technical-writer skill rules, and save changes." \;
```

#### Windows PowerShell
```powershell
# Read-Only Audit: Scan files and output report
$env:PI_SKIP_VERSION_CHECK="1"; Get-ChildItem -Path . -Filter *.md -Recurse | Where-Object { $_.FullName -notmatch "node_modules|\.pi" } | ForEach-Object { Write-Output "## $($_.Name)"; pi -p --no-session --tools read "@$($_.FullName)" "Verify formatting is correct"; Write-Output "`n" } > audit_report.md

# File Mutation: Rewrite markdown files using a specific skill
$env:PI_SKIP_VERSION_CHECK="1"; Get-ChildItem -Path . -Filter *.md -Recurse | Where-Object { $_.FullName -notmatch "node_modules|\.pi" } | ForEach-Object { pi -p --no-session --tools "read,write" --skills "technical-writer" "@$($_.FullName)" "Read this file, rewrite it following technical-writer skill rules, and save changes." }
```

### Row-by-Row CSV Enrichment

If you have a CSV file and want to generate a new column by asking Pi to analyze specific row values (similar to applying an AI-powered Excel formula to each row), you can use this compact inline Python command. It parses CSV format safely, bypasses sessions, suppresses update checks, and limits tools to just `read` for safety.

#### Bash / Git Bash
```bash
python -c '
import csv, subprocess, sys, os
os.environ["PI_SKIP_VERSION_CHECK"] = "1"
reader = csv.reader(sys.stdin)
writer = csv.writer(sys.stdout)

header = next(reader)
writer.writerow(header + ["AI_Analysis"])

for row in reader:
    # Example: columns 0 and 1 represent product name and category
    prompt = f"Analyze this product name: {row[0]}. Category: {row[1]}. Summarize its likely use-case in 5 words."
    res = subprocess.run(["pi", "-p", "--no-session", "--tools", "read", prompt], capture_output=True, text=True, encoding="utf-8", errors="replace", shell=os.name=="nt")
    writer.writerow(row + [res.stdout.strip()])
' < products.csv > products_enriched.csv
```

#### Windows PowerShell
```powershell
$code = @'
import csv, subprocess, sys, os
os.environ["PI_SKIP_VERSION_CHECK"] = "1"
reader = csv.reader(sys.stdin)
writer = csv.writer(sys.stdout)

header = next(reader)
writer.writerow(header + ["AI_Analysis"])

for row in reader:
    prompt = f"Analyze this product name: {row[0]}. Category: {row[1]}. Summarize its likely use-case in 5 words."
    res = subprocess.run(["pi", "-p", "--no-session", "--tools", "read", prompt], capture_output=True, text=True, encoding="utf-8", errors="replace", shell=os.name=="nt")
    writer.writerow(row + [res.stdout.strip()])
'@
Get-Content products.csv | python -c $code > products_enriched.csv
```

---

## 🐍 Robust Python Batch Runner (`batch-runner.py`)

For larger or more complex batch tasks, use the standalone `batch-runner.py` script. It offers advanced execution management features and is fully standard-library-only (zero external dependencies required).

### Key Features

- **Dry-run mode** (`--dry-run`): List matched files and verify glob patterns without invoking the AI.
- **Parallel execution** (`-j`/`--jobs`): Speeds up network-bound queries significantly using a thread pool.
- **Visual Progress Bar**: Real-time progress bar, file counters, active file tracker, and rolling ETA.
- **Run Resumption** (`-r`/`--resume`): Safely records completed files in `.pi/batch_state.json` so you can resume exactly where you left off if interrupted.
- **Read-Only Safety** (`--read-only`): Restricts Pi strictly to the `read` tool, guaranteeing no code changes occur.
- **Session & Update Suppression**: Built-in bypass of update checks and session logging for high performance.

### Script Template

Save this script as `batch_runner.py` (e.g., in your project root or `scripts/` folder):

```python
#!/usr/bin/env python3
"""
Pi Batch Runner
A lightweight utility to run sequential or parallel LLM tasks over codebase files
using the global 'pi' CLI, with progress bar and resume capabilities.
"""

import argparse
import fnmatch
import json
import os
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Prevent Pi from doing slow startup version checks
os.environ["PI_SKIP_VERSION_CHECK"] = "1"

# Thread-safe global counters and locks
print_lock = threading.Lock()
completed_count = 0
completed_files_set = set()


def get_matched_files(glob_pattern, excludes):
    """Finds all files matching the glob pattern, filtering out excluded patterns."""
    cwd = Path.cwd()
    all_files = list(cwd.glob(glob_pattern)) if "**" in glob_pattern else list(cwd.rglob(glob_pattern))
    
    # Handle single file glob fallback if glob/rglob doesn't match directly
    if not all_files:
        all_files = [p for p in cwd.glob(glob_pattern)]

    matched = []
    for file_path in all_files:
        if not file_path.is_file():
            continue
            
        # Get path relative to CWD for easier matching
        rel_path = file_path.relative_to(cwd).as_posix()
        
        # Check against excludes
        is_excluded = False
        for pattern in excludes:
            if fnmatch.fnmatch(rel_path, pattern) or any(fnmatch.fnmatch(part, pattern) for part in file_path.parts):
                is_excluded = True
                break
                
        if not is_excluded:
            matched.append(rel_path)
            
    return sorted(matched)


def load_state():
    """Loads previous execution state from .pi/batch_state.json."""
    state_path = Path(".pi/batch_state.json")
    if state_path.is_file():
        try:
            with open(state_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def save_state(glob_pattern, prompt, output, completed):
    """Saves the current execution state to .pi/batch_state.json."""
    state_path = Path(".pi/batch_state.json")
    state_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(state_path, "w", encoding="utf-8") as f:
            json.dump({
                "glob": glob_pattern,
                "prompt": prompt,
                "output": str(output),
                "completed": list(completed)
            }, f, indent=2)
    except Exception as e:
        # Avoid crashing the script if we can't write state
        pass


def clear_state():
    """Deletes the state file upon successful completion of the batch run."""
    state_path = Path(".pi/batch_state.json")
    if state_path.is_file():
        try:
            state_path.unlink()
        except Exception:
            pass


def print_progress(current, total, start_time, current_file=""):
    """Prints a thread-safe, beautiful terminal progress bar with ETA."""
    if total == 0:
        return
        
    percent = (current / total) * 100
    bar_length = 20
    filled_length = int(round(bar_length * current / total))
    bar = "█" * filled_length + "░" * (bar_length - filled_length)
    
    elapsed = time.time() - start_time
    if current > 0:
        eta_sec = (elapsed / current) * (total - current)
        if eta_sec > 60:
            eta_str = f"{int(eta_sec // 60)}m {int(eta_sec % 60)}s"
        else:
            eta_str = f"{int(eta_sec)}s"
    else:
        eta_str = "calculating..."
        
    # Truncate file name to fit cleanly in terminal line without wrapping
    file_display = f"| Active: {current_file}" if current_file else ""
    if len(file_display) > 35:
        file_display = file_display[:32] + "..."
        
    # Clear the rest of the line with spaces
    sys.stdout.write(f"\rProgress: [{bar}] {percent:.1f}% ({current}/{total}) | ETA: {eta_str} {file_display:<35}")
    sys.stdout.flush()


def run_pi_on_file(file_path, prompt, extra_args):
    """Invokes the pi CLI on a single file using its @file capability."""
    # Ensure --no-session is passed by default to prevent session pollution
    cmd = ["pi", "-p", "--no-session", f"@{file_path}", prompt] + extra_args
    
    start_time = time.time()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            shell=True if os.name == 'nt' else False, # Windows CLI fallback
            encoding='utf-8',
            errors='replace'
        )
        duration = time.time() - start_time
        
        if result.returncode == 0:
            return {
                "file": file_path,
                "status": "SUCCESS",
                "output": result.stdout.strip(),
                "duration": duration
            }
        else:
            return {
                "file": file_path,
                "status": "FAILED",
                "output": result.stderr.strip() or result.stdout.strip() or "Unknown CLI error",
                "duration": duration
            }
    except Exception as e:
        duration = time.time() - start_time
        return {
            "file": file_path,
            "status": "ERROR",
            "output": f"Exception raised: {str(e)}",
            "duration": duration
        }


def main():
    global completed_count, completed_files_set
    
    parser = argparse.ArgumentParser(description="Run batch operations across files using Pi CLI.")
    parser.add_argument("glob", help="Glob pattern matching target files (e.g., 'src/**/*.ts')")
    parser.add_argument("prompt", help="Instructions to send to the Pi agent for each file")
    parser.add_argument("-o", "--output", default="batch_run_report.md", help="Path to output markdown log")
    parser.add_argument("-j", "--jobs", type=int, default=1, help="Number of parallel jobs (default: 1, sequential)")
    parser.add_argument("-r", "--resume", action="store_true", help="Resume a previously interrupted batch run")
    parser.add_argument("--read-only", action="store_true", help="Restrict Pi to only the 'read' tool for extra safety")
    parser.add_argument("--dry-run", action="store_true", help="List matched files and exit without calling Pi")
    parser.add_argument("-x", "--exclude", action="append", default=[], 
                        help="Glob patterns of files/folders to exclude (can be repeated)")
    parser.add_argument("--pi-arg", action="append", default=[],
                        help="Extra CLI arguments to pass directly to pi (e.g., '--model', 'sonnet:high')")
    
    args = parser.parse_args()

    # Consolidate extra pi CLI arguments
    extra_pi_args = list(args.pi_arg)
    if args.read_only:
        extra_pi_args += ["--tools", "read"]

    # Default ignores
    default_excludes = [
        "**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**", "**/.pi/**", "**/.venv/**", "**/__pycache__/**",
        "node_modules/**", "dist/**", ".git/**", "build/**", ".pi/**", ".venv/**", "__pycache__/**"
    ]
    excludes = default_excludes + args.exclude

    print(f"🔍 Searching for files matching: '{args.glob}'...")
    all_matched_files = get_matched_files(args.glob, excludes)
    
    if not all_matched_files:
        print("❌ No files matched the targeted pattern.")
        sys.exit(0)
        
    print(f"✅ Found {len(all_matched_files)} total matching files in directory.")
    
    if args.dry_run:
        print("\nMatched Files (Dry Run):")
        for f in all_matched_files[:50]:
            print(f"  - {f}")
        if len(all_matched_files) > 50:
            print(f"  ... and {len(all_matched_files) - 50} more files.")
        print("\nDry run complete. No tasks were executed.")
        sys.exit(0)

    # Handle resume function
    matched_files = list(all_matched_files)
    is_resumed = False
    
    if args.resume:
        state = load_state()
        if state:
            if state.get("glob") == args.glob and state.get("prompt") == args.prompt:
                completed_files_set = set(state.get("completed", []))
                # Only process files that aren't already completed
                matched_files = [f for f in all_matched_files if f not in completed_files_set]
                args.output = state.get("output", args.output)
                completed_count = len(completed_files_set)
                is_resumed = True
                print(f"🔄 Resuming run! Skipped {completed_count} already-processed files. {len(matched_files)} remaining.")
            else:
                print("⚠️ Warning: Saved state glob/prompt does not match current arguments. Starting fresh.")
        else:
            print("ℹ️ No previous run state found. Starting fresh.")

    # Initialize or append to report file
    write_mode = "a" if is_resumed else "w"
    try:
        with open(args.output, write_mode, encoding="utf-8") as f:
            if is_resumed:
                f.write(f"\n\n---\n## 🔄 RESUMING RUN: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            else:
                f.write(f"# Pi Batch Run Report\n\n")
                f.write(f"- **Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"- **Target Pattern:** `{args.glob}`\n")
                f.write(f"- **Total Files:** {len(all_matched_files)}\n")
                f.write(f"- **Task Prompt:** *\"{args.prompt}\"*\n")
                f.write(f"- **Parallel Jobs:** {args.jobs}\n\n")
                f.write("---\n\n## Summary of Runs\n\n")
    except Exception as e:
        print(f"❌ Error opening output file {args.output}: {e}")
        sys.exit(1)

    if not matched_files:
        print("🏁 All files have already been successfully processed!")
        clear_state()
        sys.exit(0)

    print(f"🚀 Starting batch operation (Jobs: {args.jobs}). Write target: {args.output}")
    start_time = time.time()
    
    # Print initial progress
    print_progress(completed_count, len(all_matched_files), start_time, matched_files[0])
    
    results = []
    
    try:
        if args.jobs > 1:
            # Parallel Execution
            with ThreadPoolExecutor(max_workers=args.jobs) as executor:
                futures = {
                    executor.submit(run_pi_on_file, file, args.prompt, extra_pi_args): file 
                    for file in matched_files
                }
                
                for future in as_completed(futures):
                    res = future.result()
                    results.append(res)
                    
                    with print_lock:
                        completed_count += 1
                        completed_files_set.add(res["file"])
                        save_state(args.glob, args.prompt, args.output, completed_files_set)
                        
                        # Print progress bar inline
                        print_progress(completed_count, len(all_matched_files), start_time, res["file"])
                        
                        # Append result directly to the report
                        with open(args.output, "a", encoding="utf-8") as f:
                            f.write(f"### {res['file']} ({res['status']})\n")
                            f.write(f"- **Time taken:** {res['duration']:.1f}s\n\n")
                            f.write(f"{res['output']}\n\n")
                            f.write("---\n\n")
        else:
            # Sequential Execution
            for file in matched_files:
                # Update progress showing active file
                with print_lock:
                    print_progress(completed_count, len(all_matched_files), start_time, file)
                    
                res = run_pi_on_file(file, args.prompt, extra_pi_args)
                results.append(res)
                
                with print_lock:
                    completed_count += 1
                    completed_files_set.add(file)
                    save_state(args.glob, args.prompt, args.output, completed_files_set)
                    print_progress(completed_count, len(all_matched_files), start_time, file)
                    
                    with open(args.output, "a", encoding="utf-8") as f:
                        f.write(f"### {file} ({res['status']})\n")
                        f.write(f"- **Time taken:** {res['duration']:.1f}s\n\n")
                        f.write(f"{res['output']}\n\n")
                        f.write("---\n\n")
                        
    except KeyboardInterrupt:
        # Move output cursor past the progress bar line
        print("\n\n🛑 Batch run interrupted by user. Saved current progress. You can resume later using '--resume'.")

    # Clear terminal progress bar line and write summary
    print("\n")
    total_time = time.time() - start_time
    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    failed_count = sum(1 for r in results if r["status"] in ("FAILED", "ERROR"))
    
    summary = (
        f"## Batch Run Summary (This Run Segment)\n\n"
        f"- **Status:** Interrupted" if len(results) < len(matched_files) else "- **Status:** Completed\n"
        f"- **Segment Processed Files:** {len(results)} / {len(matched_files)}\n"
        f"- **Successes:** {success_count}\n"
        f"- **Failures/Errors:** {failed_count}\n"
        f"- **Segment Duration:** {total_time:.1f}s\n"
    )
    
    with open(args.output, "a", encoding="utf-8") as f:
        f.write(summary)
        
    print(f"🏁 Segment finished!")
    print(f"  - Processed in this run: {len(results)}/{len(matched_files)} files")
    print(f"  - Log written to: {args.output}")
    
    if len(completed_files_set) >= len(all_matched_files):
        # Everything is fully complete, delete state file
        clear_state()
        print("🎉 Batch operation fully complete! Cleaned up run state.")


if __name__ == "__main__":
    main()
```

### Execution Guide & Options

1. Make the script executable:
   ```bash
   chmod +x batch_runner.py
   ```
2. Run a dry run to verify matched files:
   ```bash
   python batch_runner.py "src/**/*.ts" "Audit for console.log statements" --dry-run
   ```
3. Run sequentially (with beautiful visual progress bar & live ETAs):
   ```bash
   python batch_runner.py "src/**/*.ts" "Identify and list all exports" -o reports/exports_log.md
   ```
4. Run in parallel with 4 threads (thread-safe, high speed):
   ```bash
   python batch_runner.py "src/**/*.ts" "Verify basic formatting" -j 4 -o reports/formatting_audit.md
   ```
5. **Resume an Interrupted Run**:
   If a run fails, rate-limits, or you stop it with `Ctrl+C`, you can resume exactly where you left off by adding the `--resume` (or `-r`) flag. It reads your current state and skips already successfully-processed files:
   ```bash
   python batch_runner.py "src/**/*.ts" "Verify basic formatting" -j 4 -o reports/formatting_audit.md --resume
   ```
6. **Enforce Read-Only Tools Safety**:
   Add the `--read-only` flag to restrict the subagents strictly to the `read` tool, guaranteeing that no files are modified during your audit or code-review:
   ```bash
   python batch_runner.py "src/**/*.ts" "Audit imports" --read-only
   ```
7. Pass specialized models or options directly to the `pi` CLI:
   ```bash
   python batch_runner.py "src/**/*.ts" "Explain this file" --pi-arg "--model" --pi-arg "sonnet:high"
   ```
