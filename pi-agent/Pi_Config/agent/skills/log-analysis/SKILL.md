---
name: log-analysis
description: Triage, search, and detect anomalies in large logs (JSONL, CSV, CloudTrail, M365). Use rg for regex, DuckDB for time-series SQL, and mlr for streaming tabular records.
---

# Log & Data Analysis Exploration

A systematic routine for exploring, schema-discovering, searching, and detecting anomalies in datasets (such as application logs, M365 audit logs, event streams, large CSVs, or nested JSON/JSONL dumps) using **ripgrep (`rg`)**, **DuckDB CLI**, **Miller (`mlr`)**, **jq**, **`ck` (`ck-search`)**, and machine-learning anomaly detectors.

> [!TIP]
> - For scanning repositories, logs, or configs for leaked credentials, API keys, or access tokens, use the **`secret-scanning`** skill (`trufflehog`).
> - For auditing logs or datasets for personal data exposures (names, emails, SSNs, credit cards), use the **`pii-detection`** skill (`openai/privacy-filter`).

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`ripgrep` (`rg`)** | Multi-threaded raw text, stack trace, and regex searching across large and compressed (`-z`) logs |
| **`duckdb`** | In-process vectorized SQL OLAP engine for zero-ingestion querying of JSONL, Parquet, and CSV logs |
| **`Miller` (`mlr`)** | Stream reshaping, column filtering, and format conversion (`JSONL` $\leftrightarrow$ `CSV`) |
| **`jq`** | Lightweight one-line JSON field inspection and key probing |
| **`ck` (`ck-search`)** | Local hybrid lexical (BM25) and semantic vector search over log directories |
| **`scikit-learn`** (`IsolationForest`) | Multi-variable numerical and categorical tabular anomaly detection in Python |
| **`fastembed`** | Local lightweight embedding model for vector distance clustering and rare log anomaly detection |
| **`lnav`** | Interactive curses log navigator (recommended for human interactive use only) |

---

## 2. Negative Guardrails (Agent Execution Safety)

| Hallucination / Mistake | Why It Fails | Correct Syntax / Protocol |
| :--- | :--- | :--- |
| `lnav ./logs/` in automated subshell | `lnav` is an interactive curses TUI; blocks headless subshells indefinitely | Use `rg`, `duckdb -bail -c "..."`, or `mlr` for batch queries; recommend `lnav` to human user |
| `cat massive.log` or `Get-Content 1GB.log` | Floods agent context and exhausts terminal buffer | Always bound output: `rg -C 5`, `head -n 25`, or DuckDB `LIMIT 25` |
| `FROM "logs.jsonl"` in DuckDB | Double quotes denote column/table identifiers | Use single quotes for paths: `FROM 'logs.jsonl'` |
| `parse_json(AuditData).UserId` in DuckDB | Outdated and verbose syntax | Use native arrow notation: `AuditData->>'UserId'` |
| `duckdb -c "..."` without `-bail` | Script does not fail fast on SQL syntax errors | Always include `-bail` with `-c` |

---

## 3. Target Use Cases & Solved Problems

* **⚡ Multi-Gigabyte File Reconnaissance**: Instantly scan 500MB+ raw logs for error codes, IP addresses, or stack traces without memory lag using `rg`.
* **🛡️ Security & M365 Audit Log Analysis**: Unpack stringified `AuditData` payloads and flag suspicious logins, file downloads, or privilege escalations with DuckDB SQL.
* **🤖 Semantic Anomaly & Rare Event Detection**: Group unstructured error logs into semantic clusters to discover rare, unseen system bugs.

---

## 4. Quick Reference Cheatsheet

