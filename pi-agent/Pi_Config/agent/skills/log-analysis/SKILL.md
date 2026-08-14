---
name: log-analysis
description: Explore, inspect, schema-discover, search, detect outliers, scan for PII/secrets, run hybrid semantic searches (ck), view interactive timelines (lnav), and run ML/AI analysis (Isolation Forest, fastembed, openai/privacy-filter) on log files and datasets (JSON/JSONL, CSV, Parquet) using DuckDB CLI, jq, ripgrep, Miller, lnav, ck, and Pi Agent.
---

# Log & Data Analysis Exploration

This skill provides a systematic routine for exploring, schema-discovering, searching, detecting statistical & ML outliers, and scanning for PII/secrets in unknown or unusual datasets (such as application logs, M365 audit logs, event streams, large CSVs, or nested JSON/JSONL dumps) using **DuckDB CLI**, **jq**, **ripgrep (`rg`)**, **Miller (`mlr`)**, **Log File Navigator (`lnav`)**, **`ck` (`ck-search`)**, **scikit-learn**, **OpenAI Privacy Filter**, and **Pi Agent (`pi`)**.

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
| **Raw Text & Stack Traces** | `ripgrep` | `rg -i -U -C 5 "exception|failed|unauthorized" ./logs/` |
| **Interactive TUI & Merged Timeline** | `lnav` | `lnav ./logs/` (auto-detects formats, merges timestamps, runs SQL) |
| **Time-Window Slicing** | `DuckDB SQL` | `duckdb -c "SELECT * FROM 'logs.jsonl' WHERE TRY_CAST(ts AS TIMESTAMP) BETWEEN '2026-08-14 02:00:00' AND '2026-08-14 04:00:00';"` |
| **Format Conversion (JSONL $\rightarrow$ CSV)** | `Miller` | `mlr --ijsonl --ocsv cat app_logs.jsonl > output.csv` |
| **Quick JSON Key Inspection** | `jq` | `jq -c '{time: .timestamp, msg: .message}' logs.jsonl \| head -n 10` |
| **Schema Discovery & JSON Keys** | `DuckDB CLI` | `duckdb -c "SELECT json_structure(AuditData) FROM 'm365.json' LIMIT 1;"` |
| **M365 Nested JSON (Arrow Syntax)** | `DuckDB SQL` | `duckdb -c "SELECT CreationTime, AuditData->>'UserId' AS user, AuditData->>'ClientIP' AS ip FROM 'm365.json';"` |
| **Statistical Outliers (Z-Score)** | `DuckDB SQL` | `duckdb -c "SELECT *, (val - AVG(val) OVER()) / NULLIF(STDDEV_POP(val) OVER(), 0) AS z FROM 'data.csv' WHERE ABS(z) > 3.0;"` |
| **Multi-Variable ML Anomalies** | `scikit-learn` | `clean_df['anomaly_label'] = IsolationForest(contamination=0.01).fit_predict(feature_df)` |
| **Hybrid & Semantic Search (CLI)** | `ck` | `ck --hybrid "unauthorized privilege escalation"` |
| **Semantic Log Clustering** | `fastembed` | `TextEmbedding('snowflake/snowflake-arctic-embed-m-v1.5').embed(cleaned_lines)` |
| **PII & Secret Audit Scan** | Python (`privacy-filter`) | Python Script (Phase 4B): `pii_grep("./logs/", batch_size=64, output_csv="pii_audit.csv")` |
| **AI Threat Summarization** | `DuckDB` + `pi` | `duckdb -c "SELECT ... FROM 'm365.json'" \| pi "Analyze suspicious security events"` |
| **Export Query to Parquet** | `DuckDB` | `duckdb -c "COPY (SELECT * FROM 'data.csv') TO 'out.parquet' (FORMAT PARQUET);"` |

---

## 1. Phase 1: Fast Raw Triaging & Stream Processing

### 🧭 Tool Selection Matrix (Pick the Right Tool for the Job)

