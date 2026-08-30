---
name: semgrep
description: Multi-language AST static security analysis (SAST) and code quality scanning. Use semgrep scan --config auto, semgrep scan --config p/bandit (Python), or p/owasp-top-ten.
---

# Semgrep SAST & Security Linting Capabilities Reference

Multi-language AST-based static application security testing (SAST) and code quality scanner. Analyzes syntax trees across 30+ languages (Python, TypeScript, JavaScript, Go, Java, Rust, C#, C++, Ruby, PHP) using declarative semantic rules matching real code syntax.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`semgrep`** | Multi-language static analysis CLI for AST pattern matching, vulnerability scanning, and automated remediation |

---

## 2. Negative Guardrails & CI Safety

| Hallucination / Mistake | Why It Fails | Correct Protocol / Syntax |
| :--- | :--- | :--- |
| `semgrep login` in scripts | Launches interactive OAuth browser / prompts for stdin (hangs headless shell) | Use unauthenticated `semgrep scan` or export `SEMGREP_APP_TOKEN` for `semgrep ci` |
| Subshell abort on findings | `--error` exits with code `1` on detected vulnerabilities | Capture exit code: `semgrep scan --error --sarif-output=report.sarif \|\| [ $? -eq 1 ]` |
| `--config auto` in air-gapped CI | Queries `semgrep.dev/api/v1/rules` over the network | Vendor YAML rules locally: `semgrep scan --config ./rules/` + `export SEMGREP_SEND_METRICS=off` |
| Unverified `--autofix` in CI | In-place file mutations can introduce unintended syntax changes | Ensure git working tree is clean before running `--autofix`, or use `--dryrun` |
| Dependency CVE / SCA queries | Semgrep analyzes source AST, not package dependencies | Use **`snyk`** (`snyk test`) for third-party manifest CVE scanning |

---

## 3. Official Ruleset Registry & Scan Packs Matrix

Combine packs using multiple `--config` arguments:

| Ruleset Pack | CLI Target (`--config`) | Target Language / Domain & Capabilities |
| :--- | :--- | :--- |
| **Curated Baseline** | `p/default` | High-signal, low-false-positive multi-language security baseline. |
| **OWASP Top 10** | `p/owasp-top-ten` | Web application vulnerabilities (SQLi, SSRF, IDOR, XSS, Broken Auth). |
| **CWE Top 25** | `p/cwe-top-25` | MITRE most dangerous software weakness patterns. |
| **Security Audit** | `p/security-audit` | Deep audit rules for comprehensive security and cryptographic reviews. |
| **Python / Bandit** | `p/bandit` | Full 1-to-1 AST replacement for legacy Python `bandit` linter. |
| **Secrets (Local)** | `p/secrets` | High-entropy credential scanning for exposed API keys and tokens. |
| **TypeScript / Web** | `p/typescript`<br/>`p/react` | DOM XSS, prototype pollution, Node.js security, SSR vulnerabilities. |
| **Go** | `p/golang` | Goroutine leaks, context cancellation, SQLi, and crypto flaws. |
| **IaC / Containers** | `p/dockerfile`<br/>`p/terraform` | Container hardening, root user alerts, and cloud infrastructure misconfigurations. |

---

## 4. Scan Execution, Autofix & Output Flags Matrix

| Configuration | Flag / Parameter | Values / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **Configuration** | `--config <target>` | `auto`, `p/<pack>`, `./rules/`, `<url>` | Rule source (registry pack, local directory/file, or URL). |
| **Automated Fixes** | `--autofix` | In-place write | Applies AST-safe replacement patches defined in matching rules. |
| | `--dryrun` | Terminal preview | Previews suggested code diffs without touching files on disk. |
| **Severity Filter** | `--severity` | `ERROR`, `WARNING`, `INFO` | Restricts findings to specified severity levels. |
| **Structured Output**| `--json-output` | `<file.json>` | Emits complete AST findings JSON to disk without polluting stdout. |
| | `--sarif-output` | `<file.sarif>` | Emits standard SARIF report for GitHub Code Scanning / IDE ingestion. |
| **CI Failure Gate** | `--error` | Flag | Exits with non-zero exit code `1` if blocking findings match. |
| **File Filtering** | `--include` / `--exclude` | Glob patterns (`"src/**"`, `"vendor/**"`) | Includes or excludes specific file trees (respects `.gitignore`). |
| **Baseline Diff** | `--baseline-commit` | `<git-hash>` | Scans only code changed since the specified git reference. |
| **Privacy / Telemetry**| `--metrics=off` | Flag (or `SEMGREP_SEND_METRICS=off`) | Disables telemetry pingbacks for air-gapped environments. |

---

## 5. High-Leverage Composite Examples

```bash
# 1. Multi-pack security audit with SARIF output and CI gate handling
semgrep scan \
  --config p/owasp-top-ten \
  --config p/secrets \
  --severity ERROR \
  --sarif-output=semgrep.sarif \
  --error || [ $? -eq 1 ]

# 2. Targeted Python security scan with dry-run patch preview
semgrep scan --config p/bandit --config p/python --dryrun src/

# 3. Ad-hoc pattern search: detect raw unsanitized SQL executions in TypeScript
semgrep scan --pattern 'db.query($SQL)' --lang ts --json-output=findings.json src/
```
