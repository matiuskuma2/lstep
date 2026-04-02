# System Overview

## Architecture

lchatAI は LINE Harness OSS をベースにした LINE ステップ配信 + AI オーケストレーションシステム。

### Runtime
- **Cloudflare Workers** (Hono + legacy handler)
- **Cloudflare D1** (SQLite, 49 tables)
- **Cron Triggers** (5分間隔, ステップ配信)

### Routing Ownership

```
/webhook          → Hono (LINE Webhook 受信)
/lh/*             → Hono (LINE Harness upstream routes, 27 endpoints)
/api/*            → Legacy handler (自前実装, 認証付き)
/dashboard/*      → Legacy handler (管理画面 HTML)
/chat             → Legacy handler (AI チャット)
/admin            → Legacy handler (super_admin パネル)
/login, /setup    → Legacy handler (認証画面)
```

### Source of Truth

| 機能 | 一覧 API | 詳細/操作 | DB |
|------|---------|----------|-----|
| friends | `/lh/api/friends` (upstream) | 自前 webhook で保存 | friends テーブル |
| scenarios | `/lh/api/scenarios` (upstream) | `/api/scenarios/:id` (自前) | scenarios + scenario_steps |
| tags | `/lh/api/tags` (upstream) | - | tags |
| forms | `/lh/api/forms` (upstream) | - | forms |
| broadcasts | `/lh/api/broadcasts` (upstream) | - | broadcasts |
| tracked-links | `/lh/api/tracked-links` (upstream) | - | tracked_links + link_clicks |
| conversions | `/api/conversion-points` (自前) | - | conversion_points |
| line-accounts | `/api/line-accounts` (自前) | - | line_accounts |
| bots | `/api/bots` (自前) | - | bots |
| knowledge | `/api/knowledge` (自前) | - | knowledge_items + knowledge_chunks |
| AI chat | `/api/ai/chat` (自前) | - | ai_execution_logs |
| admin/tenant | `/api/admin/*` (自前) | - | users + tenants + tenant_settings |

### LINE Harness Bridge

`src/line-harness/index.ts` が Env 型を export し、upstream の 27 Hono ルートが動作。
upstream ルートは `/lh/*` にマウント。自前ルートとは完全分離。

### Webhook Flow

```
LINE Platform → POST /webhook (Hono)
  → 署名検証 (line_accounts の channel_secret)
  → follow: friend 保存 → enrollment 作成 → 即時 push (step 1) → Cron (step 2+)
  → unfollow: is_following = 0
```

### Step Delivery Flow

```
Webhook follow → enrollment (current_step_order=1, next_delivery_at=+1min)
                 → await push step 1 (即時)
Cron (5min)    → due enrollments を検索
               → step N+1 を送信
               → messages_log に記録
               → 次の step があれば next_delivery_at 更新
               → なければ completed
```

### Auth

- JWT (PBKDF2-HMAC-SHA256, 24h expiry)
- super_admin: tenant_id = null, 全テナント管理
- admin: tenant_id 付き, 自テナントのみ
- LINE Harness upstream: API_KEY ベース (設定不要で動作)

### Tenant Model

- 各 admin は 1 tenant に所属
- super_admin は tenant なし (作成時に tenant_id を body で指定)
- friends, scenarios, tags, forms 等は tenant_id でスコープ
- LINE Harness upstream は tenant 概念なし (全件返却)
