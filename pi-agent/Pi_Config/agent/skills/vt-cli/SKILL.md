---
name: vt-cli
description: Query VirusTotal Enterprise/Pro for threat intelligence, hash lookups, IOC reputation, sandbox reports, and hunting pivots (e.g. vt file HASH, vt domain DOMAIN, vt search QUERY).
---

# VirusTotal CLI (`vt-cli`) Capabilities Reference

Automated threat intelligence, file hash reputation, C2 network infrastructure analysis, Livehunt YARA monitoring, and Retrohunt historical corpus mining using the official VirusTotal CLI (`vt`).

---

## 1. Execution Primitives, Fast-Paths & Circuit Breakers

| Primitive / Fast-Path / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **`uv run scripts/vt_summary.py`** | Manual CLI parsing floods context with thousands of lines | Primary fast-path: `uv run scripts/vt_summary.py SHA256` for 15-line triage JSON |
| **Interactive Shell Hang** | Invoking `vt init` prompts for interactive STDIN in subshells | Export API key: `export VTCLI_APIKEY="API_KEY"` (or set `$env:VTCLI_APIKEY="API_KEY"`) |
| **OpSec Upload Leak** | Running file upload commands on confidential code uploads binaries publicly | Compute SHA256 locally first; query existing reputation via `vt file SHA256` |
| **UK Spelling Trap** | The VirusTotal API rejects US spelling for sandbox behaviors | Always use UK spelling for behavioral endpoints: `vt file behaviours HASH` |
| **Quota Exhaustion Fallback** | Rapid searches exhaust hourly API quota | If quota error occurs, inspect allowances: `vt user current -i id,quotas --format json` |

---

## 2. Core Objects & Infrastructure Analysis Matrix

| Target Entity | CLI Command | Key Inspection Flags | Capabilities & Output Data |
| :--- | :--- | :--- | :--- |
| **File Hash** | `vt file SHA256` | `-i id,meaningful_name,type_description,last_analysis_stats` | AV detection score, threat classification, ImpHash, compilation time. |
| **Domain** | `vt domain DOMAIN` | `-i registrar,categories,last_analysis_stats` | Domain reputation, categorization, DNS history. |
| **IP Address** | `vt ip IP_ADDR` | `-i as_owner,country,last_analysis_stats` | Autonomous System (ASN), country, malicious reputation. |
| **URL Scan** | `vt scan url "URL"` | `--wait` | Submits URL for live crawler analysis and threat verdict. |
| **File Download** | `vt download HASH -o DIR` | `-o DIR` | Downloads binary sample to isolated quarantine directory. |
| **User Quota** | `vt user current` | `-i id,quotas --format json` | Pre-flight check for hourly/monthly API limits. |

---

## 3. Relationship Graphs & Hunting Capabilities Matrix

| Domain | Subcommand / Operation | Target Flags | Capabilities & Behavior |
| :--- | :--- | :--- | :--- |
| **File Graph** | `vt file contacted_ips HASH` | `-I --limit 25` | Returns C2 IP addresses contacted by binary in sandbox. |
| | `vt file contacted_domains HASH`| `-I --limit 25` | Returns contacted domain names and beacons. |
| | `vt file dropped_files HASH` | `-I --limit 25` | Returns secondary payloads and dropped artifacts. |
| | `vt file behaviours HASH` | `--format json` | Full behavioral sandbox execution reports (UK spelling). |
| **Network Pivot** | `vt ip communicating_files IP_ADDR` | `-I --limit 25` | Pivots to all malware samples communicating with target IP. |
| | `vt domain resolutions DOMAIN` | `--format json` | Passive DNS historical IP resolution records. |
| **Threat Intel** | `vt threatprofile ACTOR` | `--format json` | Threat actor and APT campaign profiles. |
| | `vt iocstream list` | `--limit 50` | Real-time subscription feeds for newly identified IoCs. |
| **Livehunt** | `vt hunting ruleset list` | None | Lists real-time continuous YARA monitoring rulesets. |
| | `vt hunting ruleset create` | `--name "NAME" --rules @rule.yar` | Creates and deploys automated live YARA rule. |
| **Retrohunt** | `vt retrohunt start` | `--rules=@rule.yar --from 2026-01-01` | Runs YARA retroactively across historical corpus. |
| | `vt retrohunt matches JOB_ID` | `-I --limit 50` | Streams matching sample hashes from historical hunt. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Fast-path triage using bundled helper script with JSON verification
uv run scripts/vt_summary.py e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | jq '.stats'

# Stage 2: Intelligence search & relationship pivot: find signed PE executables contacting C2
MALWARE_HASHES=$(vt search 'type:peexe tag:signed net_communication:"198.51.100.23"' -I --limit 5)
for hash in $MALWARE_HASHES; do
  vt file contacted_domains "$hash" -I --limit 10
done

# Stage 3: Constrained Retrohunt job with hash matching stream
JOB_ID=$(vt retrohunt start --rules=@apt_backdoor.yar --from 2026-01-01 --to 2026-08-01 --format json | jq -r '.id')
vt retrohunt matches "$JOB_ID" -I --limit 50
```
