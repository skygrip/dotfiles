---
name: snyk
description: Scan projects for security vulnerabilities, license compliance, and IaC issues using Snyk CLI.
---

# Snyk CLI Skill

This skill guides the agent on how to use Snyk CLI (`snyk` or `snyk-win`) to detect, monitor, and remediate vulnerabilities in code, open-source dependencies, containers, and Infrastructure-as-Code (IaC) configurations.

> [!NOTE]
> On Windows systems, the CLI executable is installed via Winget as `snyk-win` (e.g., `snyk-win.exe`). On macOS and Linux, the executable name is `snyk`. Check availability before running.

> [!TIP]
> Snyk commands require authentication. In headless/agent environments, authenticate by setting the `SNYK_TOKEN` environment variable. Avoid running `snyk auth` or `snyk-win auth` directly, as it attempts to launch an interactive browser and will hang.

---

## Commands and Workflows

### 1. Testing Open Source Dependencies (SCA)
Scans project package manifests (e.g., `package.json`, `requirements.txt`, `Gemfile`, `pom.xml`) for known vulnerabilities in third-party libraries.
```bash
snyk test [PATH] [OPTIONS]
snyk-win test [PATH] [OPTIONS]
```
**Common Options:**
- `--severity-threshold=<low|medium|high|critical>`: Only report issues at or above the specified level.
- `--all-projects`: Auto-detect and scan all projects recursively in subdirectories.
- `--org=<ORG_ID|ORG_SLUG>`: Specify the Snyk Organization to use for the scan.
- `--file=<FILE>`: Specify a custom manifest file (e.g., `--file=requirements-dev.txt --package-manager=pip`).
- `--json-file-output=<path>`: Save raw JSON scan results directly to a file.

### 2. Static Application Security Testing (SAST / Snyk Code)
Scans source code for security issues and vulnerability patterns (e.g., SQL injection, XSS, insecure cryptography).
```bash
snyk code test [PATH] [OPTIONS]
snyk-win code test [PATH] [OPTIONS]
```
**Common Options:**
- `--severity-threshold=<low|medium|high>`: Filter issues by severity.
- `--org=<ORG_ID|ORG_SLUG>`: Specify the Snyk Organization.
- `--json`: Print results to stdout in JSON format.
- `--sarif-file-output=<path>`: Save results in SARIF format for IDEs or static analysis reports.

### 3. Infrastructure as Code (IaC) Scanning
Checks cloud configuration files (Terraform, Kubernetes, CloudFormation, ARM templates) for security misconfigurations.
```bash
snyk iac test [PATH] [OPTIONS]
snyk-win iac test [PATH] [OPTIONS]
```
**Common Options:**
- `--severity-threshold=<low|medium|high|critical>`: Filter issues by severity.
- `--org=<ORG_ID|ORG_SLUG>`: Specify the Snyk Organization.
- `--report`: Share results and snapshot configurations with the Snyk Web UI.

### 4. Container Image Scanning
Scans container images for vulnerabilities in the OS packages and dependencies.
```bash
snyk container test [IMAGE] [OPTIONS]
snyk-win container test [IMAGE] [OPTIONS]
```
**Example:**
```bash
snyk-win container test node:18-alpine
```
**Common Options:**
- `--severity-threshold=<low|medium|high|critical>`: Filter issues by severity.
- `--org=<ORG_ID|ORG_SLUG>`: Specify the Snyk Organization.

### 5. Ignoring Vulnerabilities
When a vulnerability is a known false positive or has no immediate fix, it can be ignored. This generates or updates a `.snyk` policy file in the project root.
```bash
snyk ignore --id=<VULNERABILITY_ID> [OPTIONS]
snyk-win ignore --id=<VULNERABILITY_ID> [OPTIONS]
```
**Common Options:**
- `--expiry=<YYYY-MM-DD|duration>`: Set an expiration date or duration (e.g., `30d` for 30 days).
- `--reason=<REASON>`: A description of why this vulnerability is being ignored.
- `--path=<PATH>`: Restrict the ignore rule to a specific dependency path.

---

## Exit Codes
When executing Snyk tests, check the exit code to determine the outcome:
- **`0`**: Scan completed successfully, **no vulnerabilities** found.
- **`1`**: Scan completed successfully, **vulnerabilities/issues were found**. *Note: Do not treat this exit code as a command execution failure. Parse the output or report findings.*
- **`2`**: System failure or bad configuration. Run with `-d` for debug logs.
- **`3`**: No supported projects detected.

---

## Best Practices & Remediation

### Remediation Workflow
1. Run Snyk scans and check the CLI output. Snyk prints recommended upgrade paths or patches directly in its stdout (e.g., "Upgrade package X to version Y").
2. Apply the recommended dependency version upgrades to the manifest file (or lockfile).
3. Re-run the scan to verify the vulnerabilities have been successfully remediated.

### Automation and Formatting
- **Use JSON/SARIF for Parsing**: When processing scan results programmatically, use `--json-file-output` or `--sarif-file-output` to easily parse the findings.
- **Set Severity Thresholds**: To prevent noise, run scans with `--severity-threshold=high` or `--severity-threshold=medium` unless a full audit is requested.
