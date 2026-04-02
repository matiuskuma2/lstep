import { getShellHtml } from './shared-shell';

export function getDashboardHtml(): string {
  return getShellHtml('dashboard', `
    <h2>ダッシュボード</h2>
    <div class="stats" id="stats"><div class="stat"><div class="num">-</div><div class="label">読み込み中...</div></div></div>
    <script>
    async function loadDashboard() {
      try {
        const [linksD, friendsD, scenariosD, cvsD] = await Promise.all([
          fetchJson('/api/tracked-links'),
          fetchJson('/lh/api/friends'),
          fetchJson('/lh/api/scenarios'),
          fetchJson('/api/conversion-points'),
        ]);
        const friendCount = (friendsD.data && friendsD.data.total) || (friendsD.data && friendsD.data.items || []).length || (friendsD.friends||[]).length;
        const scenarioCount = (scenariosD.data || scenariosD.scenarios || []).length;
        const linkCount = (linksD.data || linksD.links || []).length;
        document.getElementById('stats').innerHTML =
          '<div class="stat"><div class="num">' + linkCount + '</div><div class="label">トラッキングリンク</div></div>' +
          '<div class="stat"><div class="num">' + scenarioCount + '</div><div class="label">シナリオ</div></div>' +
          '<div class="stat"><div class="num">' + friendCount + '</div><div class="label">友だち</div></div>' +
          '<div class="stat"><div class="num">' + (cvsD.conversion_points||[]).length + '</div><div class="label">CV</div></div>';
      } catch(e) {
        document.getElementById('stats').innerHTML = '<div class="stat"><div class="num" style="color:#c62828">-</div><div class="label" style="color:#c62828">' + esc(e.message) + '</div></div>';
      }
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
        const d = await fetchJson('/api/tracked-links');
        showList('linkList', d.links || [], 7, 'リンクがありません', items =>
          items.map(l =>
            '<tr><td style="font-size:11px;color:#999">' + l.id.substring(0,8) + '...</td>' +
            '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(l.destination_url) + '</td>' +
            '<td><span class="badge ' + (l.destination_type==='internal'?'badge-admin':'badge-active') + '">' + l.destination_type + '</span></td>' +
            '<td>' + (l.campaign_label||'-') + '</td>' +
            '<td>' + (l.click_count||0) + '</td>' +
            '<td>' + (l.created_at||'').substring(0,10) + '</td>' +
            '<td><a href="/t/' + l.id + '" target="_blank" style="color:#1976d2;font-size:12px">テスト</a></td></tr>'
          ).join('')
        );
      } catch(e) { showError('linkList', 7, e.message); }
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
