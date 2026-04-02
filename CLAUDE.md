# Project

This project extends LINE Harness OSS with an AI orchestration layer for natural-language-driven step delivery, tracking, and conversion setup.

**Primary use case:**
- Build LINE step scenarios by chat
- Track acquisition source -> click -> LP -> conversion
- Support internal LP hosting first, external LP tracking second
- Keep manual admin UI editing available at all times

## Core Principles

- Safety before speed
- **API で取得・自動化できることは全て自動化する（手動入力を求めない）**
- Never bypass existing domain logic
- One PR, one responsibility
- Preview/confirm before mutating delivery settings
- Keep AI deterministic where possible
- Reuse existing LINE Harness features before adding new primitives

## Hard Rules

- Never write directly to D1 tables from ad-hoc code if an existing service / route / adapter can be used
- Never change production delivery behavior without explicit preview/confirm flow
- Never bulk-edit scenarios, broadcasts, tracked links, or conversion settings without a human confirmation step
- Never introduce Agent P2P into the critical path of message delivery, webhook processing, or cron delivery execution
- Never remove manual admin editing paths
- Never commit secrets, tokens, webhook secrets, or Cloudflare credentials
- Never store secrets in wrangler.toml
- Never refactor broad areas unless the current task explicitly requires it

## Current Product Goal

Build an AI chat workflow that can:

1. `create_step_scenario`
2. `edit_step_scenario`
3. `create_tracking_link`
4. `set_conversion_point`
5. `show_report`
6. `propose_internal_lp_publish_plan`
7. `propose_external_lp_tracking_plan`

## Business Context

**Target user:** Hiramatsu Kenchiku marketing / operations team

**Important measurement goals:**
- entry route source
- friend registration source
- questionnaire/form attributes
- tracked link clicks
- LP destination
- CV type
- attribution by source / route / scenario / link / LP / form attributes

## Measurement Strategy

**Prefer internal hosted LPs first:**
- Better control
- Better attribution
- Simpler event capture

**Support external LPs second:**
- Via embeddable tracking scripts, redirect params, or server-side event design
- Accuracy depends on external site implementation

## AI Interaction Model

Use a state-machine style workflow:

1. `detect_intent`
2. `collect_required_slots`
3. `ask_back_for_missing_fields`
4. `create_draft_plan`
5. `await_confirmation`
6. `execute`
7. `log_result`

Do not implement free-form autonomous mutation flows.

## Required UX

The AI chat must:
- ask clarifying questions only for missing required business fields
- summarize the final execution plan before applying changes
- return links / IDs / summary of created resources
- provide manual follow-up path in admin UI

## Internal LP Rules

When publishing internal LPs:
- preserve source LP files if imported
- keep versioned folder naming
- make attribution params explicit
- define conversion points in a structured way
- avoid hidden coupling between page path and business logic

## External LP Rules

When supporting external LPs:
- produce a minimal install guide
- define required event payloads
- design fallback behavior when cookies are unavailable
- distinguish "measured click" and "verified conversion"
- prefer server-side verification where possible

## Agent P2P Policy

**Allowed:**
- proposal generation
- offline analysis
- batch content generation
- asynchronous report generation
- optional distributed worker experiments

**Not allowed in initial production path:**
- delivery execution
- webhook handling
- cron dispatch
- direct mutation of core campaign state

## Development Workflow

1. Repo audit first
2. Write docs before code
3. Break work into small issues
4. Implement smallest vertical slice
5. Add tests
6. Review with screenshots / payload examples / migration safety
7. Only then expand scope

## Operational Roles

- **Claude Code Web**: Design, audit, log interpretation, issue decomposition, PR review
- **Codex**: Issue-unit implementation worker (1 Issue = 1 PR)
- **GitHub**: Single source of truth for docs, issues, PRs
- **Cloudflare**: Preview and production auto-deploy via GitHub integration

See `docs/OPERATIONAL_WORKFLOW.md` for detailed flow.

## Merge Control Rules

### Parallel PR policy
- UI layer (pages, routes, shared components) changes are **serial only**
- API-only, migration-only, docs-only changes may run in parallel if files don't overlap
- If staging advances after a PR is created, that PR must be **closed and regenerated** from current staging — never merge a stale PR

### Stale PR handling
- A PR is stale if staging/main received other merges after the PR branch was created
- Stale PRs that touch page/route/shared files: **close and regenerate**
- Stale PRs that touch isolated files (migration, adapter): rebase or regenerate

### PR scope enforcement
- Each PR must only change files within the Issue scope
- Out-of-scope file changes (especially page/route/shared) are grounds for rejection
- If a Codex PR includes unrelated file diffs, close it and regenerate with tighter constraints

