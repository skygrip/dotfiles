---
name: ck
description: Fast lexical, hybrid, and semantic codebase search (e.g. ck literal, ck --hybrid query, or ck --sem concept).
---

# `ck` (Seek) Codebase Search Capabilities Reference

AI-native local search engine providing semantic vector search (FastEmbed/ONNX), BM25 lexical ranking, Reciprocal Rank Fusion (RRF) hybrid retrieval, Tree-sitter AST section extraction, and fast ripgrep-compatible regex matching.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`ck`** | Multi-modal local code search utility with AST parsing and streaming JSONL output |

---

## 2. Negative Guardrails & Retrieval Safety

| Hallucination / Mistake | Why It Fails | Correct Protocol / Syntax |
| :--- | :--- | :--- |
| High threshold on `--hybrid` | RRF scores range from `0.01–0.05`; setting `0.6` returns **zero results** | Use `--threshold 0.60` for `--sem`, but `--threshold 0.02` for `--hybrid` |
| Bare `--full-section` query | Dumps thousands of tokens for large monolithic classes | Pair `--full-section` with `--limit 3` or inspect first with `--no-snippet --jsonl` |
| Local `.ck/` repo pollution | Default index writes to repository root | Set `$env:CK_INDEX_DIR = "$env:LOCALAPPDATA\ck\indexes"` (or `~/.cache/ck/indexes`) |
| Stale branch line drift | Unindexed git branch switching produces stale line offsets | Run `ck --clean-orphans .` or `ck --reindex` to re-sync chunks |
| Non-code file AST extraction | Unsupported extensions lack Tree-sitter grammars | Fall back to standard grep (`ck "pattern"`) or lexical (`ck --lex`) |

---

## 3. Retrieval Modes & AST Extraction Matrix

| Search Mode | CLI Flag | Scoring Engine & Model | Target Use Case & Capabilities |
| :--- | :--- | :--- | :--- |
| **Semantic** | `--sem "<query>"` | Dense vector cosine similarity (FastEmbed / BGE) | Conceptual queries, architectural patterns, logic intent without exact keywords. |
| **Hybrid** | `--hybrid "<query>"` | Reciprocal Rank Fusion (RRF: BM25 + Vector) | Optimal precision: blends exact function/variable identifiers with conceptual meaning. |
| **Lexical** | `--lex "<query>"` | Ranked BM25 full-text scoring | Multi-word tokenized queries resolving terms regardless of order without regex. |
| **Regex / Grep** | `ck "<regex>"` | Instant ripgrep-style regex matcher | Zero-index literal/pattern matching: `-i` (case-insensitive), `-w` (word), `-C <N>` (context). |
| **AST Section** | `--full-section` | Tree-sitter AST node boundary tracing | Extracts complete enclosing function, method, or class declarations rather than line snippets. |

---

## 4. Output Formats, Filtering & Index Management Matrix

| Category | Flag / Option | Parameters / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **Streaming Output**| `--jsonl` | Line-delimited JSON | Low-latency streaming output optimized for agent tool calls. |
| | `--no-snippet` | Suppresses code bodies | Returns only file path, line numbers, and scores (prevents context window flooding). |
| | `--json` | Single JSON array | Formatted array for batch script consumption. |
| | `--scores` | Display scores | Appends raw cosine similarity or RRF scores to standard output. |
| **Filtering & Scope**| `--threshold` | Float (`0.60` sem \| `0.02` hybrid) | Filters matches below minimum score threshold. |
| | `--limit` / `--topk` | Integer (default `10`) | Restricts number of candidate matches returned. |
| | `path/` or `'**/*.rs'`| Positional glob/path | Scopes search to directory or file glob (do not use `-t`). |
| | `--exclude` | `<dir_pattern>` | Excludes directory paths (`--exclude vendor --exclude tests`). |
| | `--rerank` | `--rerank-model <jina\|bge>` | Re-scores candidate matches with cross-encoder for higher accuracy. |
| **Index & Server** | `--status` / `--index` | Positional directory (`.`) | Checks index health stats or pre-builds vector database. |
| | `--switch-model` | `bge-small`, `nomic-v1.5`, `jina-code` | Switches embedding model and rebuilds index cleanly. |
| | `--clean-orphans` | Positional directory (`.`) | Prunes deleted file records from index cache. |
| | `--serve` | MCP Server mode | Launches stdio Model Context Protocol server. |

---

## 5. High-Leverage Composite Examples

```bash
# 1. Concept search returning complete enclosing AST functions as JSONL
ck --sem --full-section --limit 3 --threshold 0.65 --jsonl "token bucket rate limiter middleware" src/

# 2. Hybrid keyword + semantic search with token-conserving summary
ck --hybrid --threshold 0.02 --limit 5 --no-snippet --scores "authMiddleware jwt validation" src/

# 3. Path-scoped lexical search with cross-encoder reranking
ck --lex --rerank --limit 10 "connection pool timeout backoff" crates/
```
