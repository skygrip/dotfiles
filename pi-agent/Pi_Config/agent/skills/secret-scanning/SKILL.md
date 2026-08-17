---
name: secret-scanning
description: Detect and verify leaked API keys, tokens, and credentials using TruffleHog ('trufflehog filesystem . --only-verified', 'trufflehog git file://.'). Emits structured JSON findings for CI gates and security audits.
---

# Secret & Credential Detection Skill

This skill guides agents and security auditors on discovering, verifying, and reporting high-entropy credentials, leaked API keys, private certificates, and access tokens across local filesystems, git repositories, GitHub organizations, and cloud storage using **TruffleHog CLI**.

---

## 1. Primary Detector: TruffleHog CLI

TruffleHog scans files and revision histories for 800+ credential types, performing live verification against provider APIs to differentiate active security threats from inactive strings or test fixtures.

### Essential CLI Flags

| Flag | Description | Audit Purpose |
| :--- | :--- | :--- |
| `--only-verified` | Reports only confirmed live/active secrets verified against vendor APIs. | Eliminates false positives during triage. |
| `--no-verification` | Skips live API verification checks. | Fast local/offline scanning and air-gapped environments. |
| `--json` (`-j`) | Emits findings as newline-delimited JSON objects. | Programmatic ingestion, `jq` parsing, and reporting. |
| `--exclude-paths=<file>` | Path to a newline-separated file of regex patterns to ignore. | Skips tests, mocks, test fixtures, and vendor directories. |
| `--fail` | Exits with status code `183` if findings are discovered. | Enforces hard build/PR blockers in CI/CD pipelines. |

---

## 2. Detection Commands

### A. Local Workspace Filesystem (`filesystem`)
```bash
# Scan current workspace for live, verified credentials (recommended first pass)
trufflehog filesystem . --only-verified

# Fast offline scan across all files (including unverified high-entropy strings)
trufflehog filesystem . --no-verification

# Scan with custom ignore list (skip mock/test fixtures)
trufflehog filesystem . --exclude-paths=.trufflehogignore

# Scan specific directory or build output
trufflehog filesystem ./var/logs/ --only-verified
```

### B. Git Repository History & PR Forensics (`git`)
```bash
# Scan full repository commit history for active leaked secrets
trufflehog git file://. --only-verified

# Scan PR changes between base branch and current HEAD (CI pull request gate)
trufflehog git file://. --since-commit main --branch HEAD --fail

# Scan the last 50 commits
trufflehog git file://. --since-commit HEAD~50

# Scan a remote git repository without cloning locally beforehand
trufflehog git https://github.com/org/repo.git --only-verified
```

### C. GitHub Repositories & Organizations (`github`)
```bash
# Scan a specific GitHub repository with access token (bypasses rate limits & accesses private repos)
trufflehog github --repo https://github.com/my-org/my-repo --token "$GITHUB_TOKEN" --only-verified

# Scan all repositories across an entire organization (excluding archived repos)
trufflehog github --org=my-org --token="$GITHUB_TOKEN" --exclude-archived --only-verified
```

### D. AWS S3 Buckets (`s3`)
```bash
# Scan a specific AWS S3 bucket using local AWS credentials
trufflehog s3 --bucket my-app-backups --only-verified

# Scan an S3 bucket using an assumed IAM role ARN
trufflehog s3 --bucket my-app-backups --role-arn arn:aws:iam::123456789012:role/SecurityAuditor
```

---

## 3. Structured JSON & Triage Reporting

Emit JSON Lines to extract structured metadata with `jq` for reporting:

```bash
# Extract detector name, verification status, file path, and raw secret snippet
trufflehog filesystem . --json \
  | jq -r '[.DetectorName, .Verified, .SourceMetadata.Data.Filesystem.file // .SourceMetadata.Data.Git.file, .Raw] | @tsv'

# Filter strictly for verified findings and format as audit table
trufflehog filesystem . --json \
  | jq -c 'select(.Verified == true) | {detector: .DetectorName, file: .SourceMetadata.Data.Filesystem.file, line: .SourceMetadata.Data.Filesystem.line}'
```

---

## 4. Git Metadata & Author Email Audit

Inspect commit history metadata for leaked personal email addresses, developer identities, or private domains:

```bash
# List all unique commit authors and emails across entire repository history
git log --all --format="%an <%ae>" | sort -u

# List all unique committers and emails across entire repository history
git log --all --format="%cn <%ce>" | sort -u

# Filter for personal email domains committed to corporate repos
git log --all --format="%an <%ae>" | sort -u | grep -E -i "@(gmail|hotmail|yahoo|outlook|users\.noreply\.github)\.com"
```

---

## 5. Operational Audit Workflows

### Workflow 1: Pre-Commit & Staged Files Gate
Detect secrets before creating a commit:
```bash
# Check unstaged and staged workspace files without touching remotes
trufflehog filesystem . --only-verified

# Create .trufflehogignore to exclude mock tests
cat << 'EOF' > .trufflehogignore
.*_test\.go$
tests/fixtures/.*
.*\.mock\..*
EOF
```

### Workflow 2: Git History Forensic Audit & Remediation
When auditing an existing codebase for historic leaks:
```bash
# 1. Forensic scan of entire commit history
trufflehog git file://. --only-verified --json > leaked_secrets.jsonl

# 2. Inspect results
jq -r '{detector: .DetectorName, commit: .SourceMetadata.Data.Git.commit, file: .SourceMetadata.Data.Git.file}' leaked_secrets.jsonl

# 3. CRITICAL: Rotate exposed credentials immediately via provider consoles.
# Do NOT assume rewriting git history makes an exposed secret safe.

# 4. Remove secret from history using git-filter-repo (if required)
git filter-repo --replace-text <(echo "MY_LEAKED_SECRET==>[REMOVED]")
```

### Workflow 3: CI/CD Pull Request Gate (GitHub Actions)
Block pull requests containing active credentials:

```yaml
name: Security Secret Scan
on: [pull_request]

jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog OSS Scan
        uses: trufflesecurity/trufflehog@main
        with:
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified --fail
```
