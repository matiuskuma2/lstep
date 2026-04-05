import { getShellHtml } from './shared-shell';

export function getLpVariantsPageHtml(): string {
  const content = `
<h2>LP管理</h2>
<p style="color:#666;margin-bottom:20px">内部ランディングページの管理</p>

<div style="display:flex;gap:12px;margin-bottom:20px">
  <button onclick="showCreateForm()" style="padding:8px 16px;background:#06C755;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">+ 新規LP作成</button>
</div>

<div id="createForm" style="display:none;background:white;padding:20px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);margin-bottom:20px">
  <h3 style="margin-bottom:12px;font-size:15px">新規LP作成</h3>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div>
      <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">LP名 *</label>
      <input id="lpName" type="text" placeholder="例: Instagram流入LP" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px">
    </div>
    <div>
      <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">スラッグ（URLパス） *</label>
      <input id="lpSlug" type="text" placeholder="例: instagram-lp" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px">
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div>
      <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">ページタイトル</label>
      <input id="lpTitle" type="text" placeholder="ブラウザタブに表示されるタイトル" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px">
    </div>
    <div>
      <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">ステータス</label>
      <select id="lpStatus" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px">
        <option value="draft">下書き</option>
        <option value="published">公開</option>
      </select>
    </div>
  </div>
  <div style="margin-bottom:12px">
    <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">元URL（参考元の外部LP URL）</label>
    <input id="lpSourceUrl" type="text" placeholder="https://example.com/lp" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px">
  </div>
  <div style="margin-bottom:12px">
    <label style="font-size:12px;color:#666;display:block;margin-bottom:4px">HTML コンテンツ</label>
    <textarea id="lpHtml" rows="10" placeholder="LP の HTML を入力..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:monospace"></textarea>
  </div>
  <div style="display:flex;gap:8px">
    <button onclick="createLp()" style="padding:8px 20px;background:#06C755;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">作成</button>
    <button onclick="hideCreateForm()" style="padding:8px 20px;background:#eee;color:#333;border:none;border-radius:6px;cursor:pointer;font-size:14px">キャンセル</button>
  </div>
</div>

<table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <thead><tr style="background:#f5f5f5">
    <th style="padding:10px 14px;text-align:left;font-size:13px">LP名</th>
    <th style="padding:10px 14px;text-align:left;font-size:13px">スラッグ</th>
    <th style="padding:10px 14px;text-align:left;font-size:13px">ステータス</th>
    <th style="padding:10px 14px;text-align:left;font-size:13px">URL</th>
    <th style="padding:10px 14px;text-align:right;font-size:13px">操作</th>
  </tr></thead>
  <tbody id="lpBody"><tr><td colspan="5" style="padding:12px;color:#999">読み込み中...</td></tr></tbody>
</table>

<script>
function showCreateForm() { document.getElementById('createForm').style.display = 'block'; }
function hideCreateForm() { document.getElementById('createForm').style.display = 'none'; }

async function loadLpVariants() {
  try {
    var d = await fetchJson('/api/lp-variants');
    var items = d.lp_variants || [];
    var el = document.getElementById('lpBody');
    if (items.length === 0) {
      el.innerHTML = '<tr><td colspan="5" style="padding:12px;color:#999">LPがありません。「新規LP作成」から作成してください。</td></tr>';
      return;
    }
    el.innerHTML = items.map(function(lp) {
      var statusBadge = lp.status === 'published'
        ? '<span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:12px;font-size:12px">公開</span>'
        : '<span style="background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:12px;font-size:12px">下書き</span>';
      var lpUrl = '/lp/' + esc(lp.slug);
      return '<tr>'
        + '<td style="padding:8px 14px;font-size:13px;font-weight:500">' + esc(lp.name) + '</td>'
        + '<td style="padding:8px 14px;font-size:13px;color:#666">' + esc(lp.slug) + '</td>'
        + '<td style="padding:8px 14px;font-size:13px">' + statusBadge + '</td>'
        + '<td style="padding:8px 14px;font-size:13px"><a href="' + lpUrl + '" target="_blank" style="color:#1565c0">' + lpUrl + '</a></td>'
        + '<td style="padding:8px 14px;text-align:right">'
        + '<button onclick="toggleStatus(\\'' + esc(lp.id) + '\\',\\'' + (lp.status === 'published' ? 'draft' : 'published') + '\\')" style="padding:4px 10px;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px">' + (lp.status === 'published' ? '非公開' : '公開') + '</button>'
        + '<button onclick="deleteLp(\\'' + esc(lp.id) + '\\')" style="padding:4px 10px;border:1px solid #ffcdd2;border-radius:4px;cursor:pointer;font-size:12px;color:#c62828;background:#fff">削除</button>'
        + '</td></tr>';
    }).join('');
  } catch (err) {
    document.getElementById('lpBody').innerHTML = '<tr><td colspan="5" style="padding:12px;color:#c62828">エラー: ' + esc(err.message) + '</td></tr>';
  }
}

async function createLp() {
  var name = document.getElementById('lpName').value.trim();
  var slug = document.getElementById('lpSlug').value.trim();
  if (!name || !slug) { alert('LP名とスラッグは必須です'); return; }
  try {
    var d = await fetchJson('/api/lp-variants', {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        slug: slug,
        html_content: document.getElementById('lpHtml').value || null,
        meta_title: document.getElementById('lpTitle').value || null,
        source_url: document.getElementById('lpSourceUrl').value || null,
        status: document.getElementById('lpStatus').value
      })
    });
    if (d.status === 'ok') {
      hideCreateForm();
      document.getElementById('lpName').value = '';
      document.getElementById('lpSlug').value = '';
      document.getElementById('lpHtml').value = '';
      document.getElementById('lpTitle').value = '';
      document.getElementById('lpSourceUrl').value = '';
      loadLpVariants();
    } else {
      alert('作成失敗: ' + (d.message || ''));
    }
  } catch (err) {
    alert('エラー: ' + err.message);
  }
}

async function toggleStatus(id, newStatus) {
  try {
    await fetchJson('/api/lp-variants/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    loadLpVariants();
  } catch (err) {
    alert('エラー: ' + err.message);
  }
}

async function deleteLp(id) {
  if (!confirm('このLPを削除しますか？')) return;
  try {
    await fetchJson('/api/lp-variants/' + id, { method: 'DELETE' });
    loadLpVariants();
  } catch (err) {
    alert('エラー: ' + err.message);
  }
}

loadLpVariants();
</script>
`;
  return getShellHtml('lp-variants', content);
}
