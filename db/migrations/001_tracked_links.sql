-- Tracked Links table
CREATE TABLE IF NOT EXISTS tracked_links (
  id TEXT PRIMARY KEY,
  destination_url TEXT NOT NULL,
  destination_type TEXT NOT NULL DEFAULT 'external',
  campaign_label TEXT,
  line_account_id TEXT,
  scenario_id TEXT,
  scenario_step_id TEXT,
  conversion_point_code TEXT,
  lp_variant_slug TEXT,
  attribution_context TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT DEFAULT 'ai'
);

-- Link Clicks table
CREATE TABLE IF NOT EXISTS link_clicks (
  id TEXT PRIMARY KEY,
  tracked_link_id TEXT NOT NULL,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT,
  ip_hash TEXT,
  referer TEXT,
  FOREIGN KEY (tracked_link_id) REFERENCES tracked_links(id)
);

-- Index for click lookups
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(tracked_link_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_campaign ON tracked_links(campaign_label);
