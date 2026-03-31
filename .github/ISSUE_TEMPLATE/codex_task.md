---
name: Codex Task
about: Small, implementation-ready task for Codex
title: "[codex] "
labels: ["codex", "implementation"]
assignees: ""
---

## Objective
State the purpose of this issue in 1-3 sentences.

## Why
Explain why this is needed. Business context or design rationale.

## Scope
**Do:**
-
-
-

**Do not:**
-
-
-

## Target Files / Areas
**Change candidates:**
-
-

**Must check existing:**
-
-

## Constraints
- No direct DB updates; use existing domain services/adapters
- One PR, one responsibility
- Do not break preview/confirm policy
- Do not remove manual admin paths
- Do not put Agent P2P in production critical path
- Do not leave debug endpoints in merged code

## Inputs
**Related docs:**
- CLAUDE.md
- docs/REPO_AUDIT.md
- docs/MEASUREMENT_ARCHITECTURE.md
- docs/AI_ORCHESTRATION_PLAN.md

**Related Issues / PRs:**
- #

## Risk Checklist
- [ ] null / undefined / empty input handling confirmed
- [ ] tenant boundary respected (no cross-tenant access)
- [ ] no direct DB mutation (uses adapter/service)
- [ ] no secrets exposed in code or logs
- [ ] existing pages/endpoints not broken
- [ ] race condition / concurrency impact assessed
- [ ] error messages actionable, not leaking internals

## Verification Plan
- **Completion criteria:**
- **Staging URL to test:**
- **Expected response:**
- **DB evidence to check:**
- **PASS / FAIL / PENDING criteria:**

## Expected Output
-
-
-

## Definition of Done
- [ ] Implementation works
- [ ] Follows existing design rules
- [ ] Tests added or updated
- [ ] Docs updated if needed
- [ ] Preview build confirmed
- [ ] Changes are reviewable in PR description
- [ ] Risk checklist items addressed
- [ ] Verification plan executable

## Test Plan
-
-
-

## Reviewer Notes
-
-
-
