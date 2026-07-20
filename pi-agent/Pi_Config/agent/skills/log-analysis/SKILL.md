---
name: log-analysis
description: Explore, inspect, schema-discover, search, detect outliers, scan for PII/secrets, run semantic searches (sff.exe), and run ML/AI analysis (Isolation Forest, fastembed, openai/privacy-filter) on log files and datasets (JSON/JSONL, CSV, Parquet) using DuckDB CLI, jq, ripgrep, Miller, sff.exe, and Pi Agent.
---

# Log & Data Analysis Exploration

This skill provides a systematic routine for exploring, schema-discovering, searching, detecting statistical & ML outliers, and scanning for PII/secrets in unknown or unusual datasets (such as application logs, M365 audit logs, event streams, large CSVs, or nested JSON/JSONL dumps) using **DuckDB CLI**, **jq**, **ripgrep (`rg`)**, **Miller (`mlr`)**, **Semantic File Finder (`sff.exe`)**, **scikit-learn**, **OpenAI Privacy Filter**, and **Pi Agent (`pi`)**.

---

## 🎯 Target Use Cases & Solved Problems

* **🛡️ Security & M365 Audit Log Analysis**: Unpack stringified `AuditData` payloads and flag suspicious logins, file downloads, or privilege escalations.
* **⚡ Multi-Gigabyte File Reconnaissance**: Instantly scan 500MB+ raw logs for error codes, IP addresses, or stack traces without memory lag.
* **🔒 Pre-Sharing PII & Secret Redaction**: Detect and redact API keys, JWTs, emails, credit cards, and credentials before exporting or sharing logs.
* **🤖 Semantic Anomaly & Rare Event Detection**: Group unstructured error logs into semantic clusters to discover rare, unseen system bugs.

---

## Quick Reference Cheatsheet

| Task / Goal | Recommended Tool | One-Liner / Quick Syntax |
| :--- | :--- | :--- |
| **Raw Text & Stack Traces** | `ripgrep` | `rg -i -U -C 5 "exception\|failed\|unauthorized" ./logs/` |
| **Format Conversion (JSONL $\rightarrow$ CSV)** | `Miller` | `mlr --ijsonl --ocsv cat app_logs.jsonl > output.csv` |
| **Quick JSON Key Inspection** | `jq` | `jq -c '{time: .timestamp, msg: .message}' logs.jsonl \| head -n 10` |
| **Schema Discovery** | `DuckDB CLI` | `duckdb -c "DESCRIBE SELECT * FROM read_json_auto('logs.jsonl');"` |
| **M365 Nested JSON Parsing** | `DuckDB SQL` | `duckdb -c "WITH p AS (SELECT parse_json(AuditData) a FROM 'm365.json') SELECT a.UserId, a.ClientIP FROM p;"` |
| **Statistical Outliers (Z-Score)** | `DuckDB SQL` | `duckdb -c "SELECT *, (val - AVG(val) OVER()) / NULLIF(STDDEV_POP(val) OVER(), 0) AS z FROM 'data.csv' WHERE ABS(z) > 3.0;"` |
| **Multi-Variable ML Anomalies** | `scikit-learn` | `clean_df['anomaly_label'] = IsolationForest(contamination=0.01).fit_predict(feature_df)` |
| **Semantic Log Search (CLI)** | `sff` | `sff -e log,json,txt -r -m minishlab/potion-code-16M-v2 "unauthorized privilege escalation"` |
| **Semantic Log Clustering** | `fastembed` | `TextEmbedding('snowflake/snowflake-arctic-embed-m-v1.5').embed(cleaned_lines)` |
| **PII & Secret Audit Scan** | Python (`privacy-filter`) | Python Script (Phase 4B): `pii_grep("./logs/", batch_size=64, output_csv="pii_audit.csv")` |
| **AI Threat Summarization** | `DuckDB` + `pi` | `duckdb -c "SELECT ... FROM 'm365.json'" \| pi "Analyze suspicious security events"` |
| **Export Query to Parquet** | `DuckDB` | `duckdb -c "COPY (SELECT * FROM 'data.csv') TO 'out.parquet' (FORMAT PARQUET);"` |

