---
name: secret-scanning
description: Detect and verify leaked API keys, tokens, and credentials using TruffleHog ('trufflehog filesystem . --results=verified', 'trufflehog git file://.'). Emits structured JSON/SARIF findings for CI gates and security audits.
---

# Secret & Credential Scanning Capabilities Reference

High-accuracy credential discovery engine for detecting and live-verifying 800+ API key, private token, database credential, and certificate types across local filesystems, git history, GitHub organizations, and S3 buckets using **TruffleHog**.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`trufflehog`** | Enterprise secret scanning CLI with live active API key verification and SARIF/JSON reporting |

---

## 2. Negative Guardrails & Remediation Protocol

| Hallucination / Mistake | Why It Fails | Correct Protocol / Syntax |
| :--- | :--- | :--- |
| Unverified string flooding | Unverified scans report hundreds of test fixtures and mock strings | Use `--results=verified` (or legacy `--only-verified`) to report live active keys |
| Assuming git rebase revokes keys | Rewriting git history does NOT invalidate keys harvested by scrapers | **Rotate the secret immediately** in provider console before rewriting history |
| Air-gapped / offline scan failures | Live verification attempts HTTP API requests to vendor endpoints | Pass `--no-verification` when scanning in offline/air-gapped environments |
| Subshell CI failure handling | `--fail` exits with code `183` on secret detection | Handle CI gate: `trufflehog git ... --fail \|\| [ $? -eq 183 ]` |
| Deep encoded binary strings | Base64/Hex nested inside JSON/protobuf is missed by shallow regex | Add `--max-decode-depth=3` to unwrap nested encoding layers |

---

## 3. Scan Targets & Verification Capabilities Matrix

| Target Scope | CLI Subcommand | Key Flags & Options | Capabilities & Scan Depth |
| :--- | :--- | :--- | :--- |
| **Local Filesystem** | `trufflehog filesystem <PATH>` | `--results=verified`, `--exclude-paths=.ignore` | Scans working tree, configuration files, and logs for active secrets. |
| **Git Repository** | `trufflehog git file://<PATH>` | `--since-commit HEAD~50`, `--branch=main` | Full commit history forensics across all branches and diffs. |
| **GitHub Org** | `trufflehog github --org=<ORG>` | `--token=$GITHUB_TOKEN --exclude-archived` | Scans all public and private repositories across an entire organization. |
| **S3 Buckets** | `trufflehog s3 --bucket=<NAME>` | `--role-arn=<ARN>` | Audits AWS S3 bucket objects for leaked credentials. |
| **Docker Images** | `trufflehog docker --image=<IMG>` | `--results=verified` | Extracts and scans container layers and environment variables. |
| **Key Analysis** | `trufflehog analyze` | `--token="<RAW_KEY>"` | Interrogates vendor APIs to determine exact permissions and owner for a key. |

---

## 4. Output Formats, Filtering & CI Flags Matrix

| Configuration | Flag / Parameter | Values / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **Verification** | `--results` | `verified`, `unverified`, `unknown` | Granular finding classification (`verified` filters out inactive noise). |
| | `--no-verification` | Boolean toggle | Disables network API validation for fast offline scans. |
| **Structured Output**| `--json` (`-j`) | NDJSON format | Emits line-delimited JSON for programmatic `jq` filtering. |
| | `--sarif` | SARIF format | Standard SARIF output for GitHub Security tab ingestion. |
| | `--github-actions` | Boolean toggle | Emits inline GitHub Actions workflow annotations on PR lines. |
| **Entropy Filter** | `--filter-entropy` | Float (e.g. `3.0`) | Filters unverified strings by minimum Shannon entropy threshold. |
| **CI Gating** | `--fail` | Exit code `183` | Fails build if secrets matching criteria are found. |
| **Decode Depth** | `--max-decode-depth` | Integer (default: `2`) | Iterative multi-layer decoding (e.g. base64 inside utf16). |

---

## 5. High-Leverage Composite Examples

```bash
# 1. Workspace filesystem scan filtered strictly for verified active credentials
trufflehog filesystem . --results=verified --json | jq -r '
  [.DetectorName, .Verified, (.SourceMetadata.Data.Filesystem.file // .SourceMetadata.Data.Git.file), .Raw] | @tsv
'

# 2. CI pull-request gate with SARIF export and exit-code 183 handling
trufflehog git file://. --since-commit main --branch HEAD --results=verified --sarif --fail > trufflehog.sarif || [ $? -eq 183 ]

# 3. Fast offline audit with custom entropy threshold and path exclusions
trufflehog filesystem ./src/ --no-verification --filter-entropy=3.5 --exclude-paths=.trufflehogignore --json
```
