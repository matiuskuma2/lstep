export interface ConversionPoint {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  scope: string;
  verification_method: string;
  is_primary: number;
  value_amount: number | null;
  description: string | null;
  created_at: string;
}

export class ConversionPointAdapter {
  constructor(private db: D1Database) {}

  async create(tenantId: string, input: { name: string; code: string; scope?: string; verification_method?: string; is_primary?: boolean; value_amount?: number; description?: string }): Promise<ConversionPoint> {
    if (!input.name || !input.code) throw new Error('name and code are required');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.prepare(
      'INSERT INTO conversion_points (id, tenant_id, name, code, scope, verification_method, is_primary, value_amount, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, tenantId, input.name, input.code, input.scope || 'general', input.verification_method || 'manual', input.is_primary ? 1 : 0, input.value_amount || null, input.description || null, now).run();
    return { id, tenant_id: tenantId, name: input.name, code: input.code, scope: input.scope || 'general', verification_method: input.verification_method || 'manual', is_primary: input.is_primary ? 1 : 0, value_amount: input.value_amount || null, description: input.description || null, created_at: now };
  }

  async list(tenantId: string): Promise<ConversionPoint[]> {
    const r = await this.db.prepare('SELECT * FROM conversion_points WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all<ConversionPoint>();
    return r.results || [];
  }

  async listAll(): Promise<ConversionPoint[]> {
    const r = await this.db.prepare('SELECT * FROM conversion_points ORDER BY created_at DESC').all<ConversionPoint>();
    return r.results || [];
  }
}
