-- RAG foundation: extend knowledge_items and add knowledge_chunks

-- Add source tracking to knowledge_items
ALTER TABLE knowledge_items ADD COLUMN source_type TEXT DEFAULT 'text';
-- source_type: 'text' | 'pdf' | 'excel' | 'gdrive' | 'image' | 'url'

ALTER TABLE knowledge_items ADD COLUMN file_key TEXT;
-- R2 storage key for uploaded files

ALTER TABLE knowledge_items ADD COLUMN extracted_text TEXT;
-- Full text extracted from file (separate from user-entered content)

ALTER TABLE knowledge_items ADD COLUMN metadata_json TEXT DEFAULT '{}';
-- Flexible metadata: page count, file size, source url, etc.

-- Knowledge chunks for RAG retrieval
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  embedding_vector_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (knowledge_id) REFERENCES knowledge_items(id)
);

CREATE INDEX IF NOT EXISTS idx_chunks_knowledge ON knowledge_chunks(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks(embedding_vector_id);
