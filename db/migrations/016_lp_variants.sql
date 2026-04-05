-- LP variants for internal landing pages
CREATE TABLE IF NOT EXISTS lp_variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  lp_type TEXT NOT NULL DEFAULT 'internal',
  html_content TEXT,
  css_content TEXT,
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  conversion_point_id TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_lp_variants_tenant ON lp_variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lp_variants_slug ON lp_variants(slug);
