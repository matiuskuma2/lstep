-- Add template_data column to lp_variants for structured LP templates
ALTER TABLE lp_variants ADD COLUMN template_data TEXT;
