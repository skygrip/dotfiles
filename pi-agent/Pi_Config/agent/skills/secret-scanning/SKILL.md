---
name: secret-scanning
description: Detect and verify leaked API keys, tokens, and credentials using TruffleHog (trufflehog filesystem . --results=verified, trufflehog git file://.). Emits structured JSON/SARIF findings for CI gates and security audits.
---

# Secret & Credential Scanning Capabilities Reference

High-accuracy credential discovery engine for detecting and live-verifying 800+ API key, private token, database credential, and certificate types across local filesystems, git history, GitHub organizations, and S3 buckets using **TruffleHog**.

---

## 1. Execution Primitives, Fast-Paths & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Unverified String Flood** | Unverified scans report hundreds of test fixtures and mock strings | Use `--results=verified` to filter strictly for live, active credentials |
| **Air-Gapped Network Timeout** | Live verification attempts HTTP API requests to vendor endpoints | Pass `--no-verification` when scanning in offline or air-gapped environments |
| **Exit Code 183 Gate** | TruffleHog exits with code 183 when secrets are detected | Handle exit code: append check for exit code 183 in shell commands (see Section 4) |
| **Nested Encoding Blindspot** | Base64 or Hex nested inside JSON/protobuf is missed by shallow passes | Add `--max-decode-depth=3` to unwrap nested encoding layers |
| **Revocation Protocol** | Rewriting git history does not invalidate harvested keys | Immediately rotate the exposed credential in the provider console prior to history rewrite |

---

## 2. Scan Targets & Verification Capabilities Matrix

| Target Scope | CLI Subcommand | Key Flags & Options | Capabilities & Scan Depth |
| :--- | :--- | :--- | :--- |
| **Local Filesystem** | `trufflehog filesystem TARGET_PATH` | `--results=verified`, `--exclude-paths=.ignore` | Scans working tree, configuration files, and logs for active secrets. |
| **Git Repository** | `trufflehog git file://TARGET_PATH` | `--since-commit HEAD~50`, `--branch=main` | Full commit history forensics across all branches and diffs. |
| **GitHub Org** | `trufflehog github --org=ORG_NAME` | `--token=$GITHUB_TOKEN --exclude-archived` | Scans all public and private repositories across an organization. |
| **S3 Buckets** | `trufflehog s3 --bucket=BUCKET_NAME` | `--role-arn=ROLE_ARN` | Audits AWS S3 bucket objects for leaked credentials. |
| **Docker Images** | `trufflehog docker --image=IMAGE_TAG` | `--results=verified` | Extracts and scans container layers and environment variables. |
| **Key Analysis** | `trufflehog analyze` | `--token="KEY_STRING"` | Interrogates vendor APIs to determine permissions and key owner. |

---

## 3. Output Formats, Filtering & CI Flags Matrix

| Configuration | Flag / Parameter | Values / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **Verification** | `--results` | `verified`, `unverified`, `unknown` | Granular finding classification (`verified` filters out inactive noise). |
| **Network Mode** | `--no-verification` | Boolean toggle | Disables network API validation for fast offline scans. |
| **Structured Output**| `--json` (`-j`) | NDJSON format | Emits line-delimited JSON for programmatic `jq` filtering. |
| **SARIF Report** | `--sarif` | SARIF format | Standard SARIF output for GitHub Security tab ingestion. |
| **CI Annotations** | `--github-actions` | Boolean toggle | Emits inline GitHub Actions workflow annotations on PR lines. |
| **Entropy Filter** | `--filter-entropy` | Float (e.g. `3.0`) | Filters unverified strings by minimum Shannon entropy threshold. |
| **CI Gating** | `--fail` | Exit code `183` | Fails build if secrets matching criteria are found. |
| **Decode Depth** | `--max-decode-depth` | Integer (default: `2`) | Iterative multi-layer decoding (e.g. base64 inside utf16). |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Workspace filesystem scan filtered strictly for verified active credentials with count check
trufflehog filesystem . --results=verified --json | jq -r '
  [.DetectorName, .Verified, (.SourceMetadata.Data.Filesystem.file // .SourceMetadata.Data.Git.file), .Raw] | @tsv
'
trufflehog filesystem . --results=verified --json | jq -s 'length'

# Stage 2: CI pull-request gate with SARIF export and exit-code 183 handling
trufflehog git file://. --since-commit main --branch HEAD --results=verified --sarif --fail > trufflehog.sarif || [ $? -eq 183 ]

# Stage 3: Fast offline audit with custom entropy threshold and path exclusions
trufflehog filesystem ./src/ --no-verification --filter-entropy=3.5 --exclude-paths=.trufflehogignore --json
```
