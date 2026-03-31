-- Friends
CREATE TABLE IF NOT EXISTS friends (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  line_user_id TEXT,
  display_name TEXT NOT NULL,
  picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  ref_code TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Broadcasts
CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  message_content TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'draft',
  target_tag_id TEXT,
  scheduled_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Forms
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  fields TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_friends_tenant ON friends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON broadcasts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forms_tenant ON forms(tenant_id);
