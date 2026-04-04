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
import { getEntryRoutesPageHtml } from './pages/entry-routes';
import { getLineAccountsPageHtml } from './pages/line-accounts';
import { getChatPageHtml } from './pages/chat';

// LINE Harness DB adapters
import { createLineAccount, getLineAccounts as getLineAccountsList, updateLineAccount, deleteLineAccount } from './line-harness/db/line-accounts.js';
import { verifySignature } from './line-harness/line-sdk/webhook.js';
import type { WebhookRequestBody } from './line-harness/line-sdk/types.js';

// LINE Harness upstream Hono routes (bridge via src/line-harness/index.ts)
import { webhook as lhWebhook } from './line-harness/routes/webhook.js';
import { friends as lhFriends } from './line-harness/routes/friends.js';
import { tags as lhTags } from './line-harness/routes/tags.js';
import { scenarios as lhScenarios } from './line-harness/routes/scenarios.js';
import { broadcasts as lhBroadcasts } from './line-harness/routes/broadcasts.js';
import { users as lhUsers } from './line-harness/routes/users.js';
import { lineAccounts as lhLineAccounts } from './line-harness/routes/line-accounts.js';
import { conversions as lhConversions } from './line-harness/routes/conversions.js';
import { affiliates as lhAffiliates } from './line-harness/routes/affiliates.js';
import { webhooks as lhWebhooks } from './line-harness/routes/webhooks.js';
import { calendar as lhCalendar } from './line-harness/routes/calendar.js';
import { reminders as lhReminders } from './line-harness/routes/reminders.js';
import { scoring as lhScoring } from './line-harness/routes/scoring.js';
import { templates as lhTemplates } from './line-harness/routes/templates.js';
import { chats as lhChats } from './line-harness/routes/chats.js';
import { notifications as lhNotifications } from './line-harness/routes/notifications.js';
import { stripe as lhStripe } from './line-harness/routes/stripe.js';
import { automations as lhAutomations } from './line-harness/routes/automations.js';
import { richMenus as lhRichMenus } from './line-harness/routes/rich-menus.js';
import { trackedLinks as lhTrackedLinks } from './line-harness/routes/tracked-links.js';
import { forms as lhForms } from './line-harness/routes/forms.js';
import { adPlatforms as lhAdPlatforms } from './line-harness/routes/ad-platforms.js';
import { staff as lhStaff } from './line-harness/routes/staff.js';
import { images as lhImages } from './line-harness/routes/images.js';
import { liffRoutes as lhLiff } from './line-harness/routes/liff.js';
import { health as lhHealth } from './line-harness/routes/health.js';

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

// Mount LINE Harness upstream routes at /lh/*
// These are the original complete routes from LINE Harness OSS
app.route('/lh', lhWebhook);
app.route('/lh', lhFriends);
app.route('/lh', lhTags);
app.route('/lh', lhScenarios);
app.route('/lh', lhBroadcasts);
app.route('/lh', lhUsers);
app.route('/lh', lhLineAccounts);
app.route('/lh', lhConversions);
app.route('/lh', lhAffiliates);
app.route('/lh', lhWebhooks);
app.route('/lh', lhCalendar);
app.route('/lh', lhReminders);
app.route('/lh', lhScoring);
app.route('/lh', lhTemplates);
app.route('/lh', lhChats);
app.route('/lh', lhNotifications);
app.route('/lh', lhStripe);
app.route('/lh', lhAutomations);
app.route('/lh', lhRichMenus);
app.route('/lh', lhTrackedLinks);
app.route('/lh', lhForms);
app.route('/lh', lhAdPlatforms);
app.route('/lh', lhStaff);
app.route('/lh', lhImages);
app.route('/lh', lhLiff);
app.route('/lh', lhHealth);

