# Operational Workflow

## Role Assignment

| Tool | Role | What it does | What it does NOT do |
|------|------|-------------|--------------------|
| Claude Code Web | Architect / Auditor | Design, docs, Issue decomposition, PR review, log interpretation | Direct implementation on staging/main, Codex invocation, Cloudflare API calls |
| Codex | Implementation Worker | Issue-unit coding, 1 Issue = 1 PR, triggered by GitHub Action | Design decisions, scope expansion, direct deploy |
| GitHub | Source of Truth | Docs, Issues, PRs, Actions, labels, branch protection | Runtime, secrets storage |
| Cloudflare | Deploy Platform | Preview builds, production deploy via GitHub Actions | Code review, issue management |

## Required Development Flow

**All changes must follow this flow. No exceptions.**

```
1. Create Issue (Claude Code or human)
2. Create feature/* branch from staging
3. Implement on feature branch (Claude Code or Codex)
4. Create PR to staging
5. Deploy Worker check passes
6. Merge to staging (auto-merge if checks pass)
7. Verify on staging URL
8. When ready: PR from staging to main
9. Manual approval
10. Merge to main -> production deploy
```

### Prohibited
- Direct push to `staging` or `main`
- Merging without Deploy Worker check passing
- Skipping staging verification before promoting to main
- Leaving debug endpoints in merged code
- Expanding scope beyond the Issue

## Codex Trigger Rules

- Codex runs when Issue gets `codex` label (via `openai/codex-action@v1`)
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
- Do not add debug endpoints

Deliver:
- A small PR-ready diff
- Short summary of what changed
- Risks / assumptions
- Test notes
```

## Verification Checklist

Codex success does NOT mean the task is done. Always verify:

1. [ ] Codex workflow succeeded (Actions tab)
2. [ ] PR was actually created (Pull Requests tab)
3. [ ] Deploy Worker check passed
4. [ ] Staging URL shows expected behavior

## Claude PR Review Checklist

1. **Scope match** - Does the diff match the Issue only?
2. **No direct DB writes** - All mutations through existing services/adapters?
3. **No debug endpoints** - No `/debug/*` routes left in code?
4. **preview/confirm preserved** - Mutation intents still require confirmation?
5. **Tests present** - Are tests added or updated?
6. **Staging deploy passed** - Did Deploy Worker check succeed?
7. **No secrets in code** - No API keys, tokens, or credentials?

## Deploy Strategy

### Workers
- `staging` branch -> `lstep-ai-api-stg` (auto via GitHub Actions)
- `main` branch -> `lstep-ai-api-prod` (auto via GitHub Actions)
- Manual dispatch available for both

### Branch Flow
```
feature/* branch from staging
  -> PR to staging
  -> auto deploy to lstep-ai-api-stg
  -> verify
  -> PR staging to main
  -> manual approval
  -> auto deploy to lstep-ai-api-prod
```

## Debug Endpoint Policy

- Debug endpoints may be used during local development or temporary troubleshooting
- They must be **removed before creating a PR**
- Any debug endpoint found in a PR must be flagged and removed
- Examples: `/debug/env`, `/debug/state`, `/debug/*`

## Stop Conditions (Claude Code must flag)

- Direct SQL / D1 table update bypassing domain services
- Bypassing existing LINE Harness services
- preview/confirm removed for mutation operations
- AI chat enabling bulk changes without confirmation
- Manual admin path removed
- Agent P2P introduced to production critical path
- Unconfirmed preview build merged to main
- Debug endpoint left in merged code
- Direct push to staging or main

## Incident Response

- Do NOT force push or revert directly on staging/main
- Create a fix Issue
- Fix on feature branch -> PR -> merge
- For critical production issues: use GitHub "Revert" button on the PR

## Merge Policy

A PR must not merge unless:
- Scope matches one issue
- Deploy Worker check passed
- No debug endpoints in code
- Risks explicitly described
- Tests added/updated where needed
- No unsafe mutation path introduced
- Docs updated if behavior/architecture changed
