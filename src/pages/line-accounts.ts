import { getShellHtml } from './shared-shell';

export function getLineAccountsPageHtml(): string {
  return getShellHtml('line-accounts', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>LINE\u30a2\u30ab\u30a6\u30f3\u30c8\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f\u767b\u9332</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <h3 style="font-size:15px;margin-bottom:12px">LINE\u30a2\u30ab\u30a6\u30f3\u30c8\u767b\u9332</h3>
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div style="margin-bottom:8px"><label style="font-size:13px;color:#333;display:block;margin-bottom:4px">\u30a2\u30ab\u30a6\u30f3\u30c8\u540d</label><input type="text" id="laName" placeholder="\u4f8b: \u5e73\u677e\u5efa\u7bc9 \u516c\u5f0f" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box"></div>
      <div style="margin-bottom:8px"><label style="font-size:13px;color:#333;display:block;margin-bottom:4px">Channel ID</label><input type="text" id="laChannelId" placeholder="LINE Developers Console \u304b\u3089\u53d6\u5f97" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box"></div>
      <div style="margin-bottom:8px"><label style="font-size:13px;color:#333;display:block;margin-bottom:4px">Channel Secret</label><input type="password" id="laSecret" placeholder="Channel Secret" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box"></div>
      <div style="margin-bottom:8px"><label style="font-size:13px;color:#333;display:block;margin-bottom:4px">Channel Access Token</label><textarea id="laToken" placeholder="Channel Access Token\uff08\u9577\u3044\u6587\u5b57\u5217\uff09" style="width:100%;min-height:60px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none;resize:vertical;box-sizing:border-box;font-family:monospace"></textarea></div>
      <div style="text-align:right"><button class="btn btn-primary" onclick="createAccount()">\u767b\u9332</button></div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>\u30a2\u30ab\u30a6\u30f3\u30c8\u540d</th><th>Channel ID</th><th>\u30b9\u30c6\u30fc\u30bf\u30b9</th><th>\u8a8d\u8a3c\u60c5\u5831</th><th>Webhook URL</th><th>\u64cd\u4f5c</th></tr></thead>
        <tbody id="laList"><tr><td colspan="6">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadAccounts() {
      try {
        const d = await fetchJson('/api/line-accounts');
        showList('laList', d.accounts, 6, 'LINE\\u30a2\\u30ab\\u30a6\\u30f3\\u30c8\\u304c\\u767b\\u9332\\u3055\\u308c\\u3066\\u3044\\u307e\\u305b\\u3093', items =>
          items.map(a => {
            const secretMask = a.channel_secret ? a.channel_secret.substring(0,6) + '...' : '-';
            const tokenMask = a.channel_access_token ? a.channel_access_token.substring(0,10) + '...' : '-';
            return '<tr><td>'+esc(a.name)+'</td><td style="font-size:11px;color:#999">'+esc(a.channel_id)+'</td><td><span class="badge '+(a.is_active?'badge-active':'badge-admin')+'">'+(a.is_active?'active':'inactive')+'</span></td><td style="font-size:10px;color:#999">Secret: '+esc(secretMask)+'<br>Token: '+esc(tokenMask)+'</td><td style="font-size:11px;color:#1976d2;word-break:break-all">/webhook</td><td style="white-space:nowrap"><button class="btn" style="padding:2px 8px;font-size:11px;background:#ffebee;color:#c62828;border:none;border-radius:4px;cursor:pointer" onclick="deleteAccount(\\''+a.id+'\\',\\''+esc(a.name).replace(/'/g,'')+'\\')">\\u524a\\u9664</button></td></tr>';
          }).join('')
        );
      } catch(e) { showError('laList', 6, e.message); }
    }
    async function createAccount() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');
      if(!requireTenantForCreate()){er.textContent='\\u30c6\\u30ca\\u30f3\\u30c8\\u3092\\u9078\\u629e\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044';er.style.display='block';return;}er.style.display='none';su.style.display='none';
      const name=document.getElementById('laName').value;
      const channelId=document.getElementById('laChannelId').value;
      const secret=document.getElementById('laSecret').value;
      const token=document.getElementById('laToken').value;
      if(!name||!channelId||!secret||!token){er.textContent='\\u5168\\u3066\\u306e\\u9805\\u76ee\\u3092\\u5165\\u529b\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044';er.style.display='block';return;}
      try {
        const r=await fetch('/api/line-accounts',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,channel_id:channelId,channel_secret:secret,channel_access_token:token})});
        const d=await r.json();
        if(d.status==='ok'){su.textContent='\\u767b\\u9332\\u3057\\u307e\\u3057\\u305f';su.style.display='block';document.getElementById('laName').value='';document.getElementById('laChannelId').value='';document.getElementById('laSecret').value='';document.getElementById('laToken').value='';loadAccounts();}
        else{er.textContent=d.message||'\\u767b\\u9332\\u5931\\u6557';er.style.display='block';}
      }catch(e){er.textContent=e.message;er.style.display='block';}
    }
    async function deleteAccount(id, name) {
      if(!confirm('\\u300c'+name+'\\u300d\\u3092\\u524a\\u9664\\u3057\\u307e\\u3059\\u304b\\uff1f'))return;
      try {
        const r=await fetch('/api/line-accounts/'+id,{method:'DELETE',headers:authHeaders()});
        const d=await r.json();
        if(d.status==='ok'){loadAccounts();}else{alert(d.message||'\\u524a\\u9664\\u5931\\u6557');}
      }catch(e){alert(e.message);}
    }
    loadAccounts();
    </script>
  `);
}
