# 開発計画書

## LINE Harness 全機能 実装状況マトリクス

### コア機能（動作中）
| 機能 | 自前UI | upstream | Service | 状態 |
|------|--------|----------|---------|------|
| friends | ✅ | ✅ | - | 動作中 |
| scenarios + steps | ✅ | ✅ | step-delivery(自前Cron) | 動作中 |
| tags | ✅ | ✅ | - | 動作中 |
| tracked-links + clicks | ✅ | ✅ | auto-track(未接続) | 動作中 |
| conversions | ✅ | ❌(404) | - | CRUD動作 |
| line-accounts | ✅ | ❌(500) | token-refresh(未接続) | 動作中 |
| webhook | Hono | ✅ | event-bus(未接続) | 動作中 |
| entry-routes | ✅ | - | - | 自前のみ |
| auth/admin/tenant | ✅ | - | - | 自前のみ |

### 一覧のみ（作成UI不完全）
| 機能 | 不足 | upstream Service |
|------|------|-----------------|
| broadcasts | 編集/配信実行UI | broadcast + segment-send + segment-query |
| forms | 編集/LIFF UI | - |

### UI未実装（upstream route あり、管理画面なし）
| 機能 | 優先度 | upstream routes | Notes |
|------|--------|----------------|-------|
| automations | 高 | /api/automations, /api/automations/:id, /api/automations/:id/logs | IF-THEN自動化。タグ追加→シナリオ起動等 |
| rich-menus | 中 | /api/rich-menus, /api/rich-menus/:id/default, /api/rich-menus/:id/image | LINE画面下メニュー切替（DB永続化なし、LINE API直接） |
| scoring | 中 | /api/scoring-rules, /api/scoring-rules/:id, /api/friends/:id/score | リードスコアリング。friends.score と連動 |
| reminders | 中 | /api/reminders, /api/reminders/:id, /api/reminders/:id/steps, /api/reminders/:id/enroll/:friendId | 日時指定リマインダー配信 |
| templates | 中 | /api/templates, /api/templates/:id | メッセージテンプレート再利用（step-deliveryで未使用） |
| chats | 低 | /api/chats, /api/chats/:id, /api/chats/:id/send, /api/operators | オペレーター対応チャット |
| notifications | 低 | /api/notifications/rules, /api/notifications/rules/:id, /api/notifications | イベントトリガー通知 |
| affiliates | 低 | /api/affiliates, /api/affiliates/:id, /api/affiliates/click, /api/affiliates/:id/report | アフィリエイト計測 |
| staff | 低 | /api/staff/me, /api/staff, /api/staff/:id, /api/staff/:id/regenerate-key | スタッフ権限管理（API Key認証あり） |
| calendar | 低 | /api/integrations/google-calendar, /connect, /slots, /bookings, /book | Google Calendar予約連携（Service実装済み） |
| stripe | 低 | /api/integrations/stripe/events, /api/integrations/stripe/webhook | 決済連携（Webhook受信は動作） |
| ad-platforms | 低 | /api/ad-platforms, /api/ad-platforms/test, /api/ad-platforms/:id/logs | 広告CV連携（Meta/Google/TikTok/X） |
| images | 低 | /api/images, /images/:key | R2画像管理（未設定） |
| liff | 中 | /auth/line, /auth/callback, /api/liff/profile, /api/liff/link, /api/analytics/* | 内部LP候補 + LINE認証 + ref分析 |
| webhooks(outgoing) | 低 | /api/webhooks/incoming, /api/webhooks/outgoing, /api/webhooks/incoming/:id/receive | 外部サービス連携 |
| users | 低 | /api/users, /api/users/:id, /api/users/:id/link, /api/users/:id/accounts, /api/users/match | システムユーザー管理（friendsとは別） |
| health | 低 | /api/accounts/:id/health, /api/accounts/migrations | アカウント健全性・マイグレーション管理 |

### Services 未接続（LINE Harness にあるが Cron/Worker に未配線）
| Service | 機能 | 影響 | 接続先 |
|---------|------|------|--------|
| broadcast | 一斉配信実行 | 配信ボタンが動かない | Cron + /api/broadcasts/:id/send |
| segment-send | セグメント配信 | タグベース配信不可 | broadcast から呼ばれる |
| segment-query | 配信対象抽出 | 条件検索不可 | segment-send から呼ばれる |
| reminder-delivery | リマインダー | 日時配信不可 | Cron scheduled handler |
| event-bus | イベント連動 | Webhook後の自動処理なし | webhook + automations + notifications |
| auto-track | URL自動追跡化 | メッセージ内URL未計測 | step-delivery + broadcast |
| ban-monitor | BAN検知 | アカウント監視なし | Cron scheduled handler |
| stealth | ステルス配信 | 配信間隔ランダム化なし | broadcast + segment-send |
| token-refresh | トークン更新 | Access Token手動更新 | Cron scheduled handler |
| ad-conversion | 広告CV送信 | 広告API CV 連携なし | event-bus → ad-platforms |
| google-calendar | Google Calendar連携 | ✅ Service実装済み・route接続済み | calendar.ts route |

### 自前API CRUD不足（UPDATE/DELETE未実装）
| 機能 | GET | POST | PUT/PATCH | DELETE | 不足 |
|------|-----|------|-----------|--------|------|
| friends | ✅ | ✅ | ❌ | ❌ | 個別更新・削除なし |
| broadcasts | ✅ | ✅ | ❌ | ❌ | 編集・削除なし |
| forms | ✅ | ✅ | ❌ | ❌ | 編集・削除なし |
| tags | ✅ | ✅ | ❌ | ❌ | 編集・削除なし |
| conversion-points | ✅ | ✅ | ❌ | ❌ | 編集・削除なし |
| tracked-links | ✅ | ✅ | ❌ | ❌ | 編集・削除・クリック分析なし |
| entry-routes | ✅ | ✅ | ❌ | ✅ | 編集なし |

### 自前独自機能
| 機能 | 状態 |
|------|------|
| bots (system_prompt) | ✅ 動作中 |
| knowledge + chunks | ✅ RAG基盤あり |
| ai-chat | ⚠️ 要再設計 |
| ai-logs | ✅ 動作中 |
| /api/verify (自動検証) | ✅ 10項目PASS |
| post-deploy auto-check | ✅ GitHub Actions |

## 現状評価

### スコアカード
| カテゴリ | スコア |
|---------|--------|
| コア配信（Webhook → Push → Cron） | 9/10 |
| LINE Harness 統合（27ルート） | 8/10 |
| Knowledge 管理 | 8/10 |
| 管理画面 | 7/10 |
| DB スキーマ | 7/10 |
| AI Intent 検出 | 6/10 |
| AI 実行（mutation） | 2/10 |
| 計測・アトリビューション | 2/10 |

### 動いているもの
- LINE Webhook → 友だち登録 → 名前取得
- ステップ配信（即時1通目 + Cron 2通目以降）
- Tracked Link クリック計測
- シナリオ CRUD + status 切替
- Entry Route 管理画面
- LINE アカウント管理（登録・編集・削除）
- Bot + Knowledge + RAG 基盤
- AI チャット（intent 検出 + slot 抽出）
- 自動検証（/api/verify 10項目）
- post-deploy 自動チェック

### 動いていないもの
- AI チャットが「質問型」で提案がない
- AI mutation（シナリオ + ステップ一括作成）
- Entry Route → Webhook で ref_code 保存
- アトリビューションレポート
- 内部 LP ホスティング
- 外部 LP 計測（callback/GTM/CAPI）
- 自動化（automations, scoring）
- リッチメニュー管理
- 通知ルール管理

---

## ビジネス要件

### ユーザーが本当にやりたいこと
1. SNS ごとの**流入元計測**
2. LINE 登録後の**ステップ配信**
3. 各通の**クリック計測**
4. LP / HP 遷移後の **CV 計測**
5. 上記を**チャットで指示して一括構築**
6. **どの流入元 → どのシナリオ → どのリンク → どのLP → どのCV** を追えること

### 計測の正しい優先順位
1. **内部 LP を先に** — サーバーサイドで高精度計測
2. **外部 LP は後で** — callback/GTM/CAPI が必要、精度は条件付き

---

## 概念の整理

### Entry Route（流入元）= 入口
- どこから LINE 登録されたか
- 例: instagram, youtube, tiktok, hp, seminar
- friends.ref_code に保存

### Tracked Link = 出口
- ステップ内のどのリンクをクリックしたか
- 例: 3通目の LP リンク、予約ページリンク
- link_clicks テーブルに記録

### 両方必要な理由
- 入口分析: Instagram から来た人は何人か
- 出口分析: 3通目の LP リンクは何人押したか
- つなげると: Instagram から来た人のうち、3通目リンクを押して CV した人数

### LP の種類
| 種類 | CV 計測 | 精度 |
|------|---------|------|
| 内部 LP（自社サーバー） | server-side 記録 | 高い |
| 外部 LP + callback | callback/GTM/CAPI | 条件付き |
| 外部 LP（未対応） | click のみ | CV 不可 |

---

## AI チャット再設計方針

### 現在の問題
- 11個の slot を1つずつ質問する「フォーム入力型」
- トリガー、メッセージ目標、目的地 LP が曖昧
- 提案がない、質問ばかり
- 計測導線の提案がない

### 目指す形
- **提案型**: AI がまず仮説案を出す
- **計測込み**: 流入元・tracked link・LP・CV を同時に提案
- **最小質問**: デフォルト前提を固定し、聞くのは最小限

### デフォルト固定
- trigger = friend_add（聞かない）
- KPI = click_count + conversion_count（聞かない）
- LINE アカウント = 1つなら自動、複数なら選択

### 毎回聞くもの（最小）
- 流入元名
- 通数
- 最終 CV は何か
- LP が内部か外部か

### 理想フロー
```
ユーザー: 「Instagram流入向けに3通ステップを作って」

AI: 「3通構成を提案します。
  1通目: 挨拶＋導入
  2通目: 事例・信頼形成
  3通目: LP誘導＋CV導線（tracked link 付き）

  入口: instagram 用友だち登録リンク
  クリック計測: 3通目に tracked link
  最終CV: [何を CV にしますか？]
  LP: [内部/外部どちらにしますか？]

  上記でよければ作成します。」
```

---

## Phase 計画

### Phase 1: AI チャット再設計（最重要）
- [ ] プロンプト全面改修（提案型）
- [ ] デフォルト前提の固定
- [ ] ステップ本文案の生成
- [ ] 計測導線の同時提案
- [ ] tenant_id 自動解決

### Phase 2: 計測導線の接続
- [ ] Entry Route → Webhook で ref_code 保存
- [ ] Tracked Link → シナリオステップ紐付け
- [ ] アトリビューションクエリ（流入元→クリック→CV）
- [ ] レポート UI

### Phase 3: AI mutation 完成
- [ ] シナリオ + ステップ一括作成
- [ ] Tracked Link + CV の同時作成
- [ ] 確認フローの完成
- [ ] エラーハンドリング

### Phase 4: 内部 LP
- [ ] LP ホスティング（R2 or Workers）
- [ ] server-side CV 記録
- [ ] attribution params の受け渡し
- [ ] サンキューページ CV タグ

### Phase 5: 外部 LP
- [ ] 計測設計の明文化
- [ ] callback 仕様定義
- [ ] GTM / CAPI 設計
- [ ] tracking script 発行

### Phase 6: 運用強化
- [ ] 自動化（automations, scoring）
- [ ] リッチメニュー管理
- [ ] レポート UI 拡張
- [ ] 改善 Bot / PDCA

---

## routing ownership（確定）

| パス | ハンドラ | 用途 |
|------|---------|------|
| /webhook | Hono | LINE Webhook |
| /lh/* | Hono | LINE Harness upstream |
| /api/* | Legacy | 自前 API（JWT 認証） |
| /dashboard/* | Legacy | 管理画面 HTML |
| /chat | Legacy | AI チャット |
| /admin | Legacy | Super Admin |
| /r/:ref | Legacy | 流入元ランディングページ |
| /t/:id | Legacy | Tracked Link リダイレクト |

---

## source of truth（確定）

| 機能 | 一覧 | 詳細/操作 | 理由 |
|------|------|----------|------|
| friends | /lh/api/friends | 自前 webhook | upstream 形式が充実 |
| scenarios | /api/scenarios | /api/scenarios/:id | upstream は status 不一致 |
| tags | /lh/api/tags | - | upstream で十分 |
| forms | /lh/api/forms | - | upstream で十分 |
| broadcasts | /lh/api/broadcasts | - | upstream で十分 |
| tracked-links | /api/tracked-links | /api/tracked-links | 自前で作成・クリック記録 |
| conversions | /api/conversion-points | - | upstream 404 |
| line-accounts | /api/line-accounts | /api/line-accounts/:id | upstream 500 |
| entry-routes | /api/entry-routes | - | 自前独自 |
| bots | /api/bots | - | 自前独自 |
| knowledge | /api/knowledge | /api/knowledge/:id | 自前独自 |
| AI chat | /api/ai/chat | - | 自前独自 |
| admin | /api/admin/* | - | 自前独自 |

---

## LINE Harness DB テーブル一覧（57テーブル）

### コア
friends, users, scenarios, scenario_steps, friend_scenarios, tags, friend_tags

### メッセージング
templates, messages_log, broadcasts, chats, operators

### トラッキング・計測
tracked_links, link_clicks, entry_routes, ref_tracking, conversion_points, conversion_events

### スコアリング
scoring_rules, friend_scores

### リマインダー
reminders, reminder_steps, friend_reminders, friend_reminder_deliveries

### 自動化
automations, automation_logs

### フォーム
forms, form_submissions

### 外部連携
stripe_events, google_calendar_connections, calendar_bookings, ad_platforms, ad_conversion_logs

### 通知・Webhook
notification_rules, notifications, incoming_webhooks, outgoing_webhooks

### アカウント管理
line_accounts, account_health_logs, account_migrations, staff_members

### アフィリエイト
affiliates, affiliate_clicks

### 自前独自テーブル
bots, bot_knowledge, knowledge_items, knowledge_chunks, ai_execution_logs, admin_users, tenants

---

## デグレ防止ルール

1. **実装前に必ず監査ゲートを通す**（6項目）
2. **1機能1Issue、まとめて取り込まない**
3. **migration 前に /api/debug/schema で実DB確認**
4. **upstream と自前の二重管理を放置しない**
5. **API で自動化できることは手動入力を求めない**
6. **deploy 後に /api/verify で自動検証**
