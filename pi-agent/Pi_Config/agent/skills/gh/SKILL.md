---
name: gh
description: GitHub CLI for PRs, issues, Actions CI workflows, releases, and raw GraphQL/REST queries. Use 'gh pr diff', 'gh run view --log-failed', 'gh issue list --json', or 'gh api'.
---

# GitHub CLI (`gh`) Skill

This skill guides the agent on using `gh` to inspect repositories, review pull requests, triage failed CI workflows, manage issues, and query the GitHub REST/GraphQL APIs non-interactively in automated and headless environments.

---

## Headless Execution & Safety Rules

1. **Always supply all required arguments**: Never trigger interactive prompts (e.g. always provide `--title`, `--body` or `--fill` for PR/issue creation).
2. **Check authentication status**: Run `gh auth status` before executing authenticated tasks.
3. **Explicit target repository**: When working outside a repository root or across multiple repos, pass `-R <owner>/<repo>` (or `--repo <owner>/<repo>`).
4. **Disable prompts**: If necessary in scripts, set environment variables `GH_PROMPT_DISABLED=1` and `NO_COLOR=1`.

```bash
# Check authentication status and active scopes
gh auth status

# Specify target repo explicitly when not inside a git checkout
gh pr list -R cli/cli --state open --limit 5
```

---

## Common Workflows

### 1. CI / GitHub Actions Triage (High Priority)

Diagnose build, test, and lint failures from workflow runs:

```bash
# List recent workflow runs for the current repository
gh run list --limit 10

# Filter runs by workflow name or branch
gh run list --workflow=ci.yml --branch=main --limit 5

# View summary of a specific run (shows failing jobs and steps)
gh run view <RUN_ID>

# CRITICAL: View only the failed step logs to quickly diagnose root cause
gh run view <RUN_ID> --log-failed

# View full log for a specific job ID within a run
gh run view --job <JOB_ID> --log

# Watch a currently running workflow until completion
gh run watch <RUN_ID>

# Rerun only the failed jobs in a workflow run
gh run rerun <RUN_ID> --failed
```

---

### 2. Pull Request Inspection & Review

Inspect PR diffs, check statuses, and manage PR branches:

```bash
# View PR summary, status, and latest discussion comments
gh pr view <PR_NUMBER> --comments

# View unified git diff of a PR without checking it out
gh pr diff <PR_NUMBER>

# Check PR CI status checks and their outcomes
gh pr checks <PR_NUMBER>

# Check out PR branch locally for manual reproduction/editing
gh pr checkout <PR_NUMBER>

# List open PRs targeting main
gh pr list --state open --base main --limit 10

# Create a PR non-interactively
gh pr create --title "feat: add batch processing" --body "Resolves #123" --base main --head my-feature-branch

# Add a comment to an existing PR
gh pr comment <PR_NUMBER> --body "LGTM: verified test coverage passes locally."

# Submit a review on a PR
gh pr review <PR_NUMBER> --approve --body "Looks good to merge!"
# Or request changes:
gh pr review <PR_NUMBER> --request-changes --body "Please fix the failing test in parser_test.go"

# Merge a PR once approved and checks pass
gh pr merge <PR_NUMBER> --squash --delete-branch --auto
```

---

### 3. Issue Management

Search, view, create, and update GitHub issues:

```bash
# List open issues filtered by label and assignee
gh issue list --state open --label "bug" --assignee "@me" --limit 10

# Search issues matching query syntax
gh issue list --search "memory leak in:title,body" --state open

# View full issue body and all comments
gh issue view <ISSUE_NUMBER> --comments

# Create an issue non-interactively with labels and assignees
gh issue create --title "bug: segfault on empty input" --body "Observed panic when input array is empty." --label "bug,triage"

# Add a comment to an issue
gh issue comment <ISSUE_NUMBER> --body "Reproduced on Linux x86_64. Fix incoming."

# Close an issue as completed or not planned
gh issue close <ISSUE_NUMBER> --reason "completed"
```

---

### 4. Repository & Release Management

Inspect repository metadata, releases, and release assets:

```bash
# View repository overview
gh repo view <owner>/<repo>

# List recent releases
gh release list --limit 5

# View release notes and metadata for a specific tag
gh release view <TAG>

# Download release assets non-interactively
gh release download <TAG> --pattern "*.tar.gz" --dir ./dist
```

---

### 5. Structured JSON Output & JQ Filtering

Most `gh` commands support `--json` and `--jq` (or `-q`) to extract structured data without external `jq` dependencies:

```bash
# Extract list of open PR numbers, titles, and branches as JSON
gh pr list --state open --json number,title,headRefName

# Extract specific fields using built-in jq filter
gh pr list --json number,title --jq '.[] | "#\(.number): \(.title)"'

# Get the run ID of the latest failed workflow run
gh run list --status failure --json databaseId,workflowName --jq '.[0].databaseId'

# Inspect available JSON fields for any command
gh pr view --json help
gh run view --json help
gh issue view --json help
```

---

### 6. Raw API Queries (REST & GraphQL)

Use `gh api` to access GitHub REST and GraphQL APIs using the active authenticated session:

#### REST API
```bash
# Get modified file list for a PR
gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/files --jq '.[].filename'

# Handle paginated REST endpoints automatically
gh api --paginate repos/{owner}/{repo}/issues --jq '.[].title'

# POST request to create an issue comment
gh api -X POST repos/{owner}/{repo}/issues/<ISSUE_NUMBER>/comments -f body="Automated triage comment"
```

#### GraphQL API
```bash
# Execute GraphQL query with variables
gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 5, states: OPEN) {
        nodes {
          number
          title
          isDraft
        }
      }
    }
  }' -F owner='owner_name' -F repo='repo_name'
```
