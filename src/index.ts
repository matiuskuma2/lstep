import { generatePlan } from './ai/engine';
import type { AiChatRequest } from './ai/types';
import { TrackedLinkAdapter } from './adapters/tracked-link';
import type { CreateTrackedLinkInput } from './adapters/tracked-link';
import { AuthService } from './auth/service';
import { extractAuth, requireRole } from './auth/middleware';

export interface Env {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  ADMIN_JWT_SECRET?: string;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    let response: Response;

    try {
      if (url.pathname === '/health') {
        response = Response.json({ status: 'ok', environment: env.ENVIRONMENT, timestamp: new Date().toISOString() });
      } else if (url.pathname === '/') {
        response = Response.json({ name: 'lchatAI-api', environment: env.ENVIRONMENT, version: '0.7.0' });
      } else if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        response = await handleLogin(request, env);
      } else if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        response = await handleMe(request, env);
      } else if (url.pathname === '/api/admin/bootstrap') {
        response = await handleBootstrap(request, env);
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
  },
};

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

  let loginId: string;
  let password: string;
  let email: string | undefined;

  if (request.method === 'POST') {
    let body: { login_id?: string; password?: string; email?: string };
    try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 }); }
    loginId = body.login_id || '';
    password = body.password || '';
    email = body.email;
  } else if (request.method === 'GET') {
    const url = new URL(request.url);
    loginId = url.searchParams.get('login_id') || '';
    password = url.searchParams.get('password') || '';
    email = url.searchParams.get('email') || undefined;
  } else {
    return Response.json({ error: 'method not allowed' }, { status: 405 });
  }

  if (!loginId || !password) return Response.json({ status: 'error', message: 'login_id and password required' }, { status: 400 });
  if (password.length < 8) return Response.json({ status: 'error', message: 'Password must be at least 8 characters' }, { status: 400 });

  const auth = new AuthService(env.DB, env.ADMIN_JWT_SECRET);
  try {
    const user = await auth.bootstrap(loginId, password, email);
    return Response.json({ status: 'ok', message: 'Super admin created. Go to /login to sign in.', user }, { status: 201 });
  } catch (err) {
    return Response.json({ status: 'error', message: String(err) }, { status: 409 });
  }
}

// --- AI Test ---
async function handleAiTest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return callOpenAI(env, 'hello');
  if (request.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 });
  if (!env.OPENAI_API_KEY) return Response.json({ status: 'error', message: 'OPENAI_API_KEY not configured' }, { status: 503 });
  let body: { message?: string };
  try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON body' }, { status: 400 }); }
  return callOpenAI(env, body.message || 'hello');
}

async function callOpenAI(env: Env, message: string): Promise<Response> {
  if (!env.OPENAI_API_KEY) return Response.json({ status: 'error', message: 'OPENAI_API_KEY not configured' }, { status: 503 });
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'Reply briefly in the same language as the user.' }, { role: 'user', content: message }], max_tokens: 200 }),
    });
    if (!res.ok) { const t = await res.text(); return Response.json({ status: 'error', message: `OpenAI: ${res.status}`, detail: t }, { status: 502 }); }
    const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage: Record<string, unknown> };
    return Response.json({ status: 'ok', response: data.choices[0]?.message?.content || '', usage: data.usage });
  } catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 502 }); }
}

// --- AI Chat ---
async function handleAiChatRoute(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method === 'GET') {
    return handleAiChat(new Request(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: url.searchParams.get('q') || '新規友だち向けに3日ステップを作って' }) }), env);
  }
  if (request.method === 'POST') return handleAiChat(request, env);
  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

async function handleAiChat(request: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) return Response.json({ status: 'error', message: 'OPENAI_API_KEY not configured' }, { status: 503 });
  let body: AiChatRequest;
  try { body = await request.json(); } catch { return Response.json({ status: 'error', message: 'Invalid JSON body' }, { status: 400 }); }
  if (!body.message) return Response.json({ status: 'error', message: 'Missing required field: message' }, { status: 400 });
  try { const plan = await generatePlan(body, env.OPENAI_API_KEY); return Response.json({ status: 'ok', ...plan }); }
  catch (err) { return Response.json({ status: 'error', message: String(err) }, { status: 502 }); }
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

