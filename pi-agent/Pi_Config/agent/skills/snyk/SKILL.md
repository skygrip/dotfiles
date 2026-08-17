---
name: snyk
description: Scan projects for security vulnerabilities, licenses, and SAST code flaws. Use 'snyk test' for dependency CVEs, 'snyk code test' for SAST, 'snyk container test <image>', or 'snyk iac test'.
---

# Snyk CLI Skill

This skill guides the agent on how to use Snyk CLI (`snyk`) to detect, monitor, and remediate vulnerabilities in code, open-source dependencies, containers, and Infrastructure-as-Code (IaC) configurations.

> [!IMPORTANT]
> **Headless Authentication & Configuration:**
> - In headless/agent environments, set the `SNYK_TOKEN` environment variable.
> - Alternatively, authenticate non-interactively via `snyk auth <TOKEN>` or `snyk config set api=<TOKEN>`. **Never** run `snyk auth` without arguments, as it launches an interactive browser and hangs.
> - For EU/AU/Custom tenants, set `SNYK_API="https://api.eu.snyk.io"`.
> - Disable telemetry in automated environments: `export SNYK_DISABLE_ANALYTICS=1`.

---

## Commands and Workflows

### 1. Testing Open Source Dependencies (SCA) & Continuous Monitoring
Scans package manifests (`package.json`, `requirements.txt`, `pom.xml`, `Cargo.toml`, etc.) for known CVEs and license issues:
```bash
snyk test [PATH] [OPTIONS]
```
* **Continuous Monitoring**: Snapshot dependency trees to the Snyk Web UI:
  ```bash
  snyk monitor [PATH] [OPTIONS]
  ```
* **Common Options:**
  - `--severity-threshold=<low|medium|high|critical>`: Only report issues at or above the specified level.
  - `--all-projects`: Auto-detect and scan all projects recursively in subdirectories.
  - `--all-sub-projects`: Scan all sub-projects in Gradle and Maven workspaces.
  - `--prune-repeated-subdependencies`: Prune duplicate sub-dependency trees to prevent Node/CLI Out-Of-Memory (OOM) errors in large monorepos.
  - `--org=<ORG_ID|ORG_SLUG>`: Specify the Snyk Organization to use for the scan.
  - `--file=<FILE>`: Specify a custom manifest file (e.g., `--file=requirements.txt`, `--file=pyproject.toml`).
  - `--licenses`: Check dependencies for license compliance against org policies.
  - `--dev` / `--prod`: Include or exclude development dependencies.
  - `--strict-out-of-sync=false`: Tolerate minor drift between manifests and lockfiles.
  - `--json-file-output=<path>`: Save raw JSON scan results directly to a file without flooding stdout.
  - `--sarif-file-output=<path>`: Save SARIF report for GitHub Security / IDE triage.

**Targeted Manifest & Monorepo Examples:**
```bash
# Python: scan requirements or pyproject.toml
snyk test --file=requirements.txt --package-manager=pip
snyk test --file=pyproject.toml

# Node / Monorepo: scan all packages with memory pruning
snyk test --all-projects --prune-repeated-subdependencies --severity-threshold=high

# Large Gradle / Maven multi-module monorepo:
snyk test --all-sub-projects --sarif-file-output=snyk.sarif
```

---

### 2. Static Application Security Testing (SAST / Snyk Code)
Scans source code for security issues and vulnerability patterns (e.g., SQL injection, XSS, insecure cryptography).
```bash
snyk code test [PATH] [OPTIONS]
```
* **Prerequisite**: Snyk Code must be enabled in Snyk Organization settings.
* **Common Options:**
  - `--severity-threshold=<low|medium|high>`: Filter issues (Snyk Code supports low/medium/high).
  - `--org=<ORG_ID|ORG_SLUG>`: Specify the Snyk Organization.
  - `--sarif-file-output=<path>`: Save results in SARIF format for IDEs or static analysis reports.
  - `--json-file-output=<path>`: Save detailed AST vulnerability data.

---