### Merge gate checklist
Before merging any PR, verify:
1. **Scope**: only Issue-scoped files changed
2. **Freshness**: based on latest staging, no stale diffs
3. **Non-regression**: no existing error handling, loading states, or UI behavior reverted
4. **Deploy**: staging deploy succeeds
5. **Smoke test**: /health + affected dashboard pages load correctly

### UI stabilization phase rules
When in UI stabilization/smoke-test phase:
- No new feature PRs touching page/route files
- 1 Issue → 1 PR → 1 merge → 1 staging verify → next
- All pending feature PRs for UI are frozen until stabilization completes

## Pre-Implementation Audit Gate (MANDATORY)

Before any implementation task is handed to Codex or executed directly:

### Required audit items (all must be filled)
1. **Dependency manifest** — packages, utility files, unresolved imports
2. **Required files manifest** — existing files needed, new files, deletions
3. **Route manifest** — target routes, ownership, source of truth
4. **Schema diff** — existing table vs intended changes, conflicts
5. **Live schema check** — actual D1 columns via `/api/debug/schema`
6. **Smoke test** — URL, API, DB evidence, PASS/FAIL criteria

### Rules
- If any audit item is missing, **do not implement**
- Never treat `CREATE TABLE IF NOT EXISTS` as proof of schema compatibility
- Always compare intended SQL against live DB columns before writing migrations
- Always confirm column existence before using in INSERT/UPDATE
- Never bulk-import a feature set — 1 integration = 1 feature
- Before removing imports or routes, create a remove/disable manifest

### Migration safety
- Run `/api/debug/schema` before writing any ALTER TABLE or INSERT
- Each ALTER TABLE should be a single column per migration file
- If migration fails with "duplicate column", the column already exists — skip it

### Integration safety
- Use approach B: LINE Harness DB adapters only, own route handlers
- Do not mount LINE Harness Hono routes (broken ../index.js imports)
- Always confirm tenant_id source of truth before saving records

## Definition of Done

A task is not done unless:
- docs updated if architecture changed
- tests added or updated
- admin/manual path still works
- preview/confirm exists for mutating AI actions
- logs are available for debugging
- no secret handling regressions introduced
- Cloudflare preview build confirmed
- **no existing UI states (loading/error/empty) reverted**
- **PR is based on latest staging**
- **out-of-scope file changes are absent**

## Code Style

- Prefer small, composable adapters
- Keep domain logic in services, not UI
- Keep AI prompt logic versioned and testable
- Avoid giant files
- Prefer explicit schemas over loose objects
- Prefer deterministic slot extraction over vague prompt-only behavior

## Watch Outs

- Attribution can silently break across domains
- LINE auth / UUID flows are business-critical
- Multi-account/BAN recovery logic is sensitive
- External LP measurement is less reliable than internal LP hosting
- AI token cost must be measured early

## Branch & Deploy Rules

### Branch flow
- `feature/*` → `staging` (PR required, auto-merge OK if merge gate passes)
- `staging` → `main` (manual approval required)
- **Never push directly to main** for implementation code
- main direct push is allowed only for workflow files (codex-implement.yml, deploy-worker.yml)

### Branch naming
- Codex branches: `feature/issue-{N}-codex` (one per issue)
- Manual branches: `feature/issue-{N}-{description}`
- **Never reuse a closed PR's branch** — delete and create fresh

### Stale branch prevention
- Before creating a Codex branch, check if same-name branch already exists
- If it exists, delete it first or use a unique suffix
- Codex workflow must detect existing open PRs for the same issue

### Deploy flow
- staging push triggers auto-deploy via deploy-worker.yml
- After deploy, verify `/health` returns 200
- Smoke test affected pages before marking issue as done

## Codex Workflow Rules

### Execution
- 1 Issue = 1 PR = 1 branch
- Codex workflow must comment results on the issue:
  - branch creation: PASS/FAIL
  - commit/push: PASS/FAIL
  - PR creation: PASS/FAIL + URL
  - Or: "no changes produced"
- If any step fails, comment the failing step name

### Re-trigger safety
- Before re-triggering, close existing PRs for the same issue
- Delete stale branches from previous runs
- Never merge a PR created from an outdated staging base

## Shared UI Architecture Rules

### Shell template
- `getShellHtml` must exist in exactly **one** shared location
- All dashboard pages import and use the shared shell
- Common script (authHeaders, esc, logout, user setup) is defined **before** `${content}`
- Page-specific scripts go inside content

### Fetch pattern
- All data-loading functions must be `async` with `try-catch`
- Check `!r.ok` before parsing JSON
- Show error message on failure (never stay on "読み込み中...")
- Show "データがありません" on empty results
- Never `console.error` only — always update UI

### Template literal safety
- Use `\\\\\'` (not `\\'`) for quotes inside onclick handlers in template literals
- Validate all page scripts with `new Function()` before merging
- Test authHeaders definition order with character index comparison