* **Interactive Multi-Log Inspection & Merged Timeline?** $\rightarrow$ Use **`lnav`** (auto-detects log formats, interlaces timestamps, live SQL).
* **Exact String / Known Pattern Match?** $\rightarrow$ Use **`ripgrep` (`rg`)** (instant regex, use `-u` if logs are in `.gitignore`).
* **Natural Language / Concept Search (*"find database connection failures"*)?** $\rightarrow$ Use **`ck`** (hybrid BM25 + vector search).
* **Structured SQL, Nested JSON Structs, M365 Logs, or Statistical Outliers?** $\rightarrow$ Use **`DuckDB CLI`** (parallel SQL, arrow notation `->>`).
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

### D. Interactive Multi-File Log Navigation (`lnav`)

`lnav` (The Logfile Navigator) is the recommended terminal UI for visually navigating and merging multi-file logs:

```bash
# 1. Open an entire log folder (automatically merges multiple log files into a single chronological timeline)
lnav ./logs/

# 2. Open specific compressed or raw logs
lnav /var/log/syslog /var/log/nginx/access.log.gz

# 3. Interactive features inside lnav:
# - Press 'e' / 'w' to jump between Errors and Warnings
# - Press 'u' / 'U' to jump between user sessions
# - Type ';SELECT log_time, log_level, log_body FROM all_logs WHERE log_level = 'error'' to run embedded SQLite queries
# - Type ':filter-in timeout' to dynamically filter the live view
```

---

## 2. Phase 2: Encoding, Preprocessing & Schema Discovery

### A. Universal Multi-Encoding Python Streamer & Text Sanitizer

Memory-safe generator supporting UTF-8, UTF-16 (Windows Event Logs / IIS), and Latin-1 automatically, while masking volatile dynamic tokens (ISO 8601, Apache/Nginx, Syslog timestamps, 10/13-digit Epochs, Bearer tokens, IPs, UUIDs, Hex addresses, Hashes):

```python
import re
import gzip
from pathlib import Path
from typing import Generator

def stream_log_lines(filepath: str, max_lines: int = None) -> Generator[str, None, None]:
    """
    Memory-safe streaming log reader with BOM sniffing and strict-fallback decoding.
    Handles UTF-8, UTF-8-BOM, UTF-16LE, UTF-16BE, Latin-1, and compressed .gz files.
    """
    path = Path(filepath)
    is_gz = path.suffix.lower() == '.gz'

    # 1. Sniff BOM bytes to avoid decoding trial loops
    encoding = None
    try:
        if is_gz:
            with gzip.open(path, 'rb') as bf:
                head = bf.read(4)
        else:
            with open(path, 'rb') as bf:
                head = bf.read(4)
                
        if head.startswith(b'\xef\xbb\xbf'):
            encoding = 'utf-8-sig'
        elif head.startswith(b'\xff\xfe'):
            encoding = 'utf-16-le'
        elif head.startswith(b'\xfe\xff'):
            encoding = 'utf-16-be'
    except Exception:
        pass

    # 2. Fallback hierarchy: explicit BOM -> utf-8 -> utf-16 -> latin-1
    encodings_to_try = [encoding] if encoding else ['utf-8', 'utf-16', 'latin-1']
    
    for enc in encodings_to_try:
        try:
            # Verify sample on strict decoding
            if is_gz:
                with gzip.open(path, 'rt', encoding=enc, errors='replace') as f:
                    for count, line in enumerate(f, 1):
                        if max_lines and count > max_lines:
                            break
                        clean = line.replace('\x00', '').strip()
                        if clean:
                            yield clean
            else:
                with open(path, 'r', encoding=enc, errors='replace') as f:
                    for count, line in enumerate(f, 1):
                        if max_lines and count > max_lines:
                            break
                        clean = line.replace('\x00', '').strip()
                        if clean:
                            yield clean
            return
        except (UnicodeDecodeError, UnicodeError):
            continue

def read_log_file(filepath: str, max_lines: int = 10000) -> list[str]:
    """Read log file into memory with a safe maximum line limit (default: 10,000 lines)."""
    return list(stream_log_lines(filepath, max_lines=max_lines))

def clean_log_text(text: str) -> str:
    """Normalize log text by replacing timestamps, auth tokens, IPs, UUIDs, hex addresses, and hashes with placeholders."""
    # 1. ISO 8601 & RFC 3339 timestamps (handles Z, +00:00, subseconds)
    text = re.sub(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?', '<TS>', text)
    # 2. Apache/Nginx (19/Jul/2026:15:48:35 +0000) & Syslog (Jul 19 15:48:35)
    text = re.sub(r'\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4}', '<TS>', text)
    text = re.sub(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?\b', '<TS>', text)
    # 3. Unix Epochs: 10-digit seconds / 13-digit milliseconds
    text = re.sub(r'\b1[6-9]\d{8}(?:\d{3})?\b', '<EPOCH>', text)
    # 4. Bearer & JWT tokens
    text = re.sub(r'Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*', 'Bearer <TOKEN>', text, flags=re.IGNORECASE)
    text = re.sub(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b', '<JWT>', text)
    # 5. IPv4 & IPv6 (compressed and uncompressed)
    text = re.sub(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', '<IP4>', text)
    text = re.sub(r'(?:[0-9a-fA-F]{1,4}:){1,7}:?|::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}', '<IP6>', text)
    # 6. UUIDs / GUIDs
    text = re.sub(r'\b[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\b', '<UUID>', text)
    # 7. Memory Hex Addresses & Hashes (MD5/SHA256)
    text = re.sub(r'\b0x[0-9a-fA-F]+\b', '<HEX_ADDR>', text)
    text = re.sub(r'\b[0-9a-fA-F]{32,64}\b', '<HASH>', text)
    return text.strip()
```

