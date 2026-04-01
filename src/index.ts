import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generatePlan } from './ai/engine';
import type { BotKnowledgeContext } from './ai/engine';
import type { AiChatRequest } from './ai/types';
import { ExecutionLogAdapter } from './adapters/execution-log';
import { KnowledgeChunkAdapter, chunkText } from './adapters/knowledge-chunk';
import { TrackedLinkAdapter } from './adapters/tracked-link';
import type { CreateTrackedLinkInput } from './adapters/tracked-link';
import { AuthService } from './auth/service';
import { AdminService } from './auth/admin-service';
import { extractAuth, requireRole } from './auth/middleware';
import { getAdminHtml } from './pages/admin';
import { getDashboardHtml, getTrackedLinksPageHtml, getPlaceholderPageHtml } from './pages/dashboard';
import { getScenariosPageHtml } from './pages/scenarios';
import { ScenarioAdapter } from './adapters/scenario';
import type { CreateScenarioInput, CreateStepInput } from './adapters/scenario';
import { getTagsPageHtml, getConversionsPageHtml } from './pages/tags-cv';
import { TagAdapter } from './adapters/tag';
import { ConversionPointAdapter } from './adapters/conversion-point';
import { getFriendsPageHtml, getBroadcastsPageHtml, getFormsPageHtml } from './pages/friends-broadcasts-forms';
import { FriendAdapter } from './adapters/friend';
import { BroadcastAdapter } from './adapters/broadcast';
import { FormAdapter } from './adapters/form';
import { BotAdapter, KnowledgeAdapter } from './adapters/bot-knowledge';
import { getBotsPageHtml, getKnowledgePageHtml } from './pages/bot-knowledge';
import { getAiLogsPageHtml } from './pages/ai-logs';
import { getLineAccountsPageHtml } from './pages/line-accounts';

// LINE Harness DB adapters only (approach B: no Hono routes)
import { createLineAccount, getLineAccounts as getLineAccountsList, updateLineAccount, deleteLineAccount } from './line-harness/db/line-accounts.js';
import { verifySignature } from './line-harness/line-sdk/webhook.js';
import { upsertFriend } from './line-harness/db/friends.js';
import type { WebhookRequestBody } from './line-harness/line-sdk/types.js';

export interface Env {
  DB: D1Database;
  IMAGES?: R2Bucket;
  OPENAI_API_KEY?: string;
  ADMIN_JWT_SECRET?: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  API_KEY?: string;
  LIFF_URL?: string;
  LINE_CHANNEL_ID?: string;
  LINE_LOGIN_CHANNEL_ID?: string;
  LINE_LOGIN_CHANNEL_SECRET?: string;
  WORKER_URL?: string;
  ENVIRONMENT: string;
}

// --- Hono app ---
const app = new Hono<{ Bindings: Env }>();
app.use('*', cors({ origin: '*' }));

// Webhook: direct Hono route (not in catch-all, to avoid body consumption issues)
app.post('/webhook', async (c) => {
  const env = c.env;
  const body = await c.req.text();
  const signature = c.req.header('x-line-signature') || '';

  // Debug log
  try {
    await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'WEBHOOK: sig=' + signature.substring(0, 10) + ' body_len=' + body.length, 'webhook_debug').run();
  } catch {}

  const accounts = await getLineAccountsList(env.DB);
  if (accounts.length === 0) return c.json({ status: 'ok' });

  let matchedAccount: any = null;
  for (const account of accounts) {
    if (account.is_active) {
      const valid = await verifySignature(account.channel_secret, body, signature);
      try {
        await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'SIG: ' + account.name + ' valid=' + valid, 'webhook_debug').run();
      } catch {}
      if (valid) { matchedAccount = account; break; }
    }
  }

  if (!matchedAccount) return c.json({ status: 'ok' }); // Return 200 even on sig failure (LINE expects 200)

  let parsed: any;
  try { parsed = JSON.parse(body); } catch { return c.json({ status: 'ok' }); }

  for (const event of (parsed.events || [])) {
    try {
      if (event.type === 'follow') {
        const lineUserId = event.source?.userId;
        if (lineUserId) {
          const existing = await env.DB.prepare('SELECT id FROM friends WHERE line_user_id = ?').bind(lineUserId).first();
          if (existing) {
            await env.DB.prepare("UPDATE friends SET is_following = 1, updated_at = datetime('now') WHERE line_user_id = ?").bind(lineUserId).run();
          } else {
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const tenant = await env.DB.prepare('SELECT id FROM tenants LIMIT 1').first<{id: string}>();
            await env.DB.prepare('INSERT INTO friends (id, tenant_id, display_name, line_user_id, status, is_following, score, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, tenant?.id || null, lineUserId, lineUserId, 'active', 1, 0, now, now).run();
          }
        }
      } else if (event.type === 'unfollow') {
        const lineUserId = event.source?.userId;
        if (lineUserId) {
          await env.DB.prepare("UPDATE friends SET is_following = 0, updated_at = datetime('now') WHERE line_user_id = ?").bind(lineUserId).run();
        }
      }
    } catch (e) { console.error('Webhook error:', e); }
  }

  return c.json({ status: 'ok' });
});

app.get('/webhook', (c) => c.json({ status: 'ok', message: 'Webhook endpoint active. Use POST for LINE events.' }));

