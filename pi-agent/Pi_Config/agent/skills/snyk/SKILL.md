---
name: snyk
description: Scan projects for security vulnerabilities, licenses, and SAST code flaws. Use snyk test for dependency CVEs, snyk code test for SAST, snyk container test IMAGE, or snyk iac test.
---

# Snyk Security CLI Capabilities Reference

Enterprise security scanner for Open Source dependencies (SCA), Static Code Analysis (SAST), Container images, and Infrastructure-as-Code (IaC) misconfigurations.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`snyk`** | Multi-engine security CLI for vulnerability detection, license compliance, and remediation |

---

## 2. Negative Guardrails & Headless Execution Safety

| Hallucination / Mistake | Why It Fails | Correct Protocol / Syntax |
| :--- | :--- | :--- |
| `snyk auth` without token | Spawns interactive browser session (hangs headless shell) | Pass token explicitly: `export SNYK_TOKEN="<TOKEN>"` or `snyk auth <TOKEN>` |
| Subshell failure on Exit 1 | Exit code `1` means **vulnerabilities found**, not tool error | Handle exit code: `snyk test --json ... || [ $? -eq 1 ]` |
| Monorepo Node OOM | Unbounded deep dependency trees exhaust CLI memory | Add `--prune-repeated-subdependencies` and `--all-projects` |
| Raw CLI stdout flooding | Detailed CLI terminal trees overwhelm context window | Export directly to file: `--json-file-output=snyk.json` or `--sarif-file-output=snyk.sarif` |
| Telemetry in automated runs | Sends analytical pingbacks | Disable telemetry: `export SNYK_DISABLE_ANALYTICS=1` |

---

## 3. Core Scan Engines & Capabilities Matrix

| Security Domain | CLI Command | Key Flags & Parameters | Target Artifacts / Capabilities |
| :--- | :--- | :--- | :--- |
| **Open Source (SCA)** | `snyk test` | `--all-projects`, `--prune-repeated-subdependencies`, `--licenses`, `--dev/--prod`, `--unmanaged` | Scans manifests (`package.json`, `requirements.txt`, `pom.xml`) or unmanaged C/C++ binaries for CVEs. |
| **Continuous Monitor** | `snyk monitor` | `--org=<ORG>`, `--file=<MANIFEST>` | Snapshots project dependency tree to Snyk Web UI for continuous alerts. |
| **Code SAST** | `snyk code test` | `--severity-threshold=high`, `--sarif-file-output=out.sarif` | Scans source code for OWASP Top 10 flaws, SQLi, and cryptographic vulnerabilities. |
| **AI-BOM / Model Scan**| `snyk aibom test` | `--org=<ORG>` | Discovers and scans AI models, training datasets, and HuggingFace pipelines. |
| **SBOM Generation** | `snyk sbom` | `--format=cyclonedx1.5+json \| spdx2.3+json` | Generates CycloneDX / SPDX Software Bill of Materials for target project. |
| **Secrets Detection** | `snyk secrets test` | `--org=<ORG>` | Static scan for hardcoded tokens, passwords, and private keys. |
| **Infra-as-Code (IaC)** | `snyk iac test` | `path/to/tf`, `--scan=planned-values` | Scans Terraform, Kubernetes, Helm, CloudFormation for misconfigurations. |
| **Containers** | `snyk container test` | `<image>`, `--file=Dockerfile`, `--exclude-base-image-vulns` | Scans base images and container layers; suggests minimal CVE base image upgrades. |
| **Auto-Remediation** | `snyk fix` | `--package-manager=pip \| npm` | Automatically bumps vulnerable direct dependencies to secure patch versions. |
| **Ignore Policy** | `snyk ignore` | `--id=<VULN_ID> --expiry=30d --reason="..."` | Updates `.snyk` policy file to suppress false positives with expiration dates. |

---

## 4. Exit Codes & Output Formatting Matrix

| Flag / Exit Code | Value / Type | Purpose / Behavior |
| :--- | :--- | :--- |
| **Exit Code `0`** | Success | Clean scan: **no vulnerabilities** detected. |
| **Exit Code `1`** | Action Required | Scan complete: **vulnerabilities found** above threshold. |
| **Exit Code `2`** | Fatal Error | Network failure, invalid token, or syntax error. |
| **Exit Code `3`** | Missing Manifest | No supported package managers or project files discovered. |
| `--severity-threshold` | `low|medium|high|critical` | Filters reported vulnerabilities to specified minimum severity level. |
| `--json-file-output` | `<file.json>` | Emits complete AST and dependency vulnerability data directly to disk. |
| `--sarif-file-output`| `<file.sarif>` | Emits standard SARIF format for IDE and GitHub Security ingestion. |

---

## 5. High-Leverage Composite Examples

```bash
# 1. Monorepo SCA scan with memory pruning and structured tabular JQ triage
snyk test --all-projects --prune-repeated-subdependencies --severity-threshold=high --json | jq -r '
  (if type == "array" then .[] else . end)
  | .vulnerabilities[]?
  | "\(.severity | ascii_upcase)\t\(.packageName)@\(.version)\t\(.title)\t(Fixed in: \((.fixedIn // ["None"]) | join(", ")))\t\(.id)"
' | sort -u

# 2. Snyk Code SAST scan generating SARIF report without failing shell on findings
snyk code test --severity-threshold=medium --sarif-file-output=snyk-sast.sarif || [ $? -eq 1 ]

# 3. Container scan with Dockerfile base-image upgrade recommendations
snyk container test myapp:latest --file=Dockerfile --severity-threshold=high --exclude-base-image-vulns
```
