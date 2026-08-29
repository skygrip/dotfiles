---
name: log-analysis
description: Triage, search, and detect anomalies in large logs (JSONL, CSV, CloudTrail, M365, Okta, UDM). Use rg for regex, DuckDB for time-series SQL, and mlr for streaming tabular records.
---

# Log & Telemetry Forensics Analysis Reference

A comprehensive, high-density playbook for forensic schema discovery, multi-source timeline correlation, temporal anomaly detection, semantic search, and statistical/ML threat hunting across enterprise event streams (M365 Unified Audit Logs, Windows EVTX, AWS CloudTrail, Okta System Logs, Google SecOps UDM, and raw JSONL/CSV).

---

## Resources & Domain References Index

| Resource / Reference | Description & Target Telemetry |
| :--- | :--- |
| **[`references/google_secops_udm.md`](references/google_secops_udm.md)** | **Google SecOps (Chronicle) UDM**: Actor-action-target architecture, event taxonomy, and YARA-L detection mappings. |
| **[`references/okta_logs.md`](references/okta_logs.md)** | **Okta System Logs**: Verified event catalog (`user.session.start`, `user.authentication.sso`), MFA push bombing, and ITDR recipes. |
| **`secret-scanning`** (Skill) | Leaked API key and credential detection across files and repositories using TruffleHog. |
| **`pii-detection`** (Skill) | Context-aware PII detection and grep-style auditing across datasets using `openai/privacy-filter`. |

---

## 1. Negative Guardrails & Execution Safety

| Hallucination / Mistake | Why It Fails | Correct Syntax / Protocol |
| :--- | :--- | :--- |
| `lnav ./logs/` in automated subshell | `lnav` is an interactive curses TUI; blocks headless subshells indefinitely | Use `rg`, `duckdb -bail -c "..."`, or `mlr` for batch queries; recommend `lnav` only to human users |
| `cat massive.log` or unbounded `SELECT *` | Floods agent context and exhausts terminal buffer | Always bound output: `head -n 25`, `rg -C 5`, or DuckDB `LIMIT 25` |
| `FROM "logs.jsonl"` in DuckDB | Double quotes denote column/table identifiers | Use single quotes for paths: `FROM 'logs.jsonl'` |
| `parse_json(AuditData).UserId` in DuckDB | Outdated and verbose syntax | Use native arrow notation: `AuditData->>'UserId'` (string) or `AuditData->'Key'` (struct) |
| `duckdb -c "..."` without `-bail` | Script does not fail fast on SQL syntax errors | Always include `-bail` with `-c` |

---

## 2. Telemetry Sources & Schema Ingestion Matrix

| Telemetry Source | Typical Formats | Ingestion Syntax / Path | Key Fields & Indicators to Extract |
| :--- | :--- | :--- | :--- |
| **M365 Unified Audit Log (UAL)** | `.json`, `.jsonl` | `FROM 'm365_*.json'` | `CreationTime`, `Operation`, `Workload`, `AuditData->>'UserId'`, `AuditData->>'ClientIP'`, `AuditData->>'ObjectId'` |
| **Windows Security (EVTX JSON)** | `.jsonl`, `.csv` | `FROM 'win_sec_*.jsonl'` | `EventID` (`4624` Logon, `4625` Failed, `4688` Process Spawn, `4672` Admin), `EventData->>'TargetUserName'`, `EventData->>'IpAddress'` |
| **AWS CloudTrail** | `.json.gz` | `SELECT unnest(Records) AS r FROM read_json('cloudtrail/**/*.json.gz')` | `r->>'eventTime'`, `r->>'eventName'` (`AssumeRole`, `ConsoleLogin`, `PutUserPolicy`), `r->'userIdentity'->>'arn'`, `r->>'sourceIPAddress'` |
| **Okta System Logs** | `.jsonl`, `.json` | `FROM 'okta_*.jsonl'` | `published`, `eventType` (`user.session.start`, `user.authentication.auth_via_mfa`, `user.account.privilege.grant`), `actor->>'alternateId'`, `outcome->>'result'` |
| **Google SecOps (UDM)** | `.jsonl` | `FROM 'udm_*.jsonl'` | `metadata.event_type` (`USER_LOGIN`, `PROCESS_LAUNCH`), `principal.user.userid`, `target.process.command_line`, `security_result.action` |
| **Web / Access Logs** | `.csv`, `.tsv`, `.log` | `read_csv('access.log', header=true)` | `timestamp`, `client_ip`, `http_method`, `request_uri`, `status_code`, `bytes_sent`, `user_agent` |

---

## 3. Fast Triage, Encodings & Compressed Logs

### A. Mixed Encodings & Compressed Archive Inspection
```bash
# 1. Ripgrep compressed logs (.gz) and UTF-16 logs directly (-z flag)
rg -z -i "exception|fatal|unauthorized" ./logs/archive.log.gz

# 2. Fix UTF-16 encoding (common in Windows Event Logs / IIS) to clean UTF-8
# Windows (PowerShell):
Get-Content -Encoding Unicode u_ex240817.log | Set-Content -Encoding UTF8 utf8_access.log
# Linux / POSIX:
iconv -f UTF-16LE -t UTF-8 raw_win.log -o utf8_win.log

# 3. DuckDB direct query on compressed archives (.gz / .zst)
duckdb -json -bail -c "
SELECT * FROM read_json('logs/**/*.jsonl.gz', union_by_name=true, ignore_errors=true)
LIMIT 10;
"
```

