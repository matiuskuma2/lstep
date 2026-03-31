export function getTagsPageHtml(): string {
  return getShellHtml('tags', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>\u30bf\u30b0\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row">
        <input type="text" id="tagName" placeholder="\u30bf\u30b0\u540d">
        <input type="color" id="tagColor" value="#06C755" style="max-width:60px;padding:4px">
        <input type="text" id="tagDesc" placeholder="\u8aac\u660e\uff08\u4efb\u610f\uff09">
        <button class="btn btn-primary" onclick="createTag()">\u4f5c\u6210</button>
      </div>
    </div>
    <div class="card">
      <div id="tagList" style="display:flex;flex-wrap:wrap;gap:8px">\u8aad\u307f\u8fbc\u307f\u4e2d...</div>
    </div>
    <script>
    async function loadTags() {
      const r = await fetch('/api/tags', {headers:authHeaders()});
      const d = await r.json();
      const tags = d.tags || [];
      if (!tags.length) { document.getElementById('tagList').innerHTML = '<span style="color:#999">\u30bf\u30b0\u306a\u3057</span>'; return; }
      document.getElementById('tagList').innerHTML = tags.map(t =>
        '<div style="background:'+t.color+'22;border:1px solid '+t.color+';color:'+t.color+';padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500">'+esc(t.name)+'</div>'
      ).join('');
    }
    async function createTag() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');
      er.style.display='none';su.style.display='none';
      const name=document.getElementById('tagName').value;
      if(!name){er.textContent='\u30bf\u30b0\u540d\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/tags',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,color:document.getElementById('tagColor').value,description:document.getElementById('tagDesc').value||undefined})});
      const d=await r.json();
      if(d.status==='ok'){su.textContent='\u4f5c\u6210';su.style.display='block';document.getElementById('tagName').value='';loadTags();}
      else{er.textContent=d.message;er.style.display='block';}
    }
    loadTags();
    </script>
  `);
}

export function getConversionsPageHtml(): string {
  return getShellHtml('conversions', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>CV\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row">
        <input type="text" id="cvName" placeholder="CV\u540d (\u4f8b: \u30e9\u30a4\u30d5\u30d7\u30e9\u30f3\u7533\u8fbc)">
        <input type="text" id="cvCode" placeholder="\u30b3\u30fc\u30c9 (\u4f8b: lifeplan_apply)">
        <select id="cvScope"><option value="general">\u4e00\u822c</option><option value="lp">LP</option><option value="form">\u30d5\u30a9\u30fc\u30e0</option></select>
        <select id="cvMethod"><option value="manual">\u624b\u52d5</option><option value="tag">\u30bf\u30b0\u30c8\u30ea\u30ac\u30fc</option><option value="api">API</option><option value="server">\u30b5\u30fc\u30d0\u30fc</option></select>
        <button class="btn btn-primary" onclick="createCV()">\u4f5c\u6210</button>
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>CV\u540d</th><th>\u30b3\u30fc\u30c9</th><th>\u30b9\u30b3\u30fc\u30d7</th><th>\u691c\u8a3c</th><th>\u4f5c\u6210\u65e5</th></tr></thead>
        <tbody id="cvList"><tr><td colspan="5">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadCVs() {
      const r = await fetch('/api/conversion-points', {headers:authHeaders()});
      const d = await r.json();
      const items = d.conversion_points || [];
      if (!items.length) { document.getElementById('cvList').innerHTML = '<tr><td colspan="5" style="color:#999">CV\u30dd\u30a4\u30f3\u30c8\u306a\u3057</td></tr>'; return; }
      document.getElementById('cvList').innerHTML = items.map(c =>
        '<tr><td>'+esc(c.name)+'</td><td><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:12px">'+esc(c.code)+'</code></td><td><span class="badge badge-active">'+c.scope+'</span></td><td>'+c.verification_method+'</td><td>'+c.created_at.substring(0,10)+'</td></tr>'
      ).join('');
    }
    async function createCV() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');
      er.style.display='none';su.style.display='none';
      const name=document.getElementById('cvName').value,code=document.getElementById('cvCode').value;
      if(!name||!code){er.textContent='CV\u540d\u3068\u30b3\u30fc\u30c9\u306f\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/conversion-points',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,code,scope:document.getElementById('cvScope').value,verification_method:document.getElementById('cvMethod').value})});
      const d=await r.json();
      if(d.status==='ok'){su.textContent='\u4f5c\u6210';su.style.display='block';document.getElementById('cvName').value='';document.getElementById('cvCode').value='';loadCVs();}
      else{er.textContent=d.message;er.style.display='block';}
    }
    loadCVs();
    </script>
  `);
}