---

## 1. Phase 1: Fast Raw Triaging & Stream Processing

### 🧭 Tool Selection Matrix (Pick the Right Tool for the Job)

* **Exact String / Known Pattern Match?** $\rightarrow$ Use **`ripgrep` (`rg`)** (instant regex).
* **Natural Language / Concept Search (*"find database connection failures"*)?** $\rightarrow$ Use **`sff.exe`** (Rust semantic search).
* **Structured SQL, Nested JSON Structs, M365 Logs, or Statistical Outliers?** $\rightarrow$ Use **`DuckDB CLI`** (parallel SQL).
* **Format Conversion (`JSONL` $\leftrightarrow$ `CSV`) or Column Re-ordering?** $\rightarrow$ Use **`Miller` (`mlr`)**.
* **Quick One-Line JSON Field Inspection?** $\rightarrow$ Use **`jq`**.
* **Multi-Variable Anomaly Detection across Columns?** $\rightarrow$ Use **`IsolationForest`** (scikit-learn).
* **PII & Secret Audit Scanning?** $\rightarrow$ Use **`openai/privacy-filter`** (`pii_grep`).

---

### A. Fast Raw Text Search & Stack Trace Capture (`ripgrep`)

Before parsing structured JSON or CSV into SQL, use `rg` for instant multi-threaded regex searches across raw log dumps:

```bash
# Scan a 500MB raw log file for specific IP address or username
rg "192.168.1.105" m365_logs.json | head -n 5

# Search case-insensitively for exception strings, preserving 5 lines of multi-line stack trace context (-U -C 5)
rg -i -U -C 5 "exception|failed|unauthorized" ./logs/

# Count matching lines without printing full content
rg -c "FileDownloaded" m365_audit_logs.json
```

### B. Fast Format Conversion & Reshaping (`Miller`)

Use `mlr` to slice columns, reformat data, or convert JSONL to CSV on the fly:

```bash
# Convert line-delimited JSON (JSONL) to CSV for spreadsheet viewing
mlr --ijsonl --ocsv cat app_logs.jsonl > output.csv

# Pretty-print tabular output directly in terminal
mlr --icsv --opprint cat access.csv | head -n 20

# Filter CSV rows and re-order columns on the command line
mlr --icsv filter '$status_code >= 400' then cut -f timestamp,ip_address,status_code access.csv
```

### C. Quick Terminal JSON Inspection (`jq`)

For quick terminal-based JSON inspection on smaller files:

```bash
# Pretty-print top-level keys of a JSON object
jq 'keys' data.json

# Extract specific nested fields from line-delimited JSON logs
jq -c '{time: .timestamp, level: .level, msg: .message}' app_logs.jsonl | head -n 10

# Filter JSON logs by level
jq -c 'select(.level == "ERROR" or .level == "FATAL")' app_logs.jsonl

# Frequency count of unique HTTP status codes in JSON logs
jq -r '.status_code' access_logs.jsonl | sort | uniq -c | sort -nr
```

---

## 2. Phase 2: Encoding, Preprocessing & Schema Discovery

### A. Universal Multi-Encoding Python Reader & Text Sanitizer

Handles UTF-8, UTF-16 (Windows Event Logs / IIS), and Latin-1 automatically, while masking volatile dynamic tokens (ISO 8601, Apache/Nginx, Syslog timestamps, IPs, UUIDs, Hex addresses, Hashes):

