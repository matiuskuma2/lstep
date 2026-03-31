import { generatePlan } from './ai/engine';
import type { AiChatRequest } from './ai/types';

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
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let response: Response;

    if (url.pathname === '/health') {
      response = Response.json({
        status: 'ok',
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      });
    } else if (url.pathname === '/') {
      response = Response.json({
        name: 'lstep-ai-api',
        environment: env.ENVIRONMENT,
        version: '0.3.0',
      });
    } else if (url.pathname === '/api/ai/test') {
      if (request.method === 'GET') {
        response = await handleAiTest(new Request(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello' }),
        }), env);
      } else if (request.method === 'POST') {
        response = await handleAiTest(request, env);
      } else {
        response = Response.json({ error: 'method not allowed' }, { status: 405 });
      }
    } else if (url.pathname === '/api/ai/chat') {
      if (request.method === 'GET') {
        response = await handleAiChat(new Request(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: url.searchParams.get('q') || '新規友だち向けに3日ステップを作って',
          }),
        }), env);
      } else if (request.method === 'POST') {
        response = await handleAiChat(request, env);
      } else {
        response = Response.json({ error: 'method not allowed' }, { status: 405 });
      }
    } else if (url.pathname === '/chat') {
      response = new Response(CHAT_UI_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    } else {
      response = Response.json({ error: 'not found' }, { status: 404 });
    }

    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};

