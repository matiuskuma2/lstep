# Operational Workflow

## Role Assignment

| Tool | Role | What it does | What it does NOT do |
|------|------|-------------|--------------------|
| Claude Code Web | Architect / Auditor | Design, docs, Issue decomposition, PR review, log interpretation | Direct implementation, Codex invocation, Cloudflare API calls |
| Codex | Implementation Worker | Issue-unit coding, 1 Issue = 1 PR, triggered by GitHub Action | Design decisions, scope expansion, direct deploy |
| GitHub | Source of Truth | Docs, Issues, PRs, Actions, labels, branch protection | Runtime, secrets storage |
| Cloudflare | Deploy Platform | Preview builds, production deploy via GitHub Actions | Code review, issue management |

## Automation Flow

```
1. Claude Code Web: creates Issue with `codex` label
2. GitHub Action: detects `codex` label -> triggers Codex
3. Codex: implements Issue -> creates PR
4. GitHub Action: deploys to Cloudflare staging (on PR or staging push)
5. Claude Code Web: reviews PR diff + Cloudflare build log
6. Human: approves or requests changes
7. Merge to main -> Cloudflare production deploy
```

## Issue Lifecycle

```
Claude creates Issue
  -> adds `codex` label
  -> Codex GitHub Action picks it up
  -> Codex creates branch + PR
  -> deploy-worker.yml deploys to staging
  -> Claude reviews PR
  -> fix needed? -> Claude creates fix Issue -> Codex fixes
  -> OK? -> merge to main -> production deploy
```

## Codex Trigger Rules

- Codex runs when Issue gets `codex` label
- Codex reads: CLAUDE.md, docs/, Issue body
- Codex creates: feature branch + PR with minimal diff
- Codex does NOT: broaden scope, touch unrelated files, skip tests

## Codex Task Template

```text
Implement GitHub Issue #{ISSUE_NUMBER} only.

Read first:
- CLAUDE.md
- docs/REPO_AUDIT.md
- docs/MEASUREMENT_ARCHITECTURE.md
- docs/AI_ORCHESTRATION_PLAN.md
- the Issue body

Rules:
- Do not broaden scope
- Reuse existing routes/services/adapters where possible
- Do not directly mutate DB if a domain path exists
- Keep changes minimal and reviewable
- Add/update tests where appropriate
- Update docs only if required by the issue

Deliver:
- A small PR-ready diff
- Short summary of what changed
- Risks / assumptions
- Test notes
```

## Claude PR Review Checklist

When reviewing a Codex PR, Claude checks:

1. **Scope match** - Does the diff match the Issue and nothing else?
2. **Safety** - No direct DB writes, no secret exposure, no delivery path changes?
3. **Existing reuse** - Does it use existing services/routes/adapters?
4. **preview/confirm** - If mutating, is preview/confirm preserved?
5. **Tests** - Are tests added or updated?
6. **Build** - Did Cloudflare staging deploy succeed?
7. **Docs** - Are docs updated if architecture changed?

## Claude Log Investigation Template

```text
Read the following PR / build / runtime log and triage the issue.

Steps:
1. List confirmed failure facts
2. Separate assumptions
3. Note reproduction conditions if any
4. Decompose into small fix issues
5. For each fix issue provide:
   - Objective
   - Scope
   - Constraints
   - Definition of Done
   - Test Plan
6. Identify the highest priority fix

Constraints:
- No direct DB updates
- Reuse existing service/adapter/route
- 1 Issue 1 responsibility
- Delivery path safety is top priority
- Do not break preview/confirm policy

Log:
[paste log here]
```

## Stop Conditions (Claude Code must flag)

- Direct SQL / D1 table update bypassing domain services
- Bypassing existing LINE Harness services
- preview/confirm removed for scenario / tracked link / conversion mutation
- AI chat enabling bulk changes without confirmation
- Manual admin path removed
- Agent P2P introduced to production critical path
- Unconfirmed preview build merged to main

## Deploy Strategy

### Workers
- `staging` branch -> `lstep-ai-api-stg` (auto via GitHub Actions)
- `main` branch -> `lstep-ai-api-prod` (auto via GitHub Actions)
- Manual dispatch available for both

### Branch Flow
```
Codex creates feature/* branch from staging
  -> PR to staging
  -> auto deploy to lstep-ai-api-stg
  -> review + merge
  -> PR staging to main
  -> auto deploy to lstep-ai-api-prod
```

## Merge Policy

A PR must not merge unless:
- Scope matches one issue
- Cloudflare staging deploy succeeded
- Risks explicitly described
- Tests added/updated where needed
- No unsafe mutation path introduced
- Docs updated if behavior/architecture changed
