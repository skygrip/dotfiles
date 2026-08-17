---
name: duckdb
description: Fast in-process SQL analytics on Parquet, CSV, JSON, and SQLite files without importing. Run 'duckdb -json -c "SELECT * FROM '\''data.parquet'\'' LIMIT 10;"' for structured agent output.
---

# DuckDB CLI Analytics Skill

`duckdb` is an in-process, vectorized SQL OLAP engine optimized for analytical queries directly on local or remote data files (Parquet, CSV, JSON, Arrow, SQLite) with zero ingestion required.

---

## 1. Essential CLI Flags

Execute queries directly from the shell without starting an interactive session:

| Flag | Description |
| :--- | :--- |
| `-c "SQL"` | Execute SQL statements non-interactively and exit |
| `-json` | Format query results as a JSON array (ideal for agent parsing) |
| `-csv` | Format query results as comma-separated values |
| `-bail` | Abort immediately if any SQL error occurs |
| `-readonly` | Open database/files in read-only mode (prevents lock conflicts) |
| `-nullvalue ""` | Set custom string representation for `NULL` in output |
| `-s "SQL"` | Run SQL command upon entering the interactive shell |

### Quick Execution Pattern for Agents
```bash
# Return structured JSON directly into terminal/scripts
duckdb -json -bail -c "SELECT status, COUNT(*) AS count FROM 'logs.parquet' GROUP BY status;"
```

---

## 2. Direct File Querying

DuckDB can directly query file paths inside the `FROM` clause:

```sql
-- Parquet (fastest, column-pruned)
SELECT user_id, action FROM 'data/events.parquet' WHERE status = 'failed' LIMIT 20;

-- CSV (auto-detects delimiter, quotes, and headers)
SELECT * FROM 'data/sales.csv' WHERE total > 1000;

-- JSON / NDJSON / JSON Lines
SELECT id, payload->>'name' AS name FROM 'data/records.jsonl' LIMIT 10;
```

---

## 3. Schema & Data Introspection

Inspect structure, column types, and statistical summaries before constructing complex queries:

```bash
# 1. Schema & Column Types
duckdb -c "DESCRIBE SELECT * FROM 'dataset.parquet';"

# 2. Statistical Summary (min, max, null count, distinct count, avg, stddev)
duckdb -c "SUMMARIZE SELECT * FROM 'dataset.parquet';"

# 3. Quick Table Info
duckdb -c "PRAGMA table_info('dataset.parquet');"
```

---

## 4. High-Value Agent Recipes

### A. Multi-File Globs & Filename Tracking
Query across partitioned files or multiple directories, with file provenance:

```sql
-- Read all Parquet files matching pattern and capture source filename
SELECT filename, country, SUM(revenue) AS total_revenue
FROM read_parquet('metrics/year=2026/month=*/*.parquet', filename=true)
GROUP BY filename, country;

-- Union multiple CSVs with mismatched schema order
SELECT * FROM read_csv('logs/*.csv', union_by_name=true, filename=true);
```

### B. Nested JSON Extraction (`->` and `->>`) & UNNEST
- `->` extracts sub-structures as JSON / Structs.
- `->>` extracts leaf values as `VARCHAR`.

```sql
-- Extract scalar values from nested JSON objects
SELECT 
  id,
  payload->>'user_id' AS user_id,
  CAST(payload->'metadata'->>'response_time_ms' AS INTEGER) AS response_time,
  payload->'tags' AS raw_tags
FROM 'events.jsonl';

-- Unnest JSON arrays into individual rows
SELECT id, unnest(payload->'tags') AS tag
FROM 'events.jsonl';
```

### C. Time-Window Slicing & Aggregations
Bucket and aggregate time-series data using built-in date functions:

```sql
-- Aggregate requests into 1-hour windows
SELECT 
  time_bucket(INTERVAL '1 hour', CAST(timestamp AS TIMESTAMP)) AS window_start,
  status_code,
  COUNT(*) AS request_count,
  AVG(response_time_ms) AS avg_latency
FROM 'web_access.parquet'
WHERE timestamp >= '2026-08-01T00:00:00Z'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
```

### D. Handling Dirty, Unstructured, or Huge CSVs
Fine-tune parser parameters when auto-detection fails:

```sql
SELECT * FROM read_csv(
  'dirty_data.csv',
  header = true,
  sample_size = 200000,       -- Scan more rows to infer tricky column types
  ignore_errors = true,       -- Skip malformed rows without crashing query
  null_padding = true,        -- Pad missing trailing columns with NULL
  all_varchar = false         -- Keep type inference enabled
);
```

### E. Attaching External SQLite / PostgreSQL Databases
Query external database files alongside local Parquet/CSV files:

```sql
-- Attach SQLite database
ATTACH 'app.db' AS sqlite_db (TYPE SQLITE);

-- Join SQLite table with a Parquet file
SELECT u.email, o.total, o.created_at
FROM sqlite_db.users u
JOIN 'orders.parquet' o ON u.id = o.user_id;
```

### F. High-Performance Exports
Export transformed datasets into compressed Parquet or CSV files:

```sql
-- Export to Parquet with ZSTD compression
COPY (
  SELECT user_id, date_trunc('day', timestamp) AS day, COUNT(*) AS events
  FROM 'raw_logs/*.parquet'
  GROUP BY 1, 2
) TO 'aggregated_events.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Export to CSV with headers
COPY (SELECT * FROM 'sales.parquet' WHERE status = 'COMPLETED') 
TO 'completed_sales.csv' (HEADER, DELIMITER ',');

-- Partitioned directory export
COPY (SELECT * FROM 'large_dataset.parquet')
TO 'partitioned_output' (FORMAT PARQUET, PARTITION_BY (year, month), OVERWRITE_OR_IGNORE);
```

---

## 5. Performance & Resource Tuning

For memory-constrained environments or massive datasets:

```sql
-- Limit memory usage and thread concurrency
SET max_memory = '4GB';
SET threads = 4;

-- Optimize memory by disabling strict order preservation on large GROUP BY / aggregates
SET preserve_insertion_order = false;

-- Configure temporary spill directory for out-of-core operations
SET temp_directory = './duckdb_spill';
```

Example CLI invocation with performance pragmas:
```bash
duckdb -c "SET max_memory='4GB'; SET threads=4; COPY (SELECT * FROM 'huge_dataset.parquet' WHERE valid = true) TO 'filtered.parquet' (FORMAT PARQUET);"
```