```python
import re
from pathlib import Path

def read_log_file(filepath: str) -> list[str]:
    """Read log file handling UTF-8, UTF-16, and Latin-1 encodings automatically."""
    path = Path(filepath)
    for encoding in ['utf-8', 'utf-16-le', 'utf-16', 'latin-1']:
        try:
            with open(path, 'r', encoding=encoding) as f:
                lines = [line.strip() for line in f]
                if any(lines):
                    return lines
        except (UnicodeDecodeError, UnicodeError):
            continue
    return []

def clean_log_text(text: str) -> str:
    """Normalize log text by stripping timestamps, IPs, UUIDs, hex addresses, and hashes."""
    # 1. Timestamps: ISO 8601, Apache/Nginx (19/Jul/2026:15:48:35 +0000), Syslog (Jul 19 15:48:35), Epoch (10-digit)
    text = re.sub(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?', '', text)
    text = re.sub(r'\d{2}/[A-Z][a-z]{2}/\d{4}:\d{2}:\d{2}:\d{2} (\+|\-)\d{4}', '', text)
    text = re.sub(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b', '', text)
    text = re.sub(r'\b1[6-9]\d{8}\b', '', text)

    # 2. IPs (IPv4 & IPv6)
    text = re.sub(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', '<IP>', text)
    text = re.sub(r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b', '<IP6>', text)

    # 3. UUIDs / GUIDs
    text = re.sub(r'\b[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\b', '<UUID>', text)

    # 4. Memory Hex Addresses & Hashes (MD5/SHA256)
    text = re.sub(r'\b0x[0-9a-fA-F]+\b', '<HEX_ADDR>', text)
    text = re.sub(r'\b[0-9a-fA-F]{32,64}\b', '<HASH>', text)

    return text.strip()
```

### B. SQL-Level Date & Timestamp Parsing via DuckDB

Use `TRY_CAST()` or `TRY_STRPTIME()` in DuckDB to parse unstandardized log dates into native timestamps:

```bash
# Robust timestamp parsing in DuckDB SQL
duckdb -c "
SELECT 
    TRY_CAST(timestamp_str AS TIMESTAMP) AS ts_iso,
    TRY_STRPTIME(syslog_date, '%b %d %H:%M:%S') AS ts_syslog,
    message
FROM read_csv_auto('raw_system.log');
"
```

### C. Schema & Data Type Discovery via DuckDB CLI

Run schema discovery before performing heavy SQL queries or aggregations:

```bash
# Discover column names and infer data types automatically from a JSON file
duckdb -c "DESCRIBE SELECT * FROM read_json_auto('logs.jsonl');"

# Inspect CSV schema, auto-detecting delimiters, headers, and column types
duckdb -c "DESCRIBE SELECT * FROM read_csv_auto('access_logs.csv');"

# Sample top 5 records to inspect nested structs/JSON arrays
duckdb -c "SELECT * FROM read_json_auto('events.json') LIMIT 5;"
```

### D. Querying Nested JSON & M365 Unified Audit Logs (UAL)

DuckDB automatically parses nested JSON fields into structs and dot-notation fields:

```bash
# Search for errors in nested JSON fields
duckdb -c "
SELECT 
    timestamp,
    level,
    message,
    payload.user.id AS user_id,
    payload.request.endpoint AS endpoint
FROM read_json_auto('app_logs.jsonl')
WHERE level IN ('ERROR', 'FATAL')
  OR message LIKE '%exception%'
ORDER BY timestamp DESC
LIMIT 50;
"
```

M365 logs store events in a nested JSON structure where `AuditData` is often a stringified JSON payload. Use a CTE to parse `AuditData` once:

```bash
# Unpack stringified M365 AuditData payload in a CTE (parses JSON once per row instead of 5x)
duckdb -c "
WITH parsed AS (
    SELECT 
        CreationTime,
        Operation,
        Workload,
        parse_json(AuditData) AS audit
    FROM read_json_auto('m365_unified_audit_log.json')
)
SELECT 
    CreationTime,
    Operation,
    Workload,
    audit.UserId AS user_id,
    audit.ClientIP AS client_ip,
    audit.ObjectId AS accessed_object
FROM parsed
WHERE Operation IN ('FileDownloaded', 'MailItemsAccessed', 'Set-Mailbox', 'UserLoggedIn', 'Add member to role')
   OR audit.UserId = 'compromised_user@company.com'
ORDER BY CreationTime DESC;
"
```

