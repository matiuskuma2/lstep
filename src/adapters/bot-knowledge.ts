export interface Bot {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  strategy: string;
  tone: string;
  target_audience: string | null;
  goal: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeItem {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BotWithKnowledge extends Bot {
  knowledge: KnowledgeItem[];
}

export interface CreateBotInput {
  name: string;
  description?: string;
  strategy?: string;
  tone?: string;
  target_audience?: string;
  goal?: string;
  status?: string;
}

export interface CreateKnowledgeInput {
  title: string;
  content: string;
  category?: string;
  tags?: string;
  status?: string;
}

export class BotAdapter {
  constructor(private db: D1Database) {}

  async create(tenantId: string, input: CreateBotInput): Promise<Bot> {
    if (!input.name) throw new Error('name is required');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO bots (id, tenant_id, name, description, strategy, tone, target_audience, goal, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      input.name,
      input.description || null,
      input.strategy || '',
      input.tone || 'professional',
      input.target_audience || null,
      input.goal || null,
      input.status || 'active',
      now,
      now
    ).run();

    return {
      id,
      tenant_id: tenantId,
      name: input.name,
      description: input.description || null,
      strategy: input.strategy || '',
      tone: input.tone || 'professional',
      target_audience: input.target_audience || null,
      goal: input.goal || null,
      status: input.status || 'active',
      created_at: now,
      updated_at: now,
    };
  }

  async list(tenantId: string): Promise<Bot[]> {
    const r = await this.db.prepare('SELECT * FROM bots WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all<Bot>();
    return r.results || [];
  }

  async listAll(): Promise<Bot[]> {
    const r = await this.db.prepare('SELECT * FROM bots ORDER BY created_at DESC').all<Bot>();
    return r.results || [];
  }

  async getById(id: string): Promise<Bot | null> {
    return await this.db.prepare('SELECT * FROM bots WHERE id = ?').bind(id).first<Bot>() || null;
  }

  async getWithKnowledge(id: string): Promise<BotWithKnowledge | null> {
    const bot = await this.getById(id);
    if (!bot) return null;

    const r = await this.db.prepare(
      `SELECT k.*
       FROM knowledge_items k
       INNER JOIN bot_knowledge_bindings bkb ON bkb.knowledge_id = k.id
       WHERE bkb.bot_id = ?
       ORDER BY k.created_at DESC`
    ).bind(id).all<KnowledgeItem>();

    return {
      ...bot,
      knowledge: r.results || [],
    };
  }

  async bindKnowledge(botId: string, knowledgeId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      'INSERT OR IGNORE INTO bot_knowledge_bindings (bot_id, knowledge_id, created_at) VALUES (?, ?, ?)'
    ).bind(botId, knowledgeId, now).run();
  }

  async unbindKnowledge(botId: string, knowledgeId: string): Promise<void> {
    await this.db.prepare(
      'DELETE FROM bot_knowledge_bindings WHERE bot_id = ? AND knowledge_id = ?'
    ).bind(botId, knowledgeId).run();
  }
}

export class KnowledgeAdapter {
  constructor(private db: D1Database) {}

  async create(tenantId: string, input: CreateKnowledgeInput): Promise<KnowledgeItem> {
    if (!input.title) throw new Error('title is required');
    if (!input.content) throw new Error('content is required');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO knowledge_items (id, tenant_id, title, content, category, tags, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      input.title,
      input.content,
      input.category || 'general',
      input.tags || '[]',
      input.status || 'active',
      now,
      now
    ).run();

    return {
      id,
      tenant_id: tenantId,
      title: input.title,
      content: input.content,
      category: input.category || 'general',
      tags: input.tags || '[]',
      status: input.status || 'active',
      created_at: now,
      updated_at: now,
    };
  }

  async list(tenantId: string): Promise<KnowledgeItem[]> {
    const r = await this.db.prepare('SELECT * FROM knowledge_items WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all<KnowledgeItem>();
    return r.results || [];
  }

  async listAll(): Promise<KnowledgeItem[]> {
    const r = await this.db.prepare('SELECT * FROM knowledge_items ORDER BY created_at DESC').all<KnowledgeItem>();
    return r.results || [];
  }
}
