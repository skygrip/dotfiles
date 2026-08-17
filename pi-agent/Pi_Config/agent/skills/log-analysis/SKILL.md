---
name: log-analysis
description: Triage, search, and detect anomalies in large log files (JSONL, CSV, Parquet). Use 'rg -i -C 5 "error"' for stack traces, DuckDB for time-window SQL ('duckdb -c "SELECT ..."'), and 'mlr' for streaming records.
---

# Log & Data Analysis Exploration

This skill provides a systematic routine for exploring, schema-discovering, searching, and detecting anomalies in datasets (such as application logs, M365 audit logs, event streams, large CSVs, or nested JSON/JSONL dumps) using **ripgrep (`rg`)**, **DuckDB CLI**, **Miller (`mlr`)**, **jq**, and **`ck` (`ck-search`)**.

> [!WARNING]
> **Headless / Non-Interactive Execution:**
> `lnav` is an interactive curses TUI application that will hang autonomous agent subshells if launched without arguments. The agent must use **`rg`**, **`duckdb -c`**, or **`mlr`** for automated batch queries. Recommend `lnav ./logs/` directly to the human user for visual timeline navigation.

> [!TIP]
> - For scanning repositories, logs, or configs for leaked credentials, API keys, or access tokens, use the **`secret-scanning`** skill (`trufflehog`).
> - For auditing logs or datasets for personal data exposures (names, emails, SSNs, credit cards), use the **`pii-detection`** skill (`openai/privacy-filter`).

---

## 🎯 Target Use Cases & Solved Problems

* **⚡ Multi-Gigabyte File Reconnaissance**: Instantly scan 500MB+ raw logs for error codes, IP addresses, or stack traces without memory lag using `rg`.
* **🛡️ Security & M365 Audit Log Analysis**: Unpack stringified `AuditData` payloads and flag suspicious logins, file downloads, or privilege escalations with DuckDB SQL.
* **🤖 Semantic Anomaly & Rare Event Detection**: Group unstructured error logs into semantic clusters to discover rare, unseen system bugs.

---

## Quick Reference Cheatsheet

| Task / Goal | Recommended Tool | One-Liner / Quick Syntax |
| :--- | :--- | :--- |
| **Raw Text & Stack Traces** | `ripgrep` | `rg -i -U -C 5 "exception|failed|unauthorized" ./logs/` |
| **Time-Window Slicing** | `DuckDB SQL` | `duckdb -c "SELECT * FROM 'logs.jsonl' WHERE TRY_CAST(ts AS TIMESTAMP) BETWEEN '2026-08-14 02:00:00' AND '2026-08-14 04:00:00';"` |
| **Format Conversion (JSONL $\rightarrow$ CSV)** | `Miller` | `mlr --ijsonl --ocsv cat app_logs.jsonl > output.csv` |
| **Quick JSON Key Inspection** | `jq` | `jq -c '{time: .timestamp, msg: .message}' logs.jsonl \| head -n 10` |
| **Schema Discovery & JSON Keys** | `DuckDB CLI` | `duckdb -c "SELECT json_structure(AuditData) FROM 'm365.json' LIMIT 1;"` |
| **Interactive TUI (Human User)** | `lnav` | Run `lnav ./logs/` (Interactive TUI with merged timestamps) |
| **M365 Nested JSON (Arrow Syntax)** | `DuckDB SQL` | `duckdb -c "SELECT CreationTime, AuditData->>'UserId' AS user, AuditData->>'ClientIP' AS ip FROM 'm365.json';"` |
| **Statistical Outliers (Z-Score)** | `DuckDB SQL` | `duckdb -c "SELECT *, (val - AVG(val) OVER()) / NULLIF(STDDEV_POP(val) OVER(), 0) AS z FROM 'data.csv' WHERE ABS(z) > 3.0;"` |
| **Multi-Variable ML Anomalies** | `scikit-learn` | `clean_df['anomaly_label'] = IsolationForest(contamination=0.01).fit_predict(feature_df)` |
| **Hybrid & Semantic Search (CLI)** | `ck` | `ck --hybrid "unauthorized privilege escalation"` |
| **Semantic Log Clustering** | `fastembed` | `TextEmbedding('snowflake/snowflake-arctic-embed-m-v1.5').embed(cleaned_lines)` |
| **AI Threat Summarization** | `DuckDB` + `pi` | `duckdb -c "SELECT ... FROM 'm365.json'" \| pi -p "Analyze suspicious security events"` |
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
* **Credential & Secret Key Scanning?** $\rightarrow$ Use the **`secret-scanning`** skill (`trufflehog`).
* **Personal Identity & PII Exposure Audit?** $\rightarrow$ Use the **`pii-detection`** skill (`openai/privacy-filter`).

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

### A. Handling Encodings & Compressed Logs via CLI

Modern CLI tools handle compressed archives and mixed encodings without writing Python scripts:

```bash
# 1. Ripgrep compressed logs (.gz) and UTF-16 logs directly (-z flag)
rg -z -i "exception|fatal" ./logs/archive.log.gz

# 2. Convert UTF-16 (Windows Event Logs / IIS) to clean UTF-8 on the fly
# PowerShell:
Get-Content -Encoding Unicode u_ex240817.log | Set-Content -Encoding UTF8 utf8_access.log
# Linux / Bash:
iconv -f UTF-16LE -t UTF-8 raw_win.log -o utf8_win.log

# 3. DuckDB direct querying of compressed archives (.gz / .zstd)
duckdb -c "
SELECT * FROM read_json_auto('logs/**/*.jsonl.gz', union_by_name=true, ignore_errors=true)
LIMIT 10;
"
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

Run schema discovery to inspect deeply nested structs, dynamic JSON payloads, and Parquet metadata without guesswork:

```bash
# 1. Zero-Read Parquet Metadata & Schema (Instant introspection without reading data rows)
duckdb -c "SELECT * FROM parquet_schema('telemetry.parquet');"
duckdb -c "SELECT file_name, row_group_id, num_rows, total_byte_size FROM parquet_metadata('telemetry.parquet');"
duckdb -c "SELECT path_in_schema, stats_min, stats_max, stats_null_count FROM parquet_metadata('telemetry.parquet');"

# 2. Discover column names and inferred data types from JSON/CSV files
duckdb -c "DESCRIBE SELECT * FROM read_json_auto('logs.jsonl');"
duckdb -c "DESCRIBE SELECT * FROM read_csv_auto('access_logs.csv');"

# 3. Inspect exact nested schema tree of dynamic JSON payload strings (e.g. M365 AuditData)
duckdb -c "SELECT json_structure(AuditData) FROM 'm365_unified_audit_log.json' LIMIT 1;"

# 4. List all distinct top-level JSON keys inside a stringified payload column
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

### D. Semantic Log Clustering & Rare Event Detection (`fastembed`)

For computing vector distance matrices on unstructured error text to flag the top 2% rare, unseen system bugs:

```python
import numpy as np
from fastembed import TextEmbedding

# 1. Load log lines and generate embeddings (Snowflake Arctic Embed or Nomic v1.5)
lines = [line.strip() for line in open('server_app.log', 'r', encoding='utf-8', errors='replace') if line.strip()][:5000]
model = TextEmbedding(model_name="snowflake/snowflake-arctic-embed-m-v1.5")
embeddings = list(model.embed(lines))

# 2. Compute distance from mean embedding vector to flag rare anomalies (> 98th percentile)
mean_vec = np.mean(embeddings, axis=0)
distances = [np.linalg.norm(vec - mean_vec) for vec in embeddings]
threshold = np.percentile(distances, 98)

print("=== RARE LOG ANOMALIES DETECTED ===")
for line, dist in zip(lines, distances):
    if dist > threshold:
        print(f"[{dist:.2f}] {line}")
```

---

## 4. Phase 4: Exporting & AI Summarization Pipeline

### A. AI Log Threat Summarization Pipeline (Pi Agent `pi`)

Pipe DuckDB query outputs directly into Pi Agent (`pi`) for automated AI threat & anomaly analysis:

```bash
# Filter anomalous events via DuckDB and pipe directly to Pi Agent for non-interactive analysis (-p)
duckdb -c "
SELECT CreationTime, Operation, parse_json(AuditData).UserId, parse_json(AuditData).ClientIP
FROM read_json_auto('m365_log.json')
WHERE Operation IN ('Set-Mailbox', 'Add member to role', 'MailItemsAccessed')
LIMIT 50;
" | pi -p "Analyze these M365 security log entries for suspicious account compromise or persistence activity."
```

### B. Exporting Query Results

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

1. **Detect File Type**: Check extension (`.json`, `.jsonl`, `.csv`, `.parquet`, `.gz`).
2. **Pre-Filter String Search**: Use `rg` (or `rg -z` for compressed) for instant pattern/IP searching on raw un-parsed log dumps.
3. **Format Conversion & Slicing**: Use `mlr` if converting JSONL $\leftrightarrow$ CSV or reordering fields.
4. **Quick CLI Probe**: Use `jq` for instant one-line inspection of small JSON files.
5. **Run Schema Inspection**: Execute `duckdb -c "DESCRIBE SELECT * FROM read_..."` or `parquet_schema(...)`.
6. **Outlier & Anomaly Detection**: Execute Z-Score / IQR SQL queries in DuckDB, search conceptually with `ck`, or run `IsolationForest` ML for multi-variable anomalies.
7. **AI Threat Summarization**: Pipe filtered anomalies into `pi -p` for automated threat analysis.
8. **Pre-Sharing Security Audit**: Run `secret-scanning` (`trufflehog`) or `pii-detection` prior to sharing exports.
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

# Python Libraries (for ML tabular anomaly detection)
uv pip install duckdb pandas scikit-learn fastembed
```
