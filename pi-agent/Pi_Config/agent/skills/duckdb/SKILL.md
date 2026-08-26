---
name: duckdb
description: Fast in-process SQL analytics on Parquet, CSV, JSONL, and SQLite files. Run 'duckdb -json -bail -c "SELECT * FROM '\''data.parquet'\'' LIMIT 10;"'.
---

# DuckDB CLI Analytics Skill

In-process, vectorized SQL OLAP engine optimized for analytical queries directly on local or remote data files (Parquet, CSV, JSONL, Arrow, SQLite) with zero ingestion or server setup required.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`duckdb`** | Vectorized analytical SQL engine for querying files directly in memory or disk |

---

## 2. Negative Guardrails (Small Model Safety)

Small models frequently trip on CLI flags, file quoting, or unbounded results:

| Hallucination / Mistake | Why It Fails | Correct Syntax |
| :--- | :--- | :--- |
| `duckdb --format json` or `-o json` | DuckDB uses single-dash flags | `duckdb -json -bail -c "..."` |
| `FROM "events.parquet"` | Double quotes denote column/table identifiers | `FROM 'events.parquet'` (single quotes for paths) |
| `SELECT * FROM 'huge.parquet'` | Omitting LIMIT floods agent context window | Always append `LIMIT 25` for inspection |
| `read_csv_auto(...)` | Deprecated in modern DuckDB | Query directly: `FROM 'file.csv'` or `read_csv(...)` |
| `duckdb -c "..."` in pwsh stripping quotes | PowerShell treats nested quotes ambiguously | Use explicit escaping: `"SELECT * FROM 'data.csv'"` |

---

## 3. Essential CLI Invocations (Cross-Platform)

Always execute queries non-interactively using `-c` with `-bail` (abort immediately on SQL error) and `-json` (for structured agent ingestion):

```bash
# Windows (PowerShell)
duckdb -json -bail -c "SELECT status, COUNT(*) AS count FROM 'logs.parquet' GROUP BY status LIMIT 10;"

# Linux / WSL (Bash)
duckdb -json -bail -c 'SELECT status, COUNT(*) AS count FROM '\''logs.parquet'\'' GROUP BY status LIMIT 10;'

# Read-Only flag (prevents database locking conflicts on active files)
duckdb -readonly -json -bail -c "SELECT * FROM 'production.db' LIMIT 5;"
```

---

## 4. Schema & Data Introspection

Inspect column types and statistical distributions before constructing complex queries:

```bash
# 1. Schema & Column Types
duckdb -c "DESCRIBE SELECT * FROM 'dataset.parquet';"

# 2. Statistical Summary (min, max, null count, distinct count, avg, stddev)
duckdb -c "SUMMARIZE SELECT * FROM 'dataset.parquet';"

# 3. Quick Table Info
duckdb -c "PRAGMA table_info('dataset.parquet');"
```

---

## 5. Forensic, DFIR & Log Analytics Recipes

### A. Windows Event Logs (EVTX JSONL)
Analyze Windows events exported as JSON Lines (e.g. via `evtx_dump`):

```sql
-- Count top failed logon accounts (EventID 4625)
SELECT 
  Event->'EventData'->>'TargetUserName' AS target_user,
  Event->'EventData'->>'IpAddress' AS source_ip,
  COUNT(*) AS failure_count
FROM 'security_events.jsonl'
WHERE CAST(Event->'System'->>'EventID' AS INTEGER) = 4625
GROUP BY 1, 2
ORDER BY failure_count DESC
LIMIT 20;

-- Identify suspicious process spawns (EventID 4688)
SELECT 
  Event->'EventData'->>'NewProcessName' AS process_name,
  Event->'EventData'->>'CommandLine' AS command_line,
  Event->'EventData'->>'ParentProcessName' AS parent_process
FROM 'security_events.jsonl'
WHERE CAST(Event->'System'->>'EventID' AS INTEGER) = 4688
  AND (
    Event->'EventData'->>'CommandLine' ILIKE '%powershell%'
    OR Event->'EventData'->>'CommandLine' ILIKE '%certutil%'
    OR Event->'EventData'->>'CommandLine' ILIKE '%mshta%'
  )
LIMIT 25;
```

### B. Network Traffic Slicing (Zeek `conn.log` / CSV / Parquet)
```sql
-- Top communicating external IP addresses by bytes transferred
SELECT 
  id_orig_h AS src_ip,
  id_resp_h AS dest_ip,
  id_resp_p AS dest_port,
  proto,
  SUM(orig_bytes) AS bytes_sent,
  COUNT(*) AS connection_count
FROM read_csv('conn.log', header=true, delim='\t')
WHERE dest_port NOT IN (80, 443, 53)
GROUP BY 1, 2, 3, 4
ORDER BY bytes_sent DESC
LIMIT 20;
```

### C. Multi-File Globbing with Source Provenance
Query across directories or date partitions while tracking the origin file:

```sql
-- Search for a malicious hash or filename across multiple artifact dumps
SELECT filename, computer_name, file_path, sha256
FROM read_csv('triage_exports/*/Amcache.csv', union_by_name=true, filename=true)
WHERE sha256 = '<SUSPECT_SHA256>'
LIMIT 20;
```

### D. Nested JSON Extraction (`->` and `->>`) & UNNEST
- `->` extracts sub-structures as JSON / Structs.
- `->>` extracts scalar values as `VARCHAR`.

```sql
-- Unnest array elements into individual relational rows
SELECT 
  id,
  payload->>'user_id' AS user_id,
  unnest(payload->'tags') AS tag
FROM 'events.jsonl'
LIMIT 20;
```

### E. Attaching External SQLite Databases
```sql
-- Attach SQLite database in read-only mode and query directly
ATTACH 'browsing_history.sqlite' AS history (TYPE SQLITE, READ_ONLY);

SELECT url, title, visit_count, last_visit_time
FROM history.urls
ORDER BY last_visit_time DESC
LIMIT 25;
```

---

## 6. High-Performance Exports & Resource Tuning

### Clean Exports
```sql
-- Export filtered query results to compressed Parquet
COPY (
  SELECT * FROM 'raw_logs/*.jsonl' WHERE status = 'ERROR'
) TO 'error_logs.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Export to CSV with headers
COPY (SELECT * FROM 'events.parquet' LIMIT 1000) 
TO 'sample_events.csv' (HEADER, DELIMITER ',');
```

### Resource Tuning Pragmas (Memory-Constrained Environments)
```bash
# Cap memory usage and threads to prevent host starvation
duckdb -bail -c "
  SET max_memory = '4GB';
  SET threads = 4;
  SET preserve_insertion_order = false;
  COPY (SELECT * FROM 'huge_data.parquet' WHERE valid = true) TO 'output.parquet' (FORMAT PARQUET);
"
```