function getShellHtml(activePage: string, content: string): string {
  const menuItems = [
    { id: 'dashboard', label: '\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9', icon: '&#x1f4ca;', path: '/dashboard' },
    { id: 'scenarios', label: '\u30b7\u30ca\u30ea\u30aa\u7ba1\u7406', icon: '&#x1f4e8;', path: '/dashboard/scenarios' },
    { id: 'friends', label: '\u53cb\u3060\u3061\u7ba1\u7406', icon: '&#x1f465;', path: '/dashboard/friends' },
    { id: 'tags', label: '\u30bf\u30b0\u7ba1\u7406', icon: '&#x1f3f7;', path: '/dashboard/tags' },
    { id: 'tracked-links', label: '\u30c8\u30e9\u30c3\u30ad\u30f3\u30b0\u30ea\u30f3\u30af', icon: '&#x1f517;', path: '/dashboard/tracked-links' },
    { id: 'conversions', label: 'CV\u7ba1\u7406', icon: '&#x1f3af;', path: '/dashboard/conversions' },
    { id: 'broadcasts', label: '\u914d\u4fe1\u7ba1\u7406', icon: '&#x1f4e2;', path: '/dashboard/broadcasts' },
    { id: 'forms', label: '\u30d5\u30a9\u30fc\u30e0\u7ba1\u7406', icon: '&#x1f4dd;', path: '/dashboard/forms' },
  ];
  const menuHtml = menuItems.map(m => `<a href="${m.path}" class="menu-item ${m.id === activePage ? 'active' : ''}">${m.icon} ${m.label}</a>`).join('\n    ');
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lchatAI</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f0f2f5;display:flex;height:100vh}.sidebar{width:240px;background:#1a1a2e;color:white;display:flex;flex-direction:column;flex-shrink:0}.sidebar-header{padding:20px;border-bottom:1px solid rgba(255,255,255,.1)}.sidebar-header h1{font-size:20px;color:#06C755}.sidebar-header .tenant{font-size:12px;color:#888;margin-top:4px}.sidebar-menu{flex:1;padding:12px 0;overflow-y:auto}.menu-item{display:flex;align-items:center;gap:10px;padding:10px 20px;color:#aaa;text-decoration:none;font-size:14px;transition:all .2s}.menu-item:hover{background:rgba(255,255,255,.05);color:white}.menu-item.active{background:rgba(6,199,85,.15);color:#06C755;border-right:3px solid #06C755}.sidebar-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)}.sidebar-footer a{display:block;color:#888;text-decoration:none;font-size:13px;padding:6px 0}.sidebar-footer a:hover{color:white}.main{flex:1;display:flex;flex-direction:column;overflow:hidden}.topbar{background:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e0e0e0;box-shadow:0 1px 3px rgba(0,0,0,.05)}.topbar .user-area{display:flex;align-items:center;gap:12px;font-size:13px;color:#666}.topbar .logout{color:#c62828;cursor:pointer;font-size:12px}.content{flex:1;padding:24px;overflow-y:auto}.card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);padding:20px;margin-bottom:20px}.form-row{display:flex;gap:10px;flex-wrap:wrap}.form-row input,.form-row select{flex:1;min-width:120px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none}.form-row input:focus,.form-row select:focus{border-color:#06C755}.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}.btn-primary{background:#06C755;color:white}.btn-primary:hover{background:#05a648}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px 10px;color:#888;border-bottom:2px solid #eee;font-weight:500;font-size:12px}td{padding:8px 10px;border-bottom:1px solid #f0f0f0}tr:hover td{background:#fafafa}.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}.badge-active{background:#e8f5e9;color:#2e7d32}.badge-admin{background:#e3f2fd;color:#1565c0}.msg{font-size:13px;padding:8px 12px;border-radius:8px;margin-bottom:10px;display:none}.msg.error{background:#ffebee;color:#c62828}.msg.success{background:#e8f5e9;color:#2e7d32}code{background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:12px}</style></head><body><div class="sidebar"><div class="sidebar-header"><h1>lchatAI</h1><div class="tenant" id="tenantName"></div></div><div class="sidebar-menu">${menuHtml}</div><div class="sidebar-footer"><a href="/chat">&#x1f4ac; AI \u30c1\u30e3\u30c3\u30c8</a><a href="/admin" id="superAdminLink" style="display:none">&#x2699; Super Admin</a></div></div><div class="main"><div class="topbar"><div></div><div class="user-area"><span id="userName"></span><span class="logout" onclick="logout()">\u30ed\u30b0\u30a2\u30a6\u30c8</span></div></div><div class="content">${content}</div></div><script>const user=JSON.parse(localStorage.getItem('lchatai_user')||'null'),token=localStorage.getItem('lchatai_token');if(!user||!token)window.location.href='/login';if(user){document.getElementById('userName').textContent=user.login_id+' ('+user.role+')';document.getElementById('tenantName').textContent=user.tenant_id?'Tenant: '+user.tenant_id.substring(0,8)+'...':'System';if(user.role==='super_admin')document.getElementById('superAdminLink').style.display='block'}function authHeaders(){return{'Content-Type':'application/json','Authorization':'Bearer '+token}}function logout(){localStorage.removeItem('lchatai_token');localStorage.removeItem('lchatai_user');window.location.href='/login'}function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}</script></body></html>`;
}
