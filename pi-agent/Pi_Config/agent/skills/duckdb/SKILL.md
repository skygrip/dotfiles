---
name: duckdb
description: Fast in-process SQL analytics on Parquet, CSV, JSONL, and SQLite files. Run 'duckdb -json -bail -c "SELECT * FROM '\''data.parquet'\'' LIMIT 10;"'.
---

# DuckDB CLI & SQL Capabilities Reference

In-process, vectorized SQL OLAP engine optimized for high-performance analytical queries directly on local or remote data files (Parquet, CSV, JSONL, Arrow, SQLite, Iceberg, Delta Lake) with zero ingestion or database setup required.

---

## 1. Execution Primitives & Negative Guardrails

Always execute non-interactively using `-c` with `-bail` (abort immediately on SQL error) and `-json` (for structured agent ingestion):

| Flag / Parameter | Purpose | Agent Syntax |
| :--- | :--- | :--- |
| `-json -bail -c "..."` | Headless execution returning structured JSON array; aborts on syntax error | `duckdb -json -bail -c "SELECT ..."` |
| `-jsonlines -bail -c "..."` | Emits streaming line-delimited JSON (NDJSON) for memory-efficient agent pipelines | `duckdb -jsonlines -bail -c "SELECT ..."` |
| `-markdown` / `-table` / `-box` | Direct ASCII/Markdown table output for terminal inspection | `duckdb -markdown -c "SELECT ..."` |
| `-safe` | Disables arbitrary filesystem write and dynamic extension loads (sandboxing) | `duckdb -safe -json -c "SELECT ..."` |
| `-readonly` | Prevents database lock contention on active SQLite / DuckDB files | `duckdb -readonly -json -bail -c "..."` |
| `Single Quotes` | File paths MUST use single quotes (`'data.parquet'`), not double quotes | `FROM 'data.parquet'` |
| `LIMIT 25` | Bound output on exploratory queries to prevent terminal buffer overflow | Always append `LIMIT 25` |
| `Memory Budget` | Cap memory allocation and threads to prevent OOM kills in subshells | `SET max_memory = '4GB'; SET threads = 4;` |

---

## 2. Zero-Ingestion Input Formats & Storage Engines Matrix

DuckDB natively queries structured, semi-structured, geospatial, and database files in-place with transparent decompression:

| Category | File Formats / Extensions | Engine Slicing & Scan Functions | Key Parameters & Capabilities |
| :--- | :--- | :--- | :--- |
| **Columnar / Tabular** | `.parquet`, `.arrow`, `.feather` | Direct `FROM 'path'`, `read_parquet()` | Predicate pushdown (row group skipping), min/max stats, column projection, `hive_partitioning = true`. |
| **Delimited Text** | `.csv`, `.tsv`, `.psv`, `.txt` | Direct `FROM 'path'`, `read_csv()` | Multi-threaded parallel sniffer; auto-detects delimiter, header, types; handles `lazy_quotes = true`. |
| **Semi-Structured** | `.json`, `.jsonl`, `.ndjson` | Direct `FROM 'path'`, `read_json_auto()` | Schema inference, nested struct/list conversion, arrow extraction (`->` / `->>`). |
| **Compressed Streams** | `.gz`, `.zst`, `.bz2`, `.lz4` | Direct `FROM 'file.<ext>.<comp>'` | Transparent in-stream decompression without extracting to disk. |
| **Data Lake Tables** | Apache Iceberg, Delta Lake | `iceberg_scan()`, `delta_scan()` | Metadata & manifest parsing, snapshot time-travel (`iceberg`, `delta` extensions). |
| **Spreadsheets & GIS** | `.xlsx`, `.geojson`, `.shp`, `.gpkg` | `st_read('file', layer='...')` | Direct Excel worksheet and GIS layer reads (`spatial` extension). |
| **Attached Databases** | `.sqlite`, `.db`, PostgreSQL, MySQL | `ATTACH 'conn_str' AS db (TYPE ...)` | Live cross-engine joins across external databases in a single SQL query (`ATTACH`). |
| **Remote Object Stores**| `https://`, `s3://`, `gcs://`, `azure://`, `hf://` | `httpfs`, `azure`, `hf` extensions | HTTP range requests (downloads only requested column byte ranges via DuckDB Secret Manager). |

