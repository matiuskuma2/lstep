export interface Form {
  id: string; tenant_id: string; name: string; description: string | null;
  status: string; fields: string; created_at: string;
}

export class FormAdapter {
  constructor(private db: D1Database) {}

  async create(tenantId: string, input: { name: string; description?: string; fields?: Array<{label:string;type:string;required?:boolean}> }): Promise<Form> {
    if (!input.name) throw new Error('name is required');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const fields = JSON.stringify(input.fields || []);
    await this.db.prepare('INSERT INTO forms (id, tenant_id, name, description, status, fields, created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id, tenantId, input.name, input.description || null, 'active', fields, now).run();
    return { id, tenant_id: tenantId, name: input.name, description: input.description || null, status: 'active', fields, created_at: now };
  }

  async list(tenantId: string): Promise<Form[]> {
    const r = await this.db.prepare('SELECT * FROM forms WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all<Form>();
    return r.results || [];
  }

  async listAll(): Promise<Form[]> {
    const r = await this.db.prepare('SELECT * FROM forms ORDER BY created_at DESC').all<Form>();
    return r.results || [];
  }
}
