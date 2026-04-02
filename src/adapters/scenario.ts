export interface Scenario {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ScenarioStep {
  id: string;
  scenario_id: string;
  step_order: number;
  delay_minutes: number;
  message_type: string;
  message_content: string;
  goal_label: string | null;
  created_at: string;
}

export interface CreateScenarioInput {
  name: string;
  description?: string;
  trigger_type?: string;
  status?: string;
}

export interface CreateStepInput {
  step_order: number;
  delay_minutes?: number;
  message_type?: string;
  message_content: string;
  goal_label?: string;
}

export class ScenarioAdapter {
  constructor(private db: D1Database) {}

  async create(tenantId: string, input: CreateScenarioInput): Promise<Scenario> {
    if (!input.name) throw new Error('name is required');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.prepare(
      'INSERT INTO scenarios (id, tenant_id, name, description, trigger_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, tenantId, input.name, input.description || null, input.trigger_type || 'manual', input.status || 'draft', now, now).run();
    return { id, tenant_id: tenantId, name: input.name, description: input.description || null, trigger_type: input.trigger_type || 'manual', status: input.status || 'draft', created_at: now, updated_at: now };
  }

  async list(tenantId: string): Promise<Scenario[]> {
    const r = await this.db.prepare('SELECT * FROM scenarios WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all<Scenario>();
    return r.results || [];
  }

  async listAll(): Promise<Scenario[]> {
    const r = await this.db.prepare('SELECT * FROM scenarios ORDER BY created_at DESC').all<Scenario>();
    return r.results || [];
  }

  async getById(id: string): Promise<Scenario | null> {
    return await this.db.prepare('SELECT * FROM scenarios WHERE id = ?').bind(id).first<Scenario>() || null;
  }

  async update(id: string, input: Partial<CreateScenarioInput>): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (input.name !== undefined) { sets.push('name = ?'); vals.push(input.name); }
    if (input.description !== undefined) { sets.push('description = ?'); vals.push(input.description); }
    if (input.trigger_type !== undefined) { sets.push('trigger_type = ?'); vals.push(input.trigger_type); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return;
    sets.push('updated_at = ?'); vals.push(new Date().toISOString());
    vals.push(id);
    await this.db.prepare(`UPDATE scenarios SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  async addStep(scenarioId: string, input: CreateStepInput): Promise<ScenarioStep> {
    if (!input.message_content) throw new Error('message_content is required');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.prepare(
      'INSERT INTO scenario_steps (id, scenario_id, step_order, delay_minutes, message_type, message_content, goal_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, scenarioId, input.step_order, input.delay_minutes || 0, input.message_type || 'text', input.message_content, input.goal_label || null, now).run();
    return { id, scenario_id: scenarioId, step_order: input.step_order, delay_minutes: input.delay_minutes || 0, message_type: input.message_type || 'text', message_content: input.message_content, goal_label: input.goal_label || null, created_at: now };
  }

  async getSteps(scenarioId: string): Promise<ScenarioStep[]> {
    const r = await this.db.prepare('SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC').bind(scenarioId).all<ScenarioStep>();
    return r.results || [];
  }
}
