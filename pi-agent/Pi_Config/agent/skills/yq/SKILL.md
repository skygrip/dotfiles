---
name: yq
description: Query, mutate, and convert YAML, TOML, XML, and JSON while preserving comments. Run yq -i .field = VALUE config.yml or yq .spec k8s.yml.
---

# `yq` (Mike Farah Go v4+) Capabilities Reference

High-performance CLI processor for YAML, JSON, TOML, XML, CSV, and Properties. Evaluates expressions in-place while strictly preserving comments, formatting, and YAML anchors.

> **Target Dialect:** Mike Farah `yq` (Go v4+ binary), **not** Python `yq` (`jq` wrapper). Expression syntax and operators differ.

---

## 1. CLI Execution Flags & Format Conversion Matrix

| Flag / Option | Shorthand | Purpose | Syntax Pattern |
| :--- | :--- | :--- | :--- |
| `--inplace` | `-i` | In-place modification of target file | `yq -i '.a.b = "val"' file.yml` |
| `--exit-status` | `-e` | Non-zero exit code if match is null/false or missing | `yq -e '.enabled' config.yml` |
| `--output-format` | `-o` | Output: `yaml`, `json`, `toml`, `xml`, `props`, `csv`, `shell`, `lua`, `base64`, `uri` | `yq -o=shell file.yml` |
| `--input-format` | `-p` | Input: `yaml`, `json`, `toml`, `xml`, `props`, `csv`, `ini`, `hcl`, `base64` | `yq -p=xml -o=json data.xml` |
| `--eval-all` | `ea` | Loads all documents across all files into a single array | `yq ea '.[0] * .[1]' f1.yml f2.yml` |
| `--null-input` | `-n` | Construct documents from scratch without reading file | `yq -n '.name = "app" \| .port = 8080'` |
| `--unwrapScalar` | `-r` | Print unquoted raw scalar strings | `yq -r '.spec.version' deploy.yml` |
| `--no-doc` | `-N` | Omit `---` YAML document separator header | `yq -N '.app' config.yml` |
| `--indent` | `-I` | Set indentation level (default `2`) | `yq -I=4 config.yml` |
| `--front-matter` | | Process or extract markdown front matter (`process`, `extract`) | `yq --front-matter=extract '.title' post.md` |

---

## 2. Expression Operators & Mutation Matrix

| Operator / Function | Syntax Pattern | Behavioral Rule / Capability |
| :--- | :--- | :--- |
| **Assign / Overwrite** | `.path = "val"` | Sets value; creates intermediate map keys automatically. |
| **Env Variable (String)** | `.path = strenv(VAR)` | Injects environment variable safely as string (prevents quote/type bugs). |
| **Env Variable (Typed)** | `.path = env(PORT)` | Injects variable parsing booleans/integers. |
| **Append / Prepend** | `.array += ["item"]`<br/>`.array = ["item"] + .array` | Appends or prepends items to array. |
| **Deep Merge** | `exprA * exprB` | Recursive map merge; right operand values take precedence. |
| **Delete** | `del(.path)`<br/>`del(.array[] \| select(. == "x"))` | Deletes matching keys or array elements. |
| **Key Selection** | `pick(["key1", "key2"])`<br/>`omit(["key1", "key2"])` | Keeps only specified keys or strips specified keys (whitelist/blacklist). |
| **Flatten / Explode** | `flatten`, `explode(.)` | Flattens nested arrays or expands YAML anchors into full structs. |
| **Dynamic Key Lookup** | `.[env(KEY)]` or `.[.var]` | Evaluates expression as dictionary key. |
| **External File Load** | `.target = load("sub.yml")` | Inlines external file dynamically into key. |

---

## 3. Multi-Document, Slicing & Filtering Matrix

| Capability | Syntax Pattern | Behavioral Rule |
| :--- | :--- | :--- |
| **Filter by Value** | `select(.kind == "Deployment")` | Filters nodes matching boolean predicate. |
| **Multi-Doc Stream Filter** | `(select(.kind == "Service") \| .spec.port) = 80` | Targets specific document within a multi-doc (`---`) stream. |
| **Document Index (0-based)** | `select(di == 0)` | Filters by document index within a multi-document file. |
| **File Index (0-based)** | `select(fi == 1)` | Used with `ea` to select specific files from CLI argument list. |
| **Array Slicing** | `.array[1:3]`, `.array[-1]` | Slice sub-ranges or access last element. |
| **Keys & Length** | `keys`, `length` | Returns list of map keys or array/string length. |
| **Existence Check** | `has("key_name")` | Boolean check for key presence in object. |
| **Sort & Unique** | `.tags \|= sort \| .tags \|= unique` | Updates array in-place with sorted / deduplicated elements. |
| **Multi-Doc Splitting** | `yq -s '.metadata.name' k8s.yml` | Splits a multi-doc file into individual files named by expression. |

---

## 4. Comments, Formatting & YAML Anchors Matrix

`yq` preserves formatting, anchors, and comments by default during edits:

| Directive | Syntax Pattern | Effect |
| :--- | :--- | :--- |
| **Line Comment** | `.field line_comment="Comment text"` | Appends `# Comment text` to the right of the field. |
| **Head Comment** | `.section head_comment="Header note"` | Inserts `# Header note` directly above the section. |
| **Foot Comment** | `.field foot_comment="Trailing note"` | Inserts comment below the node. |
| **Clear Comments** | `.field line_comment=""` | Strips comments from specified field. |
| **Style Directives** | `.field style="double"`<br/>`.field style="literal"` | Enforces quoting (`"double"`, `'single'`) or literal block scalar (`\|`, `>`). |
| **Anchors & Aliases** | `.node anchor="my_anchor"`<br/>`.alias = alias("my_anchor")` | Programmatically creates YAML `&anchor` definitions and `*alias` references. |

---

## 5. High-Leverage Composite Examples

```bash
# 1. In-place config update with environment variable injection and comment preservation
APP_VERSION="2.4.0" yq -i '
  .version = strenv(APP_VERSION) |
  .build.timestamp = now |
  .version line_comment = "CI auto-bump"
' config.yml

# 2. Deep-merge multiple configuration files (override.yml takes precedence over base.yml)
yq eval-all 'select(fi == 0) * select(fi == 1)' base.yml override.yml

# 3. Target and mutate a specific container inside a multi-document Kubernetes stream
yq -i '
  (select(.kind == "Deployment") | 
   .spec.template.spec.containers[] | 
   select(.name == "web-api")).image = "ghcr.io/org/web:v2.5.0"
' manifests.yml
```

