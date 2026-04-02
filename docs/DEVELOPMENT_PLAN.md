# 開発計画書

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

## デグレ防止ルール

1. **実装前に必ず監査ゲートを通す**（6項目）
2. **1機能1Issue、まとめて取り込まない**
3. **migration 前に /api/debug/schema で実DB確認**
4. **upstream と自前の二重管理を放置しない**
5. **API で自動化できることは手動入力を求めない**
6. **deploy 後に /api/verify で自動検証**
