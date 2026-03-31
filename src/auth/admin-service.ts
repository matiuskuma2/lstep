import { AuthService } from './service';
import type { SafeUser, Tenant, TenantSettings } from './types';

export class AdminService {
  constructor(private db: D1Database, private authService: AuthService) {}

  async createAdmin(input: {
    login_id: string;
    password: string;
    email?: string;
    tenant_name: string;
  }): Promise<{ user: SafeUser; tenant: Tenant }> {
    if (!input.login_id || !input.password || !input.tenant_name) {
      throw new Error('login_id, password, and tenant_name are required');
    }
    if (input.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await this.authService.hashPassword(input.password);

    // Create tenant
    await this.db.prepare(
      'INSERT INTO tenants (id, name, status, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(tenantId, input.tenant_name, 'active', 'standard', now, now).run();

    // Create tenant_settings
    await this.db.prepare(
      'INSERT INTO tenant_settings (tenant_id, created_at, updated_at) VALUES (?, ?, ?)'
    ).bind(tenantId, now, now).run();

    // Create admin user
    await this.db.prepare(
      'INSERT INTO users (id, tenant_id, role, login_id, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, tenantId, 'admin', input.login_id, input.email || null, passwordHash, 'active', now, now).run();

    return {
      user: {
        id: userId,
        tenant_id: tenantId,
        role: 'admin',
        login_id: input.login_id,
        email: input.email || null,
        status: 'active',
        last_login_at: null,
      },
      tenant: {
        id: tenantId,
        name: input.tenant_name,
        status: 'active',
        plan: 'standard',
        created_at: now,
        updated_at: now,
      },
    };
  }

  async listUsers(): Promise<SafeUser[]> {
    const results = await this.db.prepare(
      'SELECT id, tenant_id, role, login_id, email, status, last_login_at FROM users ORDER BY created_at DESC'
    ).all<SafeUser>();
    return results.results || [];
  }

  async listTenants(): Promise<Tenant[]> {
    const results = await this.db.prepare(
      'SELECT * FROM tenants ORDER BY created_at DESC'
    ).all<Tenant>();
    return results.results || [];
  }
}
