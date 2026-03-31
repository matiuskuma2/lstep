import type { User, AuthPayload, SafeUser } from './types';

const ITERATIONS = 100000;
const SALT_LENGTH = 16;

export class AuthService {
  constructor(private db: D1Database, private jwtSecret: string) {}

  async hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const key = await this.deriveKey(password, salt);
    const keyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
  }

  async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [saltHex, hashHex] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    const key = await this.deriveKey(password, salt);
    const keyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const computed = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === hashHex;
  }

  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      true,
      ['sign']
    );
  }

  async createJwt(payload: AuthPayload): Promise<string> {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    const data = `${header}.${body}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(this.jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return `${data}.${sigBase64}`;
  }

  async verifyJwt(token: string): Promise<AuthPayload | null> {
    try {
      const [header, body, sig] = token.split('.');
      const data = `${header}.${body}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(this.jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
      const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
      if (!valid) return null;
      const payload = JSON.parse(atob(body)) as AuthPayload;
      if (payload.exp < Date.now() / 1000) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async login(loginId: string, password: string): Promise<{ token: string; user: SafeUser } | null> {
    const user = await this.db.prepare('SELECT * FROM users WHERE login_id = ? AND status = ?').bind(loginId, 'active').first<User>();
    if (!user) return null;
    const valid = await this.verifyPassword(password, user.password_hash);
    if (!valid) return null;
    await this.db.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();
    const token = await this.createJwt({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      login_id: user.login_id,
      exp: Math.floor(Date.now() / 1000) + 86400,
    });
    return {
      token,
      user: { id: user.id, tenant_id: user.tenant_id, role: user.role, login_id: user.login_id, email: user.email, status: user.status, last_login_at: user.last_login_at },
    };
  }

  async bootstrap(loginId: string, password: string, email?: string): Promise<SafeUser> {
    const existing = await this.db.prepare('SELECT COUNT(*) as cnt FROM users WHERE role = ?').bind('super_admin').first<{ cnt: number }>();
    if (existing && existing.cnt > 0) {
      throw new Error('Super admin already exists');
    }
    const id = crypto.randomUUID();
    const hash = await this.hashPassword(password);
    await this.db.prepare(
      'INSERT INTO users (id, tenant_id, role, login_id, email, password_hash, status) VALUES (?, NULL, ?, ?, ?, ?, ?)'
    ).bind(id, 'super_admin', loginId, email || null, hash, 'active').run();
    return { id, tenant_id: null, role: 'super_admin', login_id: loginId, email: email || null, status: 'active', last_login_at: null };
  }

  async getUserById(id: string): Promise<SafeUser | null> {
    const user = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
    if (!user) return null;
    return { id: user.id, tenant_id: user.tenant_id, role: user.role, login_id: user.login_id, email: user.email, status: user.status, last_login_at: user.last_login_at };
  }
}
