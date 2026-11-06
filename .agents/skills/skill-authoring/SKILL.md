---
name: skill-authoring
description: Create, audit, and refactor agent SKILL.md files, references/, and scripts/ for 12B SLMs and frontier models using Primacy-Matrix-Recency layout and XML-safe frontmatter.
---

# Agent Skill Authoring & Architecture Blueprint

Standardized architecture for authoring, auditing, and refactoring `SKILL.md` files that execute reliably across both small local models (e.g. Gemma 4 12B, Qwen) and frontier models.

---

## 1. Scope Gate & Primacy Guardrails

Before creating a skill, verify it passes the **Skill Scope Gate**:
- **Do NOT create skills for:** harness self-documentation (already in `<docs>`), generic planning/workflow ceremony, or bulk LLM loops better handled by `ast-grep`, `pi-subagents`, or a 30-line `uv run` script.
- **DO create skills for:** specialized CLIs with non-obvious flags (`ck --threshold 0.02`, `docling --no-ocr`), domain forensics/triage pipelines (`pe-malware-triage`, `log-analysis`), or strict DSLs (`openscad`, `image-prompt-builder`).

Structure every `SKILL.md` using the **Primacy–Matrix–Recency** layout (Guards & Fast-Paths $\rightarrow$ Compact Flag/Capability Matrices $\rightarrow$ Executable Composite Examples):

| Dimension | Operational Trap & Why It Fails | Required Affirmative Rule & Syntax |
| :--- | :--- | :--- |
| **Empirical Flag Verification** | Hallucinated CLI flags or subcommands get copied verbatim by the model and fail at runtime. | Run `<tool> --help` to verify every flag and subcommand before adding it to `SKILL.md` or `scripts/`. |
| **Induction-Head Safety** | Including broken code snippets or anti-pattern examples in backticks causes 12B induction heads to copy them into tool calls. | Describe traps in plain English prose; ensure **100% of backticked spans are valid, executable syntax**. |
| **Skill Script Paths** | Bare relative script paths fail with `FileNotFoundError` because `bash` executes in `<cwd>`, not the skill directory. | Always use `~/.pi/agent/skills/<skill-name>/scripts/tool.py` in all tables and examples. |
| **Zero Mermaid / Fake Reports** | Mermaid flowcharts and hardcoded Markdown report templates waste 30–50 lines per skill on human theater and rigid boilerplate. | **Never use Mermaid blocks or fake output report schemas** in `SKILL.md` or `references/`. Use compact Markdown tables. |
| **Frontmatter XML Hygiene** | Quotes, angle brackets, ampersands, or colons with spaces in `description` trigger XML escaping or YAML parse errors. | Write clean unquoted single-line `description` strings with action verbs, extensions, and literal CLI examples. |
| **Split Placeholders** | Using dummy words (`foo`, `bar`) inside bottom examples causes 12B literal echoing. | Use uppercase tokens (`FILE`, `LANG`) in tables, and **realistic paths** (`'logs/events.parquet'`, `suspect.exe`) in examples. |
| **Table Geometry** | Wide 7+ column tables or 50-row tables cause horizontal token-alignment drift in 12B models. | Cap Markdown tables at **$\le 4$ columns** and **$\le 15$ rows** per table. |
| **Positive Circuit Breakers** | Leaving error recovery implicit causes models to repeat failing commands in an infinite loop. | Frame recovery positively: *"If command X exits with an error, immediately switch to command Y."* |
| **Headless & Output Bounds** | Interactive TUIs/pagers hang subshells; unbounded queries or ANSI codes flood context windows. | Enforce headless/bounded flags (`-bail`, `-q`, `--no-color`, `GH_PAGER=""`, `LIMIT 25`, `head -n 25`). |
| **Cross-Platform CLI Hygiene** | Legacy `grep` or `find` examples contradict global `AGENTS.md` / `APPEND_SYSTEM.md` rules. | Always use `rg`, `fd`, `jq`, `yq`, `mlr`, `duckdb`, and `uv run` in all skill examples. |

---

## 2. Directory Layout & Skill Archetype Matrices

### Progressive Disclosure Directory Matrix

| Skill Path | Status | Token Budget & Progressive Disclosure Rule |
| :--- | :--- | :--- |
| `SKILL.md` | **Required** | Target **55–100 lines**. Co-locate core circuit breakers, flag matrices, and 2–3 composite examples. |
| `scripts/` | Optional | **Zero context cost until executed.** Bundle deterministic Python helpers (with PEP 723 `# /// script` headers) and reference via `~/.pi/agent/skills/<name>/scripts/...`. |
| `references/` | Optional | **Loaded on demand.** Offload deep vendor schemas or engine-specific playbooks (`references/okta_logs.md`). Link using valid relative paths without fragile header anchors. |