---

## 3. Phase 3: Outlier & Anomaly Detection

### A. Statistical Outlier Detection (DuckDB SQL)

#### Z-Score Outlier Detection
Flags values that are more than 3 standard deviations away from the mean ($|Z| > 3.0$). Best for normally distributed metrics like payload size or response latency:

```bash
duckdb -c "
WITH stats AS (
    SELECT 
        *,
        (bytes_sent - AVG(bytes_sent) OVER()) / NULLIF(STDDEV_POP(bytes_sent) OVER(), 0) AS z_score
    FROM read_csv_auto('network_traffic.csv')
)
SELECT timestamp, client_ip, bytes_sent, z_score
FROM stats
WHERE ABS(z_score) > 3.0
ORDER BY z_score DESC;
"
```

#### Interquartile Range (IQR) Outlier Detection
Flags values outside $Q1 - 1.5 \times IQR$ or $Q3 + 1.5 \times IQR$. Best for skewed datasets (like request spikes or file download sizes):

```bash
duckdb -c "
WITH data AS (
    SELECT * FROM read_csv_auto('api_requests.csv')
),
percentiles AS (
    SELECT 
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY duration_ms) AS q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY duration_ms) AS q3
    FROM data
),
bounds AS (
    SELECT q1, q3, (q3 - q1) AS iqr, (q1 - 1.5 * (q3 - q1)) AS lower_bound, (q3 + 1.5 * (q3 - q1)) AS upper_bound
    FROM percentiles
)
SELECT r.*
FROM data r, bounds b
WHERE r.duration_ms < b.lower_bound OR r.duration_ms > b.upper_bound
ORDER BY r.duration_ms DESC;
"
```

### B. Multi-Variable Tabular Anomaly Detection (`IsolationForest`)

**Context**: Used when anomalies cannot be caught by single-variable rules alone (e.g. an unusual combination of `bytes_sent`, `duration_ms`, `http_method`, and `status_code`).

```python
import duckdb
import pandas as pd
from sklearn.ensemble import IsolationForest

# 1. Load numerical + categorical data via DuckDB
raw_df = duckdb.query("""
    SELECT bytes_sent, request_count, duration_ms, http_method, status_code
    FROM read_csv_auto('network_traffic.csv')
""").df()

# 2. Data Cleanup & One-Hot Encoding for categorical log fields
clean_df = raw_df.fillna(0)
feature_df = pd.get_dummies(clean_df, columns=['http_method', 'status_code'])

# 3. Train Isolation Forest model (contamination = expected anomaly ratio; tune via score_samples() distribution if needed)
model = IsolationForest(contamination=0.01, random_state=42)
# fit_predict returns binary labels (-1 = anomaly, 1 = normal)
clean_df['anomaly_label'] = model.fit_predict(feature_df)

# 4. Extract & display anomaly rows (-1 = outlier)
anomalies = clean_df[clean_df['anomaly_label'] == -1]
print(f"Detected {len(anomalies)} anomalies out of {len(clean_df)} records:")
print(anomalies.head(10))
```

### C. Fast Semantic Log Search via `sff.exe` (Rust CLI — Recommended Default)

**Context**: `sff.exe` (Semantic File Finder) uses Rust-native `model2vec-rs` for ultra-fast, zero-dependency CPU semantic search across log directories (`.log`, `.json`, `.txt`, `.csv`). It replaces heavy Python/PyTorch dependencies for most CLI search use cases and executes in milliseconds.

**Recommended Embedding Models for Log Analysis (`-m` / `--model`)**:
* **`minishlab/potion-code-16M-v2`** ⭐ *(Recommended for logs & code)*: Trained on technical text, code identifiers, and structured log payloads.
* **`minishlab/potion-retrieval-32M`** ⭐ *(Default)*: Ultra-fast 32M static model, excellent for natural language log queries.
* **`BAAI/bge-small-en-v1.5`**: High-accuracy 384-dim dense retrieval model for complex prose/event descriptions.
* **`nomic-ai/nomic-embed-text-v1.5`**: Best for long stack traces and multi-line context blocks.

