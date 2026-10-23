---
name: mlr
description: Streaming record transformation, field cleansing, summary stats, and format conversion across CSV, TSV, and JSONL (e.g. mlr --csv cut -f COL FILE.csv, mlr --ijsonl --ocsv cat FILE.jsonl).
---

# Miller (`mlr`) Streaming Tabular Capabilities Reference

High-performance streaming engine for name-indexed tabular data (CSV, TSV, JSON Lines, JSON). Operates on gigabyte-scale streams with minimal memory overhead, chaining multiple verbs in a single pass via `then`.

---

## 1. Execution Primitives & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **In-Memory Verb Exhaustion** | Verbs like `sort`, `join`, and `stats1` buffer records into memory; huge files cause OOM | Chain streaming verbs (`filter`, `cut`, `put`) before non-streaming verbs (`sort`, `stats1`) |
| **Silent Header Mismatch** | Processing mixed JSONL records without unifying keys drops fields silently | Prepend `unsparsify --fill-with ""` when ingesting heterogeneous JSONL streams |
| **Destructive In-Place Edit** | Passing `-I` on a failing verb chain truncates input files | If uncertain, test expression to stdout before executing `mlr -I --csv VERB FILE` |
| **Malformed Quote Recovery** | Irregular or unescaped quotes in raw CSV cause parser crash | If CSV parser throws quote error, prepend `--lazy-quotes` to input flags |
| **Terminal Output Formatting** | Raw JSON is verbose; terminal inspection requires aligned text | Use `--opprint` (or `--c2m`) for aligned tabular view during interactive inspection |

---

## 2. Format Flags & CLI Conversion Matrix

| Flag / Shortcut | Input Format | Output Format | Behavioral Capability |
| :--- | :--- | :--- | :--- |
| `--csv` / `--tsv` | CSV / TSV | CSV / TSV | Symmetric tabular delimiter processing. |
| `--jsonl` / `--json` | JSON Lines | JSON Lines / Array | Symmetric semi-structured streaming records. |
| `--c2j` / `--j2c` | CSV / JSON | JSON / CSV | Instant format conversion shortcut. |
| `--c2m` / `--j2m` | CSV / JSON | Markdown Table | Converts CSV or JSON directly into GitHub Flavored Markdown table. |
| `--m2c` / `--m2j` | Markdown Table | CSV / JSON | Parses Markdown table back into CSV or JSON stream. |
| `--c2p` / `--opprint` | CSV | Pretty Print | Aligned columnar table for terminal inspection. |
| `--ijsonl --ocsv` | JSON Lines | CSV | Stream convert heterogeneous JSONL to CSV. |
| `--nidx` | Index-based (no header) | Index-based | Fast positional column processing (`$1`, `$2`). |
| `--lazy-quotes` | Non-compliant CSV | Clean CSV | Gracefully tolerates irregular or unescaped quotes. |

---

## 3. Streaming Verbs & Transformation Matrix

Chain verbs sequentially in a single execution pass: `mlr --csv VERB_A then VERB_B FILE`.

### Record Cleansing, Filtering & Projection Matrix

| Verb | Syntax Pattern | Behavioral Rule / Operation |
| :--- | :--- | :--- |
| **`unsparsify`** | `unsparsify --fill-with ""` | Unifies heterogeneous JSONL/CSV schemas across stream (fills missing keys). |
| **`regularize`** | `regularize` | Re-orders keys to match first record schema across all lines. |
| **`clean-whitespace`** | `clean-whitespace` | Trims leading/trailing whitespace from all field names and values. |
| **`remove-empty-columns`** | `remove-empty-columns` | Drops columns that contain only empty strings or nulls across the stream. |
| **`cut`** | `cut -f col1,col2`, `cut -x -f drop1` | Retains only specified columns (`-f`) or removes specified columns (`-x`). |
| **`rename`** | `rename old_col,new_col` | Renames column headers in-stream. |
| **`reorder`** | `reorder -f col1,col2`, `reorder -e -f col3` | Moves columns to front (`-f`) or pushes columns to end (`-e`). |
| **`filter`** | `filter '$status >= 400 && $latency > 500'` | Row predicate filtering using boolean logic and regex (`=~`). |
| **`put`** | `put '$total = $q * $p; $host = hostname()'` | In-stream column mutation, calculations, and conditional logic. |
| **`head` / `tail`** | `head -n 25`, `tail -n 25` | Slices top or bottom $N$ records in streaming mode. |

### Aggregations, Reshaping & Relational Matrix

| Verb | Syntax Pattern | Behavioral Rule / Operation |
| :--- | :--- | :--- |
| **`stats1`** | `stats1 -a count,mean,p50,p95,max -f val -g grp` | Univariate aggregations, means, and percentiles grouped by field. |
| **`stats2`** | `stats2 -a corr,linreg-ols -f x,y -g grp` | Bivariate statistics (Pearson correlation, covariance, linear regression). |
| **`step`** | `step -a rsum,delta,ratio -f amt -g acct` | Running totals, point-to-point deltas, and ratios against preceding row. |
| **`fill-down`** | `fill-down -f status,category` | Replaces empty values with the most recent non-empty preceding value. |
| **`top`** | `top -n 5 -f metric -g group` | Emits top $N$ records per group without loading whole file into memory. |
| **`fraction`** | `fraction -f val -g grp` | Computes percentage share of each row relative to group total. |
| **`join`** | `join -j key -f LEFT_FILE RIGHT_FILE` | Inner (`-j`), Left (`--ul`), Right (`--ur`), or Full-outer joins. |
| **`reshape`** | `reshape -i q1,q2 -o quarter,val` | Wide-to-long (melting) or long-to-wide (`reshape -s`). |
| **`flatten` / `unflatten`** | `unflatten -f "."`, `flatten -f "."` | Converts nested JSON objects to dotted columns or vice-versa. |
| **`sort`** | `sort -f text_col -nr desc_num` | Multi-key sort: string (`-f`), numeric (`-n`), numeric desc (`-nr`). |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Multi-stage streaming pipeline: clean, filter, aggregate, sort, and display
mlr --icsv --opprint \
  clean-whitespace \
  then filter '$status_code >= 400 && is_not_null($latency_ms)' \
  then stats1 -a count,mean,p95,max -f latency_ms -g endpoint,status_code \
  then sort -nr count_latency_ms \
  then head -n 10 \
  access_logs.csv

# Stage 2: Convert heterogeneous JSONL stream to uniform schema CSV with row-count verification
mlr --ijsonl --ocsv \
  unsparsify --fill-with "" \
  then regularize \
  then reorder -f timestamp,event_type,user_id \
  events.jsonl > events_clean.csv
mlr --csv count events_clean.csv

# Stage 3: Relational join followed by wide-to-long quarterly melting
mlr --csv \
  join -j customer_id -f customers.csv \
  then reshape -i q1_rev,q2_rev,q3_rev,q4_rev -o quarter,revenue \
  then sort -f country -nr revenue \
  sales_wide.csv > sales_long.csv
```