---

## 3. SQL Dialect Capabilities & Syntax Flags Matrix

DuckDB implements modern "Friendly SQL" shortcuts and extensions:

| Category | Supported Dialect Capability | Syntax Pattern | Behavioral Rule / Equivalence |
| :--- | :--- | :--- | :--- |
| **Projection** | Column Exclusion | `SELECT * EXCLUDE (col_a, col_b)` | Removes specified columns from wildcard projection (BigQuery-style). |
| | Column Replacement | `SELECT * REPLACE (expr AS col_a)` | In-place transformation of existing column in wildcard output. |
| | Dynamic Column Sets | `COLUMNS('regex_pattern')` | Matches and applies expressions across columns by regex or lambda `COLUMNS(c -> c LIKE '%_amt')`. |
| **Clauses** | `FROM`-First Syntax | `FROM 'data.parquet' WHERE ...` | Omits `SELECT *` as default projection. |
| | Automated Grouping | `GROUP BY ALL`, `ORDER BY ALL` | Auto-detects and groups/orders by all non-aggregated columns. |
| | Window Filtering | `QUALIFY <window_condition>` | Filters window function results directly without subqueries/CTEs (Snowflake-style). |
| **Joins** | Temporal Predecessor | `ASOF JOIN ... ON t.ts >= q.ts` | Nearest preceding timestamp match for time-series / event streams. |
| | Set Membership Joins | `SEMI JOIN`, `ANTI JOIN`, `POSITIONAL JOIN` | Optimized existence / non-existence and index-matched row joins. |
| **Reshaping** | Pivot (Wide) | `PIVOT tbl ON col USING sum(val) GROUP BY row_col` | Direct keyword pivot without manual `CASE WHEN` aggregation. |
| | Unpivot (Long) | `UNPIVOT tbl ON c1, c2 INTO NAME k VALUE v` | Melts wide columns into key/value rows. |
| **Multi-File Scan** | Schema Evolution | `read_*(..., union_by_name = true)` | Merges files with differing or reordered schemas; fills missing keys with `NULL`. |
| | File Lineage | `read_*(..., filename = true)` | Injects origin filepath as a virtual column on every row. |
| | Hive Partitions | `read_parquet('year=*/...', hive_partitioning = true)` | Parses partition directories into virtual columns. |
| **Sampling** | Statistical Subsetting | `USING SAMPLE 10% (bernoulli \| reservoir)` | Instant sampling without full table scan. |
| **Logic & Types** | Null-Safe Equality | `a IS NOT DISTINCT FROM b` | Evaluates `NULL = NULL` as `TRUE` (joins/filters). |
| | String Slicing | `str[1:3]` (1-based), `str[-4:]` (negative index) | Python-style string and list bracket slicing. |
| | Trailing Commas | `SELECT a, b, FROM ...` | Trailing commas permitted in `SELECT`, `GROUP BY`, and structs. |
| | SQL Macros | `CREATE MACRO name(args) AS <expr>` | User-defined scalar and parameterized `TABLE` macros (`CREATE MACRO m() AS TABLE ...`). |

---

## 4. Built-in Function Families & AI Superpowers

