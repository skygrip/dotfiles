---
name: gh
description: GitHub CLI for PRs, issues, Actions CI workflows, releases, and raw GraphQL/REST queries. Use 'gh pr diff', 'gh run view --log-failed', 'gh issue list --json', or 'gh api'.
---

# GitHub CLI (`gh`) Capabilities Reference

Non-interactive GitHub CLI for inspecting repositories, reviewing pull requests, triaging failed CI workflows, managing issues, and querying REST/GraphQL APIs headlessly.

---

## 1. Programs Used

| Program / Tool | Role / Purpose |
| :--- | :--- |
| **`gh`** | Official GitHub command-line interface for GitHub REST/GraphQL and resource operations |

---

## 2. Negative Guardrails & Headless Execution Safety

Small models frequently trigger interactive prompts or fail on ambiguous repos:

| Hallucination / Mistake | Why It Fails | Correct Syntax |
| :--- | :--- | :--- |
| `gh pr create` without args | Triggers interactive TUI prompt (hangs subshell) | Always pass `--title "..." --body "..."` or `--fill` |
| `gh run view` on failing job | Dumps massive thousands-line logs | Use `gh run view <ID> --log-failed` for root-cause lines |
| Running outside repo root | Cannot detect git origin | Explicitly pass `-R <owner>/<repo>` or `--repo <owner>/<repo>` |
| Unbounded list queries | Floods agent context window | Always append `--limit 10` or `--limit 25` |
| `gh auth login` in script | Hangs on interactive OAuth browser flow | Require pre-existing auth; check with `gh auth status` |

---

## 3. Core Resource & Command Capabilities Matrix

| Resource | Operation / Subcommand | Key Flags & Parameters | Capabilities & Behavior |
| :--- | :--- | :--- | :--- |
| **CI Actions** | `gh run list` | `--workflow=ci.yml`, `--branch=main`, `--status=failure` | Lists CI workflow runs with status indicators. |
| | `gh run view <ID>` | `--log-failed`, `--job=<JOB_ID>`, `--log` | Inspects failed step logs or specific job output. |
| | `gh run rerun <ID>` | `--failed` | Reruns only the failed jobs in a workflow run. |
| | `gh run watch <ID>` | `--exit-status` | Streams live CI status until completion. |
| **Pull Requests** | `gh pr view <NUM>` | `--comments`, `--web` | Displays PR description, status checks, and discussions. |
| | `gh pr diff <NUM>` | `--name-only`, `--patch` | Returns unified git diff without checking out branch. |
| | `gh pr checks <NUM>` | `--watch`, `--required` | Checks CI status check outcomes per commit. |
| | `gh pr checkout <NUM>` | `--recurse-submodules` | Clones and checks out PR branch locally. |
| | `gh pr review <NUM>` | `--approve`, `--request-changes`, `--body "..."` | Submits PR code review verdict non-interactively. |
| | `gh pr merge <NUM>` | `--squash`, `--auto`, `--delete-branch` | Automatically merges PR once checks pass. |
| **Issues** | `gh issue list` | `--label="bug"`, `--assignee="@me"`, `--search="..."` | Searches and filters issues. |
| | `gh issue create` | `--title "..."`, `--body "..."`, `--label="bug,p1"` | Creates issues headlessly. |
| | `gh issue close <NUM>`| `--reason="completed" \| "not_planned"` | Closes issue with resolution status. |
| **Search & Caches**| `gh search <code\|repos\|issues>` | `"query" --language=ts --limit 10` | Unified multi-resource GitHub global search. |
| | `gh cache list` / `delete` | `--key <KEY>`, `--all` | Manages CI Action build caches and cache keys. |
| | `gh variable set` / `list` | `--body "val" --env <ENV>` | Manages Actions workflow configuration variables. |
| **Security & Attest**| `gh attestation verify` | `<file> --owner <ORG>` | Cryptographic SLSA artifact provenance verification. |
| | `gh ruleset list` / `view` | `--parents` | Inspects repository branch protection rulesets. |
| **Releases** | `gh release list` | `--limit 5` | Lists release tags and publication dates. |
| | `gh release download` | `<TAG> --pattern="*.tar.gz" --dir=./dist` | Downloads release binary assets non-interactively. |
| **Raw API** | `gh api <endpoint>` | `-X POST`, `-f key=val`, `--paginate`, `--jq` | Executes authenticated REST API requests. |
| | `gh api graphql` | `-f query='...'`, `-F var='val'` | Executes GraphQL queries with variable bindings. |

---

## 4. Structured Output & JQ Filtering Flags

`gh` commands support built-in JSON extraction without requiring external `jq` binaries:

| Flag | Purpose | Syntax Pattern |
| :--- | :--- | :--- |
| `--json <fields>` | Returns structured JSON with specified fields | `gh pr list --json number,title,headRefName` |
| `--jq <filter>` | Applies built-in jq filter expression | `gh pr list --json number,title --jq '.[] \| "#\(.number): \(.title)"'` |
| `--template <tmpl>` | Go text template formatting | `gh issue list --template '{{range .}}{{.title}}{{"\n"}}{{end}}'` |
| `--json help` | Discovers all available JSON fields for any command | `gh pr view --json help`, `gh run view --json help` |

---

## 5. High-Leverage Composite Examples

```bash
# 1. Diagnose latest failed CI workflow: find run ID and view failed step log
FAILED_RUN=$(gh run list --status failure --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$FAILED_RUN" --log-failed

# 2. Non-interactive PR review & check inspection
gh pr checks 142
gh pr diff 142
gh pr review 142 --approve --body "Verified changes pass test suite locally."

# 3. Raw GraphQL query to fetch open PRs with draft status
gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 5, states: OPEN) {
        nodes { number, title, isDraft }
      }
    }
  }' -F owner='cli' -F repo='cli' --jq '.data.repository.pullRequests.nodes[]'
```