async function handleAiTest(request: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return Response.json(
      { status: 'error', message: 'OPENAI_API_KEY not configured' },
      { status: 503 }
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { status: 'error', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const userMessage = body.message || 'hello';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for LINE step delivery operations. Reply briefly in the same language as the user.',
          },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { status: 'error', message: `OpenAI API error: ${response.status}`, detail: errorText },
        { status: 502 }
      );
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return Response.json({
      status: 'ok',
      response: data.choices[0]?.message?.content || '',
      usage: data.usage,
    });
  } catch (err) {
    return Response.json(
      { status: 'error', message: `Request failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}

async function handleAiChat(request: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return Response.json(
      { status: 'error', message: 'OPENAI_API_KEY not configured' },
      { status: 503 }
    );
  }

  let body: AiChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { status: 'error', message: 'Invalid JSON body. Expected: { "message": "...", "context": { "line_account_id": "..." } }' },
      { status: 400 }
    );
  }

  if (!body.message) {
    return Response.json(
      { status: 'error', message: 'Missing required field: message' },
      { status: 400 }
    );
  }

  try {
    const plan = await generatePlan(body, env.OPENAI_API_KEY);
    return Response.json({ status: 'ok', ...plan });
  } catch (err) {
    return Response.json(
      { status: 'error', message: `Plan generation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}

const CHAT_UI_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lstep AI Chat</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; height: 100vh; display: flex; flex-direction: column; }
.header { background: #06C755; color: white; padding: 16px 20px; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.header span { font-size: 14px; font-weight: 400; opacity: 0.8; }
.chat-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.msg { max-width: 85%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.6; word-break: break-word; }
.msg.user { background: #06C755; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
.msg.ai { background: white; color: #333; align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.intent-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.slots-section { margin-top: 8px; }
.slots-section h4 { font-size: 12px; color: #666; margin-bottom: 4px; }
.slot-item { font-size: 13px; padding: 2px 0; display: flex; gap: 6px; }
.slot-name { color: #1976d2; font-weight: 500; }
.slot-value { color: #333; }
.slot-missing { color: #e65100; }
.missing-section { margin-top: 12px; background: #fff3e0; padding: 10px 12px; border-radius: 8px; }
.missing-section h4 { font-size: 12px; color: #e65100; margin-bottom: 6px; }
.missing-q { font-size: 13px; color: #bf360c; padding: 3px 0; }
.plan-section { margin-top: 12px; background: #e3f2fd; padding: 10px 12px; border-radius: 8px; }
.plan-section h4 { font-size: 12px; color: #1565c0; margin-bottom: 4px; }
.plan-desc { font-size: 13px; color: #0d47a1; }
.confirm-badge { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.confirm-badge.required { background: #fce4ec; color: #c62828; }
.confirm-badge.not-required { background: #e8f5e9; color: #2e7d32; }
.input-area { padding: 12px 16px; background: white; border-top: 1px solid #e0e0e0; display: flex; gap: 8px; }
.input-area input { flex: 1; padding: 10px 14px; border: 1px solid #ddd; border-radius: 24px; font-size: 14px; outline: none; }
.input-area input:focus { border-color: #06C755; }
.input-area button { background: #06C755; color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.input-area button:disabled { background: #ccc; cursor: not-allowed; }
.loading { display: flex; gap: 4px; padding: 8px 0; }
.loading span { width: 8px; height: 8px; background: #999; border-radius: 50%; animation: bounce 1.4s infinite; }
.loading span:nth-child(2) { animation-delay: 0.2s; }
.loading span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
.error { background: #ffebee; color: #c62828; }
</style>
</head>
<body>
<div class="header">lstep AI Chat <span>preview-only</span></div>
<div class="chat-area" id="chatArea">
  <div class="msg ai">
    LINE\u30b9\u30c6\u30c3\u30d7\u914d\u4fe1\u306e\u8a2d\u5b9a\u3092\u304a\u624b\u4f1d\u3044\u3057\u307e\u3059\u3002<br><br>
    \u4f8b: \u300c\u65b0\u898f\u53cb\u3060\u3061\u5411\u3051\u306b3\u65e5\u30b9\u30c6\u30c3\u30d7\u3092\u4f5c\u3063\u3066\u300d<br>
    \u4f8b: \u300cYouTube\u6d41\u5165\u5411\u3051\u306etracked link\u3092\u4f5c\u3063\u3066\u300d<br>
    \u4f8b: \u300c\u30e9\u30a4\u30d5\u30d7\u30e9\u30f3\u7533\u8fbc\u3092CV\u306b\u3057\u3066\u300d
  </div>
</div>
<div class="input-area">
  <input type="text" id="msgInput" placeholder="\u6307\u793a\u3092\u5165\u529b..." autofocus>
  <button id="sendBtn" onclick="sendMessage()">\u2191</button>
</div>
<script>
const chatArea = document.getElementById('chatArea');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) sendMessage();
});

async function sendMessage() {
  const msg = msgInput.value.trim();
  if (!msg) return;

  addMsg(msg, 'user');
  msgInput.value = '';
  sendBtn.disabled = true;

  const loadingEl = document.createElement('div');
  loadingEl.className = 'msg ai';
  loadingEl.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  chatArea.appendChild(loadingEl);
  chatArea.scrollTop = chatArea.scrollHeight;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    const data = await res.json();
    chatArea.removeChild(loadingEl);

    if (data.status === 'ok') {
      addPlanMsg(data);
    } else {
      addMsg('Error: ' + (data.message || 'Unknown error'), 'ai error');
    }
  } catch (err) {
    chatArea.removeChild(loadingEl);
    addMsg('Error: ' + err.message, 'ai error');
  }
  sendBtn.disabled = false;
  chatArea.scrollTop = chatArea.scrollHeight;
}

function addMsg(text, cls) {
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.textContent = text;
  chatArea.appendChild(el);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function addPlanMsg(data) {
  const el = document.createElement('div');
  el.className = 'msg ai';

  let html = '<div class="intent-badge">' + esc(data.intent) + ' (' + Math.round((data.confidence || 0) * 100) + '%)</div>';

  const filled = (data.slots || []).filter(s => s.value != null);
  if (filled.length > 0) {
    html += '<div class="slots-section"><h4>\u2705 \u691c\u51fa\u3055\u308c\u305f\u60c5\u5831</h4>';
    filled.forEach(s => {
      html += '<div class="slot-item"><span class="slot-name">' + esc(s.name) + ':</span><span class="slot-value">' + esc(String(s.value)) + '</span></div>';
    });
    html += '</div>';
  }

  if (data.missing_slots && data.missing_slots.length > 0) {
    html += '<div class="missing-section"><h4>\u2753 \u4e0d\u8db3\u3057\u3066\u3044\u308b\u60c5\u5831</h4>';
    data.missing_slots.forEach(s => {
      html += '<div class="missing-q">\u30fb' + esc(s.ask_question) + '</div>';
    });
    html += '</div>';
  }

  if (data.plan) {
    html += '<div class="plan-section"><h4>\u{1f4cb} \u5b9f\u884c\u30d7\u30e9\u30f3</h4>';
    html += '<div class="plan-desc">' + esc(data.plan.description) + '</div>';
    html += '</div>';
  }

  html += '<div class="confirm-badge ' + (data.requires_confirmation ? 'required' : 'not-required') + '">';
  html += data.requires_confirmation ? '\u{1f512} \u78ba\u8a8d\u304c\u5fc5\u8981' : '\u2705 \u78ba\u8a8d\u4e0d\u8981';
  html += '</div>';

  el.innerHTML = html;
  chatArea.appendChild(el);
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
</script>
</body>
</html>`;