// Our webhook: direct Hono route with tenant support
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

  const events = parsed.events || [];
  // Debug: log parsed events
  try {
    await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'EVENTS: count=' + events.length + ' types=' + events.map((e: any) => e.type).join(',') + ' body=' + body.substring(0, 200), 'webhook_debug').run();
  } catch {}

  for (const event of events) {
    try {
      const lineUserId = event.source?.userId;
      // Debug: log each event
      try {
        await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'EVENT: type=' + event.type + ' userId=' + (lineUserId || 'none') + ' source=' + JSON.stringify(event.source || {}), 'webhook_debug').run();
      } catch {}

      if (event.type === 'follow' && lineUserId) {
        // Save friend
        const existing = await env.DB.prepare('SELECT id FROM friends WHERE line_user_id = ?').bind(lineUserId).first();
        if (existing) {
          await env.DB.prepare("UPDATE friends SET is_following = 1, updated_at = datetime('now') WHERE line_user_id = ?").bind(lineUserId).run();
        } else {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          const tenant = await env.DB.prepare('SELECT id FROM tenants LIMIT 1').first<{id: string}>();
          await env.DB.prepare('INSERT INTO friends (id, tenant_id, display_name, line_user_id, status, is_following, score, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, tenant?.id || null, lineUserId, lineUserId, 'active', 1, 0, now, now).run();
        }

        // Immediate push (this pattern worked in PR #105)
        try {
          const stepMsg = await env.DB.prepare("SELECT ss.message_content, ss.scenario_id FROM scenario_steps ss INNER JOIN scenarios s ON ss.scenario_id = s.id WHERE s.trigger_type = 'friend_add' AND s.status IN ('active','draft') AND ss.step_order = 1 LIMIT 1").first<{message_content: string; scenario_id: string}>();
          if (stepMsg) {
            await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + matchedAccount.channel_access_token },
              body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text: stepMsg.message_content }] }),
            });
            // Enrollment for step 2+ via Cron
            const friend = await env.DB.prepare('SELECT id FROM friends WHERE line_user_id = ?').bind(lineUserId).first<{id: string}>();
            if (friend) {
              await env.DB.prepare('DELETE FROM friend_scenarios WHERE friend_id = ?').bind(friend.id).run();
              const now = new Date().toISOString();
              const nextDelivery = new Date(Date.now() + 60000).toISOString();
              await env.DB.prepare('INSERT INTO friend_scenarios (id, friend_id, scenario_id, current_step_order, status, started_at, next_delivery_at, updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(
                crypto.randomUUID(), friend.id, stepMsg.scenario_id, 1, 'active', now, nextDelivery, now
              ).run();
            }
          }
        } catch {}

      } else if (event.type === 'unfollow' && lineUserId) {
        await env.DB.prepare("UPDATE friends SET is_following = 0, updated_at = datetime('now') WHERE line_user_id = ?").bind(lineUserId).run();
      }
    } catch (e: any) {
      try {
        await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'ERROR: ' + (e.message || String(e)), 'webhook_debug').run();
      } catch {}
    }
  }

  return c.json({ status: 'ok' });
});

app.get('/webhook', (c) => c.json({ status: 'ok', message: 'Webhook endpoint active. Use POST for LINE events.' }));