```bash
# 1. Search logs recursively for semantic concepts using the potion-code model
sff -e log,json,txt -r -m minishlab/potion-code-16M-v2 "unauthorized privilege escalation or admin role changes"

# 2. Search for database timeouts and return top 20 results as JSON for DuckDB/jq parsing
sff -e log,json -l 20 --json "database connection pool exhausted or timeout"

# 3. Search raw application logs using the default 32M retrieval model
sff -e log -r "unhandled exception in authentication workflow"
```

### D. Semantic Log Clustering & Rare Event Detection (`fastembed` / Hugging Face)

**Context**: Used for programmatic Python pipelines when computing vector distance matrices (e.g. flagging top 2% rare, unseen log categories).

**Recommended Embedding Models**:
* **`snowflake/snowflake-arctic-embed-m-v1.5`** ⭐ *(Recommended for logs & enterprise code/JSON)*: Ultra-high precision on technical text (512-token context limit).
* **`nomic-ai/nomic-embed-text-v1.5`** ⭐ *(Best for long stack traces)*: Supports **8,192 token context window**.

```python
import numpy as np
from fastembed import TextEmbedding

# 1. Load logs handling UTF-8/UTF-16 encodings & clean text using standard helper (Phase 2)
raw_lines = read_log_file('server_app.log')
cleaned_lines = [clean_log_text(line) for line in raw_lines]

if not cleaned_lines:
    print("No valid log lines found.")
    exit(0)

# 2. Generate embeddings using Snowflake Arctic Embed (512 token limit; use nomic-embed-text-v1.5 for long stack traces)
# FastEmbed embed() yields vectors lazily; for huge datasets (>100k lines), iterate over batch chunks.
embedding_model = TextEmbedding(model_name="snowflake/snowflake-arctic-embed-m-v1.5")
embeddings = list(embedding_model.embed(cleaned_lines))

# 3. Compute distance from mean embedding vector to identify rare log anomalies
mean_vec = np.mean(embeddings, axis=0)
distances = [np.linalg.norm(vec - mean_vec) for vec in embeddings]
threshold = np.percentile(distances, 98) # Top 2% rarest logs

print("=== RARE LOG ANOMALIES DETECTED ===")
for orig, dist in zip(raw_lines, distances):
    if dist > threshold:
        print(f"[Anomaly Score: {dist:.2f}] {orig}")
```

---

## 4. Phase 4: Privacy, Exporting & AI Summarization

Before storing or sharing log exports, scan for exposed API keys, credentials, and PII.

### A. Fast Secret Scanning via `ripgrep` (`rg`)

Scans raw logs for AWS access keys, JWTs, RSA private keys, and Bearer tokens:

```bash
# Scan for AWS Access Keys (AKIA...)
rg "AKIA[0-9A-Z]{16}" ./logs/

# Scan for RSA/PEM Private Keys (including EC, DSA, ENCRYPTED)
rg -i "BEGIN (RSA|EC|DSA|OPENSSH|PRIVATE|ENCRYPTED PRIVATE) KEY" ./logs/

# Scan for Bearer tokens or JWTs (min length 20 to reduce false positives)
rg -i "Bearer [A-Za-z0-9\-\._~\+\/]{20,}" ./logs/
```

### B. AI PII & Secret Scanner (`openai/privacy-filter` Auditor / PII Grep Script)

**Context**: `openai/privacy-filter` is OpenAI's Apache 2.0 open-weight token classification model (128,000 token context window). 

> **Note**: `pii_grep` is a self-contained Python audit script defined below. You can run it directly or save it as `pii_grep.py` to scan log folders.

