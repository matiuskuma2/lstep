import { getShellHtml } from './shared-shell';

export function getReportPageHtml(): string {
  const content = `
<h2>アトリビューションレポート</h2>
<p style="color:#666;margin-bottom:20px">流入元 → クリック → CV の計測レポート</p>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
  <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="font-size:12px;color:#666">総友だち数</div>
    <div id="totalFriends" style="font-size:28px;font-weight:700;color:#06C755">-</div>
  </div>
  <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="font-size:12px;color:#666">総クリック数</div>
    <div id="totalClicks" style="font-size:28px;font-weight:700;color:#1976d2">-</div>
  </div>
  <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="font-size:12px;color:#666">総CV数</div>
    <div id="totalCv" style="font-size:28px;font-weight:700;color:#e65100">-</div>
  </div>
</div>

<h3 style="margin-bottom:12px">流入元別</h3>
<table id="entryTable" style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);margin-bottom:24px">
  <thead><tr style="background:#f5f5f5">
    <th style="padding:10px 14px;text-align:left;font-size:13px">流入元</th>
    <th style="padding:10px 14px;text-align:right;font-size:13px">友だち数</th>
    <th style="padding:10px 14px;text-align:right;font-size:13px">アクティブ</th>
  </tr></thead>
  <tbody id="entryBody"><tr><td colspan="3" style="padding:12px;color:#999">読み込み中...</td></tr></tbody>
</table>

<h3 style="margin-bottom:12px">クリック計測</h3>
<table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);margin-bottom:24px">
  <thead><tr style="background:#f5f5f5">
    <th style="padding:10px 14px;text-align:left;font-size:13px">キャンペーン</th>
    <th style="padding:10px 14px;text-align:left;font-size:13px">リンク先</th>
    <th style="padding:10px 14px;text-align:right;font-size:13px">クリック数</th>
  </tr></thead>
  <tbody id="clickBody"><tr><td colspan="3" style="padding:12px;color:#999">読み込み中...</td></tr></tbody>
</table>

<h3 style="margin-bottom:12px">CV計測</h3>
<table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);margin-bottom:24px">
  <thead><tr style="background:#f5f5f5">
    <th style="padding:10px 14px;text-align:left;font-size:13px">CV名</th>
    <th style="padding:10px 14px;text-align:left;font-size:13px">コード</th>
    <th style="padding:10px 14px;text-align:right;font-size:13px">イベント数</th>
  </tr></thead>
  <tbody id="cvBody"><tr><td colspan="3" style="padding:12px;color:#999">読み込み中...</td></tr></tbody>
</table>

<h3 style="margin-bottom:12px">直近の流入アクセス</h3>
<table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <thead><tr style="background:#f5f5f5">
    <th style="padding:10px 14px;text-align:left;font-size:13px">ref_code</th>
    <th style="padding:10px 14px;text-align:left;font-size:13px">紐付き</th>
    <th style="padding:10px 14px;text-align:left;font-size:13px">日時</th>
  </tr></thead>
  <tbody id="refBody"><tr><td colspan="3" style="padding:12px;color:#999">読み込み中...</td></tr></tbody>
</table>

<script>
async function loadReport() {
  try {
    var r = await fetchJson('/api/report/attribution');
    if (!r || r.status !== 'ok') { showError('レポート取得に失敗しました'); return; }

    // Summary
    var totalF = 0, totalC = 0, totalCv = 0;
    (r.entry_stats || []).forEach(function(e) { totalF += e.friend_count; });
    (r.click_stats || []).forEach(function(e) { totalC += e.click_count; });
    (r.cv_stats || []).forEach(function(e) { totalCv += e.event_count; });
    document.getElementById('totalFriends').textContent = totalF;
    document.getElementById('totalClicks').textContent = totalC;
    document.getElementById('totalCv').textContent = totalCv;

    // Entry stats
    var eb = document.getElementById('entryBody');
    if (r.entry_stats && r.entry_stats.length > 0) {
      eb.innerHTML = r.entry_stats.map(function(e) {
        return '<tr><td style="padding:8px 14px;font-size:13px">' + esc(e.ref_code) + '</td>'
          + '<td style="padding:8px 14px;text-align:right;font-size:13px">' + e.friend_count + '</td>'
          + '<td style="padding:8px 14px;text-align:right;font-size:13px">' + (e.active_count || 0) + '</td></tr>';
      }).join('');
    } else {
      eb.innerHTML = '<tr><td colspan="3" style="padding:12px;color:#999">データがありません</td></tr>';
    }

    // Click stats
    var cb = document.getElementById('clickBody');
    if (r.click_stats && r.click_stats.length > 0) {
      cb.innerHTML = r.click_stats.map(function(e) {
        return '<tr><td style="padding:8px 14px;font-size:13px">' + esc(e.campaign_label || '(なし)') + '</td>'
          + '<td style="padding:8px 14px;font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(e.destination_url || '') + '</td>'
          + '<td style="padding:8px 14px;text-align:right;font-size:13px;font-weight:600">' + e.click_count + '</td></tr>';
      }).join('');
    } else {
      cb.innerHTML = '<tr><td colspan="3" style="padding:12px;color:#999">データがありません</td></tr>';
    }

    // CV stats
    var cvb = document.getElementById('cvBody');
    if (r.cv_stats && r.cv_stats.length > 0) {
      cvb.innerHTML = r.cv_stats.map(function(e) {
        return '<tr><td style="padding:8px 14px;font-size:13px">' + esc(e.cv_name) + '</td>'
          + '<td style="padding:8px 14px;font-size:13px;color:#666">' + esc(e.cv_code) + '</td>'
          + '<td style="padding:8px 14px;text-align:right;font-size:13px;font-weight:600">' + e.event_count + '</td></tr>';
      }).join('');
    } else {
      cvb.innerHTML = '<tr><td colspan="3" style="padding:12px;color:#999">データがありません</td></tr>';
    }

    // Ref visits
    var rb = document.getElementById('refBody');
    if (r.ref_visits && r.ref_visits.length > 0) {
      rb.innerHTML = r.ref_visits.map(function(e) {
        return '<tr><td style="padding:8px 14px;font-size:13px">' + esc(e.ref_code) + '</td>'
          + '<td style="padding:8px 14px;font-size:13px">' + (e.friend_id ? '&#x2705;' : '&#x2796;') + '</td>'
          + '<td style="padding:8px 14px;font-size:13px;color:#999">' + esc(e.created_at) + '</td></tr>';
      }).join('');
    } else {
      rb.innerHTML = '<tr><td colspan="3" style="padding:12px;color:#999">データがありません</td></tr>';
    }
  } catch (err) {
    showError('エラー: ' + err.message);
  }
}
loadReport();
</script>
`;
  return getShellHtml('report', content);
}
