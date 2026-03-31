export interface Friend {
  id: string; tenant_id: string; line_user_id: string | null; display_name: string;
  picture_url: string | null; status: string; ref_code: string | null; metadata: string; created_at: string;
}

export class FriendAdapter {
  constructor(private db: D1Database) {}

  async create(tenantId: string, input: { display_name: string; line_user_id?: string; ref_code?: string; metadata?: Record<string, unknown> }): Promise<Friend> {
    if (!input.display_name) throw new Error('display_name is required');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const meta = JSON.stringify(input.metadata || {});
    await this.db.prepare('INSERT INTO friends (id, tenant_id, line_user_id, display_name, status, ref_code, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id, tenantId, input.line_user_id || null, input.display_name, 'active', input.ref_code || null, meta, now).run();
    return { id, tenant_id: tenantId, line_user_id: input.line_user_id || null, display_name: input.display_name, picture_url: null, status: 'active', ref_code: input.ref_code || null, metadata: meta, created_at: now };
  }

  async list(tenantId: string): Promise<Friend[]> {
    const r = await this.db.prepare('SELECT * FROM friends WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100').bind(tenantId).all<Friend>();
    return r.results || [];
  }

  async listAll(): Promise<Friend[]> {
    const r = await this.db.prepare('SELECT * FROM friends ORDER BY created_at DESC LIMIT 100').all<Friend>();
    return r.results || [];
  }

  async count(tenantId: string): Promise<number> {
    const r = await this.db.prepare('SELECT COUNT(*) as cnt FROM friends WHERE tenant_id = ?').bind(tenantId).first<{cnt:number}>();
    return r?.cnt || 0;
  }
}