// Legacy handler for all non-Hono routes (bypasses Hono entirely)
async function legacyFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let response: Response;

  try {
      if (url.pathname === '/api/verify' && request.method === 'GET') {
        // Automated verification: checks all critical systems
        const checks: Record<string, {status: string; detail?: string}> = {};

        // C1: Health
        checks['health'] = { status: 'PASS' };

        // C2: DB connection
        try {
          const t = await env.DB.prepare('SELECT COUNT(*) as cnt FROM tenants').first<{cnt: number}>();
          checks['db_connection'] = { status: 'PASS', detail: 'tenants=' + (t?.cnt || 0) };
        } catch (e: any) { checks['db_connection'] = { status: 'FAIL', detail: e.message }; }

        // C3: Friends table
        try {
          const f = await env.DB.prepare('SELECT COUNT(*) as cnt FROM friends').first<{cnt: number}>();
          checks['friends_table'] = { status: 'PASS', detail: 'count=' + (f?.cnt || 0) };
        } catch (e: any) { checks['friends_table'] = { status: 'FAIL', detail: e.message }; }

        // C4: Scenarios + steps
        try {
          const s = await env.DB.prepare('SELECT COUNT(*) as cnt FROM scenarios').first<{cnt: number}>();
          const st = await env.DB.prepare('SELECT COUNT(*) as cnt FROM scenario_steps').first<{cnt: number}>();
          checks['scenarios'] = { status: 'PASS', detail: 'scenarios=' + (s?.cnt || 0) + ' steps=' + (st?.cnt || 0) };
        } catch (e: any) { checks['scenarios'] = { status: 'FAIL', detail: e.message }; }

        // C5: LINE accounts
        try {
          const la = await env.DB.prepare('SELECT COUNT(*) as cnt FROM line_accounts WHERE is_active = 1').first<{cnt: number}>();
          checks['line_accounts'] = (la?.cnt || 0) > 0 ? { status: 'PASS', detail: 'active=' + la?.cnt } : { status: 'WARN', detail: 'no active accounts' };
        } catch (e: any) { checks['line_accounts'] = { status: 'FAIL', detail: e.message }; }

        // C6: Enrollments
        try {
          const e = await env.DB.prepare("SELECT COUNT(*) as cnt FROM friend_scenarios WHERE status = 'active'").first<{cnt: number}>();
          checks['enrollments'] = { status: 'PASS', detail: 'active=' + (e?.cnt || 0) };
        } catch (e: any) { checks['enrollments'] = { status: 'FAIL', detail: e.message }; }

        // C7: Messages log
        try {
          const m = await env.DB.prepare('SELECT COUNT(*) as cnt FROM messages_log').first<{cnt: number}>();
          checks['messages_log'] = { status: 'PASS', detail: 'total=' + (m?.cnt || 0) };
        } catch (e: any) { checks['messages_log'] = { status: 'FAIL', detail: e.message }; }

        // C8: Cron running
        try {
          const c = await env.DB.prepare("SELECT created_at FROM ai_execution_logs WHERE intent = 'cron_debug' ORDER BY created_at DESC LIMIT 1").first<{created_at: string}>();
          checks['cron'] = c ? { status: 'PASS', detail: 'last_run=' + c.created_at } : { status: 'WARN', detail: 'no cron logs found' };
        } catch (e: any) { checks['cron'] = { status: 'FAIL', detail: e.message }; }

        // C9: Webhook working
        try {
          const w = await env.DB.prepare("SELECT created_at FROM ai_execution_logs WHERE intent = 'webhook_debug' ORDER BY created_at DESC LIMIT 1").first<{created_at: string}>();
          checks['webhook'] = w ? { status: 'PASS', detail: 'last_event=' + w.created_at } : { status: 'WARN', detail: 'no webhook logs' };
        } catch (e: any) { checks['webhook'] = { status: 'FAIL', detail: e.message }; }

        // C10: Upstream routes
        try {
          const testUrl = new URL('/lh/api/friends', request.url).toString();
          const res = await app.fetch(new Request(testUrl), env);
          checks['upstream_routes'] = res.status < 500 ? { status: 'PASS', detail: 'status=' + res.status } : { status: 'FAIL', detail: 'status=' + res.status };
        } catch (e: any) { checks['upstream_routes'] = { status: 'FAIL', detail: e.message }; }

        const passed = Object.values(checks).filter(c => c.status === 'PASS').length;
        const failed = Object.values(checks).filter(c => c.status === 'FAIL').length;
        const warned = Object.values(checks).filter(c => c.status === 'WARN').length;
        const total = Object.keys(checks).length;
        const overall = failed > 0 ? 'FAIL' : warned > 0 ? 'WARN' : 'PASS';

        response = Response.json({ status: overall, passed, failed, warned, total, checks, version: '0.14.0', timestamp: new Date().toISOString() });
      } else if (url.pathname === '/api/debug/upstream-smoke' && request.method === 'GET') {
        // Upstream recovery smoke test: check all /lh/api/* endpoints
        const endpoints = [
          '/lh/api/line-accounts', '/lh/api/friends', '/lh/api/scenarios',
          '/lh/api/tags', '/lh/api/forms', '/lh/api/broadcasts',
          '/lh/api/tracked-links', '/lh/api/conversions', '/lh/api/automations',
          '/lh/api/scoring/rules', '/lh/api/reminders', '/lh/api/templates',
          '/lh/api/chats', '/lh/api/affiliates', '/lh/api/notifications/rules',
          '/lh/api/staff',
        ];
        const results: Record<string, any> = {};
        for (const ep of endpoints) {
          try {
            const testUrl = new URL(ep, request.url).toString();
            const res = await app.fetch(new Request(testUrl, { headers: { 'X-Api-Key': 'smoke-test' } }), env);
            const body = await res.text();
            results[ep] = { status: res.status, ok: res.status < 500, preview: body.substring(0, 100) };
          } catch (e: any) { results[ep] = { status: 'error', message: e.message }; }
        }
        const passed = Object.values(results).filter((r: any) => r.ok).length;
        response = Response.json({ status: 'ok', total: endpoints.length, passed, failed: endpoints.length - passed, results });
      } else if (url.pathname === '/api/debug/schema' && request.method === 'GET') {
        // Live schema check: returns actual table names and columns from D1
        const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
        const schema: Record<string, string[]> = {};
        for (const t of (tables.results || [])) {
          const cols = await env.DB.prepare(`PRAGMA table_info('${(t as any).name}')`).all();
          schema[(t as any).name] = (cols.results || []).map((c: any) => c.name);
        }
        response = Response.json({ status: 'ok', tables: Object.keys(schema).length, schema });
      } else if (url.pathname === '/api/debug/db' && request.method === 'GET') {
        const friends = await env.DB.prepare('SELECT id, tenant_id, display_name, line_user_id, status, is_following FROM friends ORDER BY created_at DESC LIMIT 10').all();
        const accounts = await env.DB.prepare('SELECT id, channel_id, name, is_active FROM line_accounts ORDER BY created_at DESC LIMIT 10').all();
        const tenants = await env.DB.prepare('SELECT id, name FROM tenants ORDER BY created_at DESC LIMIT 5').all();
        const scenarios = await env.DB.prepare('SELECT id, tenant_id, name, trigger_type, status FROM scenarios ORDER BY created_at DESC LIMIT 10').all();
        const scenarioSteps = await env.DB.prepare('SELECT id, scenario_id, step_order, delay_minutes, message_content FROM scenario_steps ORDER BY scenario_id, step_order LIMIT 20').all();
        const enrollments = await env.DB.prepare('SELECT id, friend_id, scenario_id, current_step_order, status, next_delivery_at FROM friend_scenarios ORDER BY started_at DESC LIMIT 10').all();
        const messagesLog = await env.DB.prepare('SELECT id, friend_id, direction, message_type, content, scenario_step_id, created_at FROM messages_log ORDER BY created_at DESC LIMIT 10').all();
        const webhookLogs = await env.DB.prepare("SELECT id, request_message, intent, created_at FROM ai_execution_logs WHERE intent = 'webhook_debug' ORDER BY created_at DESC LIMIT 10").all();
        const cronLogs = await env.DB.prepare("SELECT id, request_message, intent, created_at FROM ai_execution_logs WHERE intent = 'cron_debug' ORDER BY created_at DESC LIMIT 10").all();
        response = Response.json({ friends: friends.results, line_accounts: accounts.results, tenants: tenants.results, scenarios: scenarios.results, scenario_steps: scenarioSteps.results, enrollments: enrollments.results, messages_log: messagesLog.results, webhook_logs: webhookLogs.results, cron_logs: cronLogs.results });
      } else if (url.pathname === '/health') {
        response = Response.json({ status: 'ok', environment: env.ENVIRONMENT, timestamp: new Date().toISOString() });
      } else if (url.pathname === '/') {
        response = Response.json({ name: 'lchatAI-api', environment: env.ENVIRONMENT, version: '0.14.0' });
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
      } else if (url.pathname === '/api/ai/execute') {
        response = await handleAiExecute(request, env);
      } else if (url.pathname === '/api/entry-routes' || url.pathname.startsWith('/api/entry-routes/')) {
        response = await handleEntryRoutes(request, url, env);
      } else if (url.pathname === '/api/tracked-links') {
        response = await handleTrackedLinks(request, env);
      } else if (url.pathname.startsWith('/r/')) {
        const ref = url.pathname.replace('/r/', '');
        const lineAccount = await env.DB.prepare('SELECT channel_access_token, name FROM line_accounts WHERE is_active = 1 LIMIT 1').first<{channel_access_token: string; name: string}>();
        let lineUrl = '#';
        let botName = lineAccount?.name || 'lchatAI';
        if (lineAccount) {
          try {
            const botInfo = await fetch('https://api.line.me/v2/bot/info', {
              headers: { 'Authorization': 'Bearer ' + lineAccount.channel_access_token }
            });
            if (botInfo.ok) {
              const info = await botInfo.json() as any;
              if (info.basicId) {
                lineUrl = 'https://line.me/R/ti/p/' + info.basicId;
              } else if (info.userId) {
                lineUrl = 'https://line.me/R/ti/p/' + info.userId;
              }
              botName = info.displayName || botName;
            }
          } catch {}
        }
        response = new Response(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${botName}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Hiragino Sans',system-ui,sans-serif;background:#0d1117;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh}.card{text-align:center;max-width:400px;width:90%;padding:48px 24px}h1{font-size:28px;font-weight:800;margin-bottom:8px}.sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:40px}.btn{display:block;width:100%;padding:18px;border:none;border-radius:12px;font-size:18px;font-weight:700;text-decoration:none;text-align:center;color:#fff;background:#06C755}.note{font-size:12px;color:rgba(255,255,255,0.3);margin-top:24px;line-height:1.6}</style></head><body><div class="card"><h1>${botName}</h1><p class="sub">${ref}</p><a href="${lineUrl}" class="btn">LINEで友だち追加する</a><p class="note">友だち追加するだけで体験できます</p></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } else if (url.pathname.startsWith('/t/')) {
        response = await handleRedirect(request, url, env);
      } else if (url.pathname === '/chat') {
        response = new Response(getChatPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
      } else if (url.pathname === '/dashboard/entry-routes') {
        response = new Response(getEntryRoutesPageHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
}

// Scheduled handler placeholder — LINE Harness services will be wired one by one
async function scheduled(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  // Log cron execution
  try { await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'CRON_START', 'cron_debug').run(); } catch {}

  try {
    const now = new Date().toISOString();
    const due = await env.DB.prepare(
      "SELECT fs.id, fs.friend_id, fs.scenario_id, fs.current_step_order FROM friend_scenarios fs WHERE fs.status = 'active' AND fs.next_delivery_at <= ? LIMIT 50"
    ).bind(now).all<{id: string; friend_id: string; scenario_id: string; current_step_order: number}>();

    const dueCount = (due.results || []).length;
    try { await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'CRON_DUE: count=' + dueCount, 'cron_debug').run(); } catch {}

    for (const enrollment of (due.results || [])) {
      try {
        const nextOrder = enrollment.current_step_order + 1;
        const step = await env.DB.prepare(
          'SELECT id, message_type, message_content FROM scenario_steps WHERE scenario_id = ? AND step_order = ? LIMIT 1'
        ).bind(enrollment.scenario_id, nextOrder).first<{id: string; message_type: string; message_content: string}>();

        if (!step) {
          await env.DB.prepare("UPDATE friend_scenarios SET status = 'completed', updated_at = datetime('now') WHERE id = ?").bind(enrollment.id).run();
          continue;
        }

        const friend = await env.DB.prepare('SELECT line_user_id FROM friends WHERE id = ?').bind(enrollment.friend_id).first<{line_user_id: string}>();
        if (!friend?.line_user_id) continue;

        const account = await env.DB.prepare('SELECT channel_access_token FROM line_accounts WHERE is_active = 1 LIMIT 1').first<{channel_access_token: string}>();
        if (!account) continue;

        const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + account.channel_access_token },
          body: JSON.stringify({ to: friend.line_user_id, messages: [{ type: 'text', text: step.message_content }] }),
        });

        try { await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'CRON_SENT: step=' + nextOrder + ' status=' + pushRes.status + ' msg=' + step.message_content.substring(0, 20), 'cron_debug').run(); } catch {}

        await env.DB.prepare("INSERT INTO messages_log (id, friend_id, direction, message_type, content, scenario_step_id, delivery_type, created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))").bind(crypto.randomUUID(), enrollment.friend_id, 'outgoing', 'text', step.message_content, step.id, 'push').run();

        // Check if there's a next step
        const hasMore = await env.DB.prepare('SELECT id FROM scenario_steps WHERE scenario_id = ? AND step_order = ? LIMIT 1').bind(enrollment.scenario_id, nextOrder + 1).first();
        if (hasMore) {
          const nextDelivery = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min default
          await env.DB.prepare("UPDATE friend_scenarios SET current_step_order = ?, next_delivery_at = ?, updated_at = datetime('now') WHERE id = ?").bind(nextOrder, nextDelivery, enrollment.id).run();
        } else {
          await env.DB.prepare("UPDATE friend_scenarios SET current_step_order = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?").bind(nextOrder, enrollment.id).run();
        }
      } catch (e: any) {
        try { await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'CRON_ERR: ' + (e.message || String(e)), 'cron_debug').run(); } catch {}
      }
    }
  } catch (e: any) {
    try { await env.DB.prepare("INSERT INTO ai_execution_logs (id, request_message, intent, created_at) VALUES (?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), 'CRON_FATAL: ' + (e.message || String(e)), 'cron_debug').run(); } catch {}
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // /lh/* and /webhook → Hono app (LINE Harness upstream + webhook)
    if (url.pathname.startsWith('/lh/') || url.pathname === '/lh' || url.pathname === '/webhook') {
      return app.fetch(request, env, ctx);
    }
    // Everything else → legacy handler (preserves auth headers)
    return legacyFetch(request, env);
  },
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
  // DELETE /api/scenarios/:id
  if (request.method === 'DELETE') {
    try {
      await env.DB.prepare('DELETE FROM scenario_steps WHERE scenario_id = ?').bind(scenarioId).run();
      await env.DB.prepare('DELETE FROM friend_scenarios WHERE scenario_id = ?').bind(scenarioId).run();
      await env.DB.prepare('DELETE FROM scenarios WHERE id = ?').bind(scenarioId).run();
      return Response.json({ status: 'ok' });
    } catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 400 }); }
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

  // Auto-resolve tenant_id from auth
  const tenantId = auth?.tenant_id || body.context?.tenant_id || null;
  if (tenantId && !body.context) body.context = {};
  if (tenantId && body.context) body.context.tenant_id = tenantId;

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
        tenant_id: tenantId, user_id: auth?.user_id, bot_id: body.bot_id,
        request_message: body.message, intent: plan.intent, confidence: plan.confidence,
        slots: [], missing_slots: [],
        plan: plan.proposal ? { description: plan.proposal.summary, actions: [] } : { description: '', actions: [] },
        is_complete: plan.is_ready,
      });
    } catch {}
    return Response.json({ status: 'ok', ...plan });
  }
  catch (err) {
    try { await logAdapter.record({ tenant_id: tenantId, user_id: auth?.user_id, bot_id: body.bot_id, request_message: body.message, error: String(err) }); } catch {}
    return Response.json({ status: 'error', message: String(err) }, { status: 502 });
  }
}

