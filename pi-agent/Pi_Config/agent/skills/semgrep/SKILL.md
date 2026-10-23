---
name: semgrep
description: Multi-language SAST, custom YAML rule authoring, taint tracking, and OWASP/CWE security auditing (e.g. semgrep scan --config auto --json -q TARGET).
---

# Semgrep SAST & Security Linting Capabilities Reference

Multi-language AST-based static application security testing (SAST) and code quality scanner. Analyzes syntax trees across 30+ languages (Python, TypeScript, JavaScript, Go, Java, Rust, C#, C++, Ruby, PHP) using declarative semantic rules matching real code syntax.

---

## 1. Execution Primitives, Fast-Paths & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Interactive Login Hang** | Running `semgrep login` prompts for stdin or spawns an interactive browser, hanging subshells | Use unauthenticated `semgrep scan` or export `SEMGREP_APP_TOKEN` for CI |
| **Findings Exit Code 1** | Passing `--error` causes Semgrep to exit code 1 when findings are present | Capture findings safely: append check for exit code 1 in shell commands (see Section 4) |
| **Air-Gapped Network Calls** | `--config auto` calls remote Semgrep servers over the network | In offline or locked down environments, use local rules: `semgrep scan --config ./rules/` with `--metrics=off` |
| **Destructive Autofix Hazard** | Running `--autofix` on uncommitted git trees can introduce syntax corruption | Preview diffs first with `semgrep scan --dryrun`, or verify clean `git status` prior to `--autofix` |
| **SCA Scope Confusion** | Semgrep scans source code AST, not third-party manifest dependencies | Use **`snyk`** (`snyk test`) for package manifest dependency CVE scanning |

---

## 2. Official Ruleset Registry & Scan Packs Matrix

Combine packs using multiple `--config` arguments:

| Ruleset Pack | CLI Target (`--config`) | Target Language / Domain & Capabilities |
| :--- | :--- | :--- |
| **Curated Baseline** | `p/default` | High-signal, low-false-positive multi-language security baseline. |
| **OWASP Top 10** | `p/owasp-top-ten` | Web application vulnerabilities (SQLi, SSRF, IDOR, XSS, Broken Auth). |
| **CWE Top 25** | `p/cwe-top-25` | MITRE most dangerous software weakness patterns. |
| **Security Audit** | `p/security-audit` | Deep audit rules for comprehensive security and cryptographic reviews. |
| **Python / Bandit** | `p/bandit` | Full 1-to-1 AST replacement for legacy Python `bandit` linter. |
| **Secrets (Local)** | `p/secrets` | High-entropy credential scanning for exposed API keys and tokens. |
| **TypeScript / Web** | `p/typescript`, `p/react` | DOM XSS, prototype pollution, Node.js security, SSR vulnerabilities. |
| **Go** | `p/golang` | Goroutine leaks, context cancellation, SQLi, and crypto flaws. |
| **IaC / Containers** | `p/dockerfile`, `p/terraform` | Container hardening, root user alerts, and cloud infrastructure misconfigurations. |

---

## 3. Scan Execution, Autofix & Output Flags Matrix

| Configuration | Flag / Parameter | Values / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **Rule Source** | `--config RULE_TARGET` | `p/default`, `p/security-audit`, `./rules/` | Rule source (registry pack, local directory/file, or URL). |
| **Automated Fixes** | `--autofix` | In-place write | Applies AST-safe replacement patches defined in matching rules. |
| | `--dryrun` | Terminal preview | Previews suggested code diffs without touching files on disk. |
| **Severity Filter** | `--severity` | `ERROR`, `WARNING`, `INFO` | Restricts findings to specified severity levels. |
| **Structured Output**| `--json-output` | `OUTPUT_JSON` | Emits complete AST findings JSON to disk without polluting stdout. |
| | `--sarif-output` | `OUTPUT_SARIF` | Emits standard SARIF report for GitHub Code Scanning / IDE ingestion. |
| **CI Failure Gate** | `--error` | Flag | Exits with non-zero exit code `1` if blocking findings match. |
| **File Filtering** | `--include`, `--exclude` | Glob patterns (`"src/**"`, `"vendor/**"`) | Includes or excludes specific file trees (respects `.gitignore`). |
| **Baseline Diff** | `--baseline-commit` | `COMMIT_SHA` | Scans only code changed since the specified git reference. |
| **Privacy / Telemetry**| `--metrics=off` | Flag (or `SEMGREP_SEND_METRICS=off`) | Disables telemetry pingbacks for air-gapped environments. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Multi-pack security audit with SARIF output and CI gate handling
semgrep scan \
  --config p/owasp-top-ten \
  --config p/secrets \
  --severity ERROR \
  --sarif-output=semgrep.sarif \
  --error || [ $? -eq 1 ]

# Stage 2: Targeted Python security scan with dry-run patch preview
semgrep scan --config p/bandit --config p/python --dryrun src/

# Stage 3: Ad-hoc pattern search detecting raw unsanitized SQL executions with finding count verification
semgrep scan --pattern 'db.query($SQL)' --lang ts --json-output=findings.json src/
jq '.results | length' findings.json
```
