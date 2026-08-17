---
name: semgrep
description: Multi-language AST static security analysis (SAST) and code quality scanning. Use 'semgrep scan --config auto', 'semgrep scan --config p/bandit' (Python), or 'p/owasp-top-ten'.
---

# Semgrep Skill

Semgrep is a fast, multi-language static analysis (SAST) and code scanning tool. It analyzes syntax trees across 30+ languages (Python, TypeScript, JavaScript, Go, Java, Rust, C#, C++, Ruby, PHP) using declarative pattern rules matching real code syntax.

---

## 🧭 Operational Boundaries

### Use When:
* **AST Security Analysis (SAST)**: Scanning source code for OWASP Top 10 vulnerabilities, SQL injection, command execution, insecure deserialization (`pickle`, `yaml.load`), and weak cryptography.
* **Multi-Language Bandit Replacement**: Running comprehensive Python security audits using the official Bandit ruleset port (`--config p/bandit`) without Python-only tooling restrictions.
* **Automated Code Fixes**: Automatically applying AST-aware remediation fixes across files via `--autofix`.
* **Ad-Hoc Structural Pattern Matching**: Querying code with pattern wildcards (`--pattern '$FUNC($$$ARGS)' --lang ts`).

### Do NOT Use When:
* **Secret & API Key Scanning**: Leaked keys, tokens, and git commit history $\rightarrow$ use **`secret-scanning`** (`trufflehog`).
* **PII Detection**: Personal identification data in logs/datasets $\rightarrow$ use **`pii-detection`** (`openai/privacy-filter`).
* **Dependency Vulnerability Scanning (SCA)**: Third-party package CVEs in `package.json` or `requirements.txt` $\rightarrow$ use **`snyk`** (`snyk test`).

---

## ⚡ Core CLI Workflows

### 1. Fast Repository Security Scan (Auto-Detected Rules)

Automatically detects repository languages and applies Semgrep's curated security policy:

```bash
# Scan current repository with auto-detected rulesets
semgrep scan --config auto

# Scan specific directory and output JSON
semgrep scan --config auto --json ./src/
```

---

### 2. Curated Security & Quality Rulesets (`--config <ruleset>`)

| Target / Language | Command | Description |
| :--- | :--- | :--- |
| **All Languages (Auto)** | `semgrep scan --config auto` | Auto-detects project languages and runs core security rules. |
| **Bandit Equivalent (Python)** | `semgrep scan --config p/bandit` | Full 1-to-1 port of the Python Bandit security ruleset. |
| **OWASP Top 10** | `semgrep scan --config p/owasp-top-ten` | Web application vulnerabilities across all supported languages. |
| **CWE Top 25** | `semgrep scan --config p/cwe-top-25` | Common Weakness Enumeration most dangerous software flaws. |
| **TypeScript / Node.js** | `semgrep scan --config p/typescript` | TypeScript security flaws, prototype pollution, and typing bugs. |
| **Go** | `semgrep scan --config p/golang` | Insecure goroutines, context cancellation, SQLi, and crypto. |
| **Security Audit (High Precision)** | `semgrep scan --config p/security-audit` | Thorough audit rules for security reviews. |
| **Secrets & Keys (Local)** | `semgrep scan --config p/secrets` | Local AST pattern scanning for hardcoded tokens. |

---

### 3. Language-Specific Targeted Scans

```bash
# 1. Python Security Audit (Bandit + OWASP)
semgrep scan --config p/bandit --config p/python ./backend/

# 2. TypeScript / JavaScript Web Security
semgrep scan --config p/javascript --config p/typescript ./src/

# 3. Go Microservice Audit
semgrep scan --config p/golang ./cmd/ ./internal/
```

---

## 🛠️ CLI Flags & Output Controls

```bash
# 1. Structured JSON output for programmatic filtering with jq
semgrep scan --config auto --json | jq '.results[] | {path: .path, check_id: .check_id, message: .extra.message, line: .start.line}'

# 2. SARIF format for CI/CD integrations
semgrep scan --config auto --sarif --sarif-output=semgrep.sarif

# 3. Filter by severity level (ERROR, WARNING, INFO)
semgrep scan --config auto --severity ERROR

# 4. Exclude test directories, generated code, and dependencies
semgrep scan --config auto --exclude "tests/**" --exclude "node_modules/**" --exclude "dist/**"

# 5. Fail CI on findings (--error exits with code 1 if findings exist)
semgrep scan --config auto --error --quiet
```

---

## 🔧 Ad-Hoc Pattern Search & Automated Autofix (`--autofix`)

### 1. Ad-Hoc Command-Line Pattern Search

Search code using actual syntax patterns with metavariables (`$VAR`) and ellipses (`...`):

```bash
# Find all raw SQL formatting in Python (SQL injection risks)
semgrep -e 'cursor.execute("..." % ...)' --lang python ./src/
semgrep -e 'cursor.execute(f"...")' --lang python ./src/

# Find all disabled SSL verification in Python requests
semgrep -e 'requests.$METHOD(..., verify=False, ...)' --lang python ./src/

# Find dangerous innerHTML assignments in TypeScript/JavaScript
semgrep -e '$EL.innerHTML = $INPUT' --lang ts ./src/
```

### 2. Applying Automated Fixes (`--autofix` / `-a`)

Many Semgrep rules include built-in AST code replacement patches:

```bash
# Dry-run: view what autofixes would be applied without touching files
semgrep scan --config p/bandit --dryrun

# Apply all available autofixes directly to source files
semgrep scan --config p/bandit --autofix
```

---

## 📝 Custom Rule Definition Template

Create `.semgrep.yml` or `rules.yaml` to enforce project-specific architectural and security standards:

```yaml
rules:
  - id: ban-raw-subprocess-shell
    languages: [python]
    severity: ERROR
    message: "Avoid 'subprocess.Popen(shell=True)' or 'subprocess.run(shell=True)' to prevent command injection."
    patterns:
      - pattern: subprocess.$FUNC(..., shell=True, ...)
    fix: subprocess.$FUNC(..., shell=False, ...)

  - id: ban-jwt-none-algorithm
    languages: [typescript, javascript]
    severity: ERROR
    message: "JWT verification must not permit the 'none' algorithm."
    pattern: |
      jwt.verify($TOKEN, $KEY, { algorithms: [..., "none", ...] })
```

Run custom local rules:
```bash
semgrep scan --config .semgrep.yml ./src/
```

---

## 📊 Summary Cheatsheet

| Task | Recommended Command |
| :--- | :--- |
| **Fast Full Repo Scan** | `semgrep scan --config auto` |
| **Python Bandit Audit** | `semgrep scan --config p/bandit` |
| **OWASP Web Audit** | `semgrep scan --config p/owasp-top-ten` |
| **Filter by Severity** | `semgrep scan --config auto --severity ERROR` |
| **Export SARIF Report** | `semgrep scan --config auto --sarif --sarif-output=report.sarif` |
| **Apply Autofixes** | `semgrep scan --config p/bandit --autofix` |
| **One-Off Pattern Query** | `semgrep -e '$OBJ.eval($EXPR)' --lang js src/` |
