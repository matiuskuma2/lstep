-- Align existing tables with LINE Harness schema
-- Add missing columns to tables that already exist

-- friends: add LINE Harness columns
ALTER TABLE friends ADD COLUMN line_user_id TEXT;
ALTER TABLE friends ADD COLUMN picture_url TEXT;
ALTER TABLE friends ADD COLUMN status_message TEXT;
ALTER TABLE friends ADD COLUMN is_following INTEGER NOT NULL DEFAULT 1;
ALTER TABLE friends ADD COLUMN user_id TEXT;
ALTER TABLE friends ADD COLUMN score INTEGER NOT NULL DEFAULT 0;

-- scenarios: add LINE Harness columns
ALTER TABLE scenarios ADD COLUMN trigger_tag_id TEXT;
ALTER TABLE scenarios ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- Create LINE Harness tables that don't exist yet
-- (using IF NOT EXISTS so already-created tables are skipped)

CREATE TABLE IF NOT EXISTS friend_tags (
  friend_id   TEXT NOT NULL,
  tag_id      TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (friend_id, tag_id)
);

CREATE TABLE IF NOT EXISTS friend_scenarios (
  id                 TEXT PRIMARY KEY,
  friend_id          TEXT NOT NULL,
  scenario_id        TEXT NOT NULL,
  current_step_order INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'active',
  started_at         TEXT NOT NULL DEFAULT (datetime('now')),
  next_delivery_at   TEXT,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_friend_scenarios_next_delivery_at ON friend_scenarios (next_delivery_at);
CREATE INDEX IF NOT EXISTS idx_friend_scenarios_status ON friend_scenarios (status);

CREATE TABLE IF NOT EXISTS messages_log (
  id               TEXT PRIMARY KEY,
  friend_id        TEXT NOT NULL,
  direction        TEXT NOT NULL,
  message_type     TEXT NOT NULL,
  content          TEXT NOT NULL,
  broadcast_id     TEXT,
  scenario_step_id TEXT,
  delivery_type    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_log_friend_id ON messages_log (friend_id);

CREATE TABLE IF NOT EXISTS auto_replies (
  id               TEXT PRIMARY KEY,
  keyword          TEXT NOT NULL,
  match_type       TEXT NOT NULL DEFAULT 'exact',
  response_type    TEXT NOT NULL DEFAULT 'text',
  response_content TEXT NOT NULL,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS line_accounts (
  id                   TEXT PRIMARY KEY,
  channel_id           TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  channel_access_token TEXT NOT NULL,
  channel_secret       TEXT NOT NULL,
  login_channel_id     TEXT,
  login_channel_secret TEXT,
  liff_id              TEXT,
  is_active            INTEGER NOT NULL DEFAULT 1,
  token_expires_at     TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT,
  phone        TEXT,
  external_id  TEXT,
  display_name TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversion_events (
  id                  TEXT PRIMARY KEY,
  conversion_point_id TEXT NOT NULL,
  friend_id           TEXT NOT NULL,
  user_id             TEXT,
  affiliate_code      TEXT,
  metadata            TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL UNIQUE,
  commission_rate REAL NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id           TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  url          TEXT,
  ip_address   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incoming_webhooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'custom',
  secret      TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outgoing_webhooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  event_types TEXT NOT NULL DEFAULT '[]',
  secret      TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id            TEXT PRIMARY KEY,
  calendar_id   TEXT NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  api_key       TEXT,
  auth_type     TEXT NOT NULL DEFAULT 'api_key',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_bookings (
  id             TEXT PRIMARY KEY,
  connection_id  TEXT NOT NULL,
  friend_id      TEXT,
  event_id       TEXT,
  title          TEXT NOT NULL,
  start_at       TEXT NOT NULL,
  end_at         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'confirmed',
  metadata       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminders (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminder_steps (
  id              TEXT PRIMARY KEY,
  reminder_id     TEXT NOT NULL,
  offset_minutes  INTEGER NOT NULL,
  message_type    TEXT NOT NULL,
  message_content TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS friend_reminders (
  id              TEXT PRIMARY KEY,
  friend_id       TEXT NOT NULL,
  reminder_id     TEXT NOT NULL,
  target_date     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS friend_reminder_deliveries (
  id                TEXT PRIMARY KEY,
  friend_reminder_id TEXT NOT NULL,
  reminder_step_id  TEXT NOT NULL,
  delivered_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (friend_reminder_id, reminder_step_id)
);

CREATE TABLE IF NOT EXISTS scoring_rules (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  score_value INTEGER NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS friend_scores (
  id              TEXT PRIMARY KEY,
  friend_id       TEXT NOT NULL,
  scoring_rule_id TEXT,
  score_change    INTEGER NOT NULL,
  reason          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general',
  message_type    TEXT NOT NULL,
  message_content TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS operators (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'operator',
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chats (
  id            TEXT PRIMARY KEY,
  friend_id     TEXT NOT NULL,
  operator_id   TEXT,
  status        TEXT NOT NULL DEFAULT 'unread',
  notes         TEXT,
  last_message_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  conditions   TEXT NOT NULL DEFAULT '{}',
  channels     TEXT NOT NULL DEFAULT '["webhook"]',
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  rule_id         TEXT,
  event_type      TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  channel         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  metadata        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stripe_events (
  id               TEXT PRIMARY KEY,
  stripe_event_id  TEXT NOT NULL UNIQUE,
  event_type       TEXT NOT NULL,
  friend_id        TEXT,
  amount           REAL,
  currency         TEXT,
  metadata         TEXT,
  processed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_health_logs (
  id              TEXT PRIMARY KEY,
  line_account_id TEXT NOT NULL,
  error_code      INTEGER,
  error_count     INTEGER NOT NULL DEFAULT 0,
  check_period    TEXT NOT NULL,
  risk_level      TEXT NOT NULL DEFAULT 'normal',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_migrations (
  id               TEXT PRIMARY KEY,
  from_account_id  TEXT NOT NULL,
  to_account_id    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  migrated_count   INTEGER NOT NULL DEFAULT 0,
  total_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at     TEXT
);

CREATE TABLE IF NOT EXISTS automations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  event_type  TEXT NOT NULL,
  conditions  TEXT NOT NULL DEFAULT '{}',
  actions     TEXT NOT NULL DEFAULT '[]',
  is_active   INTEGER NOT NULL DEFAULT 1,
  priority    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id             TEXT PRIMARY KEY,
  automation_id  TEXT NOT NULL,
  friend_id      TEXT,
  event_data     TEXT,
  actions_result TEXT,
  status         TEXT NOT NULL DEFAULT 'success',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ad_platforms (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  display_name TEXT,
  config       TEXT NOT NULL DEFAULT '{}',
  is_active    INTEGER DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ad_conversion_logs (
  id                  TEXT PRIMARY KEY,
  ad_platform_id      TEXT NOT NULL,
  friend_id           TEXT NOT NULL,
  conversion_point_id TEXT,
  event_name          TEXT NOT NULL,
  click_id            TEXT,
  click_id_type       TEXT,
  status              TEXT DEFAULT 'pending',
  request_body        TEXT,
  response_body       TEXT,
  error_message       TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_members (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  role       TEXT NOT NULL,
  api_key    TEXT UNIQUE NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entry_routes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