*(Do not store test harnesses, benchmark datasets, or `__pycache__` inside the synced skill directory.)*

### 4 Skill Archetype Blueprints

| Archetype | Target Skills | Required Section Progression | Recency Zone Deliverable |
| :--- | :--- | :--- | :--- |
| **1. CLI Tools & Query Engines** | `uv`, `duckdb`, `yq`, `mlr`, `ast-grep`, `gh`, `snyk`, `semgrep`, `secret-scanning`, `vt-cli`, `docling`, `ck` | `1. Execution Primitives & Circuit Breakers` $\rightarrow$ `2. Formats / Capabilities Matrix` $\rightarrow$ `3. Dialect & Flags Matrix` $\rightarrow$ `4. High-Leverage Composite Examples` | 2–3 bounded headless pipelines ending with a 1-line verification check (`jq`, `wc -l`, row count). |
| **2. Forensics & Triage Funnels** | `pe-malware-triage`, `doc-malware-triage`, `pii-detection`, `log-analysis` | `1. Toolchain, Quarantine & Circuit Breakers` $\rightarrow$ `2. Investigation Funnel Matrix` $\rightarrow$ `3. Tool Flag / Source Matrix` $\rightarrow$ `4. High-Leverage Composite Triage Examples` | Example 1 = `~/.pi/agent/skills/<name>/scripts/...` fast-path; Examples 2–3 = staged triage commands. |
| **3. Declarative DSL Compilers** | `openscad` | `1. Headless Compiler, Guardrails & Render Matrix` $\rightarrow$ `2. Core DSL & Attachment Matrix` $\rightarrow$ `3. Parametric Recipes & Verification` | Idiomatic parametric code block followed by headless render + verification. |
| **4. Generative Prompt Staging** | `image-prompt-builder` | `1. Quality Guardrails & Engine Modifiers` $\rightarrow$ `2. Optical Staging Matrix` $\rightarrow$ `3. FACS / Subject Matrix` $\rightarrow$ `4. Exemplar Composite Prompt Stacks` | 3–4 production-grade prompts across target model architectures. |

---

## 3. Canonical `SKILL.md` Skeleton & Verification

### Example 1: Canonical `SKILL.md` Skeleton

````markdown
---
name: tool-name
description: Action-oriented summary with file extensions and literal flags (e.g. tool-cli --json --bail FILE).
---

# Tool Name & 1-Sentence Operational Scope

## 1. Execution Primitives, Fast-Paths & Circuit Breakers

| Primitive / Fast-Path / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| `uv run ~/.pi/agent/skills/tool-name/scripts/fast_summary.py` | Manual multi-step parsing floods context | Primary fast-path: `uv run ~/.pi/agent/skills/tool-name/scripts/fast_summary.py FILE` |
| **Interactive Shell Hang** | Bare `tool-cli` opens interactive TUI | Always execute headlessly with `tool-cli --json --bail FILE` |
| **Corrupt Input Circuit Breaker** | Malformed records abort default parser | If exit code != 0, switch to `tool-cli --salvage FILE` |

## 2. Capability & Flag Matrix

| Flag / Subcommand | Parameters / Syntax | Behavioral Rule / Purpose |
| :--- | :--- | :--- |
| `--json` | NDJSON stream | Emits line-delimited JSON for `jq` or `duckdb` ingestion. |
| `--limit` | Integer (e.g. `25`) | Bounds returned rows to prevent context flooding. |

## 3. High-Leverage Composite Examples

```bash
# Stage 1: Fast summary using bundled helper script
uv run ~/.pi/agent/skills/tool-name/scripts/fast_summary.py logs/auth_2026.jsonl | jq '{status, count}'

# Stage 2: Filtered extraction with bounded output and count verification
tool-cli --json --bail -p "status >= 500" --limit 25 logs/auth_2026.jsonl > errors.jsonl
wc -l errors.jsonl
```
````

### Example 2: Deterministic Skill Audit & Verification Checkpoint

```bash
# Verify XML-clean frontmatter description, zero Mermaid blocks, zero relative scripts/ calls, and zero box chars
uv run -q --no-project python -c "
import pathlib, re, sys
p = pathlib.Path('dotfiles/.agents/skills/skill-authoring/SKILL.md')
txt = p.read_text(encoding='utf-8')
desc = re.search(r'^description:\s*(.+)$', txt, re.M).group(1)
bad_xml = re.findall(r'[\x22\x27<>&]|:\s', desc)
bad_box = re.findall(r'[\u2500-\u257f]', txt)
mermaid = re.findall(r'^\`\`\`mermaid', txt, re.M)
print(f'XML-unsafe: {bad_xml} | Box chars: {len(bad_box)} | Mermaid blocks: {len(mermaid)}')
sys.exit(1 if bad_xml or bad_box or mermaid else 0)
"
```
