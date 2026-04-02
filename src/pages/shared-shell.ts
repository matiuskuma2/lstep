export function getShellHtml(activePage: string, content: string): string {
  const menuItems = [
    { id: 'dashboard', label: '\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9', icon: '&#x1f4ca;', path: '/dashboard' },
    { id: 'scenarios', label: '\u30b7\u30ca\u30ea\u30aa\u7ba1\u7406', icon: '&#x1f4e8;', path: '/dashboard/scenarios' },
    { id: 'bots', label: 'Bot\u7ba1\u7406', icon: '&#x1f916;', path: '/dashboard/bots' },
    { id: 'knowledge', label: 'Knowledge', icon: '&#x1f4da;', path: '/dashboard/knowledge' },
    { id: 'friends', label: '\u53cb\u3060\u3061\u7ba1\u7406', icon: '&#x1f465;', path: '/dashboard/friends' },
    { id: 'tags', label: '\u30bf\u30b0\u7ba1\u7406', icon: '&#x1f3f7;', path: '/dashboard/tags' },
    { id: 'tracked-links', label: '\u30c8\u30e9\u30c3\u30ad\u30f3\u30b0\u30ea\u30f3\u30af', icon: '&#x1f517;', path: '/dashboard/tracked-links' },
    { id: 'conversions', label: 'CV\u7ba1\u7406', icon: '&#x1f3af;', path: '/dashboard/conversions' },
    { id: 'broadcasts', label: '\u914d\u4fe1\u7ba1\u7406', icon: '&#x1f4e2;', path: '/dashboard/broadcasts' },
    { id: 'forms', label: '\u30d5\u30a9\u30fc\u30e0\u7ba1\u7406', icon: '&#x1f4dd;', path: '/dashboard/forms' },
    { id: 'entry-routes', label: '\u6d41\u5165\u5143\u7ba1\u7406', icon: '&#x1f6a9;', path: '/dashboard/entry-routes' },
    { id: 'line-accounts', label: 'LINE\u30a2\u30ab\u30a6\u30f3\u30c8', icon: '&#x1f4f1;', path: '/dashboard/line-accounts' },
    { id: 'ai-logs', label: 'AI\u30ed\u30b0', icon: '&#x1f4cb;', path: '/dashboard/ai-logs' },
  ];
  const menuHtml = menuItems.map(m =>
    `<a href="${m.path}" class="menu-item ${m.id === activePage ? 'active' : ''}">${m.icon} ${m.label}</a>`
  ).join('\n    ');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lchatAI - \u7ba1\u7406\u753b\u9762</title>
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
code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
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
    <a href="/chat">&#x1f4ac; AI \u30c1\u30e3\u30c3\u30c8</a>
    <a href="/admin" id="superAdminLink" style="display:none">&#x2699; Super Admin</a>
  </div>
</div>
<div class="main">
  <div class="topbar">
    <div></div>
    <div class="user-area">
      <span id="userName"></span>
      <span class="logout" onclick="logout()">\u30ed\u30b0\u30a2\u30a6\u30c8</span>
    </div>
  </div>
  <div id="tenantBar" style="display:none;padding:8px 24px;background:#fff3e0;border-bottom:1px solid #ffe0b2;font-size:13px;color:#e65100;align-items:center;gap:8px">
    <span>&#x26a0; Super Admin: \u64cd\u4f5c\u5bfe\u8c61\u30c6\u30ca\u30f3\u30c8\u3092\u9078\u629e</span>
    <select id="tenantSelect" style="padding:4px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px"><option value="">\u9078\u629e...</option></select>
  </div>
  <div class="content">
    <script>
const user = JSON.parse(localStorage.getItem('lchatai_user') || 'null');
const token = localStorage.getItem('lchatai_token');
if (!user || !token) { window.location.href = '/login'; }
if (user) {
  document.getElementById('userName').textContent = user.login_id + ' (' + user.role + ')';
  document.getElementById('tenantName').textContent = user.tenant_id ? 'Tenant: ' + user.tenant_id.substring(0,8) + '...' : 'System';
  if (user.role === 'super_admin') {
    document.getElementById('superAdminLink').style.display = 'block';
    const bar = document.getElementById('tenantBar');
    if (bar) {
      bar.style.display = 'flex';
      fetch('/api/admin/tenants', { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } })
        .then(r => r.json()).then(d => {
          const sel = document.getElementById('tenantSelect');
          const tenants = d.tenants || [];
          tenants.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
          if (tenants.length === 1) { sel.value = tenants[0].id; }
        }).catch(() => {});
    }
  }
}
function getSelectedTenantId() { const sel = document.getElementById('tenantSelect'); return sel ? sel.value : (user && user.tenant_id ? user.tenant_id : ''); }
function requireTenantForCreate() {
  const tid = getSelectedTenantId();
  if (!tid && user && user.role === 'super_admin') {
    const bar = document.getElementById('tenantBar');
    if (bar) { bar.style.background = '#ffcdd2'; setTimeout(() => { bar.style.background = '#fff3e0'; }, 2000); }
    return false;
  }
  return true;
}
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }; }
function logout() { localStorage.removeItem('lchatai_token'); localStorage.removeItem('lchatai_user'); window.location.href = '/login'; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
async function fetchJson(url) {
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.json();
}
function showList(elId, items, colspan, emptyMsg, renderFn) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!items || items.length === 0) { el.innerHTML = '<tr><td colspan="' + colspan + '" style="color:#999">' + (emptyMsg || '\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093') + '</td></tr>'; return; }
  el.innerHTML = renderFn(items);
}
function showListDiv(elId, items, emptyMsg, renderFn) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!items || items.length === 0) { el.innerHTML = '<span style="color:#999">' + (emptyMsg || '\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093') + '</span>'; return; }
  el.innerHTML = renderFn(items);
}
function showError(elId, colspan, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '<tr><td colspan="' + colspan + '" style="color:#c62828">' + esc(msg) + '</td></tr>';
}
function showErrorDiv(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '<span style="color:#c62828">' + esc(msg) + '</span>';
}
    </script>
    ${content}
  </div>
</div>
</body>
</html>`;
}
