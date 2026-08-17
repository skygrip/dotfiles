---
name: yq
description: Query, mutate, and convert YAML, TOML, XML, CSV, and JSON files while preserving comments and anchors (Mike Farah Go version). Use 'yq -i ".field = \"val\"" config.yml' for in-place edits or 'yq ".spec" k8s.yml'.
---

# `yq` (Mike Farah Go) Skill

`yq` is a portable command-line data processor for YAML, JSON, TOML, XML, CSV, and Properties. It evaluates expressions on structured documents while strictly preserving comments, formatting, and YAML anchors.

> **Note**: This skill targets **Mike Farah's `yq` (Go v4+)**, not the Python `yq` (Andrey Kislyuk's `jq` wrapper). Flags and expression syntax differ significantly.

---

## Essential Flags

| Flag | Purpose | Example |
| :--- | :--- | :--- |
| `-i`, `--inplace` | Modify target file in-place | `yq -i '.version = "1.2.0"' config.yml` |
| `-o`, `--output-format` | Output format (`yaml`, `json`, `toml`, `xml`, `props`, `csv`, `lua`) | `yq -o=json config.yml` |
| `-p`, `--input-format` | Input format (`yaml`, `json`, `toml`, `xml`, `props`, `csv`, `ini`) | `yq -p=xml -o=json data.xml` |
| `-n`, `--null-input` | Create documents from scratch without reading file | `yq -n '.name = "app" \| .port = 8080'` |
| `-r`, `--unwrapScalar` | Print unquoted scalar values (default for yaml) | `yq -r '.spec.replicas' deploy.yml` |
| `-N`, `--no-doc` | Omit `---` document separator header | `yq -N '.app' config.yml` |
| `-I`, `--indent` | Control indentation level (default `2`) | `yq -I=4 config.yml` |
| `ea`, `eval-all` | Load all documents across all files at once | `yq ea '.[0] * .[1]' f1.yml f2.yml` |

---

## Practical Recipes

### 1. In-Place Configuration Updates (`-i`)
Update values safely without stripping existing comments or anchors:

```bash
# Update simple key
yq -i '.app.name = "my-service"' config.yaml

# Inject environment variables safely (prevents quote/escaping bugs)
NEW_IMAGE="ghcr.io/org/web:2.4.1" yq -i '.image = strenv(NEW_IMAGE)' config.yaml

# Set numeric or boolean env vars
PORT=8080 yq -i '.server.port = env(PORT)' config.yaml
```

---

### 2. Docker Compose Manipulation

```bash
# Update a service image tag
yq -i '.services.web.image = "node:20-alpine"' docker-compose.yml

# Append environment variable to a list
yq -i '.services.web.environment += ["NODE_ENV=production"]' docker-compose.yml

# Update or add environment variable in an object/map
yq -i '.services.web.environment.DEBUG = "0"' docker-compose.yml

# Update port mapping
yq -i '.services.web.ports[0] = "8080:80"' docker-compose.yml

# Add a new service definition
yq -i '.services.redis = {"image": "redis:7-alpine", "restart": "always"}' docker-compose.yml
```

---

### 3. Kubernetes & Multi-Document Manifests

Multi-document YAML files (separated by `---`) are processed document-by-document by default.

```bash
# Query specific resource kind across multi-document stream
yq 'select(.kind == "Deployment")' manifests.yaml

# Update container image by container name in a Deployment
yq -i '(.spec.template.spec.containers[] | select(.name == "api")).image = "registry/api:v1.5"' deployment.yaml

# Update replica count across all Deployments in a multi-doc file
yq -i '(select(.kind == "Deployment") | .spec.replicas) = 3' manifests.yaml

# Target document by 0-indexed document index (di)
yq 'select(di == 0)' manifests.yaml

# Extract all ConfigMap names
yq 'select(.kind == "ConfigMap") | .metadata.name' manifests.yaml
```

---

### 4. TOML Manipulation (`pyproject.toml`, `Cargo.toml`)

`yq` auto-detects `.toml` extensions based on filename:

```bash
# Bump project version in pyproject.toml
yq -i '.project.version = "1.5.0"' pyproject.toml

# Update a Poetry dependency
yq -i '.tool.poetry.dependencies.requests = "^2.32.0"' pyproject.toml

# Add new dependency to Cargo.toml
yq -i '.dependencies.serde = { version = "1.0", features = ["derive"] }' Cargo.toml

# Convert TOML to JSON for shell inspection
yq -o=json pyproject.toml
```

---

### 5. Array Manipulation

```bash
# Append item(s) to array
yq -i '.allowed_hosts += ["api.internal"]' config.yml

# Prepend item to array
yq -i '.plugins = ["auth"] + .plugins' config.yml

# Update item matching a filter
yq -i '(.users[] | select(.name == "admin")).role = "superadmin"' config.yml

# Delete array elements matching a filter
yq -i 'del(.users[] | select(.status == "inactive"))' config.yml

# Sort array and remove duplicates
yq -i '.tags |= sort | .tags |= unique' config.yml

# Extract array of object attributes
yq '[.services[].image]' docker-compose.yml
```

---

### 6. Deep Merging Files (`eval-all` / `ea`)

Use `ea` with the `*` operator to overlay files:

```bash
# Merge override.yml onto base.yml (override values take precedence)
yq eval-all 'select(fi == 0) * select(fi == 1)' base.yml override.yml

# Merge N files in sequence
yq ea '. as $item ireduce ({}; . * $item)' base.yml staging.yml secrets.yml

# Dynamically load and inject external file into a key
yq -i '.shared = load("shared-config.yml")' config.yml
```

---

### 7. Format Conversions

```bash
# YAML to JSON (formatted or compact)
yq -o=json config.yaml
yq -o=json -I=0 config.yaml

# JSON to YAML
yq -p=json -o=yaml payload.json

# XML to JSON
yq -p=xml -o=json manifest.xml

# Properties / .env to YAML
yq -p=props env.properties

# YAML to Properties / .env
yq -o=props config.yaml
```

---

### 8. Managing Comments & Anchors

`yq` preserves YAML comments and anchors automatically. You can also inspect or inject comments programmatically:

```bash
# Add line comment to a specific field
yq -i '.db.port line_comment="PostgreSQL default port"' config.yml

# Add head comment above a section
yq -i '.db head_comment="Database Configuration"' config.yml

# Anchors (&anchor) and Aliases (*alias) are preserved on write without expanding
yq -i '.defaults.timeout = 30' config-with-anchors.yml
```
