-- Add system_prompt column to bots table
ALTER TABLE bots ADD COLUMN system_prompt TEXT DEFAULT '';
