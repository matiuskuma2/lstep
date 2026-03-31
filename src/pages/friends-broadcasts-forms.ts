export function getFriendsPageHtml(): string {
  return getShellHtml('friends', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>\u53cb\u3060\u3061\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u624b\u52d5\u8ffd\u52a0</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row">
        <input type="text" id="fName" placeholder="\u8868\u793a\u540d">
        <input type="text" id="fRef" placeholder="\u6d41\u5165\u5143 (\u4efb\u610f)">
        <button class="btn btn-primary" onclick="addFriend()">\u8ffd\u52a0</button>
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>\u8868\u793a\u540d</th><th>LINE ID</th><th>\u6d41\u5165\u5143</th><th>\u30b9\u30c6\u30fc\u30bf\u30b9</th><th>\u767b\u9332\u65e5</th></tr></thead>
        <tbody id="fList"><tr><td colspan="5">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadFriends() {
      const r = await fetch('/api/friends', {headers:authHeaders()});
      const d = await r.json(); const items = d.friends || [];
      if (!items.length) { document.getElementById('fList').innerHTML = '<tr><td colspan="5" style="color:#999">\u53cb\u3060\u3061\u304c\u3044\u307e\u305b\u3093</td></tr>'; return; }
      document.getElementById('fList').innerHTML = items.map(f =>
        '<tr><td>'+esc(f.display_name)+'</td><td style="font-size:11px;color:#999">'+(f.line_user_id||'-')+'</td><td>'+(f.ref_code||'-')+'</td><td><span class="badge badge-active">'+f.status+'</span></td><td>'+f.created_at.substring(0,10)+'</td></tr>'
      ).join('');
    }
    async function addFriend() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');er.style.display='none';su.style.display='none';
      const name=document.getElementById('fName').value;
      if(!name){er.textContent='\u8868\u793a\u540d\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/friends',{method:'POST',headers:authHeaders(),body:JSON.stringify({display_name:name,ref_code:document.getElementById('fRef').value||undefined})});
      const d=await r.json();
      if(d.status==='ok'){su.textContent='\u8ffd\u52a0';su.style.display='block';document.getElementById('fName').value='';loadFriends();}
      else{er.textContent=d.message;er.style.display='block';}
    }
    loadFriends();
    </script>
  `);
}

export function getBroadcastsPageHtml(): string {
  return getShellHtml('broadcasts', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>\u914d\u4fe1\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row"><input type="text" id="bName" placeholder="\u914d\u4fe1\u540d"></div>
      <div class="form-row" style="margin-top:8px"><textarea id="bContent" placeholder="\u30e1\u30c3\u30bb\u30fc\u30b8\u5185\u5bb9" style="flex:1;min-height:80px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none;resize:vertical"></textarea></div>
      <div class="form-row" style="margin-top:8px"><button class="btn btn-primary" onclick="createBroadcast()">\u4f5c\u6210 (\u4e0b\u66f8\u304d)</button></div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>\u914d\u4fe1\u540d</th><th>\u30b9\u30c6\u30fc\u30bf\u30b9</th><th>\u5185\u5bb9</th><th>\u4f5c\u6210\u65e5</th></tr></thead>
        <tbody id="bList"><tr><td colspan="4">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadBroadcasts() {
      const r = await fetch('/api/broadcasts', {headers:authHeaders()});
      const d = await r.json(); const items = d.broadcasts || [];
      if (!items.length) { document.getElementById('bList').innerHTML = '<tr><td colspan="4" style="color:#999">\u914d\u4fe1\u306a\u3057</td></tr>'; return; }
      document.getElementById('bList').innerHTML = items.map(b =>
        '<tr><td>'+esc(b.name)+'</td><td><span class="badge '+(b.status==='sent'?'badge-active':'badge-admin')+'">'+b.status+'</span></td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">'+esc(b.message_content.substring(0,50))+'</td><td>'+b.created_at.substring(0,10)+'</td></tr>'
      ).join('');
    }
    async function createBroadcast() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');er.style.display='none';su.style.display='none';
      const name=document.getElementById('bName').value,content=document.getElementById('bContent').value;
      if(!name||!content){er.textContent='\u914d\u4fe1\u540d\u3068\u5185\u5bb9\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/broadcasts',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,message_content:content})});
      const d=await r.json();
      if(d.status==='ok'){su.textContent='\u4f5c\u6210';su.style.display='block';document.getElementById('bName').value='';document.getElementById('bContent').value='';loadBroadcasts();}
      else{er.textContent=d.message;er.style.display='block';}
    }
    loadBroadcasts();
    </script>
  `);
}

