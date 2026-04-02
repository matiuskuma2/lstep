# Release Guardrails

## Branch Protection Rules

### `staging` branch
- Direct push: **prohibited**
- All changes via PR only
- Required checks before merge: `Deploy Worker`
- Auto-merge: **enabled** (feature -> staging)
- Delete branch after merge: enabled

### `main` branch
- Direct push: **prohibited**
- All changes via PR only
- Required checks before merge: `Deploy Worker`
- Manual approval required: **yes** (at least 1 review)
- Auto-merge: **disabled** (manual merge only)
- Delete branch after merge: enabled

---

## Required Flow

```
Issue created
  -> feature/* branch from staging
  -> implementation (Claude Code or Codex)
  -> PR to staging
  -> Deploy Worker check passes
  -> auto-merge to staging
  -> staging deploy completes
  -> verify on staging URL
  -> PR from staging to main (when ready for production)
  -> manual approval
  -> merge to main
  -> production deploy
```

---

## Prohibited Actions

1. **No direct push to staging or main** - always via PR
2. **No debug/diagnostic endpoints in merged code** - use temporarily, remove before PR
3. **No secrets in code or logs** - use Cloudflare Secrets or GitHub Secrets only
4. **No scope expansion in PRs** - one Issue, one PR, one responsibility
5. **No skipping staging verification** - always check staging URL before promoting to main

---

## Debug Endpoint Policy

- Debug endpoints (e.g. `/debug/env`) may be added temporarily during development
- They must be **removed before the PR is created**
- If a debug endpoint is found in a PR, it must be flagged and removed
- Never expose environment variables, secrets, or internal state in production

---

## Codex Success != Done

A Codex workflow success means the code was generated. It does NOT mean:
- A PR was created (check Pull Requests tab)
- The PR was merged (check merge status)
- Staging deploy succeeded (check Actions tab)
- The feature works correctly (check staging URL)

Always verify all 4 steps.

---

## Claude PR Review Checklist

When reviewing any PR, Claude must verify:

1. **Scope match** - Does the diff match the Issue only? No extra changes?
2. **No direct DB writes** - All mutations through existing services/adapters?
3. **No debug endpoints** - No `/debug/*` routes left in code?
4. **preview/confirm preserved** - Mutation intents still require confirmation?
5. **Tests present** - Are tests added or updated for new functionality?
6. **Staging deploy passed** - Did the Deploy Worker check succeed?
7. **No secrets in code** - No API keys, tokens, or credentials in source?

---

## Auto-merge Policy

| Source | Target | Auto-merge | Approval Required |
|--------|--------|-----------|-------------------|
| `feature/*` | `staging` | Yes | No |
| `codex/*` | `staging` | Yes | No |
| `staging` | `main` | No | Yes (manual) |
| Any | `main` (direct) | Blocked | N/A |

---

## GitHub Settings Required

To implement these guardrails, configure in GitHub Settings:

### Repository > Settings > Branches > Branch protection rules

**Rule for `staging`:**
- Require a pull request before merging: Yes
- Require status checks to pass: Yes
  - Required check: `deploy` (from deploy-worker.yml)
- Allow auto-merge: Yes

**Rule for `main`:**
- Require a pull request before merging: Yes
- Require approvals: 1
- Require status checks to pass: Yes
  - Required check: `deploy` (from deploy-worker.yml)
- Allow auto-merge: No

### Repository > Settings > General
- Allow auto-merge: Yes
- Automatically delete head branches: Yes

---

## Incident Response

If a broken change reaches staging:
1. Do NOT force push or revert directly
2. Create a fix Issue
3. Implement fix on feature branch
4. PR to staging with fix
5. Verify fix on staging URL

If a broken change reaches main:
1. Assess severity
2. If critical: revert PR via GitHub "Revert" button (creates a new PR)
3. If non-critical: fix Issue -> feature branch -> PR flow
