export interface KnowledgeChunk {
  id: string;
  knowledge_id: string;
  chunk_index: number;
  chunk_text: string;
  token_count: number;
  embedding_vector_id: string | null;
  created_at: string;
}

export class KnowledgeChunkAdapter {
  constructor(private db: D1Database) {}

  async createChunks(knowledgeId: string, texts: string[]): Promise<KnowledgeChunk[]> {
    const chunks: KnowledgeChunk[] = [];
    const now = new Date().toISOString();
    for (let i = 0; i < texts.length; i++) {
      const id = crypto.randomUUID();
      const tokenCount = Math.ceil(texts[i].length / 4); // rough estimate
      await this.db.prepare(
        'INSERT INTO knowledge_chunks (id, knowledge_id, chunk_index, chunk_text, token_count, created_at) VALUES (?,?,?,?,?,?)'
      ).bind(id, knowledgeId, i, texts[i], tokenCount, now).run();
      chunks.push({ id, knowledge_id: knowledgeId, chunk_index: i, chunk_text: texts[i], token_count: tokenCount, embedding_vector_id: null, created_at: now });
    }
    return chunks;
  }

  async listByKnowledge(knowledgeId: string): Promise<KnowledgeChunk[]> {
    const r = await this.db.prepare(
      'SELECT * FROM knowledge_chunks WHERE knowledge_id = ? ORDER BY chunk_index ASC'
    ).bind(knowledgeId).all<KnowledgeChunk>();
    return r.results || [];
  }

  async deleteByKnowledge(knowledgeId: string): Promise<void> {
    await this.db.prepare('DELETE FROM knowledge_chunks WHERE knowledge_id = ?').bind(knowledgeId).run();
  }

  async listByKnowledgeIds(knowledgeIds: string[]): Promise<KnowledgeChunk[]> {
    if (knowledgeIds.length === 0) return [];
    const placeholders = knowledgeIds.map(() => '?').join(',');
    const r = await this.db.prepare(
      `SELECT * FROM knowledge_chunks WHERE knowledge_id IN (${placeholders}) ORDER BY knowledge_id, chunk_index ASC`
    ).bind(...knowledgeIds).all<KnowledgeChunk>();
    return r.results || [];
  }
}

export function chunkText(text: string, maxTokens: number = 600): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    const estimatedTokens = Math.ceil((current + '\n\n' + para).length / 4);
    if (estimatedTokens > maxTokens && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}