| Task / Goal | Recommended Tool | One-Liner / Quick Syntax |
| :--- | :--- | :--- |
| **Raw Text & Stack Traces** | `ripgrep` | `rg -i -U -C 5 "exception|failed|unauthorized" ./logs/` |
| **Time-Window Slicing** | `DuckDB SQL` | `duckdb -json -bail -c "SELECT * FROM 'logs.jsonl' WHERE TRY_CAST(ts AS TIMESTAMP) BETWEEN '2026-08-14 02:00:00' AND '2026-08-14 04:00:00' LIMIT 25;"` |
| **Format Conversion (JSONL $\rightarrow$ CSV)** | `Miller` | `mlr --ijsonl --ocsv cat app_logs.jsonl > output.csv` |
| **Quick JSON Key Inspection** | `jq` | `jq -c '{time: .timestamp, msg: .message}' logs.jsonl \| head -n 10` |
| **Schema Discovery & JSON Keys** | `DuckDB CLI` | `duckdb -c "SELECT json_structure(AuditData) FROM 'm365.json' LIMIT 1;"` |
| **Interactive TUI (Human User)** | `lnav` | Run `lnav ./logs/` (Interactive TUI with merged timestamps) |
| **M365 Nested JSON (Arrow Syntax)** | `DuckDB SQL` | `duckdb -json -c "SELECT CreationTime, AuditData->>'UserId' AS user, AuditData->>'ClientIP' AS ip FROM 'm365.json' LIMIT 25;"` |
| **Statistical Outliers (Z-Score)** | `DuckDB SQL` | `duckdb -c "SELECT *, (val - AVG(val) OVER()) / NULLIF(STDDEV_POP(val) OVER(), 0) AS z FROM 'data.csv' WHERE ABS(z) > 3.0 LIMIT 25;"` |
| **Multi-Variable ML Anomalies** | `scikit-learn` | `clean_df['anomaly_label'] = IsolationForest(contamination=0.01).fit_predict(feature_df)` |
| **Hybrid & Semantic Search (CLI)** | `ck` | `ck --hybrid "unauthorized privilege escalation"` |
| **Semantic Log Clustering** | `fastembed` | `TextEmbedding('snowflake/snowflake-arctic-embed-m-v1.5').embed(cleaned_lines)` |
| **AI Threat Summarization** | `DuckDB` + `pi` | `duckdb -c "SELECT ... FROM 'm365.json'" \| pi -p "Analyze suspicious security events"` |
| **Export Query to Parquet** | `DuckDB` | `duckdb -c "COPY (SELECT * FROM 'data.csv') TO 'out.parquet' (FORMAT PARQUET);"` |

---

## 5. Phase 1: Fast Raw Triaging & Stream Processing

### 🧭 Tool Selection Matrix

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

### D. Interactive Multi-File Log Navigation (`lnav` — User Facing Only)

`lnav` (The Logfile Navigator) is the recommended terminal UI for human analysts to visually navigate merged logs:

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

## 6. Phase 2: Encoding, Preprocessing & Schema Discovery

### A. Handling Encodings & Compressed Logs via CLI

Modern CLI tools handle compressed archives and mixed encodings without custom Python scripts:

```bash
# 1. Ripgrep compressed logs (.gz) and UTF-16 logs directly (-z flag)
rg -z -i "exception|fatal" ./logs/archive.log.gz

# 2. Convert UTF-16 (Windows Event Logs / IIS) to clean UTF-8 on the fly
# PowerShell:
Get-Content -Encoding Unicode u_ex240817.log | Set-Content -Encoding UTF8 utf8_access.log
# Linux / Bash:
iconv -f UTF-16LE -t UTF-8 raw_win.log -o utf8_win.log

# 3. DuckDB direct querying of compressed archives (.gz / .zstd)
duckdb -json -bail -c "
SELECT * FROM read_json('logs/**/*.jsonl.gz', union_by_name=true, ignore_errors=true)
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
FROM read_csv('logs/*.csv', header=true, union_by_name=true)
WHERE status_code >= 500
GROUP BY 1
ORDER BY 1 ASC;
"

# 2. Time-Window Slicing across Compressed Multi-File Archives (.gz / .zstd)
duckdb -c "
SELECT filename, timestamp, level, message
FROM read_json('logs/**/*.jsonl.gz', union_by_name=true, filename=true, ignore_errors=true)
WHERE TRY_CAST(timestamp AS TIMESTAMP) BETWEEN '2026-08-14 02:00:00' AND '2026-08-14 04:30:00'
  AND level IN ('ERROR', 'FATAL')
ORDER BY timestamp ASC;
"

# 3. Timestamp Normalization & Multi-Source Timeline Merging
# Correlate disparate log formats (Apache, Syslog, ISO-8601) into a single chronological timeline:
duckdb -json -bail -c "
SELECT 'APACHE' AS src, strptime(raw_time, '[%d/%b/%Y:%H:%M:%S %z]') AS utc_time, client_ip, request 
FROM read_csv('apache.log', delim=' ', names=['client_ip', 'ident', 'auth', 'raw_time', 'tz', 'request', 'status', 'bytes'], header=false)
UNION ALL
SELECT 'M365' AS src, CAST(CreationTime AS TIMESTAMP) AS utc_time, AuditData->>'ClientIP', Operation 
FROM 'm365_unified_audit_log.json'
ORDER BY utc_time ASC
LIMIT 50;
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
duckdb -c "DESCRIBE SELECT * FROM read_json('logs.jsonl');"
duckdb -c "DESCRIBE SELECT * FROM read_csv('access_logs.csv', header=true);"

# 3. Inspect exact nested schema tree of dynamic JSON payload strings (e.g. M365 AuditData)
duckdb -c "SELECT json_structure(AuditData) FROM 'm365_unified_audit_log.json' LIMIT 1;"

# 4. List all distinct top-level JSON keys inside a stringified payload column
duckdb -c "SELECT DISTINCT json_keys(AuditData) FROM 'm365_unified_audit_log.json' LIMIT 5;"
```

### D. Querying Nested JSON, M365 UAL, & Windows Security Events via Arrow Operators

DuckDB supports native JSON extraction with `->>` (extract scalar string) and `->` (extract JSON struct):

```bash
# 1. M365 Unified Audit Log (UAL) Triage
duckdb -json -bail -c "
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
FROM 'm365_unified_audit_log.json'
WHERE Operation IN ('FileDownloaded', 'MailItemsAccessed', 'Set-Mailbox', 'UserLoggedIn', 'Add member to role')
   OR AuditData->>'UserId' = 'compromised_user@company.com'
ORDER BY CreationTime DESC
LIMIT 50;
"

# 2. Windows Security Event Log Triage (Event IDs: 4625 = Failed Logon, 4624 = Logon, 4688 = Process Spawn)
duckdb -json -bail -c "
SELECT 
    EventData->>'TargetUserName' AS username,
    EventData->>'IpAddress' AS source_ip,
    COUNT(*) AS failure_count,
    MIN(TimeCreated) AS first_attempt,
    MAX(TimeCreated) AS last_attempt
FROM 'win_security_events.jsonl'
WHERE CAST(EventID AS INTEGER) = 4625
GROUP BY 1, 2
HAVING failure_count > 5
ORDER BY failure_count DESC
LIMIT 25;
"

# 3. AWS CloudTrail Event Triage (Privilege Escalation & Unauthorized Access)
# CloudTrail records are wrapped inside a nested 'Records: [...]' array in .json.gz files:
duckdb -json -bail -c "
SELECT 
    r->>'eventTime' AS time,
    r->>'eventName' AS event,
    r->'userIdentity'->>'arn' AS user_arn,
    r->>'sourceIPAddress' AS src_ip,
    r->>'userAgent' AS user_agent
FROM (SELECT unnest(Records) AS r FROM read_json('cloudtrail/**/*.json.gz'))
WHERE r->>'eventName' IN ('AssumeRole', 'ConsoleLogin', 'AuthorizeSecurityGroupIngress', 'CreateAccessKey', 'PutUserPolicy')
  AND r->'userIdentity'->>'type' != 'AWSService'
ORDER BY time DESC
LIMIT 25;
"
```