| Family | Function / Operator | Capabilities & Usage |
| :--- | :--- | :--- |
| **JSON Extraction** | `->` (Extracts `JSON` / Struct) | 0-based array index or path extraction: `payload->'$.user.id'`, `items->0`. |
| | `->>` (Extracts `VARCHAR`) | Scalar unquoted text extraction: `payload->>'$.user.name'`. |
| **Array Expansion** | `UNNEST(list_or_struct)` | Expands multi-value arrays or structs into discrete relational rows (Postgres-style). |
| **List Lambdas** | `list_transform(list, x -> expr)` | Maps expression over list elements: `list_transform(nums, x -> x * 2)`. |
| | `list_filter(list, x -> bool_expr)` | Filters list elements by predicate: `list_filter(tags, t -> t LIKE 'sec_%')`. |
| | `list_reduce(list, (acc, x) -> expr)` | Folds list into aggregate value. |
| | `list_sort()`, `list_slice()`, `list_concat()` | Vectorized list manipulation utilities. |
| **Vector Math (AI)** | `array_cosine_similarity(v1, v2)` | Cosine similarity across fixed-size vector embeddings (`FLOAT[N]`). |
| | `array_dot_product(v1, v2)` | Dot product across vector arrays. |
| | `array_distance(v1, v2)` | Euclidean distance ($L_2$ norm) across vector embeddings. |
| **Full-Text Search** | `PRAGMA create_fts_index(...)` | Inverted index creation for BM25 ranking (`fts` extension). |
| | `fts_main_<table>.match_bm25(...)` | Computes BM25 relevance score over indexed text. |

---

## 5. Schema Introspection, Profiling & Export Flags

| Task | Command / SQL | Purpose |
| :--- | :--- | :--- |
| **Full Statistical Profiling** | `SUMMARIZE SELECT * FROM 'file.parquet';` | Computes column types, min, max, null %, distinct count, avg, stddev, and quartiles in 1 pass. |
| **Schema & Table Info** | `DESCRIBE SELECT * FROM 'file.parquet';`<br/>`PRAGMA table_info('file.parquet');` | Column data types, nullability, and default metadata. |
| **Parquet Internals** | `SELECT * FROM parquet_metadata('file.parquet');`<br/>`SELECT * FROM parquet_schema('file.parquet');` | Row groups, column encodings, uncompressed/compressed sizes, and min/max statistics. |
| **Execution Profiling** | `EXPLAIN ANALYZE SELECT ...;` | Detailed physical operator tree with memory usage and CPU time per stage. |
| **Partitioned Parquet Export** | `COPY (...) TO 'dir/' (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (...));` | Stream query results to ZSTD-compressed Hive-partitioned directory. |
| **Compressed Stream Export** | `COPY tbl TO 'export.json.gz' (FORMAT JSON, COMPRESSION GZIP, ARRAY false);`<br/>`COPY tbl TO 'export.csv.zst' (FORMAT CSV, HEADER true, COMPRESSION ZSTD);` | Export to gzip JSONL or zstd CSV directly. |
| **Out-of-Core Spill Config** | `SET max_memory = '4GB';`<br/>`SET temp_directory = '/tmp/duckdb.tmp';` | Prevents OOM by spilling intermediate hash joins and sorts to disk. |

---

## 6. High-Leverage Composite Examples

```bash
# 1. Multi-file JSONL / Parquet triage with QUALIFY, EXCLUDE, and lineage tracking
duckdb -json -bail -c "
  FROM read_parquet('logs/*/*.parquet', union_by_name=true, filename=true)
  SELECT * EXCLUDE (internal_hash),
         payload->>'$.endpoint' AS endpoint
  WHERE status_code >= 400
  QUALIFY row_number() OVER (PARTITION BY client_ip ORDER BY timestamp DESC) = 1
  LIMIT 25;
"

# 2. Out-of-core ZSTD-compressed Hive-partitioned export with memory ceiling
duckdb -bail -c "
  SET max_memory = '4GB';
  SET temp_directory = '/tmp/duckdb.tmp';
  COPY (
    SELECT * FROM read_csv('raw_events/*.csv.gz', auto_detect=true, union_by_name=true)
    WHERE event_type IS NOT NULL
  ) TO 'lake/' (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (service, date), OVERWRITE_OR_IGNORE true);
"

# 3. Vector similarity search over document embeddings
duckdb -json -bail -c "
  SELECT doc_id, title,
         array_cosine_similarity(embedding, [0.023, -0.045, 0.112, 0.089]::FLOAT[4]) AS similarity
  FROM 'embeddings.parquet'
  ORDER BY similarity DESC
  LIMIT 10;
"
```

