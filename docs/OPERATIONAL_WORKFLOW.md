# Operational Workflow

## Role Assignment

| Tool | Role | Responsibility |
|------|------|----------------|
| Claude Code Web | Architect / Auditor | Design, docs, issue decomposition, PR review, log interpretation |
| Codex | Implementation Worker | Issue-unit coding, 1 Issue = 1 PR |
| GitHub | Source of Truth | Docs, issues, PRs, release notes |
| Cloudflare | Deploy Platform | Preview builds, production deploy via GitHub integration |

## Development Flow

```
1. User -> Claude Code Web: requirements
2. Claude Code Web: docs update + issue decomposition
3. GitHub: issue filed
4. Codex: implements that issue only
5. Codex: creates PR
6. Cloudflare: preview build / preview URL
7. Claude Code Web: reviews PR diff + build result
8. Fix needed? -> Claude Code Web creates fix issue -> Codex fixes
9. OK? -> merge to main -> Cloudflare production deploy
```

## Incident / Log Investigation Flow

```
1. Cloudflare build/deploy fails or runtime error
2. Check GitHub PR / commit status / build comment
3. Claude Code Web reads build log / runtime log / error
4. Claude Code Web creates fix issue with:
   - factual failure description
   - separated assumptions
   - reproduction conditions
   - fix scope
   - DoD and test plan
5. Codex implements fix issue only
6. Re-deploy
```

## Key Rules

1. Codex only works from GitHub Issues (never ad-hoc)
2. Claude Code Web does not implement broad changes directly
3. Cloudflare auto-deploys on GitHub push
4. Preview build must pass before merge
5. Production deploy only from main branch
6. Log observation and incident triage goes to Claude Code Web
7. Long context/background goes in repo docs, not UI paste

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

## Claude Code Log Investigation Template

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

Related files:
- CLAUDE.md
- docs/REPO_AUDIT.md
- docs/MEASUREMENT_ARCHITECTURE.md
- docs/AI_ORCHESTRATION_PLAN.md

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

## Cloudflare Initial Setup

### Workers
- main branch -> production deploy
- feature/* / PR -> preview build
- Git integration enabled
- Build status returned to GitHub

### Pages
- PR -> preview deployment URL
- main merge -> production update

## Merge Policy

A PR must not merge unless:
- Scope matches one issue
- Preview build exists and passes
- Risks explicitly described
- Tests added/updated where needed
- No unsafe mutation path introduced
- Docs updated if behavior/architecture changed
