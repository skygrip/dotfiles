---
name: mlr
description: High-speed streaming tabular data processing and stats on CSV, TSV, and JSONL. Use 'mlr --ijsonl --ocsv unsparsify data.jsonl > out.csv', 'mlr --csv stats1 -a count,mean,p95 -f latency -g endpoint logs.csv', or chain verbs with 'then'.
---

# Miller (`mlr`) Streaming Tabular Skill

Miller (`mlr`) is a high-performance streaming processor for name-indexed tabular data (CSV, TSV, JSON Lines, JSON). It operates like `awk`, `sed`, `cut`, `join`, and `sort` directly aware of tabular headers and JSON structures, processing gigabyte-scale streams with minimal memory overhead.

---

## 1. Format Flags & CLI Patterns

Specify input (`--i<fmt>`) and output (`--o<fmt>`), or use symmetric shorthand flags:

| Flag / Pair | Description |
| :--- | :--- |
| `--csv` / `--tsv` | Symmetric CSV or TSV input and output |
| `--jsonl` / `--json` | Symmetric JSON Lines or array JSON format |
| `--ijsonl --ocsv` | Convert JSON Lines stream to CSV table |
| `--icsv --opprint` | Render CSV to aligned ASCII/markdown-style pretty table |
| `--c2p`, `--j2c`, `--c2j` | Built-in conversion shortcuts (CSV→pprint, JSON→CSV, CSV→JSON) |
| `-I` | In-place file modification (e.g. `mlr -I --csv ...`) |
| `--lazy-quotes` | Handle RFC-4180 non-compliant CSV files gracefully |

---

## 2. Core Verbs & Streaming Recipes

Chain multiple verbs seamlessly in a single pass using `then` without intermediate files.

### A. Format Conversion & Normalization
```bash
# Convert heterogeneous JSONL to CSV (unsparsify creates union of all keys across stream)
mlr --ijsonl --ocsv unsparsify logs.jsonl > logs.csv

# Regularize key order across records for uniform schema
mlr --csv regularize data.csv

# Pretty-print top 20 rows of JSONL data to terminal
mlr --ijsonl --opprint head -n 20 events.jsonl
```

### B. Column Slicing, Renaming & Reordering
```bash
# Keep specific columns (cut) or remove columns (-x)
mlr --csv cut -f id,timestamp,status,latency data.csv
mlr --csv cut -x -f internal_id,stacktrace data.csv

# Rename columns
mlr --csv rename old_col,new_col,src_ip,client_ip access.csv

# Reorder columns (bring priority fields to front, or put column at end with -e)
mlr --csv reorder -f timestamp,status,user_id data.csv
mlr --csv reorder -e -f comments data.csv
```

### C. Filtering & Computed Fields (`filter`, `put`)
```bash
# Filter on status codes, latency thresholds, or regex
mlr --csv filter '$status =~ "^(500|502|504)$" && $latency > 1500' access.csv

# Filter on non-null / existence
mlr --csv filter 'is_not_null($user_id) && $user_id != ""' users.csv

# Compute new fields and mutate in-stream
mlr --csv put '$total = $qty * $unit_price; $is_slow = ($latency > 1000 ? 1 : 0)' sales.csv
```

### D. Streaming Aggregations & Percentiles (`stats1`, `stats2`)
```bash
# Calculate count, mean, p50, p95, p99, and max grouped by service & endpoint
mlr --csv stats1 -a count,min,mean,p50,p95,p99,max -f latency -g service,endpoint requests.csv

# Bivariate stats (covariance, Pearson correlation, linear regression)
mlr --csv stats2 -a corr,linreg-ols -f request_size,response_time metrics.csv

# Running totals and delta differences per group
mlr --csv step -a rsum,delta -f amount -g account_id ledger.csv
```

### E. Relational Joins (`join`)
```bash
# Inner join on common key
mlr --csv join -j user_id -f users.csv transactions.csv

# Left outer join (include unpaired left records)
mlr --csv join --ul -j user_id -f users.csv transactions.csv

# Full outer join with different field names on left and right
mlr --csv join --ul --ur -l customer_id -r user_id -f customers.csv orders.csv
```

### F. Reshaping & Sorting (`reshape`, `sort`)
```bash
# Reshape wide to long (melt quarterly columns into key/value rows)
mlr --csv reshape -i q1,q2,q3,q4 -o quarter,revenue sales_wide.csv

# Reshape long to wide (pivot)
mlr --csv reshape -s quarter,revenue sales_long.csv

# Multi-key sorting: string asc (-f), numeric desc (-nr), time/date (-t)
mlr --csv sort -f department -nr salary employees.csv
```

---

## 3. High-Density Pipeline (`then` Chaining)

```bash
# Clean, filter, aggregate, sort, and display in a single memory-efficient pass:
mlr --icsv --opprint \
  clean-whitespace \
  then filter '$status >= 400' \
  then stats1 -a count,mean,p95 -f latency_ms -g endpoint,status \
  then sort -nr count_latency_ms \
  then head -n 10 \
  access_logs.csv
```
