-- Add line_account_id column to friends table for multi-account support
ALTER TABLE friends ADD COLUMN line_account_id TEXT;
