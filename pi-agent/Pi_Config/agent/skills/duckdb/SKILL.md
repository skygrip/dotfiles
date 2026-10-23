---
name: duckdb
description: Default in-process SQL engine for analytics, aggregations, and joins across Parquet, CSV, JSONL, and SQLite files (e.g. duckdb -json -bail -c SELECT * FROM FILE.parquet LIMIT 10).
---

# DuckDB CLI & SQL Capabilities Reference

In-process, vectorized SQL OLAP engine optimized for high-performance analytical queries directly on local or remote data files (Parquet, CSV, JSONL, Arrow, SQLite, Iceberg, Delta Lake) with zero ingestion or database setup required.

---

## 1. Execution Primitives & Circuit Breakers

Always execute non-interactively using `-c` with `-bail` (abort immediately on SQL error) and `-json` (for structured agent ingestion):

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Interactive Shell Hang** | Invoking bare `duckdb` opens an interactive TUI that hangs subshells | Always execute headless with `duckdb -json -bail -c "SQL"` |
| **Streaming Output** | Loading multi-million row arrays into memory overflows subshell buffers | Use `duckdb -jsonlines -bail -c "SQL"` for streaming line-delimited records |
| **Terminal Inspection** | Raw JSON is token-heavy when inspecting schema or statistics directly | Use `duckdb -markdown -c "SQL"` for compact terminal tables |
| **Double-Quoted Path Trap** | Double quotes in SQL (`"data.parquet"`) parse as table or column identifiers | Always wrap file paths in single quotes: `FROM 'data.parquet'` |
| **Unbounded Query Buffer** | Unbounded full-file queries crash terminal buffers and subshell memory | Always append `LIMIT 25` to exploratory queries |
| **Out-Of-Memory (OOM) Circuit Breaker** | Analytical joins or large aggregations exceeding subshell RAM trigger OOM crash | If memory error occurs, prepend: `SET max_memory = '4GB'; SET temp_directory = '/tmp/duckdb.tmp';` |

---

## 2. Ingest Formats & Storage Engines Matrix

DuckDB natively queries structured, semi-structured, geospatial, and database files in-place with transparent decompression:

| Category | File Formats / Extensions | Engine Slicing & Scan Functions | Key Parameters & Capabilities |
| :--- | :--- | :--- | :--- |
| **Columnar / Tabular** | `.parquet`, `.arrow`, `.feather` | Direct `FROM 'PATH'`, `read_parquet()` | Predicate pushdown (row group skipping), min/max stats, column projection, `hive_partitioning = true`. |
| **Delimited Text** | `.csv`, `.tsv`, `.psv`, `.txt` | Direct `FROM 'PATH'`, `read_csv()` | Multi-threaded parallel sniffer; auto-detects delimiter, header, types; handles `lazy_quotes = true`. |
| **Semi-Structured** | `.json`, `.jsonl`, `.ndjson` | Direct `FROM 'PATH'`, `read_json_auto()` | Schema inference, nested struct/list conversion, arrow extraction (`->`, `->>`). |
| **Compressed Streams** | `.gz`, `.zst`, `.bz2`, `.lz4` | Direct `FROM 'events.csv.gz'` | Transparent in-stream decompression without extracting to disk. |
| **Data Lake Tables** | Apache Iceberg, Delta Lake | `iceberg_scan()`, `delta_scan()` | Metadata & manifest parsing, snapshot time-travel (`iceberg`, `delta` extensions). |
| **Spreadsheets & GIS** | `.xlsx`, `.geojson`, `.shp`, `.gpkg` | `st_read('file.geojson', layer='layer')` | Direct Excel worksheet and GIS layer reads (`spatial` extension). |
| **Attached Databases** | `.sqlite`, `.db`, PostgreSQL, MySQL | `ATTACH 'database.sqlite' AS db (TYPE SQLITE)` | Live cross-engine joins across external databases in a single SQL query (`ATTACH`). |
| **Remote Object Stores** | `https://`, `s3://`, `gcs://`, `hf://` | `httpfs`, `azure`, `hf` extensions | HTTP range requests (downloads only requested column byte ranges via Secret Manager). |

---

## 3. SQL Dialect & Analytical Superpowers Matrix

DuckDB implements modern analytical extensions, window filters, vector math, and zero-copy export:

| Category | Dialect Feature | Syntax Pattern | Behavioral Rule / Purpose |
| :--- | :--- | :--- | :--- |
| **Projection** | Column Exclusion / Replacement | `SELECT * EXCLUDE (col_a) REPLACE (expr AS col_b)` | Modifies wildcard projection without listing all columns. |
| | Dynamic Column Sets | `COLUMNS('regex_pattern')` | Matches and applies expressions across columns by regex or lambda. |
| **Friendly Clauses** | `FROM`-First Syntax | `FROM 'data.parquet' WHERE status = 'err'` | Omits `SELECT *` as default projection. |
| | Auto Group & Window Filter | `GROUP BY ALL`, `QUALIFY row_number() OVER (...) = 1` | Automatically groups non-aggregates; filters window functions without CTEs. |
| **Joins & Reshape** | Temporal & Positional Joins | `ASOF JOIN ... ON t.ts >= q.ts`, `PIVOT`, `UNPIVOT` | Nearest timestamp match for time-series; direct declarative pivot/unpivot. |
| **Multi-File Scan** | Schema Evolution & Lineage | `read_parquet('*.parquet', union_by_name = true, filename = true)` | Merges drifting schemas with null-fill and injects origin file path. |
| **JSON Extraction** | Arrow Operators | `payload->'$.user.id'`, `payload->>'$.user.name'` | `->` returns JSON struct/array; `->>` returns unquoted VARCHAR. |
| **Array & Vector** | Vector Similarity (AI) | `array_cosine_similarity(v1, v2)` | Fast cosine similarity across vector embeddings (`FLOAT[N]`). |
| **Profiling & Stats** | Statistical Introspection | `SUMMARIZE SELECT * FROM 'data.parquet';` | Computes column types, null %, distinct count, avg, stddev in 1 pass. |
| **Partitioned Export**| Hive Partitioned Export | `COPY (SELECT * FROM tbl) TO 'dir/' (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (dt))` | Streams query results into compressed partitioned directory. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Multi-file Parquet triage with QUALIFY, EXCLUDE, and lineage tracking
duckdb -json -bail -c "
  FROM read_parquet('logs/*/*.parquet', union_by_name=true, filename=true)
  SELECT * EXCLUDE (internal_hash),
         payload->>'$.endpoint' AS endpoint
  WHERE status_code >= 400
  QUALIFY row_number() OVER (PARTITION BY client_ip ORDER BY timestamp DESC) = 1
  LIMIT 25;
"

# Stage 2: Out-of-core ZSTD-compressed Hive-partitioned export with row-count verification
duckdb -bail -c "
  SET max_memory = '4GB';
  SET temp_directory = '/tmp/duckdb.tmp';
  COPY (
    SELECT * FROM read_csv('raw_events/*.csv.gz', auto_detect=true, union_by_name=true)
    WHERE event_type IS NOT NULL
  ) TO 'lake/' (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (service, date), OVERWRITE_OR_IGNORE true);
"
duckdb -bail -c "SELECT count(*) FROM 'lake/*/*.parquet';"

# Stage 3: Vector similarity search over document embeddings
duckdb -json -bail -c "
  SELECT doc_id, title,
         array_cosine_similarity(embedding, [0.023, -0.045, 0.112, 0.089]::FLOAT[4]) AS similarity
  FROM 'embeddings.parquet'
  ORDER BY similarity DESC
  LIMIT 10;
"
```

