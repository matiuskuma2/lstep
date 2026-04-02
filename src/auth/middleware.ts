import { AuthService } from './service';
import type { AuthPayload } from './types';

export async function extractAuth(request: Request, db: D1Database, jwtSecret: string): Promise<AuthPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const authService = new AuthService(db, jwtSecret);
  return authService.verifyJwt(token);
}

export function requireRole(auth: AuthPayload | null, ...roles: string[]): Response | null {
  if (!auth) {
    return Response.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
  }
  if (!roles.includes(auth.role)) {
    return Response.json({ status: 'error', message: 'Insufficient permissions' }, { status: 403 });
  }
  return null;
}

export function requireTenant(auth: AuthPayload | null, tenantId?: string): Response | null {
  if (!auth) {
    return Response.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
  }
  if (auth.role === 'super_admin') return null; // super_admin can access all tenants
  if (tenantId && auth.tenant_id !== tenantId) {
    return Response.json({ status: 'error', message: 'Access denied for this tenant' }, { status: 403 });
  }
  return null;
}
