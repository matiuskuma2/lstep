-- AI execution logs
CREATE TABLE IF NOT EXISTS ai_execution_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT,
  bot_id TEXT,
  request_message TEXT NOT NULL,
  intent TEXT,
  confidence REAL,
  slots_json TEXT,
  missing_slots_json TEXT,
  plan_json TEXT,
  is_complete INTEGER DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_tenant ON ai_execution_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_execution_logs(created_at);