export function getFormsPageHtml(): string {
  return getShellHtml('forms', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>\u30d5\u30a9\u30fc\u30e0\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row">
        <input type="text" id="formName" placeholder="\u30d5\u30a9\u30fc\u30e0\u540d">
        <input type="text" id="formDesc" placeholder="\u8aac\u660e (\u4efb\u610f)">
        <button class="btn btn-primary" onclick="createForm()">\u4f5c\u6210</button>
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>\u30d5\u30a9\u30fc\u30e0\u540d</th><th>\u8aac\u660e</th><th>\u30b9\u30c6\u30fc\u30bf\u30b9</th><th>\u4f5c\u6210\u65e5</th></tr></thead>
        <tbody id="formList"><tr><td colspan="4">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadForms() {
      const r = await fetch('/api/forms', {headers:authHeaders()});
      const d = await r.json(); const items = d.forms || [];
      if (!items.length) { document.getElementById('formList').innerHTML = '<tr><td colspan="4" style="color:#999">\u30d5\u30a9\u30fc\u30e0\u306a\u3057</td></tr>'; return; }
      document.getElementById('formList').innerHTML = items.map(f =>
        '<tr><td>'+esc(f.name)+'</td><td>'+(f.description||'-')+'</td><td><span class="badge badge-active">'+f.status+'</span></td><td>'+f.created_at.substring(0,10)+'</td></tr>'
      ).join('');
    }
    async function createForm() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');er.style.display='none';su.style.display='none';
      const name=document.getElementById('formName').value;
      if(!name){er.textContent='\u30d5\u30a9\u30fc\u30e0\u540d\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/forms',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,description:document.getElementById('formDesc').value||undefined})});
      const d=await r.json();
      if(d.status==='ok'){su.textContent='\u4f5c\u6210';su.style.display='block';document.getElementById('formName').value='';loadForms();}
      else{er.textContent=d.message;er.style.display='block';}
    }
    loadForms();
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
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lchatAI</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f0f2f5;display:flex;height:100vh}.sidebar{width:240px;background:#1a1a2e;color:white;display:flex;flex-direction:column;flex-shrink:0}.sidebar-header{padding:20px;border-bottom:1px solid rgba(255,255,255,.1)}.sidebar-header h1{font-size:20px;color:#06C755}.sidebar-header .tenant{font-size:12px;color:#888;margin-top:4px}.sidebar-menu{flex:1;padding:12px 0;overflow-y:auto}.menu-item{display:flex;align-items:center;gap:10px;padding:10px 20px;color:#aaa;text-decoration:none;font-size:14px;transition:all .2s}.menu-item:hover{background:rgba(255,255,255,.05);color:white}.menu-item.active{background:rgba(6,199,85,.15);color:#06C755;border-right:3px solid #06C755}.sidebar-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)}.sidebar-footer a{display:block;color:#888;text-decoration:none;font-size:13px;padding:6px 0}.sidebar-footer a:hover{color:white}.main{flex:1;display:flex;flex-direction:column;overflow:hidden}.topbar{background:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e0e0e0;box-shadow:0 1px 3px rgba(0,0,0,.05)}.topbar .user-area{display:flex;align-items:center;gap:12px;font-size:13px;color:#666}.topbar .logout{color:#c62828;cursor:pointer;font-size:12px}.content{flex:1;padding:24px;overflow-y:auto}.card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);padding:20px;margin-bottom:20px}.form-row{display:flex;gap:10px;flex-wrap:wrap}.form-row input,.form-row select{flex:1;min-width:120px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none}.form-row input:focus,.form-row select:focus{border-color:#06C755}.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}.btn-primary{background:#06C755;color:white}.btn-primary:hover{background:#05a648}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px 10px;color:#888;border-bottom:2px solid #eee;font-weight:500;font-size:12px}td{padding:8px 10px;border-bottom:1px solid #f0f0f0}tr:hover td{background:#fafafa}.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}.badge-active{background:#e8f5e9;color:#2e7d32}.badge-admin{background:#e3f2fd;color:#1565c0}.msg{font-size:13px;padding:8px 12px;border-radius:8px;margin-bottom:10px;display:none}.msg.error{background:#ffebee;color:#c62828}.msg.success{background:#e8f5e9;color:#2e7d32}</style></head><body><div class="sidebar"><div class="sidebar-header"><h1>lchatAI</h1><div class="tenant" id="tenantName"></div></div><div class="sidebar-menu">${menuHtml}</div><div class="sidebar-footer"><a href="/chat">&#x1f4ac; AI \u30c1\u30e3\u30c3\u30c8</a><a href="/admin" id="superAdminLink" style="display:none">&#x2699; Super Admin</a></div></div><div class="main"><div class="topbar"><div></div><div class="user-area"><span id="userName"></span><span class="logout" onclick="logout()">\u30ed\u30b0\u30a2\u30a6\u30c8</span></div></div><div class="content">${content}</div></div><script>const user=JSON.parse(localStorage.getItem('lchatai_user')||'null'),token=localStorage.getItem('lchatai_token');if(!user||!token)window.location.href='/login';if(user){document.getElementById('userName').textContent=user.login_id+' ('+user.role+')';document.getElementById('tenantName').textContent=user.tenant_id?'Tenant: '+user.tenant_id.substring(0,8)+'...':'System';if(user.role==='super_admin')document.getElementById('superAdminLink').style.display='block'}function authHeaders(){return{'Content-Type':'application/json','Authorization':'Bearer '+token}}function logout(){localStorage.removeItem('lchatai_token');localStorage.removeItem('lchatai_user');window.location.href='/login'}function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}</script></body></html>`;
}
