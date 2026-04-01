# Migration History

## Overview
- Database: Cloudflare D1 (lstep-db)
- Migration は GitHub Actions workflow で実行
- `CREATE TABLE IF NOT EXISTS` はカラム互換性を保証しない
- ALTER TABLE は 1 カラム = 1 ファイルで実行

## Migration List

| # | File | Purpose | Status |
|---|------|---------|--------|
| 001 | tracked_links.sql | tracked_links + link_clicks | ✅ Applied |
| 002 | auth_tenant.sql | users, tenants, tenant_settings | ✅ Applied |
| 003 | scenarios.sql | scenarios, scenario_steps | ✅ Applied |
| 004 | tags_cv.sql | tags, conversion_points | ✅ Applied |
| 005 | friends_broadcasts_forms.sql | friends, broadcasts, forms | ✅ Applied |
| 006 | bots_knowledge.sql | bots, knowledge_items, bot_knowledge_bindings | ✅ Applied |
| 007 | ai_execution_logs.sql | ai_execution_logs | ✅ Applied |
| 008 | bot_system_prompt.sql | ALTER bots ADD system_prompt | ✅ Applied |
| 009 | rag_foundation.sql | knowledge_chunks + knowledge_items extension | ✅ Applied |
| 010 | line_harness_full_schema.sql | LINE Harness 39 tables (CREATE IF NOT EXISTS) | ⚠️ Partial (column conflicts) |
| 011 | align_existing_tables.sql | ALTER TABLE + CREATE for missing tables | ⚠️ Partial (duplicate columns) |
| 012 | safe_align_line_harness.sql | CREATE only (no ALTER) | ✅ Applied |
| 013 | friends_add_line_harness_columns.sql | ALTER friends ADD picture_url etc | ⚠️ Partial (some duplicates) |
| 014 | friends_add_is_following.sql | ALTER friends ADD is_following | ✅ Applied |
| 015 | friends_add_score.sql | ALTER friends ADD score | ✅ Applied |
| 016 | friends_add_updated_at.sql | ALTER friends ADD updated_at | ✅ Applied |

## Lessons Learned

1. **`CREATE TABLE IF NOT EXISTS` は安全ではない** — 既存テーブルのカラム構造を更新しない
2. **ALTER TABLE は 1 カラムずつ** — D1 は複数 ALTER を 1 トランザクションで実行するとロールバックされる
3. **migration 前に `/api/debug/schema` で実カラムを確認** — CLAUDE.md の必須ルール
4. **LINE Harness schema と自前 schema のカラム差異に注意** — tenant_id, ref_code は自前のみ
