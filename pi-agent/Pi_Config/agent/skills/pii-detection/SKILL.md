---
name: pii-detection
description: Audit logs, datasets, emails, and code for PII (names, emails, phones, SSNs, credit cards, physical addresses) using OpenAI Privacy Filter (openai/privacy-filter), DuckDB SQL, and ripgrep.
---

# PII & Sensitive Data Detection Reference

Automated discovery, classification, and redaction of Personally Identifiable Information (PII) across logs, emails, customer tickets, JSON/CSV datasets, and git repositories using the **`openai/privacy-filter`** token classification model, **DuckDB SQL**, and **ripgrep (`rg`)**.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`scripts/pii_scan.py`** | Bundled Python script: fast-path grep-style contextual scanner (`-C 1`) with CSV/JSONL export |
| **`openai/privacy-filter`** | Official Apache 2.0 1.5B token classifier with 128k context window and Viterbi entity decoding |
| **`duckdb`** | Zero-ingestion SQL regex engine for multi-gigabyte tabular CSV, Parquet, and JSONL audits |
| **`ripgrep` (`rg`)** | Ultra-fast regex scanner for raw text, code repositories, and compressed logs (`-z`) |

---

## 2. Negative Guardrails & Supply-Chain Safety

| Hallucination / Mistake | Why It Fails | Correct Protocol / Syntax |
| :--- | :--- | :--- |
| Pulling third-party forks | Malicious typosquats on Hugging Face distribute infostealers | Strictly use official repository: `openai/privacy-filter` |
| Using `trust_remote_code=True` | Executes unverified remote code | `openai/privacy-filter` is natively merged into upstream `transformers` |
| Regex-only PII auditing | Misses contextual names, addresses, and medical dates | Use `rg` for fast triage; use `openai/privacy-filter` for precise classification |
| Unbounded raw log stdout | Context window flooded by non-PII lines | Run with `-C 1` (bounded context) or export directly to `--output-csv` |

---

## 3. PII Detection Engines & Taxonomy Matrix

| Category | Target Entity Types | Real-World Examples & Patterns |
| :--- | :--- | :--- |
| **`PRIVATE_PERSON`** | Human names, employee identities | `Marcus Sterling`, `Dr. Julian Bashir`, `Sarah Connor` |
| **`PRIVATE_EMAIL`** | Personal & corporate direct emails | `marcus.sterling88@gmail.com`, `richard@piedpiper.com` |
| **`PRIVATE_PHONE`** | Mobile, landline, international numbers | `+1 (650) 555-2948`, `+61 412 555 839` |
| **`PRIVATE_ADDRESS`** | Street & residential physical addresses | `1422 Victoria Street, Potts Point, NSW 2011`, `350 5th Ave, NY` |
| **`ACCOUNT_NUMBER`** | SSNs, Tax IDs, bank accounts, credit cards | `482-194-883`, `Visa 4532-8819-2049-1102`, `USA #948201948` |
| **`PRIVATE_DATE`** | Dates of birth, medical treatment dates | `DOB: 1984-11-04`, `August 25, 2026 through September 15, 2026` |
| **`PRIVATE_URL`** | Sensitive reset links, presigned URLs | `https://internal.corp-auth.net/reset?token=ghp_secretToken...` |
| **`SECRET`** | Leaked bearer tokens, API keys, passwords | `eyJhbGciOiJIUzI1Ni...`, `sec_992148x891a` |

---

## 4. Triage Engines & Output Formats Matrix

| Tool / Engine | Input Target | Output Format | CLI Syntax / Command Pattern |
| :--- | :--- | :--- | :--- |
| **`pii_scan.py`** | Raw text / emails | Grep-style `-C 1` | `uv run --with "transformers @ git+https://github.com/huggingface/transformers.git" --with torch,accelerate python scripts/pii_scan.py ./logs/ -C 1` |
| **`pii_scan.py`** | Datasets / Dumps | CSV / JSONL Report | `python scripts/pii_scan.py ./data/ --min-confidence 0.85 --output-csv findings.csv` |
| **`duckdb`** | CSV / Parquet | SQL Table / JSON | `duckdb -bail -c "SELECT * FROM read_csv('logs.csv') WHERE regexp_matches(msg, '\b\d{3}-\d{2}-\d{4}\b');"` |
| **`ripgrep`** | Code / Raw Dumps | File:Line matches | `rg -n -C 1 "(?:\b\d{3}-\d{2}-\d{4}\b\|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"` |

---

## 5. High-Leverage Composite Examples

```bash
# 1. Fast-path contextual PII scan with 1 line of context
uv run --with "transformers @ git+https://github.com/huggingface/transformers.git" --with torch,accelerate \
  python scripts/pii_scan.py ./scratch/test_emails/ -C 1 --min-confidence 0.85

# 2. Large tabular CSV audit using DuckDB zero-ingestion regex
duckdb -markdown -bail -c "
SELECT line_number, service, message,
  CASE
    WHEN regexp_matches(message, '\b\d{3}-\d{2}-\d{4}\b') THEN 'SSN'
    WHEN regexp_matches(message, '\b(?:\d{4}[-\s]?){3}\d{4}\b') THEN 'CREDIT_CARD'
    WHEN regexp_matches(message, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}') THEN 'EMAIL'
    ELSE 'CLEAN'
  END AS pii_type
FROM read_csv('enterprise_logs.csv', header=true)
WHERE pii_type != 'CLEAN' LIMIT 20;
"

# 3. Git commit history author & identity audit
git log --all --format="%h | %an <%ae> | %s" | grep -E -i "@(gmail|hotmail|yahoo|outlook)\.com"
```
