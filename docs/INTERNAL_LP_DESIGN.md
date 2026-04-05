# Phase 4: 内部LP設計

## 概要

内部LPは、サーバーサイドでホスティングするランディングページ。
外部LPと違い、以下の全パラメータを server-side で保持・記録できる:

- click_id
- tracked_link_id
- friend_id (ref から推定)
- entry_route
- scenario_id
- step_id
- conversion_point_code

## アーキテクチャ

```
ステップ配信
  → tracked link (/t/:id)
    → click 記録 (link_clicks)
    → redirect to 内部LP (/lp/:slug)
      → LP 表示 (lp_variants から HTML 取得)
      → params 保持 (click_id, tracked_link_id in URL or cookie)
      → CTA → thank-you page (/lp/:slug/thanks)
        → conversion 記録 (conversion_events)
        → server-side CV 完了
```

## データモデル

### lp_variants テーブル
```sql
CREATE TABLE IF NOT EXISTS lp_variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,       -- URL パス: /lp/:slug
  name TEXT NOT NULL,              -- 管理名
  lp_type TEXT NOT NULL DEFAULT 'internal',  -- internal | external
  html_content TEXT,               -- 内部LP の HTML
  css_content TEXT,                -- カスタム CSS
  meta_title TEXT,                 -- <title>
  meta_description TEXT,           -- <meta description>
  og_image_url TEXT,               -- OGP 画像
  conversion_point_id TEXT,        -- 紐付け CV ポイント
  source_url TEXT,                 -- 元になった外部LP URL（再構成元）
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### LP アクセスログ（lp_views）
```sql
CREATE TABLE IF NOT EXISTS lp_views (
  id TEXT PRIMARY KEY,
  lp_variant_id TEXT NOT NULL,
  click_id TEXT,                   -- link_clicks.id から
  tracked_link_id TEXT,            -- どの tracked link 経由か
  friend_ref TEXT,                 -- ref_code or friend_id
  user_agent TEXT,
  ip_hash TEXT,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lp_variant_id) REFERENCES lp_variants(id)
);
```

## ルーティング

| パス | 処理 |
|------|------|
| GET /lp/:slug | LP 表示（HTML レンダリング） |
| GET /lp/:slug/thanks | サンキューページ + CV 記録 |
| POST /lp/:slug/convert | API で CV 記録（フォーム submit 等） |

## 計測フロー

### 1. tracked link → LP
```
/t/:id
  → link_clicks に記録（click_id 生成）
  → redirect to /lp/:slug?click_id=xxx&tlid=yyy
```

### 2. LP 表示
```
/lp/:slug?click_id=xxx&tlid=yyy
  → lp_views に記録
  → click_id, tlid を hidden field or URL に保持
  → LP HTML をレンダリング
```

### 3. CV 記録
```
/lp/:slug/thanks?click_id=xxx&tlid=yyy
  → conversion_events に記録
    - conversion_point_id = lp_variant.conversion_point_id
    - tracked_link_id = tlid
    - click_id = click_id
    - friend_id = click から逆引き（click → friend）
  → サンキューページ表示
```

## tracked link との接続

tracked_links テーブルには既に `lp_variant_slug` カラムがある。
- tracked link 作成時に lp_variant_slug を設定
- redirect 時に `/lp/:slug?click_id=xxx&tlid=:id` に遷移

## AI chat との接続

AI が提案型でシナリオ作成する際:
1. `proposal.tracked_link.destination_url` が空の場合
2. AI が「内部LPを作成しますか？」と提案
3. ユーザーが OK → lp_variant を作成
4. tracked_link の destination_url を `/lp/:slug` に設定

## URL → 内部LP 再構成パイプライン（将来）

### Phase 4a: 基本
- lp_variants テーブル + CRUD
- /lp/:slug レンダリング
- click_id 引き継ぎ
- CV 記録

### Phase 4b: URL 取り込み
- URL → HTML fetch → 構造解析
- ヒーロー / CTA / セクション抽出
- 内部テンプレートへマッピング
- スクリーンショット補助（optional）

### Phase 4c: AI 再構成
- Gemini Flash Image で見た目補正
- AI chat から「内部化しますか？」提案
- テンプレート選択 → 自動生成

## 実装順序

1. **Issue 1**: lp_variants テーブル + CRUD API + 管理画面
2. **Issue 2**: /lp/:slug レンダリング + lp_views 記録
3. **Issue 3**: tracked link → LP redirect + click_id 引き継ぎ
4. **Issue 4**: CV 記録（/lp/:slug/thanks + conversion_events）
5. **Issue 5**: URL → 内部LP 再構成（HTML fetch + 構造解析）
