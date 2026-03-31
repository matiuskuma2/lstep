-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#06C755',
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Conversion Points
CREATE TABLE IF NOT EXISTS conversion_points (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'general',
  verification_method TEXT DEFAULT 'manual',
  is_primary INTEGER DEFAULT 0,
  value_amount REAL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversion_points_tenant ON conversion_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversion_points_code ON conversion_points(code);
