export interface AiExecutionLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  bot_id: string | null;
  request_message: string;
  intent: string | null;
  confidence: number | null;
  slots_json: string | null;
  missing_slots_json: string | null;
  plan_json: string | null;
  is_complete: number;
  error: string | null;
  created_at: string;
}

export class ExecutionLogAdapter {
  constructor(private db: D1Database) {}

  async record(input: {
    tenant_id?: string | null;
    user_id?: string | null;
    bot_id?: string | null;
    request_message: string;
    intent?: string | null;
    confidence?: number | null;
    slots?: unknown[];
    missing_slots?: unknown[];
    plan?: unknown;
    is_complete?: boolean;
    error?: string | null;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.prepare(
      'INSERT INTO ai_execution_logs (id, tenant_id, user_id, bot_id, request_message, intent, confidence, slots_json, missing_slots_json, plan_json, is_complete, error, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(
      id,
      input.tenant_id || null,
      input.user_id || null,
      input.bot_id || null,
      input.request_message,
      input.intent || null,
      input.confidence || null,
      input.slots ? JSON.stringify(input.slots) : null,
      input.missing_slots ? JSON.stringify(input.missing_slots) : null,
      input.plan ? JSON.stringify(input.plan) : null,
      input.is_complete ? 1 : 0,
      input.error || null,
      now,
    ).run();
    return id;
  }

  async list(limit: number = 50): Promise<AiExecutionLog[]> {
    const r = await this.db.prepare(
      'SELECT * FROM ai_execution_logs ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all<AiExecutionLog>();
    return r.results || [];
  }

  async listByTenant(tenantId: string, limit: number = 50): Promise<AiExecutionLog[]> {
    const r = await this.db.prepare(
      'SELECT * FROM ai_execution_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(tenantId, limit).all<AiExecutionLog>();
    return r.results || [];
  }
}
