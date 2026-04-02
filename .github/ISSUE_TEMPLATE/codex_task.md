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

## Pre-Implementation Audit Gate
**以下が全て埋まるまで、この Issue は Codex に渡してはいけない。**

### Dependency manifest
- 必要な package:
- 必要な utility file:
- unresolved import 確認結果:

### Required files manifest
- この実装で必須の既存ファイル:
- 新規追加が必要なファイル:
- 削除/無効化するファイル:

### Route manifest
- 対象 route:
- 既存 route 流用 or 独自 route:
- source of truth:

### Schema diff
- 対象テーブル:
- 追加/変更カラム:
- 衝突カラム:
- migration リスク:
- `/api/debug/schema` で実DB確認済み: [ ] Yes [ ] No

### Live schema check result
<!-- /api/debug/schema の結果から対象テーブルのカラム一覧を貼る -->
```
(ここに貼る)
```

### Smoke test
- URL:
- API:
- DB evidence:
- PASS条件:
- FAIL条件:

### Audit Gate Result
- [ ] dependency manifest 完了
- [ ] required files manifest 完了
- [ ] route manifest 完了
- [ ] schema diff 完了
- [ ] live schema check 完了
- [ ] smoke test 定義完了

**⚠️ 上記がすべて完了するまで Codex に渡さない。**

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
