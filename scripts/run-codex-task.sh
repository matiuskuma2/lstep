#!/usr/bin/env bash
# ==============================================================================
# Codex Task Runner — 固定入口 + 監査ゲート
#
# Usage:
#   ./scripts/run-codex-task.sh <issue_number>
#   ./scripts/run-codex-task.sh 135
#
# What it does:
#   1. GitHub Issue から title + body を取得
#   2. 監査ゲート（6項目）が Issue body に含まれるか検査
#   3. 固定プロンプト + Issue 内容を結合して Codex に渡す
#   4. ブランチ作成 → 実装 → commit → push
#
# Requirements:
#   - gh CLI (authenticated)
#   - CODEX_API_KEY or OPENAI_API_KEY in env
# ==============================================================================

set -euo pipefail

REPO="matiuskuma2/lstep"
ISSUE_NUM="${1:?Usage: $0 <issue_number>}"

echo "=== Codex Task Runner ==="
echo "Issue: #${ISSUE_NUM}"
echo ""

# ─── 1. Fetch Issue ───────────────────────────────────────────────────────────
echo ">> Fetching issue #${ISSUE_NUM}..."
ISSUE_JSON=$(gh issue view "$ISSUE_NUM" --repo "$REPO" --json title,body,labels)
ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
ISSUE_BODY=$(echo "$ISSUE_JSON" | jq -r '.body')

echo "   Title: $ISSUE_TITLE"
echo ""

# ─── 2. Audit Gate Check ─────────────────────────────────────────────────────
echo ">> Running audit gate check..."

AUDIT_ITEMS=(
  "Dependency manifest"
  "Required files manifest"
  "Route manifest"
  "Schema diff"
  "Live schema check"
  "Smoke test"
)

AUDIT_PASS=0
AUDIT_FAIL=0

for item in "${AUDIT_ITEMS[@]}"; do
  if echo "$ISSUE_BODY" | grep -qi "$item"; then
    echo "   ✅ $item"
    AUDIT_PASS=$((AUDIT_PASS + 1))
  else
    echo "   ❌ $item — MISSING"
    AUDIT_FAIL=$((AUDIT_FAIL + 1))
  fi
done

echo ""
echo "   Audit: ${AUDIT_PASS}/6 passed, ${AUDIT_FAIL}/6 missing"

if [ "$AUDIT_FAIL" -gt 0 ]; then
  echo ""
  echo "❌ AUDIT GATE FAILED"
  echo "   Issue #${ISSUE_NUM} is missing ${AUDIT_FAIL} audit items."
  echo "   Add the missing items to the Issue body before running Codex."
  echo ""
  echo "   Required sections:"
  for item in "${AUDIT_ITEMS[@]}"; do
    echo "     - $item"
  done
  exit 1
fi

echo "   ✅ Audit gate PASSED"
echo ""

# ─── 3. Branch Setup ─────────────────────────────────────────────────────────
BRANCH="feature/issue-${ISSUE_NUM}-codex"

echo ">> Setting up branch: ${BRANCH}"

# Clean up stale branch if exists
if git rev-parse --verify "$BRANCH" &>/dev/null; then
  echo "   Deleting existing local branch..."
  git branch -D "$BRANCH"
fi
if git ls-remote --heads origin "$BRANCH" | grep -q "$BRANCH"; then
  echo "   Deleting existing remote branch..."
  git push origin --delete "$BRANCH" 2>/dev/null || true
fi

# Create fresh branch from staging
git fetch origin staging
git checkout -b "$BRANCH" origin/staging
echo "   ✅ Branch created from latest staging"
echo ""

# ─── 4. Build Fixed Prompt ───────────────────────────────────────────────────
FIXED_PROMPT=$(cat <<'PROMPT_EOF'
You are implementing a task for the lchatAI project (LINE step delivery + AI orchestration).

## Hard Rules (ALWAYS follow)
- Never write directly to D1 tables if an existing adapter can be used
- Never change delivery behavior without preview/confirm
- Never bulk-edit without human confirmation
- Never introduce Agent P2P into critical delivery/webhook/cron paths
- Never remove manual admin editing paths
- Never commit secrets
- Before any DB write, confirm column existence via migration files
- Use CREATE TABLE IF NOT EXISTS for all new tables
- 1 PR = 1 responsibility, do not touch out-of-scope files
- All dashboard pages must use shared-shell.ts (getShellHtml)
- All fetch calls must have try-catch with error UI (never stay on "読み込み中...")
- Test template literal JS with new Function() mentally before committing
- super_admin has tenant_id=null — always use effectiveTenantId pattern

## Architecture
- Cloudflare Workers + Hono + D1 (SQLite)
- Dual routing: Hono for /lh/* and /webhook, legacy for /api/* and /dashboard/*
- JWT auth (PBKDF2-HMAC-SHA256, 24h)
- Source of truth:
  - friends/tags/forms/broadcasts: upstream /lh/api/*
  - scenarios/tracked-links/conversions/line-accounts/bots/knowledge: self-managed /api/*

## Code Style
- Small composable adapters
- Domain logic in services, not UI
- Explicit schemas over loose objects
- No giant files

## What to implement
Read the Issue description below carefully. Implement ONLY what the Issue describes.
Do NOT add features, refactor code, or make improvements beyond the Issue scope.

## After implementation
- Run: npx wrangler deploy --dry-run --env staging
- Verify build passes
- Commit with descriptive message referencing the Issue number
PROMPT_EOF
)

# ─── 5. Combine and Output ───────────────────────────────────────────────────
FULL_PROMPT="${FIXED_PROMPT}

## Issue #${ISSUE_NUM}: ${ISSUE_TITLE}

${ISSUE_BODY}"

echo ">> Prompt ready ($(echo "$FULL_PROMPT" | wc -c) bytes)"
echo ""

# Save prompt to temp file for review
PROMPT_FILE="/tmp/codex-task-${ISSUE_NUM}.md"
echo "$FULL_PROMPT" > "$PROMPT_FILE"
echo "   Saved to: ${PROMPT_FILE}"
echo ""

# ─── 6. Execute (placeholder — replace with actual Codex CLI) ────────────────
echo ">> Ready to execute."
echo ""
echo "   To run with Codex CLI:"
echo "   codex --prompt-file ${PROMPT_FILE}"
echo ""
echo "   To run with Claude Code:"
echo "   cat ${PROMPT_FILE} | claude --print"
echo ""
echo "   After implementation:"
echo "   git push -u origin ${BRANCH}"
echo "   gh pr create --base staging --head ${BRANCH} --title '${ISSUE_TITLE}' --body 'Closes #${ISSUE_NUM}'"
echo ""