// --- AI Execute (Phase 1b: create scenario + steps + entry route + tracked link + CV) ---
async function handleAiExecute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 });
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }

  const proposal = body.proposal;
  if (!proposal) return Response.json({ status: 'error', message: 'proposal is required' }, { status: 400 });

  const tenantId = auth.tenant_id || body.tenant_id;
  // super_admin has no tenant_id - auto-resolve from DB
  let effectiveTenantId = tenantId;
  if (!effectiveTenantId) {
    const t = await env.DB.prepare('SELECT id FROM tenants LIMIT 1').first<{id: string}>();
    effectiveTenantId = t?.id;
  }
  if (!effectiveTenantId) return Response.json({ status: 'error', message: 'Tenant required' }, { status: 400 });

  const results: any = { created: [] };

  try {
    // 1. Create scenario + steps
    if (proposal.scenario) {
      const scenarioId = crypto.randomUUID();
      const steps = proposal.scenario.steps || [];

      // Use batch for scenario + all steps
      const stmts = [
        env.DB.prepare(
          'INSERT INTO scenarios (id, tenant_id, name, trigger_type, status, created_at, updated_at) VALUES (?,?,?,?,?,datetime(\'now\'),datetime(\'now\'))'
        ).bind(scenarioId, effectiveTenantId, proposal.scenario.name, proposal.scenario.trigger_type || 'friend_add', 'active'),
      ];
      for (const step of steps) {
        stmts.push(
          env.DB.prepare(
            'INSERT INTO scenario_steps (id, scenario_id, step_order, delay_minutes, message_type, message_content, goal_label, created_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\'))'
          ).bind(crypto.randomUUID(), scenarioId, step.step_order, step.delay_minutes || 0, 'text', step.message_content, step.goal_label || null)
        );
      }
      await env.DB.batch(stmts);

      results.scenario = { id: scenarioId, name: proposal.scenario.name, steps_count: steps.length };
      results.created.push('scenario');
    }

    // 2. Create entry route (skip if code already exists)
    if (proposal.entry_route && proposal.entry_route.code) {
      const existing = await env.DB.prepare('SELECT id, name, code FROM entry_routes WHERE code = ?').bind(proposal.entry_route.code).first();
      if (existing) {
        results.entry_route = { id: existing.id, name: existing.name, code: existing.code, reused: true };
        results.created.push('entry_route_reused');
      } else {
        const erId = crypto.randomUUID();
        await env.DB.prepare(
          'INSERT INTO entry_routes (id, name, code, created_at) VALUES (?,?,?,datetime(\'now\'))'
        ).bind(erId, proposal.entry_route.name, proposal.entry_route.code).run();
        results.entry_route = { id: erId, name: proposal.entry_route.name, code: proposal.entry_route.code };
        results.created.push('entry_route');
      }
    }

    // 3. Create tracked link (skip if destination_url is empty)
    if (proposal.tracked_link && proposal.tracked_link.destination_url) {
      const adapter = new TrackedLinkAdapter(env.DB);
      const link = await adapter.create({
        destination_url: proposal.tracked_link.destination_url,
        campaign_label: proposal.tracked_link.campaign_label || '',
        destination_type: 'external',
      });
      results.tracked_link = { id: link.id, tracking_url: `/t/${link.id}` };
      results.created.push('tracked_link');
    }

    // 4. Create conversion point (skip if code already exists)
    if (proposal.conversion && proposal.conversion.name && proposal.conversion.code) {
      const existingCv = await env.DB.prepare('SELECT id, name, code FROM conversion_points WHERE code = ? AND tenant_id = ?').bind(proposal.conversion.code, effectiveTenantId).first();
      if (existingCv) {
        results.conversion = { id: existingCv.id, name: existingCv.name, code: existingCv.code, reused: true };
        results.created.push('conversion_reused');
      } else {
        const cvId = crypto.randomUUID();
        await env.DB.prepare(
          'INSERT INTO conversion_points (id, tenant_id, name, code, scope, verification_method, created_at) VALUES (?,?,?,?,?,?,datetime(\'now\'))'
        ).bind(cvId, effectiveTenantId, proposal.conversion.name, proposal.conversion.code, 'scenario', 'server').run();
        results.conversion = { id: cvId, name: proposal.conversion.name, code: proposal.conversion.code };
        results.created.push('conversion_point');
      }
    }

    return Response.json({ status: 'ok', ...results });
  } catch (err) {
    return Response.json({ status: 'error', message: String(err), partial_results: results }, { status: 500 });
  }
}

