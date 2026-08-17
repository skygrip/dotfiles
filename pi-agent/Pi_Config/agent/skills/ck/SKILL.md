---
name: ck
description: Semantic, hybrid, and fast lexical code search using ck (seek). Use 'ck --sem "concept query"' for natural language search, 'ck --hybrid "query"' for combined search, or 'ck "literal"' for fast lexical search.
---

# `ck` (Seek) Codebase Search Skill

`ck` (seek) is an AI-native search utility providing local vector semantic search, BM25 lexical search, hybrid Reciprocal Rank Fusion (RRF) retrieval, and grep-compatible regex search across codebases.

---

## Global Cache Environment

Set `CK_INDEX_DIR` in your environment to prevent local index files from cluttering working trees:

```powershell
$env:CK_INDEX_DIR = "$env:LOCALAPPDATA\ck\indexes"
```

---

## Core Search Modes

### 1. Semantic Search (`--sem`)
Searches by conceptual meaning and natural language intent rather than literal strings (auto-indexes on first run; default top 10, similarity threshold $\ge$ 0.6):

```bash
# Architectural concept or middleware flow
ck --sem "user authentication and JWT validation middleware" src/

# Error handling and retry logic
ck --sem "database retry backoff logic on connection loss"

# Code section retrieval (full function/class via tree-sitter AST)
ck --sem --full-section "rate limiter token bucket implementation"
```

### 2. Hybrid Search (`--hybrid`)
Combines BM25 lexical keyword matching and dense vector embeddings using Reciprocal Rank Fusion (RRF) for optimal precision and recall:

```bash
# Blend exact keywords with conceptual intent
ck --hybrid "authMiddleware jwt validation"

# Custom threshold and result limits
ck --hybrid --limit 5 --threshold 0.02 "cache eviction policy"
```

### 3. Lexical Search (`--lex`)
BM25 ranked full-text search across multi-word queries:

```bash
ck --lex "http client connection pool"
```

### 4. Fast Regex / Grep Search (Default)
Fast literal and regex matching without indexing requirements:

```bash
# Literal / regex search
ck -i "handleRequest" src/

# Word boundary and context lines
ck -w -C 3 "MAX_RETRIES" .
```

---

## Agent & Scripting Output Formats

| Flag | Purpose | Example |
| :--- | :--- | :--- |
| `--jsonl` | Streaming JSON Lines (recommended for AI pipelines/agents) | `ck --jsonl --sem "auth" src/` |
| `--no-snippet` | Suppresses code body in JSONL to reduce token usage | `ck --jsonl --no-snippet --sem "config"` |
| `--json` | Single JSON array output for standard tooling | `ck --json --hybrid "session store"` |
| `--scores` | Displays cosine/RRF similarity scores alongside matches | `ck --sem --scores "queue worker"` |

---

## Filtering and Precision Tuning

- `--topk <N>` / `--limit <N>`: Limit result count (e.g. `--topk 5`).
- `--threshold <SCORE>`: Filter by minimum similarity score (`0.0–1.0` for semantic, `0.01–0.05` for hybrid).
- `--full-section`: Extracts complete enclosing function or class definitions (supports TS, JS, Python, Rust, Go, C#, C/C++, Ruby, etc.).
- `--rerank`: Activates cross-encoder reranking (`--rerank-model jina|bge|mxbai`).
- `--exclude <DIR>`: Exclude specific directories matching pattern.

---

## Index Management & Server Mode

```bash
# Check index status and chunk stats
ck --status .
ck --status-verbose .

# Pre-build or force reindex
ck --index .
ck --reindex --sem "health check"

# Clean index or orphaned entries
ck --clean-orphans .
ck --clean .

# Launch Model Context Protocol (MCP) server
ck --serve
```
