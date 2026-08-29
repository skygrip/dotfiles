---
name: vt-cli
description: Query VirusTotal Enterprise/Pro for threat intelligence, hash lookups, IOC validation, sandbox reports, and search pivots using 'vt-cli'.
---

# VirusTotal CLI (`vt-cli`) Capabilities Reference

Automated threat intelligence, file hash reputation, C2 network infrastructure analysis, Livehunt YARA monitoring, and Retrohunt historical corpus mining using the official VirusTotal CLI (`vt`).

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`vt-cli` (`vt`)** | Official VirusTotal CLI for querying hashes, IPs, domains, sandbox behaviors, and YARA hunting |
| **`scripts/vt_summary.py`**| Bundled Python fast-path helper emitting a token-bounded 15-line JSON triage summary |

---

## 2. Negative Guardrails & OpSec Safety

| Hallucination / Mistake | Why It Fails | Correct Protocol / Syntax |
| :--- | :--- | :--- |
| `vt init` in automated shells | Prompts for interactive STDIN (hangs headless subshell) | Export `VTCLI_APIKEY="<KEY>"` or pass `--apikey="<KEY>"` |
| `vt scan file <PATH>` on private code | Uploads raw physical files to public VT corpus (OpSec leak) | Hash-first: compute SHA256 locally, then query `vt file <SHA256>` |
| `vt scan <HASH>` | `scan` is strictly for uploading new data, not querying | Use `vt file <SHA256>` for hash metadata |
| `vt file behaviors <HASH>` | VT API enforces UK spelling | Use `vt file behaviours <HASH>` |
| Unbounded `vt search` | Floods context window and exhausts API quota | Always append `-I` (`--ids-only`) and `--limit 20` |
| `vt file <HASH> --download` | Download is a distinct top-level command | Use `vt download <HASH> -o <DIR>` |

---

## 3. Core Objects & Infrastructure Analysis Matrix

| Target Entity | CLI Command | Key Inspection Flags | Capabilities & Output Data |
| :--- | :--- | :--- | :--- |
| **File Hash** | `vt file <SHA256>` | `-i id,meaningful_name,type_description,last_analysis_stats` | AV detection score, threat classification, ImpHash, compilation time. |
| **File Scan** | `vt scan file <PATH>` | `-r` (recursive), `--wait` | Submits file to multi-engine sandbox scanners (OpSec: verify policy). |
| **Domain** | `vt domain <DOMAIN>` | `-i registrar,categories,last_analysis_stats` | Domain reputation, categorization, DNS history. |
| **IP Address** | `vt ip <IP>` | `-i as_owner,country,last_analysis_stats` | Autonomous System (ASN), country, malicious reputation. |
| **URL Submission**| `vt scan url "<URL>"` | `--wait` | Submits URL for live crawler analysis and threat verdict. |
| **Quota Check** | `vt user current` | `-i id,quotas --format json` | Pre-flight check for hourly/monthly API limits. |

---

## 4. Relationship Graphs & Hunting Capabilities Matrix

| Domain | Subcommand / Operation | Target Flags | Capabilities & Behavior |
| :--- | :--- | :--- | :--- |
| **File Graph** | `vt file contacted_ips <HASH>` | `-I --limit 25` | Returns C2 IP addresses contacted by binary in sandbox. |
| | `vt file contacted_domains <HASH>`| `-I --limit 25` | Returns contacted domain names and beacons. |
| | `vt file dropped_files <HASH>` | `-I --limit 25` | Returns secondary payloads and dropped artifacts. |
| | `vt file behaviours <HASH>` | `--format json` | Full behavioral sandbox execution reports (UK spelling). |
| **Network Pivot**| `vt ip communicating_files <IP>` | `-I --limit 25` | Pivots to all malware samples communicating with target IP. |
| | `vt domain resolutions <DOMAIN>` | `--format json` | Passive DNS historical IP resolution records. |
| **Threat Intel** | `vt threatprofile <ACTOR>` | `--format json` | Threat actor and APT campaign profiles. |
| | `vt iocstream list` | `--limit 50` | Real-time subscription feeds for newly identified IoCs. |
| | `vt collection get <ID>` | `--format json` | Curated security research threat collections. |
| **Livehunt** | `vt hunting ruleset list` | None | Lists real-time continuous YARA monitoring rulesets. |
| | `vt hunting ruleset create` | `--name "..." --rules @rule.yar` | Creates and deploys automated live YARA rule. |
| | `vt hunting notification list` | `--limit 50` | Streams matched alerts from deployed Livehunt rules. |
| **Retrohunt** | `vt retrohunt start` | `--rules=@rule.yar --from 2026-01-01` | Runs YARA retroactively across petabytes of historical corpus. |
| | `vt retrohunt matches <JOB_ID>` | `-I --limit 100` | Streams matching sample hashes from historical hunt. |

---

## 5. Output Formatting & Field Filtering Matrix

| Flag / Option | Shorthand | Purpose & Capabilities |
| :--- | :--- | :--- |
| `--format <fmt>` | | Formats output as `json`, `yaml` (default), `csv`, or `table`. |
| `--include <fields>` | `-i` | Comma-separated list of attributes (e.g. `-i id,last_analysis_stats,names`). |
| `--exclude <fields>` | `-x` | Strips verbose nested attributes (e.g. `-x last_analysis_results`). |
| `--identifiers-only` | `-I` | Prints raw identifiers only (one per line, ideal for Unix pipes). |
| `--limit <N>` | `-n` | Restricts maximum number of returned items. |

---

## 6. High-Leverage Composite Examples

```bash
# 1. Deterministic triage using bundled helper (token-bounded JSON summary)
python scripts/vt_summary.py <SHA256>

# 2. Intelligence search & relationship pivot: find signed PE executables contacting C2
MALWARE_HASHES=$(vt search 'type:peexe tag:signed net_communication:"198.51.100.23"' -I --limit 5)
for hash in $MALWARE_HASHES; do
  vt file contacted_domains "$hash" -I --limit 10
done

# 3. Constrained Retrohunt job with hash matching stream
JOB_ID=$(vt retrohunt start --rules=@apt_backdoor.yar --from 2026-01-01 --to 2026-08-01 --format json | jq -r '.id')
vt retrohunt matches "$JOB_ID" -I --limit 50
```