// --- Tracked Links ---
// --- Entry Routes ---
async function handleEntryRoutes(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_JWT_SECRET) return Response.json({ status: 'error', message: 'Not configured' }, { status: 503 });
  const auth = await extractAuth(request, env.DB, env.ADMIN_JWT_SECRET);
  const denied = requireRole(auth, 'super_admin', 'admin');
  if (denied) return denied;

  if (url.pathname === '/api/entry-routes' && request.method === 'GET') {
    const routes = await env.DB.prepare('SELECT * FROM entry_routes ORDER BY created_at DESC').all();
    return Response.json({ status: 'ok', entry_routes: routes.results || [] });
  }
  if (url.pathname === '/api/entry-routes' && request.method === 'POST') {
    let body: any;
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    if (!body.name || !body.code) return Response.json({ status: 'error', message: 'name and code are required' }, { status: 400 });
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO entry_routes (id, name, code, created_at) VALUES (?,?,?,datetime(\'now\'))').bind(id, body.name, body.code).run();
    return Response.json({ status: 'ok', entry_route: { id, name: body.name, code: body.code } }, { status: 201 });
  }
  // DELETE /api/entry-routes/:id
  const segments = url.pathname.split('/');
  const routeId = segments[3];
  if (routeId && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM entry_routes WHERE id = ?').bind(routeId).run();
    return Response.json({ status: 'ok' });
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

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

// getChatHtml moved to src/pages/chat.ts as getChatPageHtml
