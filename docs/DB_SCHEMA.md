# DB Schema

## Overview
- **Database**: Cloudflare D1 (SQLite)
- **Total tables**: 49
- **Source**: 自前 migration (001-009) + LINE Harness schema (010-016)

## Core Tables

### users (認証)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| tenant_id | TEXT | null for super_admin |
| role | TEXT | 'super_admin' or 'admin' |
| login_id | TEXT UNIQUE | |
| password_hash | TEXT | PBKDF2 |
| status | TEXT | active/inactive/deleted |
| email | TEXT | |
| last_login_at | TEXT | |

### tenants
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| name | TEXT | |
| status | TEXT | active/inactive |
| plan | TEXT | standard |

### friends
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| tenant_id | TEXT | |
| line_user_id | TEXT | LINE UID |
| display_name | TEXT | LINE Profile API から取得 |
| picture_url | TEXT | |
| status | TEXT | |
| ref_code | TEXT | 流入元 |
| is_following | INTEGER | 1=following, 0=blocked |
| score | INTEGER | スコアリング用 |
| updated_at | TEXT | |

### scenarios
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| tenant_id | TEXT | |
| name | TEXT | |
| trigger_type | TEXT | friend_add / tag_added / manual |
| status | TEXT | draft / active |
| description | TEXT | |

### scenario_steps
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| scenario_id | TEXT FK | |
| step_order | INTEGER | 1, 2, 3... |
| delay_minutes | INTEGER | 前ステップからの待機時間 |
| message_type | TEXT | text / image / flex |
| message_content | TEXT | 送信内容 |
| goal_label | TEXT | 目標ラベル |

### friend_scenarios (enrollment)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| friend_id | TEXT FK | |
| scenario_id | TEXT FK | |
| current_step_order | INTEGER | 最後に配信したステップ |
| status | TEXT | active / completed |
| next_delivery_at | TEXT | 次回配信予定 |
| started_at | TEXT | |

### line_accounts
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| channel_id | TEXT UNIQUE | LINE Channel ID |
| name | TEXT | アカウント名 |
| channel_access_token | TEXT | LINE API トークン |
| channel_secret | TEXT | Webhook 署名検証用 |
| is_active | INTEGER | |

### messages_log
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| friend_id | TEXT FK | |
| direction | TEXT | incoming / outgoing |
| message_type | TEXT | |
| content | TEXT | |
| scenario_step_id | TEXT | |
| delivery_type | TEXT | push / reply |

## AI / Bot Tables

### bots
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| tenant_id | TEXT | |
| name | TEXT | |
| system_prompt | TEXT | GPTs 風プロンプト |
| description | TEXT | |
| status | TEXT | |

### knowledge_items
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| tenant_id | TEXT | |
| title | TEXT | |
| content | TEXT | |
| category | TEXT | general/product/faq/policy |
| source_type | TEXT | text/pdf/excel/gdrive |
| status | TEXT | |

### knowledge_chunks (RAG)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| knowledge_id | TEXT FK | |
| chunk_index | INTEGER | |
| chunk_text | TEXT | |
| token_count | INTEGER | |

### ai_execution_logs
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| tenant_id | TEXT | |
| request_message | TEXT | |
| intent | TEXT | webhook_debug / cron_debug / AI intent |
| confidence | REAL | |
| slots_json | TEXT | |
| error | TEXT | |

## LINE Harness Tables (upstream)

010_line_harness_full_schema.sql + 012 で作成。主要テーブル:

- auto_replies, automations, automation_logs
- affiliates, affiliate_clicks
- conversion_events
- google_calendar_connections, calendar_bookings
- reminders, reminder_steps, friend_reminders
- scoring_rules, friend_scores
- templates, operators, chats
- notification_rules, notifications
- stripe_events
- account_health_logs, account_migrations
- ad_platforms, ad_conversion_logs
- staff_members, entry_routes
- incoming_webhooks, outgoing_webhooks