---

## 7. Phase 3: Outlier & Anomaly Detection

### A. Statistical Outlier Detection (DuckDB SQL)

#### Z-Score Outlier Detection
Flags values that are more than 3 standard deviations away from the mean ($|Z| > 3.0$). Best for normally distributed metrics like payload size or response latency:

```bash
duckdb -c "
WITH stats AS (
    SELECT 
        *,
        (bytes_sent - AVG(bytes_sent) OVER()) / NULLIF(STDDEV_POP(bytes_sent) OVER(), 0) AS z_score
    FROM read_csv('network_traffic.csv', header=true)
)
SELECT timestamp, client_ip, bytes_sent, z_score
FROM stats
WHERE ABS(z_score) > 3.0
ORDER BY z_score DESC
LIMIT 25;
"
```

#### Interquartile Range (IQR) Outlier Detection
Flags values outside $Q1 - 1.5 \times IQR$ or $Q3 + 1.5 \times IQR$. Best for skewed datasets (like request spikes or file download sizes):

```bash
duckdb -c "
WITH data AS (
    SELECT * FROM read_csv('api_requests.csv', header=true)
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
ORDER BY r.duration_ms DESC
LIMIT 25;
"
```

#### Rolling Window Rate Spikes & Beaconing (Time-Series Rate of Change)
Detects sudden traffic surges, port scans, brute-force attempts, or periodic C2 beaconing within sliding time windows:

```bash
duckdb -json -bail -c "
SELECT 
    timestamp, 
    client_ip,
    COUNT(*) OVER (
        PARTITION BY client_ip 
        ORDER BY CAST(timestamp AS TIMESTAMP) 
        RANGE BETWEEN INTERVAL '1 minute' PRECEDING AND CURRENT ROW
    ) AS requests_per_min
FROM read_csv('web_access.csv', header=true)
QUALIFY requests_per_min > 20
ORDER BY requests_per_min DESC
LIMIT 25;
"
```

#### Long-Tail (Least-Frequency) Threat Hunting
Identifies the rarest events in the fleet (e.g. rare User-Agents, single-occurrence process names, or one-off external domains that evade volume-based alerts):

```bash
duckdb -json -bail -c "
SELECT 
    http_user_agent, 
    COUNT(*) AS occurrence_count,
    MIN(timestamp) AS first_seen,
    MAX(client_ip) AS sample_ip
FROM read_csv('web_access.csv', header=true)
GROUP BY 1
HAVING occurrence_count <= 2
ORDER BY occurrence_count ASC
LIMIT 25;
"
```

### B. Multi-Variable Tabular Anomaly Detection (`IsolationForest`)

Used when anomalies cannot be caught by single-variable rules alone (e.g. an unusual combination of `bytes_sent`, `duration_ms`, `http_method`, and `status_code`):

```python
import duckdb
import pandas as pd
from sklearn.ensemble import IsolationForest

# 1. Load numerical + categorical data via DuckDB
raw_df = duckdb.query("""
    SELECT bytes_sent, request_count, duration_ms, http_method, status_code
    FROM read_csv('network_traffic.csv', header=true)
""").df()

# 2. Data Cleanup & One-Hot Encoding for categorical log fields
clean_df = raw_df.fillna(0)
feature_df = pd.get_dummies(clean_df, columns=['http_method', 'status_code'])

# 3. Train Isolation Forest model (contamination = expected anomaly ratio)
model = IsolationForest(contamination=0.01, random_state=42)
clean_df['anomaly_label'] = model.fit_predict(feature_df)

# 4. Extract & display anomaly rows (-1 = outlier)
anomalies = clean_df[clean_df['anomaly_label'] == -1]
print(f"Detected {len(anomalies)} anomalies out of {len(clean_df)} records:")
print(anomalies.head(10))
```