// --- Redirect ---
async function handleRedirect(request: Request, url: URL, env: Env): Promise<Response> {
  const linkId = url.pathname.replace('/t/', '');
  if (!linkId) return Response.json({ error: 'missing link id' }, { status: 400 });
  const adapter = new TrackedLinkAdapter(env.DB);
  const link = await adapter.getById(linkId);
  if (!link) return Response.json({ error: 'link not found' }, { status: 404 });
  try { await adapter.recordClick(linkId, request); } catch { /* best effort */ }
  return Response.redirect(link.destination_url, 302);
}

// --- Setup HTML ---
function getSetupHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lchatAI - 初期セットアップ</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); width: 100%; max-width: 440px; }
h1 { color: #06C755; font-size: 24px; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
label { display: block; font-size: 13px; color: #333; margin-bottom: 4px; font-weight: 500; }
input { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; margin-bottom: 16px; outline: none; }
input:focus { border-color: #06C755; }
button { width: 100%; padding: 12px; background: #06C755; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
button:hover { background: #05a648; }
.msg { font-size: 13px; margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; display: none; }
.msg.error { background: #ffebee; color: #c62828; }
.msg.success { background: #e8f5e9; color: #2e7d32; }
.note { font-size: 12px; color: #999; margin-top: 16px; }
</style>
</head>
<body>
<div class="card">
  <h1>lchatAI 初期セットアップ</h1>
  <div class="subtitle">スーパーアドミンアカウントを作成します（1回のみ）</div>
  <div class="msg error" id="error"></div>
  <div class="msg success" id="success"></div>
  <label>ログインID</label>
  <input type="text" id="loginId" placeholder="admin">
  <label>パスワード（8文字以上）</label>
  <input type="password" id="password" placeholder="********">
  <label>メールアドレス（任意）</label>
  <input type="email" id="email" placeholder="admin@example.com">
  <button onclick="doSetup()">スーパーアドミンを作成</button>
  <div class="note">このページは1回だけ使えます。作成後は /login からログインしてください。</div>
</div>
<script>
async function doSetup() {
  const loginId = document.getElementById('loginId').value;
  const password = document.getElementById('password').value;
  const email = document.getElementById('email').value;
  const errorEl = document.getElementById('error');
  const successEl = document.getElementById('success');
  errorEl.style.display = 'none'; successEl.style.display = 'none';
  if (!loginId || !password) { errorEl.textContent = 'ログインIDとパスワードを入力してください'; errorEl.style.display = 'block'; return; }
  if (password.length < 8) { errorEl.textContent = 'パスワードは8文字以上にしてください'; errorEl.style.display = 'block'; return; }
  try {
    const res = await fetch('/api/admin/bootstrap', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId, password, email: email || undefined }) });
    const data = await res.json();
    if (data.status === 'ok') {
      successEl.textContent = 'スーパーアドミンを作成しました！ログインページへ移動します...';
      successEl.style.display = 'block';
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } else { errorEl.textContent = data.message || '作成に失敗しました'; errorEl.style.display = 'block'; }
  } catch (err) { errorEl.textContent = 'エラー: ' + err.message; errorEl.style.display = 'block'; }
}
</script>
</body>
</html>`;
}

// --- Login HTML ---
function getLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lchatAI Login</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
h1 { color: #06C755; font-size: 24px; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
label { display: block; font-size: 13px; color: #333; margin-bottom: 4px; font-weight: 500; }
input { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; margin-bottom: 16px; outline: none; }
input:focus { border-color: #06C755; }
button { width: 100%; padding: 12px; background: #06C755; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
button:hover { background: #05a648; }
.msg { font-size: 13px; margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; display: none; }
.msg.error { background: #ffebee; color: #c62828; }
.msg.success { background: #e8f5e9; color: #2e7d32; }
</style>
</head>
<body>
<div class="card">
  <h1>lchatAI</h1>
  <div class="subtitle">管理者ログイン</div>
  <div class="msg error" id="error"></div>
  <div class="msg success" id="success"></div>
  <label>ログインID</label>
  <input type="text" id="loginId" placeholder="login_id">
  <label>パスワード</label>
  <input type="password" id="password" placeholder="password">
  <button onclick="doLogin()">ログイン</button>
</div>
<script>
async function doLogin() {
  const loginId = document.getElementById('loginId').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');
  const successEl = document.getElementById('success');
  errorEl.style.display = 'none'; successEl.style.display = 'none';
  if (!loginId || !password) { errorEl.textContent = 'ログインIDとパスワードを入力してください'; errorEl.style.display = 'block'; return; }
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login_id: loginId, password }) });
    const data = await res.json();
    if (data.status === 'ok') {
      localStorage.setItem('lchatai_token', data.token);
      localStorage.setItem('lchatai_user', JSON.stringify(data.user));
      successEl.textContent = 'ログイン成功！';
      successEl.style.display = 'block';
      setTimeout(() => { window.location.href = '/chat'; }, 1000);
    } else { errorEl.textContent = data.message || 'ログインに失敗しました'; errorEl.style.display = 'block'; }
  } catch (err) { errorEl.textContent = 'エラー: ' + err.message; errorEl.style.display = 'block'; }
}
document.getElementById('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
</script>
</body>
</html>`;
}

// --- Chat HTML ---
function getChatHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lchatAI Chat</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; height: 100vh; display: flex; flex-direction: column; }
.header { background: #06C755; color: white; padding: 16px 20px; font-size: 18px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; }
.header span { font-size: 14px; font-weight: 400; opacity: 0.8; }
.header .user-info { font-size: 12px; opacity: 0.8; cursor: pointer; }
.chat-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.msg { max-width: 85%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.6; word-break: break-word; }
.msg.user { background: #06C755; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
.msg.ai { background: white; color: #333; align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.intent-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.slots-section { margin-top: 8px; } .slots-section h4 { font-size: 12px; color: #666; margin-bottom: 4px; }
.slot-item { font-size: 13px; padding: 2px 0; display: flex; gap: 6px; } .slot-name { color: #1976d2; font-weight: 500; } .slot-value { color: #333; }
.missing-section { margin-top: 12px; background: #fff3e0; padding: 10px 12px; border-radius: 8px; } .missing-section h4 { font-size: 12px; color: #e65100; margin-bottom: 6px; }
.missing-q { font-size: 13px; color: #bf360c; padding: 3px 0; cursor: pointer; } .missing-q:hover { text-decoration: underline; }
.plan-section { margin-top: 12px; background: #e3f2fd; padding: 10px 12px; border-radius: 8px; } .plan-section h4 { font-size: 12px; color: #1565c0; margin-bottom: 4px; } .plan-desc { font-size: 13px; color: #0d47a1; }
.confirm-badge { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.confirm-badge.required { background: #fce4ec; color: #c62828; } .confirm-badge.not-required { background: #e8f5e9; color: #2e7d32; }
.confirm-badge.complete { background: #06C755; color: white; cursor: pointer; padding: 8px 20px; font-size: 14px; } .confirm-badge.complete:hover { background: #05a648; }
.progress-bar { margin-top: 8px; background: #e0e0e0; border-radius: 4px; height: 6px; overflow: hidden; } .progress-fill { height: 100%; background: #06C755; border-radius: 4px; transition: width 0.3s; }
.input-area { padding: 12px 16px; background: white; border-top: 1px solid #e0e0e0; display: flex; gap: 8px; }
.input-area input { flex: 1; padding: 10px 14px; border: 1px solid #ddd; border-radius: 24px; font-size: 14px; outline: none; } .input-area input:focus { border-color: #06C755; }
.input-area button { background: #06C755; color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.input-area button:disabled { background: #ccc; cursor: not-allowed; }
.loading { display: flex; gap: 4px; padding: 8px 0; } .loading span { width: 8px; height: 8px; background: #999; border-radius: 50%; animation: bounce 1.4s infinite; }
.loading span:nth-child(2) { animation-delay: 0.2s; } .loading span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
</style>
</head>
<body>
<div class="header">
  <div>lchatAI <span>v0.7</span></div>
  <div class="user-info" id="userInfo" onclick="logout()"></div>
</div>
<div class="chat-area" id="chatArea">
  <div class="msg ai">LINE配信の設定をAIがお手伝いします。<br><br>例: 「新規友だち向けに3日ステップを作って」<br>例: 「YouTube流入向けのtracked linkを作って」<br>例: 「ライフプラン申込をCVにして」</div>
</div>
<div class="input-area">
  <input type="text" id="msgInput" placeholder="指示を入力..." autofocus>
  <button id="sendBtn" onclick="sendMessage()">&#8593;</button>
</div>
<script>
const chatArea = document.getElementById('chatArea');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const userInfoEl = document.getElementById('userInfo');
let conversationHistory = [];
let accumulatedSlots = [];

const user = JSON.parse(localStorage.getItem('lchatai_user') || 'null');
if (user) { userInfoEl.textContent = user.login_id + ' (' + user.role + ') [ログアウト]'; }
else { userInfoEl.textContent = '未ログイン'; }

function logout() { localStorage.removeItem('lchatai_token'); localStorage.removeItem('lchatai_user'); window.location.href = '/login'; }

msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) sendMessage(); });
async function sendMessage() {
  const msg = msgInput.value.trim(); if (!msg) return;
  addMsg(msg, 'user'); conversationHistory.push({ role: 'user', content: msg });
  msgInput.value = ''; msgInput.placeholder = '指示を入力...'; sendBtn.disabled = true;
  const loadingEl = document.createElement('div'); loadingEl.className = 'msg ai';
  loadingEl.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  chatArea.appendChild(loadingEl); chatArea.scrollTop = chatArea.scrollHeight;
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('lchatai_token'); if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch('/api/ai/chat', { method: 'POST', headers, body: JSON.stringify({ message: msg, history: conversationHistory.slice(0, -1), accumulated_slots: accumulatedSlots }) });
    const data = await res.json(); chatArea.removeChild(loadingEl);
    if (data.status === 'ok') { accumulatedSlots = (data.slots || []).filter(s => s.value != null); conversationHistory.push({ role: 'assistant', content: 'Intent: ' + data.intent }); addPlanMsg(data); }
    else { addMsg('Error: ' + (data.message || 'Unknown error'), 'ai'); }
  } catch (err) { chatArea.removeChild(loadingEl); addMsg('Error: ' + err.message, 'ai'); }
  sendBtn.disabled = false; chatArea.scrollTop = chatArea.scrollHeight;
}
function addMsg(text, cls) { const el = document.createElement('div'); el.className = 'msg ' + cls; el.textContent = text; chatArea.appendChild(el); chatArea.scrollTop = chatArea.scrollHeight; }
function fillQuestion(q) { msgInput.value = ''; msgInput.focus(); msgInput.placeholder = q; }
function addPlanMsg(data) {
  const el = document.createElement('div'); el.className = 'msg ai';
  const filled = (data.slots || []).filter(s => s.value != null);
  const totalRequired = filled.length + (data.missing_slots || []).length;
  const progress = totalRequired > 0 ? Math.round((filled.length / totalRequired) * 100) : 0;
  let html = '<div class="intent-badge">' + esc(data.intent) + ' (' + Math.round((data.confidence || 0) * 100) + '%)</div>';
  html += '<div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%"></div></div>';
  html += '<div style="font-size:11px;color:#666;margin-top:2px">' + filled.length + '/' + totalRequired + ' 項目完了</div>';
  if (filled.length > 0) { html += '<div class="slots-section"><h4>&#x2705; 検出された情報</h4>'; filled.forEach(s => { html += '<div class="slot-item"><span class="slot-name">' + esc(s.name) + ':</span><span class="slot-value">' + esc(String(s.value)) + '</span></div>'; }); html += '</div>'; }
  if (data.missing_slots && data.missing_slots.length > 0) { html += '<div class="missing-section"><h4>&#x2753; 不足している情報</h4>'; data.missing_slots.forEach(s => { html += '<div class="missing-q" onclick="fillQuestion(\\'' + esc(s.ask_question).replace(/'/g, "\\\\'") + '\\')">・' + esc(s.ask_question) + '</div>'; }); html += '</div>'; }
  if (data.plan) { html += '<div class="plan-section"><h4>&#x1f4cb; 実行プラン</h4><div class="plan-desc">' + esc(data.plan.description) + '</div></div>'; }
  if (data.is_complete) { html += '<div class="confirm-badge complete" onclick="confirmPlan()">&#x2705; この内容で実行する</div>'; }
  else if (data.requires_confirmation) { html += '<div class="confirm-badge required">&#x1f512; 情報が揃ったら確認へ</div>'; }
  else { html += '<div class="confirm-badge not-required">&#x2705; 確認不要</div>'; }
  el.innerHTML = html; chatArea.appendChild(el);
}
function confirmPlan() { addMsg('[確認] 実行を承認しました。（※現在はpreview-onlyモードです。）', 'ai'); conversationHistory = []; accumulatedSlots = []; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
</script>
</body>
</html>`;
}
