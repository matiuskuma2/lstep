-- LP view tracking for internal landing pages
CREATE TABLE IF NOT EXISTS lp_views (
  id TEXT PRIMARY KEY,
  lp_variant_id TEXT NOT NULL,
  click_id TEXT,
  tracked_link_id TEXT,
  friend_ref TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lp_views_variant ON lp_views(lp_variant_id);
CREATE INDEX IF NOT EXISTS idx_lp_views_click ON lp_views(click_id);
