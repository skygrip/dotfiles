---
name: pii-detection
description: Audit datasets, logs, and git repos for leaked PII (names, emails, phones, SSNs, credit cards). Use 'openai/privacy-filter' for token classification audits or quick heuristic regex via 'rg'.
---

# PII & Personal Data Exposure Detection Skill

This skill guides agents and security auditors on discovering, classifying, and reporting Personally Identifiable Information (PII) and sensitive personal data across application logs, databases, JSON/CSV datasets, and git repositories.

---

## 1. Deep AI Classifier: `openai/privacy-filter`

`openai/privacy-filter` is an Apache 2.0 open-weight token classification model (128k context) that detects contextual human identities and sensitive personal spans across unstructured text with high accuracy.

### Supported Entity Categories

| Category | Description | Examples |
| :--- | :--- | :--- |
| `PRIVATE_PERSON` | Personal names, real identities | Full names, usernames, signatures |
| `PRIVATE_EMAIL` | Personal & corporate emails | Direct contact addresses |
| `PRIVATE_PHONE` | Mobile, landline, fax numbers | E.164 and local formatted phone numbers |
| `PRIVATE_ADDRESS`| Physical addresses & geolocation | Street addresses, postal codes, GPS |
| `ACCOUNT_NUMBER` | Financial & government identifiers | SSNs, Tax IDs, bank accounts, credit cards |
| `PRIVATE_DATE` | Sensitive dates | Dates of birth, medical event dates |
| `PRIVATE_URL` | Internal/sensitive web endpoints | Internal intranet URLs, presigned links |
| `SECRET` | Embedded keys & tokens | Auth tokens, credentials |

### Standalone PII Audit Script (`pii_audit.py`)

Run this Python script to batch-scan log folders or datasets and export structured audit findings to CSV and JSONL:

```python
# Install: uv pip install --python 3.13 --system --break-system-packages transformers torch rich
import csv
import json
import sys
from pathlib import Path
from transformers import pipeline
from rich.console import Console

console = Console()

# 1. Initialize OpenAI Privacy Filter model
privacy_filter = pipeline(task="token-classification", model="openai/privacy-filter")

PII_DESCRIPTIONS = {
    "SECRET": "API Key / Credential / Password",
    "PRIVATE_PERSON": "Personal Name / Identity",
    "PRIVATE_EMAIL": "Email Address",
    "PRIVATE_PHONE": "Phone Number",
    "PRIVATE_ADDRESS": "Physical Address / Location",
    "ACCOUNT_NUMBER": "Credit Card / Bank Account / SSN",
    "PRIVATE_URL": "Internal / Sensitive URL",
    "PRIVATE_DATE": "Date of Birth / Sensitive Date"
}

def stream_log_lines(file_path_str: str):
    """Safely stream text lines across common encodings."""
    p = Path(file_path_str)
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            with open(p, "r", encoding=enc, errors="replace") as f:
                for line in f:
                    yield line.strip()
            return
        except Exception:
            continue

def scan_pii(
    target_path_str: str,
    min_confidence: float = 0.85,
    batch_size: int = 64,
    output_csv: str = "pii_audit_findings.csv",
    output_jsonl: str = "pii_audit_findings.jsonl"
):
    """Scan files/directories for PII with batched inference and emit audit reports."""
    target_path = Path(target_path_str)
    files = list(target_path.rglob("*.*")) if target_path.is_dir() else [target_path]
    console.print(f"[bold yellow]=== SCANNING FOR PII IN: {target_path_str} ===[/bold yellow]\n")
    
    findings = []

    def process_batch(batch_lines, batch_nums, current_file):
        try:
            batch_results = privacy_filter(batch_lines, aggregation_strategy="simple")
            for line_num, line_str, entities in zip(batch_nums, batch_lines, batch_results):
                for entity in entities:
                    if entity['score'] < min_confidence:
                        continue
                    label = entity['entity_group'].upper()
                    word = entity['word'].strip()
                    score = entity['score']
                    desc = PII_DESCRIPTIONS.get(label, "Sensitive Personal Data")
                    
                    record = {
                        "file": str(current_file),
                        "line": line_num,
                        "category": label,
                        "description": desc,
                        "confidence": round(score, 4),
                        "matched_value": word,
                        "line_content": line_str
                    }
                    findings.append(record)
                    console.print(
                        f"[bold cyan]{current_file}:{line_num}[/bold cyan] "
                        f"[[bold red]{label}[/bold red] ({score:.1%})] "
                        f"[yellow]'{word}'[/yellow]"
                    )
        except Exception as e:
            console.print(f"[dim red]Error processing batch in {current_file}: {e}[/dim red]")

    for file_path in files:
        if file_path.is_dir() or file_path.suffix in [".parquet", ".zip", ".gz", ".png", ".jpg", ".exe"]:
            continue
        batch_lines, batch_nums = [], []
        for line_num, line_str in enumerate(stream_log_lines(str(file_path)), 1):
            if not line_str:
                continue
            batch_lines.append(line_str)
            batch_nums.append(line_num)
            if len(batch_lines) >= batch_size:
                process_batch(batch_lines, batch_nums, file_path)
                batch_lines, batch_nums = [], []
        if batch_lines:
            process_batch(batch_lines, batch_nums, file_path)

    # Export to CSV
    if output_csv and findings:
        with open(output_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["file", "line", "category", "description", "confidence", "matched_value", "line_content"])
            writer.writeheader()
            writer.writerows(findings)
        console.print(f"\n[bold green]Exported {len(findings)} findings to CSV: {output_csv}[/bold green]")

    # Export to JSONL
    if output_jsonl and findings:
        with open(output_jsonl, "w", encoding="utf-8") as f:
            for item in findings:
                f.write(json.dumps(item) + "\n")
        console.print(f"[bold green]Exported {len(findings)} findings to JSONL: {output_jsonl}[/bold green]")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "./logs/"
    scan_pii(target)
```

