---
name: ck
description: Semantic, hybrid, and lexical codebase search for discovering code by concept or keyword (e.g. ck --jsonl PATTERN, ck --hybrid --jsonl QUERY, ck --sem --jsonl CONCEPT).
---

# `ck` (Seek) Codebase Search Capabilities Reference

AI-native local search engine providing semantic vector search (FastEmbed/ONNX), BM25 lexical ranking, Reciprocal Rank Fusion (RRF) hybrid retrieval, Tree-sitter AST section extraction, and fast ripgrep-compatible regex matching.

---

## 1. Execution Primitives & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **High `--hybrid` Threshold** | RRF scores range from 0.01 to 0.05; setting 0.6 returns zero results | Use `--threshold 0.60` for `--sem`, but `--threshold 0.02` for `--hybrid` |
| **Unbounded `--full-section`** | Monolithic classes flood context windows with thousands of tokens | Always pair `--full-section` with `--limit 3` or inspect headers first with `--no-snippet --jsonl` |
| **Index Directory Isolation** | Writing index files to repository root pollutes git working trees | Set `$env:CK_INDEX_DIR = "$env:LOCALAPPDATA\ck\indexes"` (PowerShell) or `export CK_INDEX_DIR=~/.cache/ck/indexes` (POSIX) |
| **Stale Git Offsets** | Switching branches without re-indexing produces stale line offsets | If line numbers drift, run `ck --clean-orphans .` or `ck --reindex .` |
| **Non-Code AST Fallback** | Unsupported file extensions lack Tree-sitter AST parsers | If `--full-section` fails on raw text, fall back immediately to `ck --lex QUERY` or standard grep `ck REGEX` |

---

## 2. Retrieval Modes & AST Extraction Matrix

| Search Mode | CLI Flag | Scoring Engine & Model | Target Use Case & Capabilities |
| :--- | :--- | :--- | :--- |
| **Semantic** | `--sem QUERY` | Dense vector cosine similarity (FastEmbed / BGE) | Conceptual queries, architectural patterns, logic intent without exact keywords. |
| **Hybrid** | `--hybrid QUERY` | Reciprocal Rank Fusion (RRF: BM25 + Vector) | Optimal precision: blends exact function/variable identifiers with conceptual meaning. |
| **Lexical** | `--lex QUERY` | Ranked BM25 full-text scoring | Multi-word tokenized queries resolving terms regardless of order without regex. |
| **Regex / Grep** | `ck REGEX` | Instant ripgrep-style regex matcher | Zero-index literal/pattern matching: `-i` (case-insensitive), `-w` (word), `-C NUM` (context). |
| **AST Section** | `--full-section` | Tree-sitter AST node boundary tracing | Extracts complete enclosing function, method, or class declarations rather than line snippets. |

---

## 3. Dialect, Filtering & Output Matrix

| Category | Flag / Option | Parameters / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **Streaming Output** | `--jsonl` | Line-delimited JSON | Low-latency streaming output optimized for agent tool calls. |
| | `--no-snippet` | Suppresses code bodies | Returns only file path, line numbers, and scores (prevents context window flooding). |
| | `--json` | Single JSON array | Formatted array for batch script consumption. |
| | `--scores` | Display scores | Appends raw cosine similarity or RRF scores to standard output. |
| **Filtering & Scope** | `--threshold` | Float (`0.60` sem, `0.02` hybrid) | Filters matches below minimum score threshold. |
| | `--limit` / `--topk` | Integer (default `10`) | Restricts number of candidate matches returned. |
| | `PATH` or `'**/*.rs'` | Positional glob/path | Scopes search to directory or file glob (do not use `-t`). |
| | `--exclude` | `DIR` | Excludes directory paths (`--exclude vendor --exclude tests`). |
| | `--rerank` | `--rerank-model jina` or `bge` | Re-scores candidate matches with cross-encoder for higher accuracy. |
| **Index Maintenance** | `--status` / `--index` | Positional directory (`.`) | Checks index health stats or pre-builds vector database. |
| | `--switch-model` | `bge-small`, `nomic-v1.5`, `jina-code` | Switches embedding model and rebuilds index cleanly. |
| | `--clean-orphans` | Positional directory (`.`) | Prunes deleted file records from index cache. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Semantic search returning complete enclosing AST functions as JSONL with count verification
ck --sem --full-section --limit 3 --threshold 0.65 --jsonl "token bucket rate limiter middleware" src/ | jq -s 'length'

# Stage 2: Hybrid keyword + semantic search with token-conserving summary
ck --hybrid --threshold 0.02 --limit 5 --no-snippet --scores "authMiddleware jwt validation" src/

# Stage 3: Path-scoped lexical search with cross-encoder reranking
ck --lex --rerank --limit 10 "connection pool timeout backoff" crates/
```
