-- Bots
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  strategy TEXT NOT NULL DEFAULT '',
  tone TEXT DEFAULT 'professional',
  target_audience TEXT,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Knowledge items
CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Bot/Knowledge bindings
CREATE TABLE IF NOT EXISTS bot_knowledge_bindings (
  bot_id TEXT NOT NULL,
  knowledge_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (bot_id, knowledge_id),
  FOREIGN KEY (bot_id) REFERENCES bots(id),
  FOREIGN KEY (knowledge_id) REFERENCES knowledge_items(id)
);

CREATE INDEX IF NOT EXISTS idx_bots_tenant ON bots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_tenant ON knowledge_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_bot ON bot_knowledge_bindings(bot_id);
