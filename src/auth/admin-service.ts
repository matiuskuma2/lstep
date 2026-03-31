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

  async updateUserStatus(userId: string, status: 'active' | 'inactive', requestingUserId: string): Promise<SafeUser> {
    if (userId === requestingUserId) {
      throw new Error('Cannot change your own status');
    }
    const user = await this.db.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first<{ id: string; role: string }>();
    if (!user) throw new Error('User not found');

    await this.db.prepare(
      "UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, userId).run();

    const updated = await this.db.prepare(
      'SELECT id, tenant_id, role, login_id, email, status, last_login_at FROM users WHERE id = ?'
    ).bind(userId).first<SafeUser>();
    return updated!;
  }

  async deleteUser(userId: string, requestingUserId: string): Promise<void> {
    if (userId === requestingUserId) {
      throw new Error('Cannot delete yourself');
    }
    const user = await this.db.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first<{ id: string; role: string }>();
    if (!user) throw new Error('User not found');
    if (user.role === 'super_admin') throw new Error('Cannot delete a super_admin');

    await this.db.prepare(
      "UPDATE users SET status = 'deleted', updated_at = datetime('now') WHERE id = ?"
    ).bind(userId).run();
  }

  async updateUser(userId: string, input: { password?: string; email?: string }): Promise<SafeUser> {
    const user = await this.db.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first<{ id: string; role: string }>();
    if (!user) throw new Error('User not found');

    if (input.password) {
      if (input.password.length < 8) throw new Error('Password must be at least 8 characters');
      const hash = await this.authService.hashPassword(input.password);
      await this.db.prepare(
        "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(hash, userId).run();
    }

    if (input.email !== undefined) {
      await this.db.prepare(
        "UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(input.email || null, userId).run();
    }

    const updated = await this.db.prepare(
      'SELECT id, tenant_id, role, login_id, email, status, last_login_at FROM users WHERE id = ?'
    ).bind(userId).first<SafeUser>();
    return updated!;
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

  async updateTenant(tenantId: string, input: { name?: string; plan?: string; status?: string }): Promise<Tenant> {
    const tenant = await this.db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first<Tenant>();
    if (!tenant) throw new Error('Tenant not found');

    if (input.name !== undefined) {
      await this.db.prepare(
        "UPDATE tenants SET name = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(input.name, tenantId).run();
    }

    if (input.plan !== undefined) {
      await this.db.prepare(
        "UPDATE tenants SET plan = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(input.plan, tenantId).run();
    }

    if (input.status !== undefined) {
      if (input.status !== 'active' && input.status !== 'inactive') {
        throw new Error('status must be "active" or "inactive"');
      }
      await this.db.prepare(
        "UPDATE tenants SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(input.status, tenantId).run();
    }

    const updated = await this.db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first<Tenant>();
    return updated!;
  }
}