**Supported Span Categories**:
1. `SECRET` (API keys, credentials, tokens, passwords)
2. `PRIVATE_PERSON` (Names, usernames)
3. `PRIVATE_EMAIL` (Email addresses)
4. `PRIVATE_PHONE` (Phone numbers)
5. `PRIVATE_ADDRESS` (Physical addresses, locations)
6. `ACCOUNT_NUMBER` (Credit cards, bank accounts, SSNs)
7. `PRIVATE_URL` (Internal/private URLs)
8. `PRIVATE_DATE` (Birthdates, sensitive timestamps)

```python
# Install: uv pip install --python 3.13 --system --break-system-packages transformers torch rich
import csv
import json
from pathlib import Path
from transformers import pipeline
from rich.console import Console

console = Console()

# 1. Initialize OpenAI Privacy Filter model
privacy_filter = pipeline(task="token-classification", model="openai/privacy-filter")

PII_DESCRIPTIONS = {
    "SECRET": "API Key / Credential / Password",
    "PRIVATE_PERSON": "Personal Name / Username",
    "PRIVATE_EMAIL": "Email Address",
    "PRIVATE_PHONE": "Phone Number",
    "PRIVATE_ADDRESS": "Physical Address / Location",
    "ACCOUNT_NUMBER": "Credit Card / Bank Account / SSN",
    "PRIVATE_URL": "Internal / Sensitive Web URL",
    "PRIVATE_DATE": "Date of Birth / Sensitive Date"
}

def pii_grep(
    target_path_str: str, 
    min_confidence: float = 0.85, 
    batch_size: int = 64,
    output_csv: str = None, 
    output_jsonl: str = None,
    quiet: bool = False
):
    """Scan files/directories for PII & secrets with batched pipeline inference for high GPU/CPU throughput."""
    target_path = Path(target_path_str)
    files = list(target_path.rglob("*.*")) if target_path.is_dir() else [target_path]
    
    if not quiet:
        console.print(f"[bold yellow]=== SCANNING FOR PII & SECRETS IN: {target_path_str} ===[/bold yellow]\n")
    
    findings = []

    def process_batch(batch_lines, batch_nums, current_file):
        try:
            batch_results = privacy_filter(batch_lines, aggregation_strategy="simple")
            for line_num, line_str, entities in zip(batch_nums, batch_lines, batch_results):
                valid_entities = [e for e in entities if e['score'] >= min_confidence]
                for entity in valid_entities:
                    label = entity['entity_group'].upper()
                    score = entity['score']
                    word = entity['word'].strip()
                    desc = PII_DESCRIPTIONS.get(label, "Sensitive PII Data")
                    
                    record = {
                        "file": str(current_file),
                        "line_num": line_num,
                        "category": label,
                        "description": desc,
                        "confidence": round(score, 4),
                        "matched_value": word,
                        "line_content": line_str
                    }
                    findings.append(record)
                    
                    if not quiet:
                        console.print(
                            f"[bold cyan]{current_file}:{line_num}[/bold cyan] "
                            f"[[bold red]{label}[/bold red] ({desc}) - {score:.2%}] "
                            f"[yellow]Found: '{word}'[/yellow]\n"
                            f"  [dim]Line: {line_str}[/dim]\n"
                        )
        except Exception as e:
            if not quiet:
                console.print(f"[dim yellow]Skipping batch in {current_file}: {e}[/dim yellow]")

    for file_path in files:
        if file_path.is_dir() or file_path.suffix in ['.parquet', '.zip', '.gz', '.png', '.jpg']:
            continue
            
        try:
            lines = read_log_file(str(file_path))
            batch_lines, batch_nums = [], []
            for line_num, line_str in enumerate(lines, 1):
                batch_lines.append(line_str)
                batch_nums.append(line_num)
                
                if len(batch_lines) >= batch_size:
                    process_batch(batch_lines, batch_nums, file_path)
                    batch_lines, batch_nums = [], []
            
            if batch_lines:
                process_batch(batch_lines, batch_nums, file_path)
        except Exception as e:
            if not quiet:
                console.print(f"[dim yellow]Skipping {file_path}: {e}[/dim yellow]")
            continue

    # Export to CSV (ideal for Excel / spreadsheet auditing)
    if output_csv:
        csv_path = Path(output_csv)
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["file", "line_num", "category", "description", "confidence", "matched_value", "line_content"])
            writer.writeheader()
            writer.writerows(findings)
        console.print(f"[bold green]Saved {len(findings)} findings to CSV: {csv_path}[/bold green]")

    # Export to JSONL (ideal for DuckDB / jq analysis)
    if output_jsonl:
        jsonl_path = Path(output_jsonl)
        with open(jsonl_path, "w", encoding="utf-8") as f:
            for item in findings:
                f.write(json.dumps(item) + "\n")
        console.print(f"[bold green]Saved {len(findings)} findings to JSONL: {jsonl_path}[/bold green]")

    if not quiet:
        console.print(f"[bold green]Scan complete. Total findings: {len(findings)}[/bold green]")

# Run PII Grep scan on a file or directory and export to CSV
if __name__ == "__main__":
    pii_grep("./logs/", output_csv="pii_audit_results.csv", output_jsonl="pii_audit_results.jsonl")
```

