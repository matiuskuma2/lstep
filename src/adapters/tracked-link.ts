export interface TrackedLink {
  id: string;
  destination_url: string;
  destination_type: 'internal' | 'external';
  campaign_label: string | null;
  line_account_id: string | null;
  scenario_id: string | null;
  scenario_step_id: string | null;
  conversion_point_code: string | null;
  lp_variant_slug: string | null;
  attribution_context: string | null;
  created_at: string;
  created_by: string;
}

export interface LinkClick {
  id: string;
  tracked_link_id: string;
  clicked_at: string;
  user_agent: string | null;
  ip_hash: string | null;
  referer: string | null;
}

export interface CreateTrackedLinkInput {
  destination_url: string;
  destination_type?: 'internal' | 'external';
  campaign_label?: string;
  line_account_id?: string;
  scenario_id?: string;
  scenario_step_id?: string;
  conversion_point_code?: string;
  lp_variant_slug?: string;
  attribution_context?: string;
}

export interface TrackedLinkWithClicks extends TrackedLink {
  click_count: number;
}

export class TrackedLinkAdapter {
  constructor(private db: D1Database) {}

  async create(input: CreateTrackedLinkInput): Promise<TrackedLink> {
    if (!input.destination_url) {
      throw new Error('destination_url is required');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO tracked_links (id, destination_url, destination_type, campaign_label, line_account_id, scenario_id, scenario_step_id, conversion_point_code, lp_variant_slug, attribution_context, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      input.destination_url,
      input.destination_type || 'external',
      input.campaign_label || null,
      input.line_account_id || null,
      input.scenario_id || null,
      input.scenario_step_id || null,
      input.conversion_point_code || null,
      input.lp_variant_slug || null,
      input.attribution_context || null,
      now,
      'ai'
    ).run();

    return {
      id,
      destination_url: input.destination_url,
      destination_type: input.destination_type || 'external',
      campaign_label: input.campaign_label || null,
      line_account_id: input.line_account_id || null,
      scenario_id: input.scenario_id || null,
      scenario_step_id: input.scenario_step_id || null,
      conversion_point_code: input.conversion_point_code || null,
      lp_variant_slug: input.lp_variant_slug || null,
      attribution_context: input.attribution_context || null,
      created_at: now,
      created_by: 'ai',
    };
  }

  async getById(id: string): Promise<TrackedLink | null> {
    const result = await this.db.prepare(
      'SELECT * FROM tracked_links WHERE id = ?'
    ).bind(id).first<TrackedLink>();
    return result || null;
  }

  async list(limit = 50, offset = 0): Promise<TrackedLinkWithClicks[]> {
    const results = await this.db.prepare(
      `SELECT t.*, COALESCE(c.click_count, 0) as click_count
       FROM tracked_links t
       LEFT JOIN (SELECT tracked_link_id, COUNT(*) as click_count FROM link_clicks GROUP BY tracked_link_id) c
       ON t.id = c.tracked_link_id
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all<TrackedLinkWithClicks>();
    return results.results || [];
  }

  async recordClick(trackedLinkId: string, request: Request): Promise<LinkClick> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const userAgent = request.headers.get('user-agent') || null;
    const referer = request.headers.get('referer') || null;
    const ip = request.headers.get('cf-connecting-ip') || '';
    const ipHash = ip ? await hashString(ip) : null;

    await this.db.prepare(
      `INSERT INTO link_clicks (id, tracked_link_id, clicked_at, user_agent, ip_hash, referer)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, trackedLinkId, now, userAgent, ipHash, referer).run();

    return { id, tracked_link_id: trackedLinkId, clicked_at: now, user_agent: userAgent, ip_hash: ipHash, referer };
  }
}

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}
