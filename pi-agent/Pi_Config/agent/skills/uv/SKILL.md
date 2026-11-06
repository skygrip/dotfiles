---
name: uv
description: Default execution engine for all Python tasks, scripts, one-liners, pytest runs, package management, PEP 723 inline dependencies, and virtualenvs (e.g. uv run python SCRIPT, uv run --with PKG, uvx TOOL).
---

# `uv` Default Python Execution & Packaging Reference

Default execution engine, package resolver, runtime manager, and script runner for **all Python tasks**. Always prefer `uv run`, `uvx`, and `uv add` over bare `python`, `python3`, `pip`, `venv`, or `poetry` to guarantee deterministic environments, automatic virtualenv activation, and zero global site-packages pollution.

---

## 1. Execution Primitives & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Default Python Execution** | Invoking bare python or python3 hits wrong system interpreters or unactivated virtualenvs | Default to `uv run` for all Python tasks: `uv run SCRIPT`, `uv run python -c "CODE"`, `uv run pytest` |
| **`ModuleNotFoundError` Circuit Breaker** | Failing on missing third-party imports and running pip mutates global site-packages | If a script fails with ModuleNotFoundError, immediately re-run with `uv run --with PKG SCRIPT` |
| **PEP 668 Global Install Trap** | Invoking bare pip install fails with externally-managed-environment errors on modern OS | Use `uv add PKG` inside projects, `uv run --with PKG` for ad-hoc scripts, or `uvx TOOL` for CLIs |
| **Manual Venv Activation** | Chaining source activate commands fails across subshells and breaks on Windows PowerShell | Execute directly through `uv run SCRIPT`; uv discovers and activates `.venv` automatically |
| **Output Signal Hygiene (`-q`)** | Dependency resolution spinners and download logs add noise when piping stdout | Pass `uv run -q` (or `--quiet`) when piping script stdout into `jq` or downstream tools |
| **Missing Python Runtime** | Missing local Python versions block execution on fresh machines | Let uv fetch and isolate runtimes automatically: `uv run --python 3.12 SCRIPT` |

---

## 2. Execution & PEP 723 Matrix

For standalone utility scripts (`scripts/*.py` or `.scratch/*.py`), embed a PEP 723 inline metadata block at the top of the file so `uv run script.py` resolves dependencies automatically without a `requirements.txt`:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27", "pydantic>=2.0"]
# ///
```

| Mode / Flag | Syntax Pattern | Behavioral Rule |
| :--- | :--- | :--- |
| **Ephemeral Dependency Run** | `uv run --with pandas,scipy SCRIPT` | Creates cached temporary venv with requested packages and leaves zero disk mess. |
| **Isolated From Project** | `uv run -q --no-project --with PKG SCRIPT` | Ignores current directory `pyproject.toml` and suppresses resolution logs (`-q`). |
| **Stamp Inline PEP 723** | `uv add --script SCRIPT "httpx>=0.27"` | Programmatically inserts or updates the `# /// script` block inside a `.py` file. |
| **Standalone CLI Tool** | `uvx ruff check .` | Runs standalone CLI tools in isolated sandboxes without installing into `.venv`. |
| **Target Interpreter** | `uv run --python 3.12 SCRIPT` | Automatically fetches and runs under the specified Python version. |
| **Offline / Locked Run** | `uv run --frozen --offline SCRIPT` | Disables network calls; runs strictly from local wheel cache and existing `uv.lock`. |
| **Selective Lock Upgrade** | `uv lock --upgrade-package PKG` | Upgrades a single package in `uv.lock` without disturbing the rest of the graph. |

---

## 3. High-Leverage Composite Examples

```bash
# Stage 1: Isolated Python one-liner with ephemeral dependency injection and quiet stdout piping
uv run -q --no-project --with duckdb,polars python -c "
import duckdb, json
rows = duckdb.sql('SELECT 42 AS metric, true AS healthy').df().to_dict(orient='records')
print(json.dumps(rows))
" | jq -e '.[0].healthy == true'

# Stage 2: Stamp and execute a self-contained PEP 723 script without a virtualenv
uv add --script parse_feed.py "httpx>=0.27"
uv run -q parse_feed.py
```
