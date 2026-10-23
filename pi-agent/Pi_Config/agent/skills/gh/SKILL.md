---
name: gh
description: GitHub CLI for PRs, issues, Actions CI workflows, releases, and raw GraphQL/REST queries. Use gh pr diff, gh run view --log-failed, gh issue list --json, or gh api.
---

# GitHub CLI (`gh`) Capabilities Reference

Non-interactive GitHub CLI for inspecting repositories, reviewing pull requests, triaging failed CI workflows, managing issues, and querying REST/GraphQL APIs headlessly.

---

## 1. Execution Primitives & Circuit Breakers

| Primitive / Trap | Operational Hazard & Behavior | Required Affirmative Protocol |
| :--- | :--- | :--- |
| **Interactive TUI Hang** | Running `gh pr create` or `gh issue create` without flags opens an interactive editor | Always pass non-interactive flags: `--title "..." --body "..."` or `--fill` |
| **Context Log Flood** | Running raw `gh run view` prints thousands of log lines, exhausting context | Always pass `--log-failed` to print only the root-cause failure lines |
| **Ambiguous Repository Root** | Running outside git directories fails with no origin error | Explicitly pass repository context: `-R OWNER/REPO` or `--repo OWNER/REPO` |
| **Terminal Pager Hang** | `gh` defaults to opening a terminal pager (`less`), pausing subshells | Always prefix commands with `GH_PAGER="" gh ...` or set `$env:GH_PAGER=""` |
| **Rate Limit Circuit Breaker** | Rapid API calls trigger secondary rate limits | If rate-limited, inspect limits via `gh api rate_limit` before retrying |

---

## 2. Core PR, Issue & Release Matrix

| Resource | Operation / Subcommand | Key Flags & Parameters | Capabilities & Behavior |
| :--- | :--- | :--- | :--- |
| **Pull Requests** | `gh pr view PR_NUM` | `--comments`, `--json number,title` | Displays PR description, status checks, and discussions. |
| | `gh pr diff PR_NUM` | `--name-only`, `--patch` | Returns unified git diff without checking out branch. |
| | `gh pr checks PR_NUM` | `--watch`, `--required` | Checks CI status check outcomes per commit. |
| | `gh pr checkout PR_NUM` | `--recurse-submodules` | Clones and checks out PR branch locally. |
| | `gh pr review PR_NUM` | `--approve`, `--request-changes`, `--body "..."` | Submits PR code review verdict non-interactively. |
| | `gh pr merge PR_NUM` | `--squash`, `--auto`, `--delete-branch` | Automatically merges PR once checks pass. |
| **Issues** | `gh issue list` | `--label="bug"`, `--assignee="@me"`, `--limit 10` | Searches and filters issues. |
| | `gh issue create` | `--title "..."`, `--body "..."`, `--label="bug"` | Creates issues headlessly. |
| | `gh issue close PR_NUM` | `--reason="completed"`, `--reason="not_planned"` | Closes issue with resolution status. |
| **Releases** | `gh release list` | `--limit 5` | Lists release tags and publication dates. |
| | `gh release download TAG` | `--pattern="*.tar.gz" --dir=./dist` | Downloads release binary assets non-interactively. |

---

## 3. Actions CI, Security & API Matrix

| Resource | Operation / Subcommand | Key Flags & Parameters | Capabilities & Behavior |
| :--- | :--- | :--- | :--- |
| **CI Actions** | `gh run list` | `--workflow=ci.yml`, `--branch=main`, `--status=failure` | Lists CI workflow runs with status indicators. |
| | `gh run view RUN_ID` | `--log-failed`, `--job=JOB_ID` | Inspects failed step logs or specific job output. |
| | `gh run rerun RUN_ID` | `--failed` | Reruns only the failed jobs in a workflow run. |
| | `gh run watch RUN_ID` | `--exit-status` | Streams live CI status until completion. |
| **Security & Attest** | `gh attestation verify FILE` | `--owner ORG` | Cryptographic SLSA artifact provenance verification. |
| | `gh ruleset list`, `view` | `--parents` | Inspects repository branch protection rulesets. |
| **Search & Cache** | `gh search code "QUERY"` | `--language=ts --limit 10` | Unified multi-resource GitHub global search. |
| | `gh cache list`, `delete` | `--key KEY`, `--all` | Manages CI Action build caches and cache keys. |
| **Raw API** | `gh api ENDPOINT` | `-X POST`, `-f key=val`, `--paginate`, `--jq` | Executes authenticated REST API requests. |
| | `gh api graphql` | `-f query='...'`, `-F var='val'` | Executes GraphQL queries with variable bindings. |

---

## 4. High-Leverage Composite Examples

```bash
# Stage 1: Diagnose latest failed CI workflow: find run ID and view failed step log
FAILED_RUN=$(GH_PAGER="" gh run list --status failure --limit 1 --json databaseId --jq '.[0].databaseId')
GH_PAGER="" gh run view "$FAILED_RUN" --log-failed

# Stage 2: Non-interactive PR review & check inspection with decision verification
GH_PAGER="" gh pr checks 142
GH_PAGER="" gh pr diff 142
GH_PAGER="" gh pr review 142 --approve --body "Verified changes pass test suite locally."
GH_PAGER="" gh pr view 142 --json reviewDecision

# Stage 3: Raw GraphQL query to fetch open PRs with draft status
GH_PAGER="" gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 5, states: OPEN) {
        nodes { number, title, isDraft }
      }
    }
  }' -F owner='cli' -F repo='cli' --jq '.data.repository.pullRequests.nodes[]'
```