---

## 2. Quick Heuristic Regex Detection (`ripgrep`)

For rapid initial reconnaissance across gigabyte dumps, use `rg` regex heuristics. 

> [!WARNING]
> **Regex Limitations & False Positives:**
> Regex patterns cannot determine semantic context. They produce false positives on UUIDs, timestamps, package versions, and mock data, and miss obfuscated or non-standard formats. Always verify findings with `openai/privacy-filter`.

| Target PII Type | `ripgrep` Search Command | Known Flaws / False Positives |
| :--- | :--- | :--- |
| **Email Addresses** | `rg -n "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" ./logs/` | Catches example/mock emails (`test@test.com`), documentation links, and code symbols. |
| **Phone Numbers** | `rg -n "\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b" ./logs/` | Matches build timestamps, numerical hash prefixes, and database auto-increment IDs. |
| **US Social Security (SSN)** | `rg -n "\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b" ./logs/` | Misses un-hyphenated 9-digit SSNs; matches hardware part numbers and serial codes. |
| **Credit Card Numbers** | `rg -n "\b(?:\d{4}[-\s]?){3}\d{4}\b" ./logs/` | Does not perform Luhn checksum validation; matches UUID segments, binary masks, and product keys. |
| **IPv4 / Internal Subnets** | `rg -n "\b(?:10|192\.168|172\.(?:1[6-9]|2[0-9]|3[01]))\.\d{1,3}\.\d{1,3}\b" ./logs/` | Matches software version strings (e.g. `10.0.1.20`) and subnet configuration definitions. |

---

## 3. Git Revision & Author Identity Leak Audit

Inspect git repository history to detect exposed personal developer identities, private email domains, or PII committed into commit messages:

```bash
# 1. List all unique author names & email addresses committed across the entire repo history
git log --all --format="%an <%ae>" | sort -u

# 2. List all unique committer names & email addresses across the entire repo history
git log --all --format="%cn <%ce>" | sort -u

# 3. Flag commits containing personal email domains on corporate repositories
git log --all --format="%h | %an <%ae> | %s" | grep -E -i "@(gmail|hotmail|yahoo|outlook|users\.noreply\.github)\.com"

# 4. Search commit messages for SSN or phone number patterns
git log --all --grep="[0-9]\{3\}-[0-9]\{2\}-[0-9]\{4\}" --oneline

# 5. Search git diff history for specific personal identifier additions (Pickaxe search)
git log -S "SSN" --all --oneline
```

---

## 4. Triage Checklist for Auditors

1. **Quick Grep Triaging**: Run `rg` heuristic patterns to check if obvious email dumps or credit card patterns exist.
2. **Deep Semantic Audit**: Run `pii_audit.py` with `openai/privacy-filter` to detect contextual names, physical addresses, and sensitive dates.
3. **Inspect Git Metadata**: Run `git log --all --format="%an <%ae>" | sort -u` to verify no personal email addresses or identities leaked in repository commits.
4. **Generate Report**: Review `pii_audit_findings.csv` and group findings by severity (`ACCOUNT_NUMBER` > `PRIVATE_PERSON` > `PRIVATE_EMAIL`).