### B. SQL-Level Date, Timestamp Parsing & Time-Window Slicing (DuckDB)

Use `TRY_CAST()` or `TRY_STRPTIME()` in DuckDB to parse unstandardized log dates, slice exact time windows, and aggregate error histograms:

```bash
# 1. Parse unstandardized timestamps & time-bucket error rates (5-min intervals)
duckdb -c "
SELECT 
    time_bucket(INTERVAL '5 minutes', TRY_CAST(timestamp AS TIMESTAMP)) AS window_start,
    COUNT(*) AS total_errors,
    COUNT(DISTINCT client_ip) AS affected_ips
FROM read_csv_auto('logs/*.csv')
WHERE status_code >= 500
GROUP BY 1
ORDER BY 1 ASC;
"

# 2. Time-Window Slicing across Compressed Multi-File Archives (.gz / .zstd)
duckdb -c "
SELECT filename, timestamp, level, message
FROM read_json_auto('logs/**/*.jsonl.gz', union_by_name=true, filename=true, ignore_errors=true)
WHERE TRY_CAST(timestamp AS TIMESTAMP) BETWEEN '2026-08-14 02:00:00' AND '2026-08-14 04:30:00'
  AND level IN ('ERROR', 'FATAL')
ORDER BY timestamp ASC;
"
```

### C. Schema & Deep JSON Structure Discovery (`DuckDB CLI`)

Run schema discovery to inspect deeply nested structs and dynamic JSON payloads without guesswork:

```bash
# Discover column names and inferred data types from JSON/CSV files
duckdb -c "DESCRIBE SELECT * FROM read_json_auto('logs.jsonl');"
duckdb -c "DESCRIBE SELECT * FROM read_csv_auto('access_logs.csv');"

# Inspect exact nested schema tree of dynamic JSON payload strings (e.g. M365 AuditData)
duckdb -c "SELECT json_structure(AuditData) FROM 'm365_unified_audit_log.json' LIMIT 1;"

# List all distinct top-level JSON keys inside a stringified payload column
duckdb -c "SELECT DISTINCT json_keys(AuditData) FROM 'm365_unified_audit_log.json' LIMIT 5;"
```

### D. Querying Nested JSON, M365 UAL, & Windows Security Events via Arrow Operators

DuckDB supports native JSON extraction with `->>` (extract string) and `->` (extract JSON struct):

