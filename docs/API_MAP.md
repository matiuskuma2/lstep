# API Map

## Routing Architecture

```
Request → export default fetch()
  ├─ /webhook, /lh/* → Hono app (LINE Harness upstream)
  └─ everything else → legacyFetch() (自前実装)
```

## Self-Managed APIs (/api/*)

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | なし | ログイン → JWT 発行 |
| GET | /api/auth/me | JWT | 現在のユーザー情報 |
| POST | /api/admin/bootstrap | なし | 初回 super_admin 作成 |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/admin/users | super_admin | ユーザー一覧 |
| POST | /api/admin/users | super_admin | admin 作成 |
| PATCH | /api/admin/users/:id | super_admin | admin 編集 |
| PATCH | /api/admin/users/:id/status | super_admin | ステータス変更 |
| DELETE | /api/admin/users/:id | super_admin | 論理削除 |
| GET | /api/admin/tenants | super_admin | テナント一覧 |
| PATCH | /api/admin/tenants/:id | super_admin | テナント編集 |

### LINE Accounts
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/line-accounts | admin+ | 一覧 |
| POST | /api/line-accounts | admin+ | 登録 |
| PATCH | /api/line-accounts/:id | admin+ | 編集 |
| DELETE | /api/line-accounts/:id | admin+ | 削除 |

### Scenarios
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/scenarios | admin+ | 一覧 |
| POST | /api/scenarios | admin+ | 作成 |
| GET | /api/scenarios/:id | admin+ | 詳細 |
| PUT | /api/scenarios/:id | admin+ | 更新 |
| DELETE | /api/scenarios/:id | admin+ | 削除 (cascade) |
| GET | /api/scenarios/:id/steps | admin+ | ステップ一覧 |
| POST | /api/scenarios/:id/steps | admin+ | ステップ追加 |

### Other Resources
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST | /api/friends | admin+ | 友だち管理 |
| GET/POST | /api/tags | admin+ | タグ管理 |
| GET/POST | /api/conversion-points | admin+ | CV管理 |
| GET/POST | /api/broadcasts | admin+ | 配信管理 |
| GET/POST | /api/forms | admin+ | フォーム管理 |
| GET/POST | /api/bots | admin+ | Bot管理 |
| GET/POST | /api/knowledge | admin+ | Knowledge管理 |
| PATCH/DELETE | /api/knowledge/:id | admin+ | Knowledge編集/削除 |

### AI
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/ai/chat | なし | AI チャット (Bot+Knowledge対応) |
| GET | /api/ai/logs | super_admin | 実行ログ |
| GET/POST | /api/ai/test | なし | AI テスト |

### Debug / Verification
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/verify | なし | 自動検証 (10項目) |
| GET | /api/debug/schema | なし | D1 テーブル/カラム一覧 |
| GET | /api/debug/db | なし | DB 状態確認 |
| GET | /api/debug/upstream-smoke | なし | upstream 全ルートテスト |

## Upstream APIs (/lh/*)

LINE Harness OSS の完全な API。27 ルートファイル。

### 主要エンドポイント (確認済み)
| Path | Status | Description |
|------|--------|-------------|
| /lh/api/friends | 200 | 友だち一覧 (upstream形式) |
| /lh/api/scenarios | 200 | シナリオ一覧 |
| /lh/api/tags | 200 | タグ一覧 |
| /lh/api/forms | 200 | フォーム一覧 |
| /lh/api/broadcasts | 200 | 配信一覧 |
| /lh/api/tracked-links | 200 | トラッキングリンク一覧 |
| /lh/api/automations | 200 | 自動化一覧 |
| /lh/api/reminders | 200 | リマインダー一覧 |
| /lh/api/templates | 200 | テンプレート一覧 |
| /lh/api/chats | 200 | チャット一覧 |
| /lh/api/affiliates | 200 | アフィリエイト一覧 |
| /lh/api/staff | 403 | 権限チェック正常 |
| /lh/api/line-accounts | 500 | upstream 側エラー (自前を使用) |

## Webhook
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | /webhook | Hono直接 | LINE Webhook 受信 |
| GET | /webhook | Hono直接 | 疎通確認 |

## Dashboard Pages
| Path | Description |
|------|-------------|
| /dashboard | トップ (KPI 数値) |
| /dashboard/scenarios | シナリオ管理 |
| /dashboard/friends | 友だち管理 |
| /dashboard/tags | タグ管理 |
| /dashboard/tracked-links | トラッキングリンク |
| /dashboard/conversions | CV管理 |
| /dashboard/broadcasts | 配信管理 |
| /dashboard/forms | フォーム管理 |
| /dashboard/bots | Bot管理 |
| /dashboard/knowledge | Knowledge管理 |
| /dashboard/line-accounts | LINEアカウント管理 |
| /dashboard/ai-logs | AI実行ログ |
| /admin | Super Admin パネル |
| /chat | AI チャット |
| /login | ログイン |
| /setup | 初期セットアップ |
