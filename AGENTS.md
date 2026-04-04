# AGENTS.md — Codex / AI Agent 実装ルール

> このファイルは CLAUDE.md のルールを Codex 向けに構造化したものです。
> 正本は CLAUDE.md。このファイルは CLAUDE.md と同期してください。

## 絶対禁止

- D1 テーブルへの直接書き込み（既存 adapter / route がある場合）
- 本番配信動作の無断変更
- 一括編集（シナリオ、配信、リンク、CV）のユーザー確認なし実行
- Agent P2P をメッセージ配信・webhook・cron の critical path に入れること
- 手動管理画面の編集パスの削除
- secrets / tokens / credentials のコミット
- wrangler.toml への secret 格納
- scope 外のファイル変更
- `CREATE TABLE IF NOT EXISTS` を schema 互換性の証拠として扱うこと

## 必須パターン

### tenant_id 解決
```typescript
// super_admin は tenant_id=null。必ず fallback する
const tenantId = auth.tenant_id || body.tenant_id;
let effectiveTenantId = tenantId;
if (!effectiveTenantId) {
  const t = await env.DB.prepare('SELECT id FROM tenants LIMIT 1').first<{id: string}>();
  effectiveTenantId = t?.id;
}
if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required' }, { status: 400 });
```

### fetch パターン
```typescript
// 全 data-loading は async + try-catch + エラーUI
async function loadData() {
  try {
    const r = await fetchJson('/api/...');
    if (!r || r.status !== 'ok') { /* エラー表示 */ return; }
    // データ表示
  } catch (err) {
    // エラー表示（「読み込み中...」のまま放置しない）
  }
}
```

### dashboard ページ
```typescript
// 必ず shared-shell.ts を使う
import { getShellHtml } from './shared-shell';
export function getXxxPageHtml(): string {
  const content = `...`;
  return getShellHtml('xxx', content);
}
```

### テンプレートリテラル内の引用符
```typescript
// onclick 内のシングルクォートは \\\\' を使う
onclick="doSomething(\\\\'value\\\\')"
```

## アーキテクチャ

- **Runtime**: Cloudflare Workers + Hono + D1 (SQLite) + Cron (5min)
- **Routing**: Hono for `/lh/*` and `/webhook`, legacy for `/api/*` and `/dashboard/*`
- **Auth**: JWT (PBKDF2-HMAC-SHA256, 24h)

### Source of Truth
| 機能 | API | 理由 |
|------|-----|------|
| friends, tags, forms, broadcasts | /lh/api/* (upstream) | LINE Harness 形式が充実 |
| scenarios, tracked-links, conversions | /api/* (self-managed) | upstream と status 不一致 |
| line-accounts, bots, knowledge | /api/* (self-managed) | 自前独自 |
| entry-routes, AI chat | /api/* (self-managed) | 自前独自 |

## 実装前監査ゲート（MANDATORY）

Issue に以下の6項目が記載されていること。1つでも欠けたら実装禁止。

1. **Dependency manifest** — packages, utility files, unresolved imports
2. **Required files manifest** — existing files needed, new files, deletions
3. **Route manifest** — target routes, ownership, source of truth
4. **Schema diff** — existing table vs intended changes, conflicts
5. **Live schema check** — actual D1 columns via `/api/debug/schema`
6. **Smoke test** — URL, API, DB evidence, PASS/FAIL criteria

## 実装後チェック

1. `npx wrangler deploy --dry-run --env staging` が通ること
2. scope 外のファイルを変更していないこと
3. 既存 UI states（loading/error/empty）を消していないこと
4. commit message に Issue 番号を含めること

## Migration ルール

- `/api/debug/schema` で実DB確認してから ALTER TABLE
- 1 ALTER TABLE = 1 column = 1 migration file
- `CREATE TABLE IF NOT EXISTS` は冪等（何度実行しても安全）
- duplicate column エラー = 既に存在 → skip
- **"migration ファイルがある" ≠ "カラムが実在する"**
- deploy 後に `/api/verify` の C11-C13 で schema 実在確認
- 新カラムを INSERT/UPDATE に追加する場合は **core INSERT + optional UPDATE** パターンを使う
  - core: 既存カラムのみ（失敗不可）
  - optional: 新カラム（try-catch、失敗しても本流は壊さない）
- `POST /api/debug/migrate` で手動 migration 実行可能

## コードスタイル

- 小さく composable な adapter
- domain logic は service、UI に書かない
- AI prompt は versioned & testable
- 巨大ファイル禁止
- explicit schema > loose object
- deterministic slot extraction > vague prompt-only
