# Integration Contract: Friends / Webhook / Dashboard

> 確定版。このドキュメントが friends 関連の source of truth です。

## 現状の問題

### 1. スキーマ衝突
- Migration 005: `tenant_id, status, ref_code, metadata` あり、`user_id, line_account_id` なし
- Migration 010: `user_id` あり、`tenant_id, status, ref_code, metadata` なし
- Migration 013: `is_following, score, status_message, picture_url` を 005 に追加
- 実テーブルは 005 → 013 → 010 の順で実行されるため、005 のスキーマが生き残る（CREATE TABLE IF NOT EXISTS）

### 2. 二重 INSERT
- `src/index.ts` webhook: `tenant_id, status, is_following, score` を書く
- `src/line-harness/db/friends.ts` upsertFriend: `display_name, picture_url, status_message, is_following` を書く
- 同じテーブルに異なるカラムセットで書き込み

### 3. Dashboard の混在
- 友だち一覧: `/lh/api/friends` を呼ぶ（LINE Harness 形式）
- 友だち追加: `/api/friends` を呼ぶ（自前形式）
- 表示と作成で source of truth が違う

---

## 確定: Source of Truth

| 操作 | 正 | 理由 |
|------|---|------|
| 友だち一覧 | `/lh/api/friends` | 形式が充実（tags, pagination, ref-stats） |
| 友だち詳細 | `/lh/api/friends/:id` | tags, messages 含む |
| 友だち作成（webhook） | `src/index.ts` webhook | 実配信パスの正本 |
| 友だち作成（手動） | `/api/friends` → **廃止予定** | dashboard からの手動追加は upstream に寄せる |
| 友だち ref_code 更新 | `src/index.ts` webhook (attribution) | `/r/:ref` → ref_tracking → webhook match |
| タグ操作 | `/lh/api/friends/:id/tags` | upstream が正 |
| metadata 操作 | `/lh/api/friends/:id/metadata` | upstream が正 |

---

## 確定: Webhook Contract

### Primary Webhook: POST /webhook（src/index.ts）

これが**唯一の友だち作成パス**。LINE Harness webhook は使わない（ルーティングで /webhook は src/index.ts の Hono app が処理）。

#### Follow イベント

```
1. SELECT id FROM friends WHERE line_user_id = ?
2. IF existing → UPDATE is_following = 1
   IF new → INSERT (全カラム)
3. ref_tracking から ref_code マッチ
4. シナリオ enrollment + step 1 push
```

#### 書き込むカラム（確定）

| カラム | 値 | 必須 |
|--------|---|------|
| id | UUID | yes |
| tenant_id | テナントID（DB fallback） | yes |
| line_user_id | LINE UID | yes |
| display_name | LINE UID（初期値、後で profile fetch で更新） | yes |
| status | 'active' | yes |
| is_following | 1 | yes |
| score | 0 | yes |
| ref_code | ref_tracking マッチ結果 or null | no |
| created_at | ISO string | yes |
| updated_at | ISO string | yes |

#### 書かないカラム（後から更新される）

| カラム | 更新元 | タイミング |
|--------|-------|-----------|
| picture_url | LINE Profile API or /lh/api | 非同期 |
| status_message | LINE Profile API or /lh/api | 非同期 |
| metadata | /lh/api/friends/:id/metadata | 手動 or フォーム |
| user_id | /lh/api/users/:id/link | LINE ログイン時 |
| line_account_id | webhook 拡張（未実装） | マルチアカウント時 |

---

## 確定: Route Ownership

| Route | Owner | DB 操作 |
|-------|-------|---------|
| POST /webhook (follow) | src/index.ts Hono app | INSERT/UPDATE friends |
| GET /lh/api/friends | LINE Harness (upstream) | SELECT friends |
| GET /lh/api/friends/:id | LINE Harness (upstream) | SELECT friends + tags |
| GET /lh/api/friends/count | LINE Harness (upstream) | SELECT COUNT |
| POST /lh/api/friends/:id/tags | LINE Harness (upstream) | INSERT friend_tags |
| PUT /lh/api/friends/:id/metadata | LINE Harness (upstream) | UPDATE friends.metadata |
| GET /api/friends | src/index.ts (legacy) | SELECT friends (tenant-scoped) |
| POST /api/friends | src/index.ts (legacy) | INSERT friends — **廃止予定** |

---

## 確定: Dashboard Contract

| ページ | API | 操作 |
|--------|-----|------|
| /dashboard/friends 一覧 | GET /lh/api/friends | 読み取り |
| /dashboard/friends 追加 | **POST /lh/api/friends (upstream に移行)** | 作成 |
| /dashboard/friends 詳細 | GET /lh/api/friends/:id | 読み取り |
| /dashboard/friends タグ | POST /lh/api/friends/:id/tags | 操作 |

---

## 必要な修正（優先順）

### 1. Webhook INSERT の全カラム対応（高）
現在の INSERT に `metadata` と `line_account_id` が欠けている。
追加: `metadata DEFAULT '{}'`, `line_account_id` (matched account から)

### 2. Dashboard 友だち追加を upstream に寄せる（中）
現在 `/api/friends` POST を呼んでいるが、upstream `/lh/api/friends` の POST は存在しない。
→ 当面は `/api/friends` POST を残すが、全カラム書き込みに修正。

### 3. Migration の統合（低）
005 + 013 + 010 の衝突を整理する統合 migration を作成。
ただし CREATE TABLE IF NOT EXISTS なので実害は少ない（005 が勝つ）。

---

## ステップ配信 運用監査チェックリスト

| # | テスト | 方法 | PASS 条件 |
|---|--------|------|----------|
| 1 | 1通シナリオ | friend_add → step 1 即時配信 | LINE に届く |
| 2 | 3通シナリオ | step 1 即時 + step 2,3 Cron | 3通全て届く |
| 3 | delay あり | step 2 に delay_minutes=1440 | 翌日に届く |
| 4 | draft シナリオ | status=draft のシナリオ | 配信されない |
| 5 | active シナリオ | status=active のシナリオ | 配信される |
| 6 | 複数シナリオ | 2つの friend_add シナリオ | 最初の1つだけ |
| 7 | ブロック後再追加 | unfollow → re-follow | 再 enrollment |
| 8 | 重複 enrollment | 同じ friend に2回 follow | 1つの enrollment |
| 9 | ref_code 保存 | /r/instagram → follow | friends.ref_code = 'instagram' |
| 10 | tracked link クリック | step 内の /t/:id クリック | link_clicks に記録 |
