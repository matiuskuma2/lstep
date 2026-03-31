export interface Broadcast {
  id: string; tenant_id: string; name: string; message_content: string; message_type: string;
  status: string; target_tag_id: string | null; scheduled_at: string | null; sent_at: string | null; created_at: string;
}

export class BroadcastAdapter {
  constructor(private db: D1Database) {}

  async create(tenantId: string, input: { name: string; message_content: string; message_type?: string; target_tag_id?: string; scheduled_at?: string }): Promise<Broadcast> {
    if (!input.name || !input.message_content) throw new Error('name and message_content required');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.prepare('INSERT INTO broadcasts (id, tenant_id, name, message_content, message_type, status, target_tag_id, scheduled_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id, tenantId, input.name, input.message_content, input.message_type || 'text', 'draft', input.target_tag_id || null, input.scheduled_at || null, now).run();
    return { id, tenant_id: tenantId, name: input.name, message_content: input.message_content, message_type: input.message_type || 'text', status: 'draft', target_tag_id: input.target_tag_id || null, scheduled_at: input.scheduled_at || null, sent_at: null, created_at: now };
  }

  async list(tenantId: string): Promise<Broadcast[]> {
    const r = await this.db.prepare('SELECT * FROM broadcasts WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all<Broadcast>();
    return r.results || [];
  }

  async listAll(): Promise<Broadcast[]> {
    const r = await this.db.prepare('SELECT * FROM broadcasts ORDER BY created_at DESC').all<Broadcast>();
    return r.results || [];
  }
}