### 3. Infrastructure as Code (IaC) Scanning
Checks cloud configuration files (Terraform, Kubernetes, CloudFormation, ARM, Helm) for security misconfigurations.
```bash
snyk iac test [PATH] [OPTIONS]
```
* **Terraform Plan Scanning (Evaluated Attributes)**:
  ```bash
  terraform plan -out=tfplan.binary
  terraform show -json tfplan.binary > tfplan.json
  snyk iac test tfplan.json --scan=planned-values
  ```
* **Common Options:**
  - `--severity-threshold=<low|medium|high|critical>`: Filter issues by severity.
  - `--report`: Share results and snapshot configurations with the Snyk Web UI.
  - `--sarif-file-output=<path>`

---

### 4. Container Image Scanning
Scans container images and Dockerfiles for OS packages and layer vulnerabilities.
```bash
snyk container test [IMAGE] [OPTIONS]
snyk container monitor [IMAGE] [OPTIONS]
```
* **Base Image Remediation**: Include `--file=Dockerfile` to get automated upgrade recommendations for less vulnerable base image tags:
  ```bash
  snyk container test myapp:latest --file=Dockerfile
  ```
* **Common Options:**
  - `--severity-threshold=<low|medium|high|critical>`: Filter issues by severity.
  - `--exclude-base-image-vulns`: Highlight only vulnerabilities introduced in application layers.

---

### 5. Automated Dependency Fixing (`snyk fix`)
Snyk can attempt to automatically upgrade vulnerable dependencies in supported manifest files (`npm`, `yarn`, `pip`, `poetry`, `pipenv`).
```bash
snyk fix [OPTIONS]
```
> [!NOTE]
> - Ensure dependencies/lockfiles are installed (`npm install`, `pip install`) before running `snyk fix`.
> - For unsupported package managers (Maven, Go, Rust), apply recommended versions manually from `snyk test` output.
> - Always review git diffs and run test suites before committing automated fixes.

---

### 6. Ignoring Vulnerabilities
When a vulnerability is a known false positive or has no immediate fix, it can be ignored. This generates or updates a `.snyk` policy file in the project root.
```bash
snyk ignore --id=<VULNERABILITY_ID> [OPTIONS]
```
**Common Options:**
- `--expiry=<YYYY-MM-DD|duration>`: Set an expiration date or duration (e.g., `30d` for 30 days).
- `--reason=<REASON>`: A description of why this vulnerability is being ignored.
- `--path=<PATH>`: Restrict the ignore rule to a specific dependency path.

---

## Exit Codes & Shell Handling

| Exit Code | Meaning | Agent Shell Handling |
| :--- | :--- | :--- |
| **`0`** | Success: Scan complete, **no vulnerabilities** found. | Standard execution. |
| **`1`** | Action Required: Scan complete, **vulnerabilities found**. | **Do not treat as script failure.** Parse output or report findings. |
| **`2`** | Fatal Error: Misconfiguration, network error, or invalid auth. | Run with `-d` for debug logs. |
| **`3`** | Project Detection Failure: No supported manifests found. | Verify paths and file arguments. |

**Shell Safeguard for Agents:**
Prevent subshells from terminating under `set -e`:
```bash
snyk test --json-file-output=snyk-report.json || [ $? -eq 1 ]
```

---

## JSON Triage Recipes (Prevent Context Flooding)

Always triage large repositories with `jq` queries against exported JSON files:

### 1. Robust SCA Vulnerability Summary (Handles single project & `--all-projects` arrays):
```bash
snyk test --json | jq -r '
  (if type == "array" then .[] else . end)
  | .vulnerabilities[]?
  | "\(.severity | ascii_upcase)\t\(.packageName)@\(.version)\t\(.title)\t(Fixed in: \((.fixedIn // ["None"]) | join(", ")))\t\(.id)"
' | sort -u
```

### 2. SAST (Snyk Code) SARIF Summary:
```bash
snyk code test --sarif | jq -r '
  .runs[0].results[]?
  | "\(.level | ascii_upcase)\t\(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine)\t\(.ruleId)\t\(.message.text)"
'
```

### 3. IaC Misconfiguration Summary:
```bash
snyk iac test --json | jq -r '
  (if type == "array" then .[] else . end)
  | .infrastructureAsCodeIssues[]?
  | "\(.severity | ascii_upcase)\t\(.targetFile):\(.lineNumber // 0)\t\(.title)\t\(.resolve)"
'
```
