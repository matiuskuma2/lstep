export function getDashboardHtml(): string {
  return getShellHtml('dashboard', `
    <h2>ダッシュボード</h2>
    <div class="stats" id="stats"><div class="stat"><div class="num">-</div><div class="label">読み込み中...</div></div></div>
    <script>
    async function loadDashboard() {
      const h = authHeaders();
      try {
        const [linksRes] = await Promise.all([fetch('/api/tracked-links', {headers: h})]);
        const linksData = await linksRes.json();
        const links = linksData.links || [];
        document.getElementById('stats').innerHTML =
          '<div class="stat"><div class="num">' + links.length + '</div><div class="label">トラッキングリンク</div></div>' +
          '<div class="stat"><div class="num">-</div><div class="label">シナリオ</div></div>' +
          '<div class="stat"><div class="num">-</div><div class="label">友だち</div></div>' +
          '<div class="stat"><div class="num">-</div><div class="label">CV</div></div>';
      } catch(e) { console.error(e); }
    }
    loadDashboard();
    </script>
  `);
}

export function getTrackedLinksPageHtml(): string {
  return getShellHtml('tracked-links', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>トラッキングリンク</h2>
      <button class="btn btn-primary" onclick="document.getElementById('createForm').style.display=document.getElementById('createForm').style.display==='none'?'block':'none'">+ 新規作成</button>
    </div>
    <div id="createForm" style="display:none;margin-bottom:20px" class="card">
      <h3 style="font-size:15px;margin-bottom:12px">リンク作成</h3>
      <div class="msg error" id="createError"></div>
      <div class="msg success" id="createSuccess"></div>
      <div class="form-row">
        <input type="url" id="destUrl" placeholder="遷移先URL (https://...)">
        <input type="text" id="campLabel" placeholder="キャンペーンラベル">
        <select id="destType"><option value="external">外部</option><option value="internal">内部LP</option></select>
        <button class="btn btn-primary" onclick="createLink()">作成</button>
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>ID</th><th>遷移先</th><th>タイプ</th><th>キャンペーン</th><th>クリック数</th><th>作成日</th><th>リンク</th></tr></thead>
        <tbody id="linkList"><tr><td colspan="7">読み込み中...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadLinks() {
      try {
        const r = await fetch('/api/tracked-links', {headers: authHeaders()});
        const d = await r.json();
        const links = d.links || [];
        if (links.length === 0) { document.getElementById('linkList').innerHTML = '<tr><td colspan="7" style="color:#999">リンクがありません</td></tr>'; return; }
        document.getElementById('linkList').innerHTML = links.map(l =>
          '<tr><td style="font-size:11px;color:#999">' + l.id.substring(0,8) + '...</td>' +
          '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(l.destination_url) + '</td>' +
          '<td><span class="badge ' + (l.destination_type==='internal'?'badge-admin':'badge-active') + '">' + l.destination_type + '</span></td>' +
          '<td>' + (l.campaign_label||'-') + '</td>' +
          '<td>' + (l.click_count||0) + '</td>' +
          '<td>' + (l.created_at||'').substring(0,10) + '</td>' +
          '<td><a href="/t/' + l.id + '" target="_blank" style="color:#1976d2;font-size:12px">テスト</a></td></tr>'
        ).join('');
      } catch(e) { console.error(e); }
    }
    async function createLink() {
      const er = document.getElementById('createError'), su = document.getElementById('createSuccess');
      er.style.display='none'; su.style.display='none';
      const url = document.getElementById('destUrl').value;
      const label = document.getElementById('campLabel').value;
      const type = document.getElementById('destType').value;
      if (!url) { er.textContent='遷移先URLは必須です'; er.style.display='block'; return; }
      try {
        const r = await fetch('/api/tracked-links', { method:'POST', headers: authHeaders(), body: JSON.stringify({destination_url:url, campaign_label:label, destination_type:type}) });
        const d = await r.json();
        if (d.status==='ok') { su.textContent='作成しました: /t/'+d.link.id.substring(0,8)+'...'; su.style.display='block'; document.getElementById('destUrl').value=''; document.getElementById('campLabel').value=''; loadLinks(); }
        else { er.textContent=d.message; er.style.display='block'; }
      } catch(e) { er.textContent='エラー: '+e.message; er.style.display='block'; }
    }
    loadLinks();
    </script>
  `);
}

export function getPlaceholderPageHtml(title: string, pageId: string): string {
  return getShellHtml(pageId, `
    <h2>${title}</h2>
    <div class="card" style="text-align:center;padding:60px">
      <div style="font-size:48px;margin-bottom:16px">&#x1f6a7;</div>
      <div style="font-size:18px;color:#666;margin-bottom:8px">${title}は準備中です</div>
      <div style="font-size:14px;color:#999">この機能は今後のアップデートで追加されます</div>
    </div>
  `);
}

function getShellHtml(activePage: string, content: string): string {
  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: '&#x1f4ca;', path: '/dashboard' },
    { id: 'scenarios', label: 'シナリオ管理', icon: '&#x1f4e8;', path: '/dashboard/scenarios' },
    { id: 'friends', label: '友だち管理', icon: '&#x1f465;', path: '/dashboard/friends' },
    { id: 'tags', label: 'タグ管理', icon: '&#x1f3f7;', path: '/dashboard/tags' },
    { id: 'tracked-links', label: 'トラッキングリンク', icon: '&#x1f517;', path: '/dashboard/tracked-links' },
    { id: 'conversions', label: 'CV管理', icon: '&#x1f3af;', path: '/dashboard/conversions' },
    { id: 'broadcasts', label: '配信管理', icon: '&#x1f4e2;', path: '/dashboard/broadcasts' },
    { id: 'forms', label: 'フォーム管理', icon: '&#x1f4dd;', path: '/dashboard/forms' },
  ];

  const menuHtml = menuItems.map(m =>
    `<a href="${m.path}" class="menu-item ${m.id === activePage ? 'active' : ''}">${m.icon} ${m.label}</a>`
  ).join('\n    ');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lchatAI - 管理画面</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f0f2f5; display: flex; height: 100vh; }
.sidebar { width: 240px; background: #1a1a2e; color: white; display: flex; flex-direction: column; flex-shrink: 0; }
.sidebar-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.sidebar-header h1 { font-size: 20px; color: #06C755; }
.sidebar-header .tenant { font-size: 12px; color: #888; margin-top: 4px; }
.sidebar-menu { flex: 1; padding: 12px 0; overflow-y: auto; }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; color: #aaa; text-decoration: none; font-size: 14px; transition: all 0.2s; }
.menu-item:hover { background: rgba(255,255,255,0.05); color: white; }
.menu-item.active { background: rgba(6,199,85,0.15); color: #06C755; border-right: 3px solid #06C755; }
.sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1); }
.sidebar-footer a { display: block; color: #888; text-decoration: none; font-size: 13px; padding: 6px 0; }
.sidebar-footer a:hover { color: white; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.topbar { background: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.topbar .breadcrumb { font-size: 14px; color: #666; }
.topbar .user-area { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #666; }
.topbar .user-area .logout { color: #c62828; cursor: pointer; font-size: 12px; }
.content { flex: 1; padding: 24px; overflow-y: auto; }
.stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.stat { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); padding: 20px; flex: 1; min-width: 140px; text-align: center; }
.stat .num { font-size: 28px; font-weight: 700; color: #06C755; }
.stat .label { font-size: 12px; color: #666; margin-top: 4px; }
.card { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); padding: 20px; margin-bottom: 20px; }
.card h3 { font-size: 16px; color: #333; margin-bottom: 12px; }
.form-row { display: flex; gap: 10px; flex-wrap: wrap; }
.form-row input, .form-row select { flex: 1; min-width: 120px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; outline: none; }
.form-row input:focus, .form-row select:focus { border-color: #06C755; }
.btn { padding: 8px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-primary { background: #06C755; color: white; } .btn-primary:hover { background: #05a648; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; padding: 8px 10px; color: #888; border-bottom: 2px solid #eee; font-weight: 500; font-size: 12px; }
td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
tr:hover td { background: #fafafa; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-active { background: #e8f5e9; color: #2e7d32; }
.badge-admin { background: #e3f2fd; color: #1565c0; }
.msg { font-size: 13px; padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; display: none; }
.msg.error { background: #ffebee; color: #c62828; }
.msg.success { background: #e8f5e9; color: #2e7d32; }
</style>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-header">
    <h1>lchatAI</h1>
    <div class="tenant" id="tenantName"></div>
  </div>
  <div class="sidebar-menu">
    ${menuHtml}
  </div>
  <div class="sidebar-footer">
    <a href="/chat">&#x1f4ac; AI チャット</a>
    <a href="/admin" id="superAdminLink" style="display:none">&#x2699; Super Admin</a>
  </div>
</div>
<div class="main">
  <div class="topbar">
    <div class="breadcrumb" id="breadcrumb"></div>
    <div class="user-area">
      <span id="userName"></span>
      <span class="logout" onclick="logout()">ログアウト</span>
    </div>
  </div>
  <div class="content">
    ${content}
  </div>
</div>
<script>
const user = JSON.parse(localStorage.getItem('lchatai_user') || 'null');
const token = localStorage.getItem('lchatai_token');
if (!user || !token) { window.location.href = '/login'; }
if (user) {
  document.getElementById('userName').textContent = user.login_id + ' (' + user.role + ')';
  document.getElementById('tenantName').textContent = user.tenant_id ? 'Tenant: ' + user.tenant_id.substring(0,8) + '...' : 'System';
  if (user.role === 'super_admin') { document.getElementById('superAdminLink').style.display = 'block'; }
}
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }; }
function logout() { localStorage.removeItem('lchatai_token'); localStorage.removeItem('lchatai_user'); window.location.href = '/login'; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
</script>
</body>
</html>`;
}
