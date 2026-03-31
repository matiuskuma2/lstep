export function getAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lchatAI Admin</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; }
.header { background: #1a1a2e; color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
.header h1 { font-size: 20px; } .header .nav { display: flex; gap: 16px; align-items: center; }
.header a { color: #aaa; text-decoration: none; font-size: 14px; } .header a:hover { color: white; }
.header .user-info { font-size: 12px; color: #888; cursor: pointer; }
.container { max-width: 1000px; margin: 24px auto; padding: 0 16px; }
.card { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); padding: 24px; margin-bottom: 24px; }
.card h2 { font-size: 18px; color: #333; margin-bottom: 16px; }
.form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.form-row input { flex: 1; min-width: 150px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; outline: none; }
.form-row input:focus { border-color: #06C755; }
.btn { padding: 8px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-primary { background: #06C755; color: white; } .btn-primary:hover { background: #05a648; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 10px 12px; color: #666; border-bottom: 2px solid #eee; font-weight: 500; }
td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: #333; }
tr:hover td { background: #fafafa; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-super { background: #e3f2fd; color: #1565c0; } .badge-admin { background: #e8f5e9; color: #2e7d32; }
.badge-active { background: #e8f5e9; color: #2e7d32; } .badge-inactive { background: #ffebee; color: #c62828; }
.msg { font-size: 13px; padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; display: none; }
.msg.error { background: #ffebee; color: #c62828; } .msg.success { background: #e8f5e9; color: #2e7d32; }
.stats { display: flex; gap: 16px; margin-bottom: 24px; }
.stat { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); padding: 20px; flex: 1; text-align: center; }
.stat .num { font-size: 32px; font-weight: 700; color: #06C755; } .stat .label { font-size: 13px; color: #666; margin-top: 4px; }
</style>
</head>
<body>
<div class="header">
  <h1>lchatAI Admin</h1>
  <div class="nav">
    <a href="/chat">AI Chat</a>
    <a href="/admin">Admin</a>
    <span class="user-info" id="userInfo" onclick="logout()"></span>
  </div>
</div>
<div class="container">
  <div class="stats" id="stats"></div>

  <div class="card">
    <h2>新規アドミン作成</h2>
    <div class="msg error" id="createError"></div>
    <div class="msg success" id="createSuccess"></div>
    <div class="form-row">
      <input type="text" id="tenantName" placeholder="テナント名（会社名）">
      <input type="text" id="newLoginId" placeholder="ログインID">
      <input type="password" id="newPassword" placeholder="パスワード（8文字以上）">
      <input type="email" id="newEmail" placeholder="メール（任意）">
      <button class="btn btn-primary" onclick="createAdmin()">作成</button>
    </div>
  </div>

  <div class="card">
    <h2>ユーザー一覧</h2>
    <table>
      <thead><tr><th>ログインID</th><th>ロール</th><th>テナント</th><th>ステータス</th><th>最終ログイン</th></tr></thead>
      <tbody id="userList"><tr><td colspan="5">読み込み中...</td></tr></tbody>
    </table>
  </div>

  <div class="card">
    <h2>テナント一覧</h2>
    <table>
      <thead><tr><th>テナント名</th><th>ID</th><th>プラン</th><th>ステータス</th><th>作成日</th></tr></thead>
      <tbody id="tenantList"><tr><td colspan="5">読み込み中...</td></tr></tbody>
    </table>
  </div>
</div>
<script>
const token = localStorage.getItem('lchatai_token');
const user = JSON.parse(localStorage.getItem('lchatai_user') || 'null');
if (!token || !user) { window.location.href = '/login'; }
if (user && user.role !== 'super_admin') { document.body.innerHTML = '<div style="padding:40px;text-align:center"><h2>アクセス権限がありません</h2><p>スーパーアドミンのみアクセスできます</p><a href="/chat">チャットへ</a></div>'; }
if (user) { document.getElementById('userInfo').textContent = user.login_id + ' [ログアウト]'; }
function logout() { localStorage.removeItem('lchatai_token'); localStorage.removeItem('lchatai_user'); window.location.href = '/login'; }
const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

async function loadData() {
  try {
    const [usersRes, tenantsRes] = await Promise.all([
      fetch('/api/admin/users', { headers }),
      fetch('/api/admin/tenants', { headers }),
    ]);
    const usersData = await usersRes.json();
    const tenantsData = await tenantsRes.json();
    const users = usersData.users || [];
    const tenants = tenantsData.tenants || [];
    const tenantMap = {}; tenants.forEach(t => tenantMap[t.id] = t.name);

    document.getElementById('stats').innerHTML =
      '<div class="stat"><div class="num">' + users.length + '</div><div class="label">ユーザー数</div></div>' +
      '<div class="stat"><div class="num">' + tenants.length + '</div><div class="label">テナント数</div></div>' +
      '<div class="stat"><div class="num">' + users.filter(u => u.role === 'admin').length + '</div><div class="label">アドミン数</div></div>';

    document.getElementById('userList').innerHTML = users.map(u =>
      '<tr><td>' + esc(u.login_id) + '</td><td><span class="badge ' + (u.role === 'super_admin' ? 'badge-super' : 'badge-admin') + '">' + u.role + '</span></td>' +
      '<td>' + (tenantMap[u.tenant_id] || '-') + '</td>' +
      '<td><span class="badge ' + (u.status === 'active' ? 'badge-active' : 'badge-inactive') + '">' + u.status + '</span></td>' +
      '<td>' + (u.last_login_at || '-') + '</td></tr>'
    ).join('');

    document.getElementById('tenantList').innerHTML = tenants.map(t =>
      '<tr><td>' + esc(t.name) + '</td><td style="font-size:11px;color:#999">' + t.id.substring(0,8) + '...</td>' +
      '<td>' + t.plan + '</td>' +
      '<td><span class="badge badge-active">' + t.status + '</span></td>' +
      '<td>' + t.created_at.substring(0,10) + '</td></tr>'
    ).join('');
  } catch (err) { console.error(err); }
}

async function createAdmin() {
  const errorEl = document.getElementById('createError');
  const successEl = document.getElementById('createSuccess');
  errorEl.style.display = 'none'; successEl.style.display = 'none';
  const tenantName = document.getElementById('tenantName').value;
  const loginId = document.getElementById('newLoginId').value;
  const password = document.getElementById('newPassword').value;
  const email = document.getElementById('newEmail').value;
  if (!tenantName || !loginId || !password) { errorEl.textContent = 'テナント名、ログインID、パスワードは必須です'; errorEl.style.display = 'block'; return; }
  try {
    const res = await fetch('/api/admin/users', { method: 'POST', headers, body: JSON.stringify({ tenant_name: tenantName, login_id: loginId, password, email: email || undefined }) });
    const data = await res.json();
    if (data.status === 'ok') {
      successEl.textContent = 'アドミン「' + loginId + '」を作成しました（テナント: ' + tenantName + '）';
      successEl.style.display = 'block';
      document.getElementById('tenantName').value = '';
      document.getElementById('newLoginId').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newEmail').value = '';
      loadData();
    } else { errorEl.textContent = data.message || '作成に失敗しました'; errorEl.style.display = 'block'; }
  } catch (err) { errorEl.textContent = 'エラー: ' + err.message; errorEl.style.display = 'block'; }
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
loadData();
</script>
</body>
</html>`;
}
