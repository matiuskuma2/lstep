-- Add LINE Harness columns to existing friends table
-- Each ALTER is separate so one failure doesn't block others

ALTER TABLE friends ADD COLUMN picture_url TEXT;
ALTER TABLE friends ADD COLUMN status_message TEXT;
ALTER TABLE friends ADD COLUMN is_following INTEGER NOT NULL DEFAULT 1;
ALTER TABLE friends ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