### B. Schema & Deep JSON Structure Introspection (DuckDB & JQ)
```bash
# 1. Discover top-level schema and inferred types
duckdb -c "DESCRIBE SELECT * FROM read_json('events.jsonl');"

# 2. Inspect dynamic JSON payload structure and discover keys
duckdb -c "SELECT json_structure(AuditData) FROM 'm365_audit.json' LIMIT 1;"
duckdb -c "SELECT DISTINCT json_keys(AuditData) FROM 'm365_audit.json' LIMIT 5;"

# 3. Quick JSON key filtering and status code frequency counts with jq
jq -c '{time: .timestamp, user: .user_id, status: .status_code}' app_logs.jsonl | head -n 10
jq -r '.status_code' access_logs.jsonl | sort | uniq -c | sort -nr
```

### C. Interactive Log Exploration (`lnav` — Recommend to Human User)
`lnav` merges disparate log files into a unified chronological timeline for interactive investigation:
```bash
lnav ./logs/                     # Merges and displays all logs chronologically
# Inside lnav:
# - 'e' / 'w' : Jump between error and warning messages
# - 'u' / 'U' : Jump between user sessions
# - ':filter-in <pattern>' : Dynamically filters view
# - ';SELECT log_time, log_body FROM all_logs WHERE log_level = "error"' : Embedded SQLite query
```

---

## 4. Threat Hunting & Forensics Query Playbook (DuckDB SQL)

### A. Multi-Source Timeline Merging
Correlate disparate authentication, cloud, and application log streams into a single chronologically aligned investigation timeline:

```sql
duckdb -json -bail -c "
SELECT 'ACCESS' AS source, timestamp::TIMESTAMP AS event_time, client_ip, request_uri AS detail, status_code::VARCHAR AS status
FROM read_csv('access_logs.csv', header=true)
UNION ALL
SELECT 'M365' AS source, CreationTime::TIMESTAMP AS event_time, AuditData->>'ClientIP' AS client_ip, Operation AS detail, AuditData->>'ResultStatus' AS status
FROM 'm365_audit.json'
UNION ALL
SELECT 'OKTA' AS source, published::TIMESTAMP AS event_time, client->>'ipAddress' AS client_ip, eventType AS detail, outcome->>'result' AS status
FROM 'okta_logs.jsonl'
ORDER BY event_time ASC
LIMIT 50;
"
```

### B. Sliding Time-Window Rate Spikes & Brute-Force Detection
Detect high-frequency authentication bursts, credential stuffing, or exfiltration spikes within sliding time windows:

```sql
duckdb -json -bail -c "
SELECT 
    timestamp, 
    client_ip,
    COUNT(*) OVER (
        PARTITION BY client_ip 
        ORDER BY timestamp::TIMESTAMP 
        RANGE BETWEEN INTERVAL '1 minute' PRECEDING AND CURRENT ROW
    ) AS requests_per_min
FROM read_csv('auth_events.csv', header=true)
QUALIFY requests_per_min > 20
ORDER BY requests_per_min DESC
LIMIT 25;
"
```

### C. Impossible Travel & IP-Hopping State Deltas (`LAG()`)
Track state transitions, rapid IP changes across geographic locations, or unexpected user sessions within 60 minutes:

```sql
duckdb -json -bail -c "
SELECT 
    user_id,
    timestamp,
    client_ip,
    LAG(client_ip) OVER w AS prev_ip,
    date_diff('minute', LAG(timestamp::TIMESTAMP) OVER w, timestamp::TIMESTAMP) AS mins_since_last_event
FROM read_csv('auth_events.csv', header=true)
WINDOW w AS (PARTITION BY user_id ORDER BY timestamp::TIMESTAMP)
QUALIFY prev_ip IS NOT NULL AND client_ip != prev_ip AND mins_since_last_event < 60
ORDER BY timestamp DESC
LIMIT 25;
"
```

### D. Long-Tail (Least-Frequency) Threat Hunting
Filter out standard operational noise and isolate rare, low-frequency anomalies (e.g. single-occurrence User-Agents, rare parent processes, or one-off C2 domains):

```sql
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

### E. Statistical Z-Score Outlier Detection ($|Z| > 3.0$)
Detect volumetric exfiltration anomalies or response latency spikes more than 3 standard deviations above the population mean:

```sql
duckdb -json -bail -c "
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

### F. Temporal & Holiday Anomaly Detection (Off-Hours & Public Holidays)
Identify high-privilege operations (`ElevateAccess`, `Set-Mailbox`, `Add member to role`) executed on statutory public holidays or weekends:

```bash
# 1. Generate statutory holiday reference CSV for jurisdiction (e.g. NSW Australia)
uv run --with holidays python -c "
import csv, holidays
h = holidays.AU(subdiv='NSW', years=range(2024, 2028))
with open('nsw_holidays.csv', 'w', newline='', encoding='utf-8') as f:
    csv.writer(f).writerows([['holiday_date', 'holiday_name']] + [[d.isoformat(), name] for d, name in sorted(h.items())])
"

# 2. Join telemetry against holidays to flag off-hours anomalies
duckdb -markdown -bail -c "
SELECT 
    l.CreationTime,
    l.Operation,
    l.AuditData->>'UserId' AS user_id,
    l.AuditData->>'ClientIP' AS client_ip,
    dayname(TRY_CAST(l.CreationTime AS DATE)) AS day_of_week,
    h.holiday_name,
    CASE 
        WHEN dayofweek(TRY_CAST(l.CreationTime AS DATE)) IN (0, 6) THEN 'Weekend'
        WHEN h.holiday_name IS NOT NULL THEN 'Public Holiday'
        ELSE 'Normal Workday'
    END AS day_classification
FROM read_json('m365_audit.json') l
LEFT JOIN read_csv('nsw_holidays.csv', header=true) h 
       ON TRY_CAST(l.CreationTime AS DATE) = h.holiday_date
WHERE day_classification IN ('Weekend', 'Public Holiday')
  AND l.Operation IN ('FileDownloaded', 'ElevateAccess', 'Set-Mailbox', 'Add member to role')
ORDER BY l.CreationTime DESC
LIMIT 25;
"
```

---

## 5. Machine Learning, Semantic Embeddings & Concept Search

### A. Multi-Variable Tabular Isolation Forest (`scikit-learn` via `uv run`)
Isolates anomalous combinations across multiple simultaneous variables (e.g. `bytes_sent`, `duration_ms`, `http_method`, and `status_code`):

```bash
uv run --with scikit-learn,duckdb,pandas python -c "
import duckdb, pandas as pd; from sklearn.ensemble import IsolationForest
df = duckdb.query(\"SELECT bytes_sent, duration_ms, http_method, status_code FROM read_csv('network_traffic.csv', header=true)\").df()
feature_df = pd.get_dummies(df.fillna(0))
df['anomaly'] = IsolationForest(contamination=0.01, random_state=42).fit_predict(feature_df)
anomalies = df[df['anomaly'] == -1]
print(f'Detected {len(anomalies)} multi-variable anomalies:\n', anomalies.head(20))
"
```

### B. Vector Distance Clustering & Semantic Anomaly Detection (`fastembed` via `uv run`)
Computes dense neural vector embeddings on unstructured log messages using Snowflake Arctic Embed to identify the top 2% statistical semantic outliers:

```bash
uv run --with fastembed,duckdb,numpy python -c "
import numpy as np, duckdb; from fastembed import TextEmbedding
lines = duckdb.query(\"SELECT DISTINCT message FROM read_csv('app_logs.csv', header=true) WHERE message IS NOT NULL LIMIT 2000\").df()['message'].tolist()
embs = np.array(list(TextEmbedding('snowflake/snowflake-arctic-embed-m-v1.5').embed(lines)))
dists = np.linalg.norm(embs - np.mean(embs, axis=0), axis=1)
threshold = np.percentile(dists, 98)
for l, d in zip(lines, dists):
    if d > threshold: print(f'[{d:.2f}] {l}')
"
```

### C. Hybrid & Semantic Log Search (`ck` CLI)
Blends lexical keyword matching with dense semantic embeddings for conceptual investigation queries:

```bash
# 1. Semantic search for conceptual incident descriptions
ck --sem "unauthorized privilege escalation or admin role changes" ./logs/

# 2. Hybrid search combining exact identifiers (IPs, UUIDs) with natural language meaning
ck --hybrid "database connection pool exhausted or timeout" ./logs/

# 3. Hybrid search emitting structured JSON Lines for agent tool processing
ck --hybrid --jsonl --limit 10 "unhandled exception in auth" ./logs/
```

---

## 6. Automated AI Triage & Pipeline Export

### A. Piped AI Threat Summarization (`pi -p`)
Pipe filtered SQL query results directly into Pi Agent for automated security summarization:

```bash
duckdb -json -bail -c "
SELECT CreationTime, Operation, AuditData->>'UserId' AS user_id, AuditData->>'ClientIP' AS ip, AuditData->>'Parameters' AS params
FROM 'm365_audit.json'
WHERE Operation IN ('Set-Mailbox', 'Add member to role', 'ElevateAccess', 'AppRoleAssignment')
LIMIT 50;
" | pi -p "Analyze these security log entries for suspicious account compromise, persistence mechanisms, or privilege escalation."
```

### B. Forensic Dataset Export
```bash
# Export filtered findings directly to compressed Parquet with ZSTD compression
duckdb -bail -c "
COPY (
    SELECT * FROM read_json('raw_events/**/*.jsonl.gz', union_by_name=true)
    WHERE level IN ('ERROR', 'CRITICAL', 'FATAL')
) TO 'triage_errors.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
"
```
