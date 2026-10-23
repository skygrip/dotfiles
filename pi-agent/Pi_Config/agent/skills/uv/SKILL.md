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

## 2. Command & Execution Modes Matrix

| Execution Mode | Subcommand / Flags | Syntax Pattern | Capabilities & Behavioral Rules |
| :--- | :--- | :--- | :--- |
| **Standard Script / One-Liner** | `uv run` | `uv run python -c "CODE"` | Runs Python inside the project `.venv` (or ephemeral managed interpreter if outside a project). |
| **Ephemeral Dependency Run** | `uv run --with PKG` | `uv run --with pandas,scipy SCRIPT` | Creates cached temporary venv with requested packages, executes script, and leaves zero disk mess. |
| **PEP 723 Self-Contained Script**| `uv run SCRIPT` | `uv run SCRIPT` | Parses inline `# /// script` header block and provisions exact dependencies automatically. |
| **Test & Linter Execution** | `uv run` / `uvx` | `uv run pytest -q`, `uvx ruff check .` | Runs test suites inside project `.venv` or standalone linters/formatters in isolated tool sandboxes. |
| **Project Workspace** | `uv init`, `uv add` | `uv init DIR`, `uv add httpx` | Initializes `pyproject.toml` and updates `uv.lock` and `.venv` atomically. |
| **Environment Sync** | `uv sync` | `uv sync --all-extras` | Reconciles local `.venv` with exact locked versions in `uv.lock`. |
| **Pip Drop-In Compatibility** | `uv pip` | `uv pip compile reqs.in -o reqs.txt` | High-speed drop-in replacement for legacy `pip` and `pip-tools` workflows when required. |
| **Offline / Reproducible Run** | `--offline`, `--frozen` | `uv run --frozen --offline SCRIPT` | Disables network calls and runs strictly from local wheel cache and existing lockfile. |

---

## 3. PEP 723 Script Metadata & Environment Matrix

For standalone utility scripts (`scripts/*.py` or scratch tools), embed a PEP 723 inline metadata block at the top of the file so `uv run script.py` resolves dependencies automatically without a `requirements.txt`:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "httpx>=0.27",
#     "rich",
# ]
# ///
import httpx
from rich import print
```

| Configuration | Flag / Subcommand | Options / Syntax | Purpose / Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **Stamp Inline Metadata** | `uv add --script` | `uv add --script SCRIPT PKG` | Programmatically inserts or updates the PEP 723 `# /// script` block inside a `.py` file. |
| **On-the-Fly Injection** | `--with` | Comma-separated or repeated | Injects packages for a single invocation: `uv run --with "duckdb>=1.0" --with polars SCRIPT`. |
| **Isolated From Project** | `--no-project` | Boolean flag | Ignores the current directory's `pyproject.toml` when running an unrelated scratch script. |
| **Target Interpreter** | `--python` | Version (`3.12`, `3.13`) | Downloads and executes under the specified Python version: `uv run --python 3.12 SCRIPT`. |
| **Selective Lock Upgrade** | `--upgrade-package` | `uv lock --upgrade-package PKG` | Upgrades a single package in `uv.lock` without disturbing the rest of the dependency graph. |
| **Cache Maintenance** | `uv cache prune` | `uv cache prune` | Removes unused wheels and pre-built environments while keeping active caches hot. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Default Python one-liner with ephemeral dependency injection and quiet stdout piping
uv run -q --no-project --with duckdb,polars python -c "
import duckdb, json
rows = duckdb.sql('SELECT 42 AS metric, true AS healthy').df().to_dict(orient='records')
print(json.dumps(rows))
" | jq -e '.[0].healthy == true'

# Stage 2: Create and execute a self-contained PEP 723 script without a virtualenv
cat << 'EOF' > parse_feed.py
import httpx
print("HTTPX loaded successfully:", httpx.__version__)
EOF
uv add --script parse_feed.py "httpx>=0.27"
uv run -q parse_feed.py

# Stage 3: Project workspace initialization, dependency locking, and test verification
uv init data-service
cd data-service
uv add pydantic httpx
uv add --dev pytest
uv run pytest --version
```