### C. AI Log Threat Summarization Pipeline (Pi Agent `pi`)

Pipe DuckDB query outputs directly into Pi Agent (`pi`) for automated AI threat & anomaly analysis:

```bash
# Filter anomalous events via DuckDB and pipe directly to Pi Agent for analysis
duckdb -c "
SELECT CreationTime, Operation, parse_json(AuditData).UserId, parse_json(AuditData).ClientIP
FROM read_json_auto('m365_log.json')
WHERE Operation IN ('Set-Mailbox', 'Add member to role', 'MailItemsAccessed')
LIMIT 50;
" | pi "Analyze these M365 security log entries for suspicious account compromise or persistence activity."
```

### D. Exporting Query Results

```bash
# Export filtered log search results to CSV
duckdb -c "
COPY (
    SELECT * FROM read_json_auto('raw_logs.jsonl')
    WHERE level = 'ERROR'
) TO 'error_summary.csv' (HEADER, DELIMITER ',');
"

# Export to compressed Parquet for high-speed analysis
duckdb -c "
COPY (
    SELECT * FROM read_csv_auto('large_dataset.csv')
) TO 'dataset.parquet' (FORMAT PARQUET);
"
```

---

## Workflow Checklist for Pi Agent

1. **Detect File Type**: Check extension (`.json`, `.jsonl`, `.csv`, `.parquet`).
2. **Pre-Filter String Search**: Use `rg` for instant pattern/IP searching on raw un-parsed log dumps.
3. **Format Conversion & Preprocessing**: Use `mlr` if converting JSONL $\leftrightarrow$ CSV; use `read_log_file()` / `clean_log_text()` to handle encodings (UTF-8/UTF-16) and mask timestamps/IPs/UUIDs.
4. **Quick CLI Probe**: Use `jq` for instant one-line inspection of small JSON files.
5. **Run Schema Inspection**: Execute `duckdb -c "DESCRIBE SELECT * FROM read_..."` to map field names.
6. **Outlier & Anomaly Detection**: Execute Z-Score / IQR SQL queries in DuckDB or run `IsolationForest` / `fastembed` ML for multi-variable/text anomalies.
7. **AI Summarization Pipeline**: Pipe filtered anomalies into `pi` for automated analysis.
8. **Scan for Secrets & PII**: Run `rg` secret patterns or `openai/privacy-filter` prior to sharing/exporting log exports.
9. **Present Clean Summary**: Format query outputs cleanly for the user.

---

## Appendix: Setup & Installation

```bash
# CLI Tools
winget install DuckDB.cli BurntSushi.ripgrep.MSVC johnkerl.miller jqlang.jq sff

# Python Libraries (for ML tabular & PII scripts)
uv pip install duckdb pandas scikit-learn fastembed transformers torch rich
```