### C. Fast Hybrid & Semantic Log Search via `ck` (CLI)

`ck` (`ck-search`) provides local-first hybrid search fusing **BM25 keyword search** (for exact error codes, UUIDs, IP addresses) and **dense vector embeddings** (for conceptual, natural language queries) using Reciprocal Rank Fusion (RRF).

* **Cache & Index Directories**: By default, `ck` stores index databases under `.ck/` in the target directory.
* **Global Index Relocation (`CK_INDEX_DIR`)**: Set `$env:CK_INDEX_DIR="$env:LOCALAPPDATA\ck\indexes"` (PowerShell) or `export CK_INDEX_DIR=~/.cache/ck/indexes` (Bash) to keep log folders clean.

```bash
# 1. Semantic search for conceptual meaning (dense neural vector embeddings)
ck --sem "unauthorized privilege escalation or admin role changes"

# 2. Hybrid search combining BM25 exact keywords with semantic embeddings
ck --hybrid "database connection pool exhausted or timeout"

# 3. Hybrid search on a specific log directory returning JSON
ck --hybrid --json -p ./logs/ "unhandled exception in auth"
```

### D. Semantic Log Clustering & Rare Event Detection (`fastembed`)

Computes vector distance matrices on unstructured error text to flag the top 2% rare, unseen system bugs:

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

## 8. Phase 4: Exporting & AI Summarization Pipeline

### A. AI Log Threat Summarization Pipeline (Pi Agent `pi`)

Pipe DuckDB query outputs directly into Pi Agent (`pi`) for automated AI threat & anomaly analysis:

```bash
# Filter anomalous events via DuckDB and pipe directly to Pi Agent for non-interactive analysis (-p)
duckdb -c "
SELECT CreationTime, Operation, AuditData->>'UserId' AS user_id, AuditData->>'ClientIP' AS ip
FROM 'm365_log.json'
WHERE Operation IN ('Set-Mailbox', 'Add member to role', 'MailItemsAccessed')
LIMIT 50;
" | pi -p "Analyze these M365 security log entries for suspicious account compromise or persistence activity."
```

### B. Exporting Query Results

```bash
# Export filtered log search results to CSV
duckdb -c "
COPY (
    SELECT * FROM read_json('raw_logs.jsonl')
    WHERE level = 'ERROR'
) TO 'error_summary.csv' (HEADER, DELIMITER ',');
"

# Export to compressed Parquet for high-speed analysis
duckdb -c "
COPY (
    SELECT * FROM read_csv('large_dataset.csv', header=true)
) TO 'dataset.parquet' (FORMAT PARQUET);
"
```

---

## 9. Workflow Checklist for Autonomous Agents

1. **Detect File Type**: Check extension (`.json`, `.jsonl`, `.csv`, `.parquet`, `.gz`).
2. **Pre-Filter String Search**: Use `rg` (or `rg -z` for compressed) for instant pattern/IP searching on raw un-parsed log dumps.
3. **Format Conversion & Slicing**: Use `mlr` if converting JSONL $\leftrightarrow$ CSV or reordering fields.
4. **Quick CLI Probe**: Use `jq` for instant one-line inspection of small JSON files.
5. **Run Schema Inspection**: Execute `duckdb -c "DESCRIBE SELECT * FROM ..."` or `parquet_schema(...)`.
6. **Outlier & Anomaly Detection**: Execute Z-Score / IQR SQL queries in DuckDB, search conceptually with `ck`, or run `IsolationForest` ML for multi-variable anomalies.
7. **AI Threat Summarization**: Pipe filtered anomalies into `pi -p` for automated threat analysis.
8. **Pre-Sharing Security Audit**: Run `secret-scanning` (`trufflehog`) or `pii-detection` prior to sharing exports.
9. **Present Clean Summary**: Format query outputs cleanly for the user.
