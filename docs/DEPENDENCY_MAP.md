# Dependency Map

## Package Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| hono | ^4.0.0 | HTTP framework (upstream routes + webhook) |

## File Architecture

```
src/
├── index.ts                    # Main entry: routing split (Hono + legacy)
├── ai/
│   ├── engine.ts               # AI plan generation (OpenAI GPT-4o-mini)
│   ├── prompts.ts              # System prompts (7 intents)
│   └── types.ts                # AI request/response types
├── auth/
│   ├── service.ts              # JWT, password hashing, login, bootstrap
│   ├── admin-service.ts        # Admin/tenant CRUD
│   ├── middleware.ts           # extractAuth, requireRole, requireTenant
│   └── types.ts                # User, Tenant, AuthPayload types
├── adapters/                   # Self-managed DB adapters (tenant-scoped)
│   ├── bot-knowledge.ts        # BotAdapter, KnowledgeAdapter
│   ├── broadcast.ts            # BroadcastAdapter
│   ├── conversion-point.ts     # ConversionPointAdapter
│   ├── execution-log.ts        # ExecutionLogAdapter
│   ├── form.ts                 # FormAdapter
│   ├── friend.ts               # FriendAdapter
│   ├── knowledge-chunk.ts      # KnowledgeChunkAdapter, chunkText()
│   ├── scenario.ts             # ScenarioAdapter
│   ├── tag.ts                  # TagAdapter
│   └── tracked-link.ts         # TrackedLinkAdapter
├── pages/                      # Dashboard HTML pages
│   ├── shared-shell.ts         # 共通 shell (sidebar, authHeaders, fetchJson)
│   ├── dashboard.ts            # トップページ
│   ├── scenarios.ts            # シナリオ管理
│   ├── friends-broadcasts-forms.ts # 友だち/配信/フォーム
│   ├── tags-cv.ts              # タグ/CV
│   ├── bot-knowledge.ts        # Bot/Knowledge
│   ├── line-accounts.ts        # LINE アカウント管理
│   ├── ai-logs.ts              # AI 実行ログ
│   └── admin.ts                # Super Admin パネル
└── line-harness/               # LINE Harness OSS (upstream, bridge 経由)
    ├── index.ts                # Env type bridge (25 lines)
    ├── db/                     # 25 DB adapters
    ├── line-sdk/               # LINE Messaging API client
    ├── routes/                 # 27 Hono routes (mounted at /lh)
    ├── services/               # 12 services (step-delivery, broadcast, etc.)
    ├── middleware/              # auth, rate-limit, role-guard
    ├── shared/                 # Shared types
    └── utils/                  # flex-alt-text etc.
```

## Key Dependencies

### Webhook → Step Delivery
```
POST /webhook (Hono)
  → verifySignature (line-harness/line-sdk/webhook.ts)
  → friends table (direct SQL)
  → scenarios table (direct SQL)
  → friend_scenarios table (enrollment)
  → LINE Push API (await fetch)
  → Cron scheduled handler → friend_scenarios → scenario_steps → LINE Push API
```

### Dashboard → API
```
shared-shell.ts (authHeaders, fetchJson)
  → /lh/api/* (upstream, no auth needed)
  → /api/* (self-managed, JWT auth)
```

### AI Chat → Bot/Knowledge
```
/api/ai/chat
  → engine.ts (generatePlan)
  → BotAdapter.getWithKnowledge()
  → KnowledgeChunkAdapter.listByKnowledgeIds()
  → OpenAI API (GPT-4o-mini)
  → ExecutionLogAdapter.record()
```

## Shared Components

### shared-shell.ts
全 dashboard ページの共通基盤:
- sidebar メニュー
- authHeaders() — JWT Bearer token
- fetchJson() — auth 付き fetch + error handling
- showList/showError — 一覧表示 + エラー表示
- getSelectedTenantId() — super_admin 用テナント選択
- esc() — XSS 防止

### line-harness/index.ts (bridge)
LINE Harness upstream の全ルートが動作するための Env 型定義。
これ 1 ファイル (25行) で 27 ルートが有効化された。
