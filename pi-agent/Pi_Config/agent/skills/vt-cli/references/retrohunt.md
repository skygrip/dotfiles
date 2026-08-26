# VirusTotal Enterprise Livehunt & Retrohunt Reference

This guide covers continuous rule monitoring (Livehunt) and petabyte-scale historical searches (Retrohunt) using `vt-cli`.

---

## 1. Livehunt (Continuous YARA Notification Rules)

Livehunt scans every newly submitted sample on VirusTotal against custom YARA rules in real time.

```bash
# List all active Livehunt rulesets
vt hunting ruleset list

# View ruleset details
vt hunting ruleset get <RULESET_ID>

# Create a new Livehunt ruleset
vt hunting ruleset add "<RULESET_NAME>" <YARA_FILE>

# Enable / Disable ruleset
vt hunting ruleset update <RULESET_ID> --enabled true
vt hunting ruleset update <RULESET_ID> --enabled false

# Delete a ruleset
vt hunting ruleset delete <RULESET_ID>
```

---

## 2. Retrohunt (Historical Corpus Search)

Retrohunt runs YARA rules backwards in time against VirusTotal's multi-petabyte repository of historical malware samples.

```bash
# Start a Retrohunt job against historical corpus
vt retrohunt start <YARA_FILE>

# Constrain Retrohunt by date range (saves quota & speeds up execution)
vt retrohunt start <YARA_FILE> --after 2026-01-01 --before 2026-08-01

# List recent Retrohunt jobs and status
vt retrohunt list

# Check progress or details of a specific job
vt retrohunt get <JOB_ID>

# Stream matching sample hashes (identifiers only)
vt retrohunt matches <JOB_ID> -I --limit 50

# Abort a running Retrohunt job
vt retrohunt abort <JOB_ID>
```
