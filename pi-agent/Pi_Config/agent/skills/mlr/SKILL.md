---
name: mlr
description: Stream processing and stats for CSV, TSV, and JSONL. Run 'mlr --ijsonl --ocsv unsparsify file.jsonl', compute stats with 'mlr --csv stats1', or chain verbs with 'then'.
---

# Miller (`mlr`) Streaming Tabular Capabilities Reference

High-performance streaming engine for name-indexed tabular data (CSV, TSV, JSON Lines, JSON). Operates on gigabyte-scale streams with minimal memory overhead, chaining multiple verbs in a single pass via `then`.

---

## 1. Format Flags & CLI Conversion Matrix

| Flag / Shortcut | Input Format | Output Format | Behavioral Capability |
| :--- | :--- | :--- | :--- |
| `--csv` / `--tsv` | CSV / TSV | CSV / TSV | Symmetric tabular delimiter processing. |
| `--jsonl` / `--json` | JSON Lines | JSON Lines / Array | Symmetric semi-structured streaming records. |
| `--c2j` / `--j2c` | CSV / JSON | JSON / CSV | Instant conversion shortcut. |
| `--c2m` / `--j2m` | CSV / JSON | Markdown Table | Converts CSV or JSON directly into GitHub Flavored Markdown table. |
| `--m2c` / `--m2j` | Markdown Table | CSV / JSON | Parses Markdown table back into CSV or JSON stream. |
| `--c2p` / `--opprint`| CSV | Pretty Print | Aligned columnar table for terminal inspection. |
| `--ijsonl --ocsv` | JSON Lines | CSV | Stream convert heterogeneous JSONL to CSV. |
| `--nidx` | Index-based (no header) | Index-based | Fast positional column processing (`$1`, `$2`). |
| `--xtab` | Vertical key-value pairs | Vertical key-value pairs | Transposed record-per-block output. |
| `-I` | Any | Target file in-place | In-place file modification (e.g. `mlr -I --csv ...`). |
| `--lazy-quotes` | Non-compliant CSV | Clean CSV | Gracefully tolerates irregular or unescaped quotes. |

---

## 2. Streaming Verbs & Transformation Matrix

Chain verbs seamlessly in a single pipeline: `mlr --csv <verb1> then <verb2> then <verb3> file.csv`.

| Verb | Syntax Pattern | Behavioral Rule / Operation |
| :--- | :--- | :--- |
| **`unsparsify`** | `unsparsify [--fill-with ""]` | Unifies heterogeneous JSONL/CSV schemas across stream (fills missing keys). |
| **`regularize`** | `regularize` | Re-orders keys to match first record schema across all lines. |
| **`cut`** | `cut -f col1,col2`<br/>`cut -x -f drop1,drop2` | Retains only specified columns (`-f`) or removes specified columns (`-x`). |
| **`rename`** | `rename old1,new1,old2,new2` | Renames column headers in-stream. |
| **`reorder`** | `reorder -f col1,col2`<br/>`reorder -e -f trailing_col` | Moves columns to front (`-f`) or pushes columns to end (`-e`). |
| **`filter`** | `filter '$status >= 400 && $latency > 500'` | Row predicate filtering using boolean logic and regex (`=~`). |
| **`put`** | `put '$total = $q * $p; $host = hostname()'` | In-stream column mutation, calculations, and conditional logic. |
| **`clean-whitespace`**| `clean-whitespace` | Trims leading/trailing whitespace from all field names and values. |
| **`remove-empty-columns`**| `remove-empty-columns` | Drops columns that contain only empty strings/nulls across the stream. |
| **`label`** | `label col1,col2,col3` | Sets or overrides header names for headerless streams. |
| **`stats1`** | `stats1 -a count,mean,p50,p95,p99,min,max -f val -g grp` | Univariate aggregations, means, and percentiles grouped by field. |
| **`stats2`** | `stats2 -a corr,linreg-ols -f x,y -g grp` | Bivariate statistics (Pearson correlation, covariance, linear regression). |
| **`step`** | `step -a rsum,delta,ratio -f amt -g acct` | Running totals, point-to-point deltas, and ratios against preceding row. |
| **`fill-down`** | `fill-down -f status,category` | Replaces empty values with the most recent non-empty preceding value. |
| **`top`** | `top -n 5 -f metric -g group` | Emits top $N$ records per group without loading whole file into memory. |
| **`fraction`** | `fraction -f val -g grp` | Computes percentage share of each row relative to group total. |
| **`join`** | `join -j key -f left.csv right.csv`<br/>`join --ul --ur -l id -r uid -f l.csv r.csv` | Inner (`-j`), Left-outer (`--ul`), Right-outer (`--ur`), or Full-outer joins. |
| **`reshape`** | `reshape -i q1,q2,q3 -o quarter,val`<br/>`reshape -s quarter,val` | Wide-to-long (melting) or long-to-wide (pivoting). |
| **`nest`** | `nest --values --across-records -f tag -g id` | Combines repeating values across rows into delimited lists or arrays. |
| **`flatten` / `unflatten`**| `unflatten -f "."` \| `flatten -f "."` | Converts nested JSON objects to dotted columns (`user.geo.city`) or vice-versa. |
| **`sort`** | `sort -f text_col -n num_col -nr desc_num -t date_col` | Multi-key sort: string (`-f`), numeric asc (`-n`), numeric desc (`-nr`), time (`-t`). |
| **`head` / `tail`** | `head -n 25`, `tail -n 25` | Slices top or bottom $N$ records. |
| **`sample`** | `sample -k 100` | Reservoir sampling: emits random sample of $K$ records. |
| **`shuffle`** | `shuffle` | Randomizes row order in-memory. |

---

## 3. High-Leverage Composite Examples

```bash
# 1. Multi-stage streaming pipeline: clean, filter, aggregate, sort, and display
mlr --icsv --opprint \
  clean-whitespace \
  then filter '$status_code >= 400 && is_not_null($latency_ms)' \
  then stats1 -a count,mean,p95,max -f latency_ms -g endpoint,status_code \
  then sort -nr count_latency_ms \
  then head -n 10 \
  access_logs.csv

# 2. Convert heterogeneous JSONL stream to uniform schema CSV
mlr --ijsonl --ocsv \
  unsparsify --fill-with "" \
  then regularize \
  then reorder -f timestamp,event_type,user_id \
  events.jsonl > events_clean.csv

# 3. Relational join followed by wide-to-long quarterly melting
mlr --csv \
  join -j customer_id -f customers.csv \
  then reshape -i q1_rev,q2_rev,q3_rev,q4_rev -o quarter,revenue \
  then sort -f country -nr revenue \
  sales_wide.csv > sales_long.csv
```

