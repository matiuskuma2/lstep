export interface Tag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export class TagAdapter {
  constructor(private db: D1Database) {}

  async create(tenantId: string, input: { name: string; color?: string; description?: string }): Promise<Tag> {
    if (!input.name) throw new Error('name is required');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.prepare(
      'INSERT INTO tags (id, tenant_id, name, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, tenantId, input.name, input.color || '#06C755', input.description || null, now).run();
    return { id, tenant_id: tenantId, name: input.name, color: input.color || '#06C755', description: input.description || null, created_at: now };
  }

  async list(tenantId: string): Promise<Tag[]> {
    const r = await this.db.prepare('SELECT * FROM tags WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all<Tag>();
    return r.results || [];
  }

  async listAll(): Promise<Tag[]> {
    const r = await this.db.prepare('SELECT * FROM tags ORDER BY created_at DESC').all<Tag>();
    return r.results || [];
  }
}
