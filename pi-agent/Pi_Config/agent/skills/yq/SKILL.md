---
name: yq
description: Default tool to query, mutate in-place, and convert YAML, TOML, XML, and JSON config files while preserving comments (e.g. yq .FIELD FILE.yml, yq -i .FIELD = VAL FILE.yml).
---

# `yq` (Mike Farah Go v4+) Capabilities Reference

High-performance CLI processor for YAML, JSON, TOML, XML, CSV, and Properties. Evaluates expressions in-place while strictly preserving comments, formatting, and YAML anchors.

> **Target Dialect:** Mike Farah `yq` (Go v4+ binary), **not** Python `yq` (`jq` wrapper). Expression syntax and operators differ.

---

## 1. Execution Primitives & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **ANSI Color Pollution** | Terminal escapes in stdout corrupt agent JSON parsing | Always pass `-M` (or `--no-colors`) when parsing programmatically |
| **Silent Missing Key Null** | Querying a missing key exits 0 and prints null | Always pass `-e` (or `--exit-status`) to trigger exit code 1 on null/missing keys |
| **Destructive In-Place Edit** | Writing `-i` with a broken expression truncates the file to empty | If uncertain, test with `yq -e 'EXPR' FILE` before executing `yq -i 'EXPR' FILE` |
| **Shell Quote Interpolation** | Double quotes in shell expressions expand `$VAR` unexpectedly | Wrap expressions in single quotes: `' .a.b = strenv(VAR) '` |
| **Type Ingestion Drift** | Plain `env(VAR)` attempts YAML type coercion | Use `strenv(VAR)` for literal strings, and `env(VAR)` for booleans or integers |

---

## 2. CLI Execution Flags & Format Conversion Matrix

| Flag / Option | Shorthand | Purpose | Syntax Pattern |
| :--- | :--- | :--- | :--- |
| `--inplace` | `-i` | In-place modification of target file | `yq -i '.a.b = "val"' file.yml` |
| `--exit-status` | `-e` | Non-zero exit code if match is null/false or missing | `yq -e '.enabled' config.yml` |
| `--output-format` | `-o` | Output: `yaml`, `json`, `toml`, `xml`, `props`, `csv`, `shell` | `yq -o=json file.yml` |
| `--input-format` | `-p` | Input: `yaml`, `json`, `toml`, `xml`, `props`, `csv`, `ini`, `hcl` | `yq -p=xml -o=json data.xml` |
| `--eval-all` | `ea` | Loads all documents across all files into a single array | `yq ea '.[0] * .[1]' f1.yml f2.yml` |
| `--null-input` | `-n` | Construct documents from scratch without reading file | `yq -n '.name = "app", .port = 8080'` |
| `--unwrapScalar` | `-r` | Print unquoted raw scalar strings | `yq -r '.spec.version' deploy.yml` |
| `--no-doc` | `-N` | Omit `---` YAML document separator header | `yq -N '.app' config.yml` |
| `--indent` | `-I` | Set indentation level (default `2`) | `yq -I=4 config.yml` |

---

## 3. Dialect, Operators & Mutation Matrix

| Capability | Syntax Pattern | Behavioral Rule / Purpose |
| :--- | :--- | :--- |
| **Assign / Overwrite** | `.path = "val"` | Sets value; creates intermediate map keys automatically. |
| **Env Injection (Safe)** | `.path = strenv(VAR)` | Injects environment variable safely as string (prevents quote/type bugs). |
| **Append to Array** | `.array += ["item"]` | Appends elements to array. |
| **Deep Merge** | `exprA * exprB` | Recursive map merge; right operand values take precedence. |
| **Delete Key or Item** | `del(.path)`, `del(.array[] | select(. == "x"))` | Deletes matching keys or filtered array elements. |
| **Pick & Omit** | `pick(["k1", "k2"])`, `omit(["k1"])` | Whitelists or blacklists specified keys. |
| **Document Filter** | `(select(.kind == "Service") | .spec.port) = 80` | Targets specific document within a multi-doc (`---`) stream. |
| **File Index (ea)** | `select(fi == 1)` | Used with `ea` to target specific files from CLI argument list. |
| **Comments & Anchors** | `.field line_comment = "note"` | Appends inline comment `# note` preserving YAML formatting. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: In-place config update with environment variable injection and verification
APP_VERSION="2.4.0" yq -i '
  .version = strenv(APP_VERSION) |
  .build.timestamp = now |
  .version line_comment = "CI auto-bump"
' config.yml
yq -e '.version' config.yml

# Stage 2: Deep-merge multiple configuration files (override.yml takes precedence over base.yml)
yq eval-all 'select(fi == 0) * select(fi == 1)' base.yml override.yml

# Stage 3: Target and mutate a specific container inside a multi-document Kubernetes stream
yq -i '
  (select(.kind == "Deployment") | 
   .spec.template.spec.containers[] | 
   select(.name == "web-api")).image = "ghcr.io/org/web:v2.5.0"
' manifests.yml
```