```bash
# 1. M365 Unified Audit Log (UAL) Triage
duckdb -c "
SELECT 
    CreationTime,
    Operation,
    Workload,
    AuditData->>'UserId' AS user_id,
    AuditData->>'ClientIP' AS client_ip,
    AuditData->>'ObjectId' AS accessed_object,
    list_filter(
        CAST(AuditData->'ExtendedProperties' AS JSON[]), 
        x -> x->>'Name' = 'ClientInfoString'
    )[1]->>'Value' AS client_info
FROM read_json_auto('m365_unified_audit_log.json')
WHERE Operation IN ('FileDownloaded', 'MailItemsAccessed', 'Set-Mailbox', 'UserLoggedIn', 'Add member to role')
   OR AuditData->>'UserId' = 'compromised_user@company.com'
ORDER BY CreationTime DESC;
"

# 2. Windows Security Event Log Triage (Event IDs: 4625 = Failed Logon, 4624 = Logon, 4688 = Process Spawn)
duckdb -c "
SELECT 
    EventData->>'TargetUserName' AS username,
    EventData->>'IpAddress' AS source_ip,
    COUNT(*) AS failure_count,
    MIN(TimeCreated) AS first_attempt,
    MAX(TimeCreated) AS last_attempt
FROM read_json_auto('win_security_events.jsonl')
WHERE EventID = 4625
GROUP BY 1, 2
HAVING failure_count > 5
ORDER BY failure_count DESC;
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

### C. Fast Hybrid & Semantic Log Search via `ck` (CLI — Recommended Default)

**Context**: `ck` (`ck-search`) provides local-first hybrid search fusing **BM25 keyword search** (for exact error codes, UUIDs, IP addresses) and **dense vector embeddings** (for conceptual, natural language queries) using Reciprocal Rank Fusion (RRF).

**Cache & Index Directories**:
* **Project / Log Directory Index**: By default, `ck` creates an index and cache inside a **`.ck/`** folder at the root of the searched directory (contains index databases, embeddings, and vector files).
* **Global Index Relocation (`CK_INDEX_DIR`)**: Set the `CK_INDEX_DIR` environment variable (e.g. `export CK_INDEX_DIR=~/.cache/ck/indexes` or `$env:CK_INDEX_DIR="$env:LOCALAPPDATA\ck\indexes"`) to keep log folders clean and store indexes under `$CK_INDEX_DIR/<basename>-<hash>`.
* **Model Cache Directories**:
  * **Windows**: `%LOCALAPPDATA%\ck\cache\models\`
  * **Linux / macOS**: `~/.cache/ck/models/`
  * **Fallback**: `.ck_models/models/` in the current working directory.
* **Clearing Cache**: Simply delete the local `.ck/` directory or purge the global cache folder (`rm -rf .ck` or `rm -rf ~/.cache/ck`).

```bash
# 1. Semantic search for conceptual meaning (dense neural vector embeddings)
ck --sem "unauthorized privilege escalation or admin role changes"

# 2. Hybrid search combining BM25 exact keywords with semantic embeddings
ck --hybrid "database connection pool exhausted or timeout"

# 3. Hybrid search on a specific log directory returning JSON
ck --hybrid --json -p ./logs/ "unhandled exception in auth"
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
            batch_lines, batch_nums = [], []
            for line_num, line_str in enumerate(stream_log_lines(str(file_path)), 1):
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
winget install DuckDB.cli BurntSushi.ripgrep.MSVC Miller.Miller jqlang.jq tstack.lnav

# Hybrid & Semantic Search CLI (ck)
npm install -g @beaconbay/ck-search

# Optional: Persist central index directory (keeps workspaces clean from .ck/ folders)
# Windows (PowerShell): [Environment]::SetEnvironmentVariable("CK_INDEX_DIR", "$env:LOCALAPPDATA\ck\indexes", "User")
# Linux / macOS (Bash/Zsh): export CK_INDEX_DIR="$HOME/.cache/ck/indexes"

# Python Libraries (for ML tabular & PII scripts)
uv pip install duckdb pandas scikit-learn fastembed transformers torch rich
```
