import { getShellHtml } from './shared-shell';

export function getAiLogsPageHtml(): string {
  return getShellHtml('ai-logs', `
    <h2>AI \u5b9f\u884c\u30ed\u30b0</h2>
    <div class="card">
      <table>
        <thead><tr><th>\u65e5\u6642</th><th>Intent</th><th>\u4fe1\u983c\u5ea6</th><th>Bot</th><th>\u30e1\u30c3\u30bb\u30fc\u30b8</th><th>\u5b8c\u4e86</th><th>\u30a8\u30e9\u30fc</th></tr></thead>
        <tbody id="logList"><tr><td colspan="7">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadLogs() {
      try {
        const d = await fetchJson('/api/ai/logs');
        showList('logList', d.logs, 7, '\u30ed\u30b0\u304c\u3042\u308a\u307e\u305b\u3093', items =>
          items.map(l =>
            '<tr><td style="font-size:11px;white-space:nowrap">'+(l.created_at||'').substring(0,19)+'</td>' +
            '<td><span class="badge badge-active">'+(l.intent||'-')+'</span></td>' +
            '<td>'+(l.confidence?Math.round(l.confidence*100)+'%':'-')+'</td>' +
            '<td style="font-size:11px">'+(l.bot_id?l.bot_id.substring(0,8)+'...':'-')+'</td>' +
            '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+esc(l.request_message.substring(0,60))+'</td>' +
            '<td>'+(l.is_complete?'\\u2705':'\\u274c')+'</td>' +
            '<td style="color:#c62828;font-size:11px">'+(l.error?esc(l.error.substring(0,40)):'-')+'</td></tr>'
          ).join('')
        );
      } catch(e) { showError('logList', 7, e.message); }
    }
    loadLogs();
    </script>
  `);
}
