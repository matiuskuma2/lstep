export function getScenariosPageHtml(): string {
  return getShellHtml('scenarios', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>\u30b7\u30ca\u30ea\u30aa\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="toggleCreate()">+ \u65b0\u898f\u4f5c\u6210</button>
    </div>
    <div id="createForm" style="display:none" class="card">
      <h3 style="font-size:15px;margin-bottom:12px">\u30b7\u30ca\u30ea\u30aa\u4f5c\u6210</h3>
      <div class="msg error" id="createError"></div>
      <div class="msg success" id="createSuccess"></div>
      <div class="form-row">
        <input type="text" id="scenarioName" placeholder="\u30b7\u30ca\u30ea\u30aa\u540d">
        <select id="triggerType"><option value="friend_add">\u53cb\u3060\u3061\u8ffd\u52a0\u6642</option><option value="tag_added">\u30bf\u30b0\u8ffd\u52a0\u6642</option><option value="manual">\u624b\u52d5</option></select>
        <button class="btn btn-primary" onclick="createScenario()">\u4f5c\u6210</button>
      </div>
      <div class="form-row" style="margin-top:8px">
        <input type="text" id="scenarioDesc" placeholder="\u8aac\u660e\uff08\u4efb\u610f\uff09" style="flex:2">
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>\u30b7\u30ca\u30ea\u30aa\u540d</th><th>\u30c8\u30ea\u30ac\u30fc</th><th>\u30b9\u30c6\u30fc\u30bf\u30b9</th><th>\u4f5c\u6210\u65e5</th><th>\u64cd\u4f5c</th></tr></thead>
        <tbody id="scenarioList"><tr><td colspan="5">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <div id="detailPanel" style="display:none" class="card">
      <h3 id="detailTitle" style="font-size:16px;margin-bottom:12px"></h3>
      <div id="detailInfo" style="margin-bottom:16px"></div>
      <h4 style="font-size:14px;margin-bottom:8px">\u30b9\u30c6\u30c3\u30d7\u4e00\u89a7</h4>
      <table>
        <thead><tr><th>#</th><th>\u5f85\u6a5f(\u5206)</th><th>\u30bf\u30a4\u30d7</th><th>\u5185\u5bb9</th><th>\u76ee\u6a19</th></tr></thead>
        <tbody id="stepList"><tr><td colspan="5">-</td></tr></tbody>
      </table>
      <div style="margin-top:12px">
        <h4 style="font-size:14px;margin-bottom:8px">\u30b9\u30c6\u30c3\u30d7\u8ffd\u52a0</h4>
        <div class="msg error" id="stepError"></div>
        <div class="msg success" id="stepSuccess"></div>
        <div class="form-row">
          <input type="number" id="stepOrder" placeholder="#" style="max-width:60px" value="1">
          <input type="number" id="stepDelay" placeholder="\u5f85\u6a5f(\u5206)" style="max-width:100px" value="0">
          <input type="text" id="stepContent" placeholder="\u30e1\u30c3\u30bb\u30fc\u30b8\u5185\u5bb9">
          <input type="text" id="stepGoal" placeholder="\u76ee\u6a19" style="max-width:120px">
          <button class="btn btn-primary" onclick="addStep()">\u8ffd\u52a0</button>
        </div>
      </div>
    </div>
    <script>
    let currentScenarioId = null;
    function toggleCreate() { const f=document.getElementById('createForm'); f.style.display=f.style.display==='none'?'block':'none'; }
    async function loadScenarios() {
      try {
        const r = await fetch('/api/scenarios', {headers: authHeaders()});
        if (!r.ok) {
          document.getElementById('scenarioList').innerHTML = '<tr><td colspan="5" style="color:#c62828">\u30c7\u30fc\u30bf\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f\uff08' + r.status + '\uff09</td></tr>';
          return;
        }
        const d = await r.json();
        const list = d.scenarios || [];
        if (list.length === 0) { document.getElementById('scenarioList').innerHTML = '<tr><td colspan="5" style="color:#999">\u30b7\u30ca\u30ea\u30aa\u304c\u3042\u308a\u307e\u305b\u3093</td></tr>'; return; }
        document.getElementById('scenarioList').innerHTML = list.map(s =>
          '<tr onclick="showDetail(\\\''+s.id+'\\\')" style="cursor:pointer"><td>'+esc(s.name)+'</td>' +
          '<td><span class="badge badge-active">'+s.trigger_type+'</span></td>' +
          '<td><span class="badge '+(s.status==='active'?'badge-active':'badge-admin')+'">'+s.status+'</span></td>' +
          '<td>'+s.created_at.substring(0,10)+'</td>' +
          '<td><button class="btn btn-primary" onclick="event.stopPropagation();showDetail(\\\''+s.id+'\\\')" style="padding:4px 12px;font-size:12px">\u8a73\u7d30</button></td></tr>'
        ).join('');
      } catch(e) {
        const message = e instanceof Error ? e.message : String(e);
        document.getElementById('scenarioList').innerHTML = '<tr><td colspan="5" style="color:#c62828">\u8aad\u307f\u8fbc\u307f\u30a8\u30e9\u30fc: ' + message + '</td></tr>';
      }
    }
    async function createScenario() {
      const er=document.getElementById('createError'),su=document.getElementById('createSuccess');
      er.style.display='none';su.style.display='none';
      const name=document.getElementById('scenarioName').value;
      const trigger=document.getElementById('triggerType').value;
      const desc=document.getElementById('scenarioDesc').value;
      if(!name){er.textContent='\u30b7\u30ca\u30ea\u30aa\u540d\u306f\u5fc5\u9808';er.style.display='block';return;}
      try {
        const r=await fetch('/api/scenarios',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,trigger_type:trigger,description:desc||undefined})});
        const d=await r.json();
        if(d.status==='ok'){su.textContent='\u4f5c\u6210\u3057\u307e\u3057\u305f';su.style.display='block';document.getElementById('scenarioName').value='';document.getElementById('scenarioDesc').value='';loadScenarios();}
        else{er.textContent=d.message;er.style.display='block';}
      }catch(e){er.textContent=e.message;er.style.display='block';}
    }
    async function showDetail(id) {
      currentScenarioId = id;
      try {
        const [sr, str] = await Promise.all([
          fetch('/api/scenarios/'+id, {headers:authHeaders()}),
          fetch('/api/scenarios/'+id+'/steps', {headers:authHeaders()})
        ]);
        const sd = await sr.json();
        const std = await str.json();
        const s = sd.scenario;
        document.getElementById('detailTitle').textContent = s.name;
        document.getElementById('detailInfo').innerHTML = '<span class="badge badge-active">'+s.trigger_type+'</span> <span class="badge '+(s.status==='active'?'badge-active':'badge-admin')+'">'+s.status+'</span>' + (s.description ? '<p style="margin-top:8px;font-size:13px;color:#666">'+esc(s.description)+'</p>' : '');
        const steps = std.steps || [];
        if(steps.length===0){document.getElementById('stepList').innerHTML='<tr><td colspan="5" style="color:#999">\u30b9\u30c6\u30c3\u30d7\u306a\u3057</td></tr>';}
        else{document.getElementById('stepList').innerHTML=steps.map(st=>'<tr><td>'+st.step_order+'</td><td>'+st.delay_minutes+'</td><td>'+st.message_type+'</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">'+esc(st.message_content)+'</td><td>'+(st.goal_label||'-')+'</td></tr>').join('');}
        document.getElementById('detailPanel').style.display='block';
        document.getElementById('stepOrder').value = steps.length+1;
      }catch(e){console.error(e);}
    }
    async function addStep() {
      const er=document.getElementById('stepError'),su=document.getElementById('stepSuccess');
      er.style.display='none';su.style.display='none';
      const content=document.getElementById('stepContent').value;
      if(!content){er.textContent='\u5185\u5bb9\u306f\u5fc5\u9808';er.style.display='block';return;}
      try {
        const r=await fetch('/api/scenarios/'+currentScenarioId+'/steps',{method:'POST',headers:authHeaders(),body:JSON.stringify({
          step_order:parseInt(document.getElementById('stepOrder').value)||1,
          delay_minutes:parseInt(document.getElementById('stepDelay').value)||0,
          message_content:content,
          goal_label:document.getElementById('stepGoal').value||undefined
        })});
        const d=await r.json();
        if(d.status==='ok'){su.textContent='\u8ffd\u52a0\u3057\u307e\u3057\u305f';su.style.display='block';document.getElementById('stepContent').value='';document.getElementById('stepGoal').value='';showDetail(currentScenarioId);}
        else{er.textContent=d.message;er.style.display='block';}
      }catch(e){er.textContent=e.message;er.style.display='block';}
    }
    loadScenarios();
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
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lchatAI</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f0f2f5;display:flex;height:100vh}.sidebar{width:240px;background:#1a1a2e;color:white;display:flex;flex-direction:column;flex-shrink:0}.sidebar-header{padding:20px;border-bottom:1px solid rgba(255,255,255,.1)}.sidebar-header h1{font-size:20px;color:#06C755}.sidebar-header .tenant{font-size:12px;color:#888;margin-top:4px}.sidebar-menu{flex:1;padding:12px 0;overflow-y:auto}.menu-item{display:flex;align-items:center;gap:10px;padding:10px 20px;color:#aaa;text-decoration:none;font-size:14px;transition:all .2s}.menu-item:hover{background:rgba(255,255,255,.05);color:white}.menu-item.active{background:rgba(6,199,85,.15);color:#06C755;border-right:3px solid #06C755}.sidebar-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)}.sidebar-footer a{display:block;color:#888;text-decoration:none;font-size:13px;padding:6px 0}.sidebar-footer a:hover{color:white}.main{flex:1;display:flex;flex-direction:column;overflow:hidden}.topbar{background:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e0e0e0;box-shadow:0 1px 3px rgba(0,0,0,.05)}.topbar .user-area{display:flex;align-items:center;gap:12px;font-size:13px;color:#666}.topbar .logout{color:#c62828;cursor:pointer;font-size:12px}.content{flex:1;padding:24px;overflow-y:auto}.stats{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}.stat{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);padding:20px;flex:1;min-width:140px;text-align:center}.stat .num{font-size:28px;font-weight:700;color:#06C755}.stat .label{font-size:12px;color:#666;margin-top:4px}.card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);padding:20px;margin-bottom:20px}.form-row{display:flex;gap:10px;flex-wrap:wrap}.form-row input,.form-row select{flex:1;min-width:120px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none}.form-row input:focus,.form-row select:focus{border-color:#06C755}.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}.btn-primary{background:#06C755;color:white}.btn-primary:hover{background:#05a648}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px 10px;color:#888;border-bottom:2px solid #eee;font-weight:500;font-size:12px}td{padding:8px 10px;border-bottom:1px solid #f0f0f0}tr:hover td{background:#fafafa}.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}.badge-active{background:#e8f5e9;color:#2e7d32}.badge-admin{background:#e3f2fd;color:#1565c0}.msg{font-size:13px;padding:8px 12px;border-radius:8px;margin-bottom:10px;display:none}.msg.error{background:#ffebee;color:#c62828}.msg.success{background:#e8f5e9;color:#2e7d32}</style></head><body><div class="sidebar"><div class="sidebar-header"><h1>lchatAI</h1><div class="tenant" id="tenantName"></div></div><div class="sidebar-menu">${menuHtml}</div><div class="sidebar-footer"><a href="/chat">&#x1f4ac; AI \u30c1\u30e3\u30c3\u30c8</a><a href="/admin" id="superAdminLink" style="display:none">&#x2699; Super Admin</a></div></div><div class="main"><div class="topbar"><div></div><div class="user-area"><span id="userName"></span><span class="logout" onclick="logout()">\u30ed\u30b0\u30a2\u30a6\u30c8</span></div></div><div class="content"><script>const user=JSON.parse(localStorage.getItem('lchatai_user')||'null'),token=localStorage.getItem('lchatai_token');if(!user||!token)window.location.href='/login';if(user){document.getElementById('userName').textContent=user.login_id+' ('+user.role+')';document.getElementById('tenantName').textContent=user.tenant_id?'Tenant: '+user.tenant_id.substring(0,8)+'...':'System';if(user.role==='super_admin')document.getElementById('superAdminLink').style.display='block'}function authHeaders(){return{'Content-Type':'application/json','Authorization':'Bearer '+token}}function logout(){localStorage.removeItem('lchatai_token');localStorage.removeItem('lchatai_user');window.location.href='/login'}function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}</script>${content}</div></div></body></html>`;
}
