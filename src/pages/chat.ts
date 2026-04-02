export function getChatPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lchatAI</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;height:100vh;display:flex;flex-direction:column}
.header{background:#06C755;color:white;padding:16px 20px;font-size:18px;font-weight:600;display:flex;align-items:center;justify-content:space-between}
.header span{font-size:14px;font-weight:400;opacity:.8}
.header .nav a{color:rgba(255,255,255,.8);text-decoration:none;font-size:13px;margin-left:12px}
.header .nav a:hover{color:white}
.header .user-info{font-size:12px;opacity:.8;cursor:pointer}
.bot-selector{padding:8px 16px;background:#f9f9f9;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:8px;font-size:13px;color:#666}
.bot-selector select{padding:6px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none;min-width:180px}
.bot-selector select:focus{border-color:#06C755}
.bot-selector .bot-info{font-size:11px;color:#999}
.chat-area{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}
.msg{max-width:85%;padding:12px 16px;border-radius:16px;font-size:14px;line-height:1.6;word-break:break-word}
.msg.user{background:#06C755;color:white;align-self:flex-end;border-bottom-right-radius:4px}
.msg.ai{background:white;color:#333;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.msg.ai pre{white-space:pre-wrap;font-family:inherit}
.proposal-card{margin-top:8px;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden}
.proposal-header{background:#e8f5e9;padding:10px 14px;font-size:13px;font-weight:600;color:#2e7d32}
.proposal-body{padding:12px 14px;font-size:13px;line-height:1.7}
.proposal-section{margin-top:10px;padding:8px 12px;border-radius:8px}
.proposal-section h4{font-size:12px;margin-bottom:6px;font-weight:600}
.section-scenario{background:#e3f2fd}
.section-scenario h4{color:#1565c0}
.section-measurement{background:#f3e5f5}
.section-measurement h4{color:#7b1fa2}
.section-questions{background:#fff3e0}
.section-questions h4{color:#e65100}
.step-item{padding:4px 0;display:flex;gap:8px;font-size:13px}
.step-num{background:#1976d2;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0}
.step-content{flex:1}
.step-meta{font-size:11px;color:#999;margin-top:2px}
.measurement-item{font-size:13px;padding:3px 0}
.measurement-label{color:#7b1fa2;font-weight:500}
.question-item{font-size:13px;color:#bf360c;padding:3px 0;cursor:pointer}
.question-item:hover{text-decoration:underline}
.intent-badge{display:inline-block;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}
.input-area{padding:12px 16px;background:white;border-top:1px solid #e0e0e0;display:flex;gap:8px}
.input-area input{flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:24px;font-size:14px;outline:none}
.input-area input:focus{border-color:#06C755}
.input-area button{background:#06C755;color:white;border:none;border-radius:50%;width:40px;height:40px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.input-area button:disabled{background:#ccc}
.loading{display:flex;gap:4px;padding:8px 0}
.loading span{width:8px;height:8px;background:#999;border-radius:50%;animation:bounce 1.4s infinite}
.loading span:nth-child(2){animation-delay:.2s}
.loading span:nth-child(3){animation-delay:.4s}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
</style>
</head>
<body>
<div class="header">
  <div>lchatAI <span>v2.0</span></div>
  <div class="nav">
    <a href="/dashboard">管理画面</a>
    <span class="user-info" id="userInfo" onclick="logout()"></span>
  </div>
</div>
<div class="bot-selector">
  <span>Bot:</span>
  <select id="botSelect"><option value="">未選択（汎用）</option></select>
  <span class="bot-info" id="botInfo"></span>
</div>
<div class="chat-area" id="chatArea">
  <div class="msg ai">
    LINE配信の設定をAIが<b>提案</b>します。<br><br>
    やりたいことを自然に伝えてください。AIが配信シナリオ・計測設定をまとめて提案します。<br><br>
    例: 「Instagram流入向けに3通ステップを作って」<br>
    例: 「YouTube経由の友だちにセミナー案内を送りたい」<br>
    例: 「HP経由で来た人に無料相談を案内するステップ配信」
  </div>
</div>
<div class="input-area">
  <input type="text" id="msgInput" placeholder="やりたいことを入力..." autofocus>
  <button id="sendBtn" onclick="sendMessage()">&#8593;</button>
</div>
<script>
var chatArea = document.getElementById('chatArea');
var msgInput = document.getElementById('msgInput');
var sendBtn = document.getElementById('sendBtn');
var userInfoEl = document.getElementById('userInfo');
var conversationHistory = [];

var user = JSON.parse(localStorage.getItem('lchatai_user') || 'null');
if (user) { userInfoEl.textContent = user.login_id + ' [logout]'; }

function logout() {
  localStorage.removeItem('lchatai_token');
  localStorage.removeItem('lchatai_user');
  window.location.href = '/login';
}

function esc(s) {
  if (s == null) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function getHeaders() {
  var h = { 'Content-Type': 'application/json' };
  var t = localStorage.getItem('lchatai_token');
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

msgInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.isComposing) sendMessage();
});

function addMsg(text, cls) {
  var e = document.createElement('div');
  e.className = 'msg ' + cls;
  if (cls === 'ai') {
    e.innerHTML = '<pre>' + esc(text) + '</pre>';
  } else {
    e.textContent = text;
  }
  chatArea.appendChild(e);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function addProposalMsg(d) {
  var e = document.createElement('div');
  e.className = 'msg ai';
  var h = '';

  // Intent badge
  h += '<div style="margin-bottom:8px"><span class="intent-badge">' + esc(d.intent) + '</span></div>';

  // Display message (natural language)
  if (d.display_message) {
    h += '<pre style="white-space:pre-wrap;font-family:inherit;margin-bottom:8px">' + esc(d.display_message) + '</pre>';
  }

  // Proposal card
  if (d.proposal) {
    h += '<div class="proposal-card">';
    h += '<div class="proposal-header">' + esc(d.proposal.summary || '') + '</div>';
    h += '<div class="proposal-body">';

    // Scenario steps
    if (d.proposal.scenario && d.proposal.scenario.steps) {
      h += '<div class="proposal-section section-scenario"><h4>&#x1f4e8; ステップ構成</h4>';
      d.proposal.scenario.steps.forEach(function(s) {
        var delay = s.delay_minutes === 0 ? '即時' : (s.delay_minutes >= 1440 ? Math.floor(s.delay_minutes / 1440) + '日後' : s.delay_minutes + '分後');
        h += '<div class="step-item">';
        h += '<div class="step-num">' + s.step_order + '</div>';
        h += '<div class="step-content">' + esc(s.message_content).substring(0, 80) + (s.message_content.length > 80 ? '...' : '');
        h += '<div class="step-meta">' + delay + ' | ' + esc(s.goal_label || '') + '</div>';
        h += '</div></div>';
      });
      h += '</div>';
    }

    // Measurement section
    var hasMeasurement = d.proposal.entry_route || d.proposal.tracked_link || d.proposal.conversion;
    if (hasMeasurement) {
      h += '<div class="proposal-section section-measurement"><h4>&#x1f4ca; 計測設定</h4>';
      if (d.proposal.entry_route && d.proposal.entry_route.code) {
        h += '<div class="measurement-item"><span class="measurement-label">流入元:</span> ' + esc(d.proposal.entry_route.name) + ' (' + esc(d.proposal.entry_route.code) + ')</div>';
      }
      if (d.proposal.tracked_link) {
        h += '<div class="measurement-item"><span class="measurement-label">Tracked Link:</span> Step ' + d.proposal.tracked_link.step_order + ' - ' + esc(d.proposal.tracked_link.campaign_label) + '</div>';
      }
      if (d.proposal.conversion && d.proposal.conversion.name) {
        h += '<div class="measurement-item"><span class="measurement-label">CV:</span> ' + esc(d.proposal.conversion.name) + '</div>';
      }
      h += '</div>';
    }

    h += '</div></div>';
  }

  // Questions
  if (d.questions && d.questions.length > 0) {
    h += '<div class="proposal-section section-questions"><h4>&#x2753; 確認事項</h4>';
    d.questions.forEach(function(q) {
      h += '<div class="question-item" onclick="msgInput.value=\\'\\';msgInput.focus()">・' + esc(q) + '</div>';
    });
    h += '</div>';
  }

  // Status indicator (preview-only, no mutation)
  if (d.is_ready && d.proposal) {
    h += '<div style="margin-top:8px;padding:8px 14px;background:#e8f5e9;border-radius:8px;font-size:13px;color:#2e7d32">&#x2705; 提案が完成しました。管理画面からシナリオを作成できます。<br><a href="/dashboard/scenarios" style="color:#1565c0">シナリオ管理画面へ</a></div>';
  } else if (d.proposal) {
    h += '<div style="margin-top:8px;font-size:12px;color:#999">質問に回答すると提案が完成します</div>';
  }

  e.innerHTML = h;
  chatArea.appendChild(e);
  chatArea.scrollTop = chatArea.scrollHeight;
}

async function sendMessage() {
  var msg = msgInput.value.trim();
  if (!msg) return;

  addMsg(msg, 'user');
  conversationHistory.push({ role: 'user', content: msg });
  msgInput.value = '';
  sendBtn.disabled = true;

  var le = document.createElement('div');
  le.className = 'msg ai';
  le.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  chatArea.appendChild(le);
  chatArea.scrollTop = chatArea.scrollHeight;

  try {
    var r = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        message: msg,
        history: conversationHistory.slice(0, -1),
        bot_id: document.getElementById('botSelect').value || undefined
      })
    });
    var d = await r.json();
    chatArea.removeChild(le);

    if (d.status === 'ok') {
      conversationHistory.push({ role: 'assistant', content: d.display_message || '' });
      addProposalMsg(d);
    } else {
      addMsg('Error: ' + (d.message || ''), 'ai');
    }
  } catch (err) {
    chatArea.removeChild(le);
    addMsg('Error: ' + err.message, 'ai');
  }
  sendBtn.disabled = false;
}

async function loadBots() {
  try {
    var r = await fetch('/api/bots', { headers: getHeaders() });
    if (!r.ok) return;
    var d = await r.json();
    var sel = document.getElementById('botSelect');
    (d.bots || []).forEach(function(b) {
      var o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name + ' (' + b.tone + ')';
      sel.appendChild(o);
    });
  } catch (e) {}
}

document.getElementById('botSelect').addEventListener('change', async function() {
  var id = this.value;
  var info = document.getElementById('botInfo');
  if (!id) { info.textContent = ''; return; }
  try {
    var r = await fetch('/api/bots/' + id, { headers: getHeaders() });
    var d = await r.json();
    if (d.status === 'ok') {
      var b = d.bot;
      info.textContent = (b.strategy || '') + (b.knowledge && b.knowledge.length ? ' | Knowledge: ' + b.knowledge.length + '件' : '');
    }
  } catch (e) { info.textContent = ''; }
});

loadBots();
</script>
</body>
</html>`;
}