// Fallback: existing lchatAI routes
app.all('*', async (c) => {
  const request = c.req.raw;
  const env = c.env;
  const url = new URL(request.url);
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let response: Response;

  try {
      if (url.pathname === '/api/debug/db' && request.method === 'GET') {
        // Temporary debug endpoint - shows raw DB state
        const friends = await env.DB.prepare('SELECT id, tenant_id, display_name, line_user_id, status, is_following FROM friends ORDER BY created_at DESC LIMIT 10').all();
        const accounts = await env.DB.prepare('SELECT id, channel_id, name, is_active FROM line_accounts ORDER BY created_at DESC LIMIT 10').all();
        const tenants = await env.DB.prepare('SELECT id, name FROM tenants ORDER BY created_at DESC LIMIT 5').all();
        const webhookLogs = await env.DB.prepare("SELECT id, request_message, intent, created_at FROM ai_execution_logs WHERE intent = 'webhook_debug' ORDER BY created_at DESC LIMIT 20").all();
        response = Response.json({ friends: friends.results, line_accounts: accounts.results, tenants: tenants.results, webhook_logs: webhookLogs.results });
      } else if (url.pathname === '/health') {
        response = Response.json({ status: 'ok', environment: env.ENVIRONMENT, timestamp: new Date().toISOString() });
      } else if (url.pathname === '/') {
        response = Response.json({ name: 'lchatAI-api', environment: env.ENVIRONMENT, version: '0.13.0' });
      } else if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        response = await handleLogin(request, env);
      } else if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        response = await handleMe(request, env);
      } else if (url.pathname === '/api/admin/bootstrap') {
        response = await handleBootstrap(request, env);
      } else if (url.pathname.startsWith('/api/admin/users/') && url.pathname !== '/api/admin/users') {
        response = await handleAdminUserById(request, url, env);
      } else if (url.pathname === '/api/admin/users') {
        response = await handleAdminUsers(request, env);
      } else if (url.pathname.startsWith('/api/admin/tenants/') && url.pathname !== '/api/admin/tenants') {
        response = await handleAdminTenantById(request, url, env);
      } else if (url.pathname === '/api/admin/tenants') {
        response = await handleAdminTenants(request, env);
      } else if (url.pathname === '/api/friends') {
        response = await handleFriends(request, env);
      } else if (url.pathname === '/api/broadcasts') {
        response = await handleBroadcasts(request, env);
      } else if (url.pathname === '/api/forms') {
        response = await handleForms(request, env);
      } else if (url.pathname === '/api/tags') {
        response = await handleTags(request, env);
      } else if (url.pathname === '/api/conversion-points') {
        response = await handleConversionPoints(request, env);
      } else if (url.pathname === '/api/bots' || url.pathname.startsWith('/api/bots/')) {
        response = await handleBots(request, url, env);
      } else if (url.pathname.startsWith('/api/knowledge/') && url.pathname !== '/api/knowledge') {
        response = await handleKnowledgeById(request, url, env);
      } else if (url.pathname === '/api/knowledge') {
        response = await handleKnowledge(request, env);
      } else if (url.pathname === '/api/scenarios' || url.pathname.startsWith('/api/scenarios/')) {
        response = await handleScenarios(request, url, env);
      } else if (url.pathname === '/api/line-accounts' || url.pathname.startsWith('/api/line-accounts/')) {
        response = await handleLineAccounts(request, url, env);
      } else if (url.pathname === '/api/ai/logs') {
        response = await handleAiLogs(request, env);
      } else if (url.pathname === '/api/ai/test') {
        response = await handleAiTest(request, env);
      } else if (url.pathname === '/api/ai/chat') {
        response = await handleAiChatRoute(request, url, env);
      } else if (url.pathname === '/api/tracked-links') {
        response = await handleTrackedLinks(request, env);
      } else if (url.pathname.startsWith('/t/')) {
        response = await handleRedirect(request, url, env);
      } else if (url.pathname === '/chat') {
        response = new Response(getChatHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/login') {
        response = new Response(getLoginHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/admin') {
        response = new Response(getAdminHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard') {
        response = new Response(getDashboardHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/tracked-links') {
        response = new Response(getTrackedLinksPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/scenarios') {
        response = new Response(getScenariosPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/friends') {
        response = new Response(getFriendsPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/tags') {
        response = new Response(getTagsPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/conversions') {
        response = new Response(getConversionsPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/broadcasts') {
        response = new Response(getBroadcastsPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/forms') {
        response = new Response(getFormsPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/bots') {
        response = new Response(getBotsPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/knowledge') {
        response = new Response(getKnowledgePageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/ai-logs') {
        response = new Response(getAiLogsPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/dashboard/line-accounts') {
        response = new Response(getLineAccountsPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname === '/setup') {
        response = new Response(getSetupHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else {
        response = Response.json({ error: 'not found' }, { status: 404 });
      }
    } catch (err) {
      response = Response.json({ status: 'error', message: String(err) }, { status: 500 });
    }

    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) newHeaders.set(key, value);
    return new Response(response.body, { status: response.status, headers: newHeaders });
});

// Scheduled handler placeholder — LINE Harness services will be wired one by one
async function scheduled(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  // TODO: Wire step delivery, broadcast, reminder services individually
}

export default {
  fetch: app.fetch,
  scheduled,
};

// --- Admin Users/Tenants ---
async function handleAdminUsers(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'ADMIN_JWT_SECRET not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin');
  if (denied) return denied;
  const authService = new AuthService(env.DB, env.ADMIN_JWT_SECRET);
  const adminService = new AdminService(env.DB, authService);
  if (request.method === 'GET') { const users = await adminService.listUsers(); return Response.json({ status: 'ok', users }); }
  if (request.method === 'POST') {
    let body: { tenant_name?: string; login_id?: string; password?: string; email?: string };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    try {
      const result = await adminService.createAdmin({ tenant_name: body.tenant_name || '', login_id: body.login_id || '', password: body.password || '', email: body.email });
      return Response.json({ status: 'ok', ...result }, { status: 201 });
    } catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

async function handleAdminUserById(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'ADMIN_JWT_SECRET not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin');
  if (denied) return denied;

  const authService = new AuthService(env.DB, env.ADMIN_JWT_SECRET);
  const adminService = new AdminService(env.DB, authService);
  const segments = url.pathname.split('/');
  // /api/admin/users/:id => segments[4]
  // /api/admin/users/:id/status => segments[5]
  const userId = segments[4];

  try {
    if (request.method === 'PATCH' && segments[5] === 'status') {
      let body: { status?: string };
      try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
      if (body.status !== 'active' && body.status !== 'inactive') {
        return Response.json({ status: 'error', message: 'status must be "active" or "inactive"' }, { status: 400 });
      }
      const user = await adminService.updateUserStatus(userId, body.status, auth!.user_id);
      return Response.json({ status: 'ok', user });
    }

    // PATCH /api/admin/users/:id (edit: password, email)
    if (request.method === 'PATCH' && !segments[5]) {
      let body: { password?: string; email?: string };
      try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
      if (!body.password && body.email === undefined) {
        return Response.json({ status: 'error', message: 'Nothing to update' }, { status: 400 });
      }
      const user = await adminService.updateUser(userId, body);
      return Response.json({ status: 'ok', user });
    }

    if (request.method === 'DELETE') {
      await adminService.deleteUser(userId, auth!.user_id);
      return Response.json({ status: 'ok' });
    }

    return Response.json({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    const status = err.message === 'User not found' ? 404 : 400;
    return Response.json({ status: 'error', message: err.message }, { status });
  }
}

async function handleAdminTenants(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'ADMIN_JWT_SECRET not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin');
  if (denied) return denied;
  const authService = new AuthService(env.DB, env.ADMIN_JWT_SECRET);
  const adminService = new AdminService(env.DB, authService);
  const tenants = await adminService.listTenants();
  return Response.json({ status: 'ok', tenants });
}

async function handleAdminTenantById(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'ADMIN_JWT_SECRET not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin');
  if (denied) return denied;

  const authService = new AuthService(env.DB, env.ADMIN_JWT_SECRET);
  const adminService = new AdminService(env.DB, authService);
  const segments = url.pathname.split('/');
  // /api/admin/tenants/:id => segments[4]
  const tenantId = segments[4];

  if (request.method !== 'PATCH') {
    return Response.json({ error: 'method not allowed' }, { status: 405 });
  }

  let body: { name?: string; plan?: string; status?: string };
  try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }

  if (body.name === undefined && body.plan === undefined && body.status === undefined) {
    return Response.json({ status: 'error', message: 'Nothing to update' }, { status: 400 });
  }

  try {
    const tenant = await adminService.updateTenant(tenantId, body);
    return Response.json({ status: 'ok', tenant });
  } catch (err: any) {
    const status = err.message === 'Tenant not found' ? 404 : 400;
    return Response.json({ status: 'error', message: err.message }, { status });
  }
}

// --- Auth ---
async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'ADMIN_JWT_SECRET not configured' }, { status: 503 });
  let body: { login_id?: string; password?: string };
  try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
  if (!body.login_id || !body.password) return Response.json({ status: 'error', message: 'login_id and password required' }, { status: 400 });
  const auth = new AuthService(env.DB, env.ADMIN_JWT_SECRET);
  const result = await auth.login(body.login_id, body.password);
  if (!result) return Response.json({ status: 'error', message: 'Invalid credentials' }, { status: 401 });
  return Response.json({ status: 'ok', token: result.token, user: result.user });
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'ADMIN_JWT_SECRET not configured' }, { status: 503 });
  const authPayload = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(authPayload, 'super_admin', 'admin');
  if (denied) return denied;
  const auth = new AuthService(env.DB, env.ADMIN_JWT_SECRET);
  const user = await auth.getUserById(authPayload!.user_id);
  if (!user) return Response.json({ status: 'error', message: 'User not found' }, { status: 404 });
  return Response.json({ status: 'ok', user });
}

async function handleBootstrap(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'ADMIN_JWT_SECRET not configured' }, { status: 503 });
  let loginId: string; let password: string; let email: string | undefined;
  if (request.method === 'POST') {
    let body: { login_id?: string; password?: string; email?: string };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    loginId = body.login_id || ''; password = body.password || ''; email = body.email;
  } else if (request.method === 'GET') {
    const url = new URL(request.url);
    loginId = url.searchParams.get('login_id') || ''; password = url.searchParams.get('password') || ''; email = url.searchParams.get('email') || undefined;
  } else { return Response.json({ error: 'method not allowed' }, { status: 405 }); }
  if (!loginId || !password) return Response.json({ status: 'error', message: 'login_id and password required' }, { status: 400 });
  if (password.length < 8) return Response.json({ status: 'error', message: 'Password must be at least 8 characters' }, { status: 400 });
  const auth = new AuthService(env.DB, env.ADMIN_JWT_SECRET);
  try {
    const user = await auth.bootstrap(loginId, password, email);
    return Response.json({ status: 'ok', message: 'Super admin created. Go to /login to sign in.', user }, { status: 201 });
  } catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 409 }); }
}

// --- Friends ---
async function handleFriends(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new FriendAdapter(env.DB);
  const tenantId = auth!.tenant_id;
  if (request.method === 'GET') {
    const friends = tenantId ? await adapter.list(tenantId) : await adapter.listAll();
    return Response.json({ status: 'ok', friends });
  }
  if (request.method === 'POST') {
    let body: { display_name?: string; line_user_id?: string; ref_code?: string };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    const effectiveTenantId = tenantId || (body as any).tenant_id;
    if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required (specify tenant_id for super_admin)' }, { status: 400 });
    try { const f = await adapter.create(effectiveTenantId, { display_name: body.display_name || '', line_user_id: body.line_user_id, ref_code: body.ref_code }); return Response.json({ status: 'ok', friend: f }, { status: 201 }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

// --- Broadcasts ---
async function handleBroadcasts(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new BroadcastAdapter(env.DB);
  const tenantId = auth!.tenant_id;
  if (request.method === 'GET') {
    const broadcasts = tenantId ? await adapter.list(tenantId) : await adapter.listAll();
    return Response.json({ status: 'ok', broadcasts });
  }
  if (request.method === 'POST') {
    let body: { name?: string; message_content?: string; message_type?: string; target_tag_id?: string; scheduled_at?: string };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    const effectiveTenantId = tenantId || (body as any).tenant_id;
    if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required (specify tenant_id for super_admin)' }, { status: 400 });
    try { const b = await adapter.create(effectiveTenantId, { name: body.name || '', message_content: body.message_content || '', message_type: body.message_type, target_tag_id: body.target_tag_id, scheduled_at: body.scheduled_at }); return Response.json({ status: 'ok', broadcast: b }, { status: 201 }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

// --- Forms ---
async function handleForms(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new FormAdapter(env.DB);
  const tenantId = auth!.tenant_id;
  if (request.method === 'GET') {
    const forms = tenantId ? await adapter.list(tenantId) : await adapter.listAll();
    return Response.json({ status: 'ok', forms });
  }
  if (request.method === 'POST') {
    let body: { name?: string; description?: string; fields?: Array<{label:string;type:string;required?:boolean}> };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    const effectiveTenantId = tenantId || (body as any).tenant_id;
    if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required (specify tenant_id for super_admin)' }, { status: 400 });
    try { const f = await adapter.create(effectiveTenantId, { name: body.name || '', description: body.description, fields: body.fields }); return Response.json({ status: 'ok', form: f }, { status: 201 }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

// --- Tags ---
async function handleTags(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new TagAdapter(env.DB);
  const tenantId = auth!.tenant_id;
  if (request.method === 'GET') {
    const tags = tenantId ? await adapter.list(tenantId) : await adapter.listAll();
    return Response.json({ status: 'ok', tags });
  }
  if (request.method === 'POST') {
    let body: { name?: string; color?: string; description?: string };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    const effectiveTenantId = tenantId || (body as any).tenant_id;
    if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required (specify tenant_id for super_admin)' }, { status: 400 });
    try { const tag = await adapter.create(effectiveTenantId, { name: body.name || '', color: body.color, description: body.description }); return Response.json({ status: 'ok', tag }, { status: 201 }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

// --- Conversion Points ---
async function handleConversionPoints(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new ConversionPointAdapter(env.DB);
  const tenantId = auth!.tenant_id;
  if (request.method === 'GET') {
    const cvs = tenantId ? await adapter.list(tenantId) : await adapter.listAll();
    return Response.json({ status: 'ok', conversion_points: cvs });
  }
  if (request.method === 'POST') {
    let body: { name?: string; code?: string; scope?: string; verification_method?: string; is_primary?: boolean; value_amount?: number; description?: string };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    const effectiveTenantId = tenantId || (body as any).tenant_id;
    if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required (specify tenant_id for super_admin)' }, { status: 400 });
    try { const cv = await adapter.create(effectiveTenantId, { name: body.name || '', code: body.code || '', scope: body.scope, verification_method: body.verification_method, is_primary: body.is_primary, value_amount: body.value_amount, description: body.description }); return Response.json({ status: 'ok', conversion_point: cv }, { status: 201 }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

// --- Scenarios ---
// --- Bots ---
async function handleBots(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new BotAdapter(env.DB);
  const tenantId = auth!.tenant_id;

  // GET /api/bots
  if (url.pathname === '/api/bots' && request.method === 'GET') {
    const bots = tenantId ? await adapter.list(tenantId) : await adapter.listAll();
    return Response.json({ status: 'ok', bots });
  }
  // POST /api/bots
  if (url.pathname === '/api/bots' && request.method === 'POST') {
    let body: any;
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    const effectiveTenantId = tenantId || (body as any).tenant_id;
    if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required (specify tenant_id for super_admin)' }, { status: 400 });
    try { const bot = await adapter.create(effectiveTenantId, body); return Response.json({ status: 'ok', bot }, { status: 201 }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }

  // /api/bots/:id
  const parts = url.pathname.replace('/api/bots/', '').split('/');
  const botId = parts[0];
  if (!botId) return Response.json({ error: 'missing id' }, { status: 400 });

  // GET /api/bots/:id
  if (!parts[1] && request.method === 'GET') {
    const bot = await adapter.getWithKnowledge(botId);
    if (!bot) return Response.json({ status: 'error', message: 'Bot not found' }, { status: 404 });
    return Response.json({ status: 'ok', bot });
  }

  // POST /api/bots/:id/knowledge — bind knowledge
  if (parts[1] === 'knowledge' && request.method === 'POST') {
    let body: { knowledge_id?: string };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    if (!body.knowledge_id) return Response.json({ status: 'error', message: 'knowledge_id required' }, { status: 400 });
    try { await adapter.bindKnowledge(botId, body.knowledge_id); return Response.json({ status: 'ok' }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }

  // DELETE /api/bots/:id/knowledge/:knowledgeId — unbind
  if (parts[1] === 'knowledge' && parts[2] && request.method === 'DELETE') {
    try { await adapter.unbindKnowledge(botId, parts[2]); return Response.json({ status: 'ok' }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }

  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

// --- Knowledge ---
async function handleKnowledgeById(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new KnowledgeAdapter(env.DB);
  const knowledgeId = url.pathname.split('/')[3];
  try {
    if (request.method === 'PATCH') {
      let body: { title?: string; content?: string; category?: string };
      try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
      const item = await adapter.update(knowledgeId, body);
      return Response.json({ status: 'ok', knowledge_item: item });
    }
    if (request.method === 'DELETE') {
      await adapter.delete(knowledgeId);
      return Response.json({ status: 'ok' });
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    const status = err.message === 'Knowledge not found' ? 404 : 400;
    return Response.json({ status: 'error', message: err.message }, { status });
  }
}

async function handleKnowledge(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new KnowledgeAdapter(env.DB);
  const tenantId = auth!.tenant_id;

  if (request.method === 'GET') {
    const items = tenantId ? await adapter.list(tenantId) : await adapter.listAll();
    return Response.json({ status: 'ok', knowledge: items });
  }
  if (request.method === 'POST') {
    let body: any;
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    const effectiveTenantId = tenantId || (body as any).tenant_id;
    if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required (specify tenant_id for super_admin)' }, { status: 400 });
    try {
      const item = await adapter.create(effectiveTenantId, body);
      // Auto-chunk the content for RAG
      try {
        const chunkAdapter = new KnowledgeChunkAdapter(env.DB);
        const chunks = chunkText(item.content);
        await chunkAdapter.createChunks(item.id, chunks);
      } catch {}
      return Response.json({ status: 'ok', knowledge_item: item }, { status: 201 });
    }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

async function handleScenarios(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;
  const adapter = new ScenarioAdapter(env.DB);
  const tenantId = auth!.tenant_id;

  // GET /api/scenarios
  if (url.pathname === '/api/scenarios' && request.method === 'GET') {
    const scenarios = tenantId ? await adapter.list(tenantId) : await adapter.listAll();
    return Response.json({ status: 'ok', scenarios });
  }
  // POST /api/scenarios
  if (url.pathname === '/api/scenarios' && request.method === 'POST') {
    let body: CreateScenarioInput;
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    const effectiveTenantId = tenantId || (body as any).tenant_id;
    if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required (specify tenant_id for super_admin)' }, { status: 400 });
    try { const s = await adapter.create(effectiveTenantId, body); return Response.json({ status: 'ok', scenario: s }, { status: 201 }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  // /api/scenarios/:id or /api/scenarios/:id/steps
  const parts = url.pathname.replace('/api/scenarios/', '').split('/');
  const scenarioId = parts[0];
  if (!scenarioId) return Response.json({ error: 'missing id' }, { status: 400 });

  if (parts[1] === 'steps') {
    if (request.method === 'GET') {
      const steps = await adapter.getSteps(scenarioId);
      return Response.json({ status: 'ok', steps });
    }
    if (request.method === 'POST') {
      let body: CreateStepInput;
      try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
      try { const step = await adapter.addStep(scenarioId, body); return Response.json({ status: 'ok', step }, { status: 201 }); }
      catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
    }
  }

  // GET /api/scenarios/:id
  if (request.method === 'GET') {
    const scenario = await adapter.getById(scenarioId);
    if (!scenario) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ status: 'ok', scenario });
  }
  // PUT /api/scenarios/:id
  if (request.method === 'PUT') {
    let body: Partial<CreateScenarioInput>;
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    await adapter.update(scenarioId, body);
    const updated = await adapter.getById(scenarioId);
    return Response.json({ status: 'ok', scenario: updated });
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

// --- AI ---
async function handleAiTest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return callOpenAI(env, 'hello');
  if (request.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 });
  let body: { message?: string };
  try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON body' }, { status: 400 }); }
  return callOpenAI(env, body.message || 'hello');
}
async function callOpenAI(env: Env, message: string): Promise<Response> {
  if (!env.OPENAI_API_KEY) return Response.json({ status: 'error', message: 'OPENAI_API_KEY not configured' }, { status: 503 });
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'Reply briefly in the same language as the user.' }, { role: 'user', content: message }], max_tokens: 200 }) });
    if (!res.ok) { const t = await res.text(); return Response.json({ status: 'error', message: `OpenAI: ${res.status}`, detail: t }, { status: 502 }); }
    const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage: Record<string, unknown> };
    return Response.json({ status: 'ok', response: data.choices[0]?.message?.content || '', usage: data.usage });
  } catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 502 }); }
}
async function handleAiChatRoute(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method === 'GET') { return handleAiChat(new Request(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: url.searchParams.get('q') || '新規友だち向けに3日ステップを作って' }) }), env); }
  if (request.method === 'POST') return handleAiChat(request, env);
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}
// --- LINE Accounts ---
// --- Webhook ---
async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  // Debug: log webhook receipt
  try {
    await env.DB.prepare(
      "INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(crypto.randomUUID(), 'WEBHOOK_RECEIVED: sig=' + signature.substring(0, 10) + '... body_len=' + body.length, 'webhook_debug').run();
  } catch {}

  // Get all registered LINE accounts to find matching channel_secret
  const accounts = await getLineAccountsList(env.DB);

  if (accounts.length === 0) {
    return Response.json({ status: 'error', message: 'No LINE accounts registered' }, { status: 400 });
  }

  let matchedAccount = null;
  for (const account of accounts) {
    if (account.is_active) {
      const valid = await verifySignature(account.channel_secret, body, signature);
      // Debug log
      try {
        await env.DB.prepare(
          "INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(crypto.randomUUID(), 'SIG_CHECK: account=' + account.name + ' valid=' + valid, 'webhook_debug').run();
      } catch {}
      if (valid) { matchedAccount = account; break; }
    }
  }

  if (!matchedAccount) {
    return Response.json({ status: 'error', message: 'Invalid signature' }, { status: 401 });
  }

  // Parse webhook events
  let parsed: WebhookRequestBody;
  try { parsed = JSON.parse(body); } catch { return Response.json({ status: 'ok' }); }

  // Process events
  for (const event of parsed.events) {
    try {
      if (event.type === 'follow') {
        const lineUserId = event.source?.userId;
        if (lineUserId) {
          // Check if friend already exists
          const existing = await env.DB.prepare('SELECT id FROM friends WHERE line_user_id = ?').bind(lineUserId).first();
          if (existing) {
            await env.DB.prepare("UPDATE friends SET is_following = 1, updated_at = datetime('now') WHERE line_user_id = ?").bind(lineUserId).run();
          } else {
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            // Use first tenant from DB as default (line_accounts don't have tenant_id yet)
            const tenants = await env.DB.prepare('SELECT id FROM tenants LIMIT 1').first<{id: string}>();
            const tenantId = tenants?.id || null;
            await env.DB.prepare(
              'INSERT INTO friends (id, tenant_id, display_name, line_user_id, status, is_following, score, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
            ).bind(id, tenantId, lineUserId, lineUserId, 'active', 1, 0, now, now).run();
          }
        }
      } else if (event.type === 'unfollow') {
        const lineUserId = event.source?.userId;
        if (lineUserId) {
          await env.DB.prepare("UPDATE friends SET is_following = 0, updated_at = datetime('now') WHERE line_user_id = ?").bind(lineUserId).run();
        }
      }
    } catch (e) {
      // Log error but don't fail the webhook
      console.error('Webhook event processing error:', e);
    }
  }

  return Response.json({ status: 'ok' });
}

async function handleLineAccounts(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;

  // GET /api/line-accounts
  if (url.pathname === '/api/line-accounts' && request.method === 'GET') {
    const accounts = await getLineAccountsList(env.DB);
    return Response.json({ status: 'ok', accounts });
  }
  // POST /api/line-accounts
  if (url.pathname === '/api/line-accounts' && request.method === 'POST') {
    let body: any;
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    if (!body.channel_id || !body.name || !body.channel_access_token || !body.channel_secret) {
      return Response.json({ status: 'error', message: 'channel_id, name, channel_access_token, channel_secret are required' }, { status: 400 });
    }
    try {
      const account = await createLineAccount(env.DB, {
        channelId: body.channel_id,
        name: body.name,
        channelAccessToken: body.channel_access_token,
        channelSecret: body.channel_secret,
      });
      return Response.json({ status: 'ok', account }, { status: 201 });
    } catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }

  // /api/line-accounts/:id
  const segments = url.pathname.split('/');
  const accountId = segments[3];
  if (!accountId) return Response.json({ error: 'missing id' }, { status: 400 });

  // DELETE /api/line-accounts/:id
  if (request.method === 'DELETE') {
    try { await deleteLineAccount(env.DB, accountId); return Response.json({ status: 'ok' }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  // PATCH /api/line-accounts/:id
  if (request.method === 'PATCH') {
    let body: any;
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    try {
      const account = await updateLineAccount(env.DB, accountId, {
        name: body.name,
        channel_access_token: body.channel_access_token,
        channel_secret: body.channel_secret,
        is_active: body.is_active,
      });
      return Response.json({ status: 'ok', account });
    } catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

async function handleAiLogs(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin');
  if (denied) return denied;
  const adapter = new ExecutionLogAdapter(env.DB);
  const logs = await adapter.list(100);
  return Response.json({ status: 'ok', logs });
}

async function handleAiChat(request: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) return Response.json({ status: 'error', message: 'OPENAI_API_KEY not configured' }, { status: 503 });
  let body: AiChatRequest;
  try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON body' }, { status: 400 }); }
  if (!body.message) return Response.json({ status: 'error', message: 'Missing required field: message' }, { status: 400 });

  const logAdapter = new ExecutionLogAdapter(env.DB);
  let auth: any = null;
  if (env.ADMIN_JWT_SECRET) { auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET); }

  try {
    let botKnowledge: BotKnowledgeContext | undefined;
    if (body.bot_id && env.DB) {
      const botAdapter = new BotAdapter(env.DB);
      const bot = await botAdapter.getWithKnowledge(body.bot_id);
      if (bot) {
          const chunkAdapter = new KnowledgeChunkAdapter(env.DB);
          const knowledgeIds = bot.knowledge.map(k => k.id);
          const chunks = knowledgeIds.length > 0 ? await chunkAdapter.listByKnowledgeIds(knowledgeIds) : [];
          botKnowledge = { bot, knowledge: bot.knowledge, chunks };
        }
    }
    const plan = await generatePlan(body, env.OPENAI_API_KEY, botKnowledge);
    try {
      await logAdapter.record({
        tenant_id: auth?.tenant_id, user_id: auth?.user_id, bot_id: body.bot_id,
        request_message: body.message, intent: plan.intent, confidence: plan.confidence,
        slots: plan.slots, missing_slots: plan.missing_slots, plan: plan.plan,
        is_complete: plan.is_complete,
      });
    } catch {}
    return Response.json({ status: 'ok', ...plan });
  }
  catch (err) {
    try { await logAdapter.record({ tenant_id: auth?.tenant_id, user_id: auth?.user_id, bot_id: body.bot_id, request_message: body.message, error: String(err) }); } catch {}
    return Response.json({ status: 'error', message: String(err) }, { status: 502 });
  }
}

// --- Tracked Links ---
async function handleTrackedLinks(request: Request, env: Env): Promise<Response> {
  const adapter = new TrackedLinkAdapter(env.DB);
  if (request.method === 'GET') { const links = await adapter.list(); return Response.json({ status: 'ok', links }); }
  if (request.method === 'POST') {
    let input: CreateTrackedLinkInput;
    try { input = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    try { const link = await adapter.create(input); return Response.json({ status: 'ok', link, tracking_url: `/t/${link.id}` }, { status: 201 }); }
    catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}
async function handleRedirect(request: Request, url: URL, env: Env): Promise<Response> {
  const linkId = url.pathname.replace('/t/', '');
  if (!linkId) return Response.json({ error: 'missing link id' }, { status: 400 });
  const adapter = new TrackedLinkAdapter(env.DB);
  const link = await adapter.getById(linkId);
  if (!link) return Response.json({ error: 'link not found' }, { status: 404 });
  try { await adapter.recordClick(linkId, request); } catch {}
  return Response.redirect(link.destination_url, 302);
}

// --- Inline HTML pages ---
function getSetupHtml(): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lchatAI - 初期セットアップ</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:white;padding:40px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.1);width:100%;max-width:440px}h1{color:#06C755;font-size:24px;margin-bottom:8px}.subtitle{color:#666;font-size:14px;margin-bottom:24px}label{display:block;font-size:13px;color:#333;margin-bottom:4px;font-weight:500}input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:16px;outline:none}input:focus{border-color:#06C755}button{width:100%;padding:12px;background:#06C755;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}button:hover{background:#05a648}.msg{font-size:13px;margin-bottom:12px;padding:8px 12px;border-radius:8px;display:none}.msg.error{background:#ffebee;color:#c62828}.msg.success{background:#e8f5e9;color:#2e7d32}.note{font-size:12px;color:#999;margin-top:16px}</style></head><body><div class="card"><h1>lchatAI</h1><div class="subtitle">スーパーアドミンアカウントを作成します（1回のみ）</div><div class="msg error" id="error"></div><div class="msg success" id="success"></div><label>ログインID</label><input type="text" id="loginId" placeholder="admin"><label>パスワード（8文字以上）</label><input type="password" id="password" placeholder="********"><label>メールアドレス（任意）</label><input type="email" id="email" placeholder="admin@example.com"><button onclick="doSetup()">スーパーアドミンを作成</button><div class="note">作成後は /login からログインしてください。</div></div><script>async function doSetup(){const l=document.getElementById('loginId').value,p=document.getElementById('password').value,e=document.getElementById('email').value,er=document.getElementById('error'),su=document.getElementById('success');er.style.display='none';su.style.display='none';if(!l||!p){er.textContent='ログインIDとパスワードを入力してください';er.style.display='block';return}if(p.length<8){er.textContent='パスワードは8文字以上';er.style.display='block';return}try{const r=await fetch('/api/admin/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login_id:l,password:p,email:e||undefined})});const d=await r.json();if(d.status==='ok'){su.textContent='作成しました！';su.style.display='block';setTimeout(()=>window.location.href='/login',2000)}else{er.textContent=d.message;er.style.display='block'}}catch(err){er.textContent=err.message;er.style.display='block'}}</script></body></html>`;
}

function getLoginHtml(): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lchatAI Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:white;padding:40px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.1);width:100%;max-width:400px}h1{color:#06C755;font-size:24px;margin-bottom:8px}.subtitle{color:#666;font-size:14px;margin-bottom:24px}label{display:block;font-size:13px;color:#333;margin-bottom:4px;font-weight:500}input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:16px;outline:none}input:focus{border-color:#06C755}button{width:100%;padding:12px;background:#06C755;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}button:hover{background:#05a648}.msg{font-size:13px;margin-bottom:12px;padding:8px 12px;border-radius:8px;display:none}.msg.error{background:#ffebee;color:#c62828}.msg.success{background:#e8f5e9;color:#2e7d32}</style></head><body><div class="card"><h1>lchatAI</h1><div class="subtitle">管理者ログイン</div><div class="msg error" id="error"></div><div class="msg success" id="success"></div><label>ログインID</label><input type="text" id="loginId" placeholder="login_id"><label>パスワード</label><input type="password" id="password" placeholder="password"><button onclick="doLogin()">ログイン</button></div><script>async function doLogin(){const l=document.getElementById('loginId').value,p=document.getElementById('password').value,er=document.getElementById('error'),su=document.getElementById('success');er.style.display='none';su.style.display='none';if(!l||!p){er.textContent='入力してください';er.style.display='block';return}try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login_id:l,password:p})});const d=await r.json();if(d.status==='ok'){localStorage.setItem('lchatai_token',d.token);localStorage.setItem('lchatai_user',JSON.stringify(d.user));su.textContent='ログイン成功！';su.style.display='block';setTimeout(()=>window.location.href='/dashboard',1000)}else{er.textContent=d.message||'失敗';er.style.display='block'}}catch(err){er.textContent=err.message;er.style.display='block'}}document.getElementById('password').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()})</script></body></html>`;
}

function getChatHtml(): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lchatAI</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;height:100vh;display:flex;flex-direction:column}.header{background:#06C755;color:white;padding:16px 20px;font-size:18px;font-weight:600;display:flex;align-items:center;justify-content:space-between}.header span{font-size:14px;font-weight:400;opacity:.8}.header .nav a{color:rgba(255,255,255,.8);text-decoration:none;font-size:13px;margin-left:12px}.header .nav a:hover{color:white}.header .user-info{font-size:12px;opacity:.8;cursor:pointer}.chat-area{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}.msg{max-width:85%;padding:12px 16px;border-radius:16px;font-size:14px;line-height:1.6;word-break:break-word}.msg.user{background:#06C755;color:white;align-self:flex-end;border-bottom-right-radius:4px}.msg.ai{background:white;color:#333;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.1)}.intent-badge{display:inline-block;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;margin-bottom:8px}.slots-section{margin-top:8px}.slots-section h4{font-size:12px;color:#666;margin-bottom:4px}.slot-item{font-size:13px;padding:2px 0;display:flex;gap:6px}.slot-name{color:#1976d2;font-weight:500}.missing-section{margin-top:12px;background:#fff3e0;padding:10px 12px;border-radius:8px}.missing-section h4{font-size:12px;color:#e65100;margin-bottom:6px}.missing-q{font-size:13px;color:#bf360c;padding:3px 0;cursor:pointer}.missing-q:hover{text-decoration:underline}.plan-section{margin-top:12px;background:#e3f2fd;padding:10px 12px;border-radius:8px}.plan-section h4{font-size:12px;color:#1565c0;margin-bottom:4px}.plan-desc{font-size:13px;color:#0d47a1}.confirm-badge{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600}.confirm-badge.required{background:#fce4ec;color:#c62828}.confirm-badge.not-required{background:#e8f5e9;color:#2e7d32}.confirm-badge.complete{background:#06C755;color:white;cursor:pointer;padding:8px 20px;font-size:14px}.confirm-badge.complete:hover{background:#05a648}.progress-bar{margin-top:8px;background:#e0e0e0;border-radius:4px;height:6px;overflow:hidden}.progress-fill{height:100%;background:#06C755;border-radius:4px;transition:width .3s}.bot-selector{padding:8px 16px;background:#f9f9f9;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:8px;font-size:13px;color:#666}.bot-selector select{padding:6px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none;min-width:180px}.bot-selector select:focus{border-color:#06C755}.bot-selector .bot-info{font-size:11px;color:#999}.input-area{padding:12px 16px;background:white;border-top:1px solid #e0e0e0;display:flex;gap:8px}.input-area input{flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:24px;font-size:14px;outline:none}.input-area input:focus{border-color:#06C755}.input-area button{background:#06C755;color:white;border:none;border-radius:50%;width:40px;height:40px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}.input-area button:disabled{background:#ccc}.loading{display:flex;gap:4px;padding:8px 0}.loading span{width:8px;height:8px;background:#999;border-radius:50%;animation:bounce 1.4s infinite}.loading span:nth-child(2){animation-delay:.2s}.loading span:nth-child(3){animation-delay:.4s}@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}</style></head><body><div class="header"><div>lchatAI <span>v0.9</span></div><div class="nav"><a href="/dashboard">管理画面</a><span class="user-info" id="userInfo" onclick="logout()"></span></div></div><div class="bot-selector"><span>Bot:</span><select id="botSelect"><option value="">未選択（汎用）</option></select><span class="bot-info" id="botInfo"></span></div><div class="chat-area" id="chatArea"><div class="msg ai">LINE配信の設定をAIがお手伝いします。<br><br>例: 「新規友だち向けに3日ステップを作って」<br>例: 「YouTube流入向けのtracked linkを作って」<br>例: 「ライフプラン申込をCVにして」</div></div><div class="input-area"><input type="text" id="msgInput" placeholder="指示を入力..." autofocus><button id="sendBtn" onclick="sendMessage()">&#8593;</button></div><script>const chatArea=document.getElementById('chatArea'),msgInput=document.getElementById('msgInput'),sendBtn=document.getElementById('sendBtn'),userInfoEl=document.getElementById('userInfo');let conversationHistory=[],accumulatedSlots=[];const user=JSON.parse(localStorage.getItem('lchatai_user')||'null');if(user){userInfoEl.textContent=user.login_id+' [ログアウト]'}function logout(){localStorage.removeItem('lchatai_token');localStorage.removeItem('lchatai_user');window.location.href='/login'}msgInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing)sendMessage()});async function sendMessage(){const msg=msgInput.value.trim();if(!msg)return;addMsg(msg,'user');conversationHistory.push({role:'user',content:msg});msgInput.value='';sendBtn.disabled=true;const le=document.createElement('div');le.className='msg ai';le.innerHTML='<div class="loading"><span></span><span></span><span></span></div>';chatArea.appendChild(le);chatArea.scrollTop=chatArea.scrollHeight;try{const h={'Content-Type':'application/json'};const t=localStorage.getItem('lchatai_token');if(t)h['Authorization']='Bearer '+t;const r=await fetch('/api/ai/chat',{method:'POST',headers:h,body:JSON.stringify({message:msg,history:conversationHistory.slice(0,-1),accumulated_slots:accumulatedSlots,bot_id:document.getElementById('botSelect').value||undefined})});const d=await r.json();chatArea.removeChild(le);if(d.status==='ok'){accumulatedSlots=(d.slots||[]).filter(s=>s.value!=null);conversationHistory.push({role:'assistant',content:'Intent: '+d.intent});addPlanMsg(d)}else{addMsg('Error: '+(d.message||''),  'ai')}}catch(err){chatArea.removeChild(le);addMsg('Error: '+err.message,'ai')}sendBtn.disabled=false;chatArea.scrollTop=chatArea.scrollHeight}function addMsg(t,c){const e=document.createElement('div');e.className='msg '+c;e.textContent=t;chatArea.appendChild(e);chatArea.scrollTop=chatArea.scrollHeight}function fillQuestion(q){msgInput.value='';msgInput.focus();msgInput.placeholder=q}function addPlanMsg(d){const e=document.createElement('div');e.className='msg ai';const f=(d.slots||[]).filter(s=>s.value!=null);const tr=f.length+(d.missing_slots||[]).length;const p=tr>0?Math.round((f.length/tr)*100):0;let h='<div class="intent-badge">'+esc(d.intent)+' ('+Math.round((d.confidence||0)*100)+'%)</div>';h+='<div class="progress-bar"><div class="progress-fill" style="width:'+p+'%"></div></div>';h+='<div style="font-size:11px;color:#666;margin-top:2px">'+f.length+'/'+tr+' 項目完了</div>';if(f.length>0){h+='<div class="slots-section"><h4>&#x2705; 検出された情報</h4>';f.forEach(s=>{h+='<div class="slot-item"><span class="slot-name">'+esc(s.name)+':</span> '+esc(String(s.value))+'</div>'});h+='</div>'}if(d.missing_slots&&d.missing_slots.length>0){h+='<div class="missing-section"><h4>&#x2753; 不足している情報</h4>';d.missing_slots.forEach(s=>{h+='<div class="missing-q" onclick="fillQuestion(\\''+esc(s.ask_question).replace(/'/g,"\\\\'")+'\\')">・'+esc(s.ask_question)+'</div>'});h+='</div>'}if(d.plan){h+='<div class="plan-section"><h4>&#x1f4cb; 実行プラン</h4><div class="plan-desc">'+esc(d.plan.description)+'</div></div>'}if(d.is_complete){h+='<div class="confirm-badge complete" onclick="confirmPlan()">&#x2705; この内容で実行する</div>'}else if(d.requires_confirmation){h+='<div class="confirm-badge required">&#x1f512; 情報が揃ったら確認へ</div>'}else{h+='<div class="confirm-badge not-required">&#x2705; 確認不要</div>'}e.innerHTML=h;chatArea.appendChild(e)}function confirmPlan(){addMsg('[確認] 実行を承認しました。（preview-only）','ai');conversationHistory=[];accumulatedSlots=[]}function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}async function loadBots(){try{const h={'Content-Type':'application/json'};const t=localStorage.getItem('lchatai_token');if(t)h['Authorization']='Bearer '+t;const r=await fetch('/api/bots',{headers:h});if(!r.ok)return;const d=await r.json();const sel=document.getElementById('botSelect');(d.bots||[]).forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name+' ('+b.tone+')';sel.appendChild(o)})}catch(e){}}document.getElementById('botSelect').addEventListener('change',async function(){const id=this.value;const info=document.getElementById('botInfo');if(!id){info.textContent='';return}try{const h={'Content-Type':'application/json'};const t=localStorage.getItem('lchatai_token');if(t)h['Authorization']='Bearer '+t;const r=await fetch('/api/bots/'+id,{headers:h});const d=await r.json();if(d.status==='ok'){const b=d.bot;info.textContent=b.strategy+(b.knowledge&&b.knowledge.length?' | Knowledge: '+b.knowledge.length+'件':'')}}catch(e){info.textContent=''}});loadBots()</script></body></html>`;
}
