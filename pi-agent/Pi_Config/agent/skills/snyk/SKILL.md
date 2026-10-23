---
name: snyk
description: Scan project dependencies, containers, IaC, and source code for CVEs, license issues, and SAST flaws (e.g. snyk test --json, snyk code test --json).
---

# Snyk Security CLI Capabilities Reference

Enterprise security scanner for Open Source dependencies (SCA), Static Code Analysis (SAST), Container images, and Infrastructure-as-Code (IaC) misconfigurations.

---

## 1. Execution Primitives & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Interactive Auth Hang** | Running bare `snyk auth` spawns an interactive browser session, hanging subshells | Export auth token headlessly: `export SNYK_TOKEN="TOKEN"` (or set `$env:SNYK_TOKEN="TOKEN"`) |
| **Exit Code 1 Failure Trap** | Exit code 1 indicates vulnerabilities found; treating exit 1 as an error breaks scripts | Use positive error gate: append check for exit code 1 in shell commands (see Section 4) |
| **Context Window Flooding** | Raw terminal output prints massive formatted ASCII dependency trees | Export results to disk: `--json-file-output=snyk.json` or pipe through `jq` |
| **Monorepo Memory OOM** | Deeply nested JavaScript / Java dependency trees cause Node heap exhaustion | Always append `--prune-repeated-subdependencies` and `--all-projects` |
| **Telemetry Noise** | Background analytics pings add latency to continuous execution loops | Set `export SNYK_DISABLE_ANALYTICS=1` |

---

## 2. Core Scan Engines & Capabilities Matrix

| Security Domain | CLI Command | Key Flags & Parameters | Target Artifacts / Capabilities |
| :--- | :--- | :--- | :--- |
| **Open Source (SCA)** | `snyk test` | `--all-projects`, `--prune-repeated-subdependencies`, `--licenses`, `--dev`, `--prod` | Scans manifests (`package.json`, `requirements.txt`, `pom.xml`) for CVEs. |
| **Continuous Monitor**| `snyk monitor` | `--org=ORG_ID`, `--file=MANIFEST_FILE` | Snapshots project dependency tree to Snyk Web UI for continuous alerts. |
| **Code SAST** | `snyk code test` | `--severity-threshold=high`, `--sarif-file-output=out.sarif` | Scans source code for OWASP Top 10 flaws, SQLi, and cryptographic bugs. |
| **AI-BOM / Model Scan**| `snyk aibom test`| `--org=ORG_ID` | Discovers and scans AI models, training datasets, and pipelines. |
| **SBOM Generation** | `snyk sbom` | `--format=cyclonedx1.5+json`, `--format=spdx2.3+json` | Generates CycloneDX or SPDX Software Bill of Materials. |
| **Secrets Detection** | `snyk secrets test` | `--org=ORG_ID` | Static scan for hardcoded tokens, passwords, and private keys. |
| **Infra-as-Code (IaC)**| `snyk iac test` | `terraform/`, `--scan=planned-values` | Scans Terraform, Kubernetes, Helm, CloudFormation for misconfigurations. |
| **Containers** | `snyk container test` | `IMAGE_TAG`, `--file=Dockerfile`, `--exclude-base-image-vulns` | Scans base images and container layers; suggests minimal CVE base upgrades. |
| **Auto-Remediation** | `snyk fix` | `--package-manager=npm`, `--package-manager=pip` | Automatically bumps vulnerable direct dependencies to secure patch versions. |
| **Ignore Policy** | `snyk ignore` | `--id=VULN_ID --expiry=30d --reason="Risk accepted"` | Updates `.snyk` policy file to suppress false positives with expiration dates. |

---

## 3. Exit Codes & Output Formatting Matrix

| Flag / Exit Code | Value / Type | Purpose / Behavior |
| :--- | :--- | :--- |
| **Exit Code `0`** | Clean | Scan complete: **no vulnerabilities** detected above threshold. |
| **Exit Code `1`** | Findings | Scan complete: **vulnerabilities found** (action required). |
| **Exit Code `2`** | Fatal Error | Network failure, invalid token, or syntax error. |
| **Exit Code `3`** | Missing File | No supported package managers or project files discovered. |
| `--severity-threshold`| `low`, `medium`, `high`, `critical` | Filters reported vulnerabilities to specified minimum severity level. |
| `--json-file-output` | `OUTPUT_JSON` | Emits complete AST and dependency vulnerability data directly to disk. |
| `--sarif-file-output`| `OUTPUT_SARIF` | Emits standard SARIF format for IDE and CI security ingestion. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Monorepo SCA scan with memory pruning and structured tabular JQ triage
snyk test --all-projects --prune-repeated-subdependencies --severity-threshold=high --json | jq -r '
  (if type == "array" then .[] else . end)
  | .vulnerabilities[]?
  | "\(.severity | ascii_upcase)\t\(.packageName)@\(.version)\t\(.title)\t(Fixed in: \((.fixedIn // ["None"]) | join(", ")))\t\(.id)"
' | sort -u

# Stage 2: Snyk Code SAST scan generating SARIF report with finding-count verification
snyk code test --severity-threshold=medium --sarif-file-output=snyk-sast.sarif || [ $? -eq 1 ]
jq '.runs[0].results | length' snyk-sast.sarif

# Stage 3: Container scan with Dockerfile base-image upgrade recommendations
snyk container test myapp:latest --file=Dockerfile --severity-threshold=high --exclude-base-image-vulns
```
