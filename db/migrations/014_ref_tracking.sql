-- Ref tracking: records /r/:ref page visits for attribution matching
CREATE TABLE IF NOT EXISTS ref_tracking (
  id TEXT PRIMARY KEY,
  ref_code TEXT NOT NULL,
  friend_id TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ref_tracking_ref_code ON ref_tracking(ref_code);
CREATE INDEX IF NOT EXISTS idx_ref_tracking_ip_hash ON ref_tracking(ip_hash);
CREATE INDEX IF NOT EXISTS idx_ref_tracking_friend_id ON ref_tracking(friend_id);
