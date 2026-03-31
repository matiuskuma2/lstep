export function getBotsPageHtml(): string {
  return getShellHtml('bots', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>Bot\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898fBot</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <h3 style="font-size:15px;margin-bottom:12px">Bot\u4f5c\u6210</h3>
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row"><input type="text" id="botName" placeholder="Bot\u540d (\u4f8b: \u5e73\u677e\u5efa\u7bc9\u30ca\u30fc\u30c1\u30e3\u30ea\u30f3\u30b0Bot)"></div>
      <div class="form-row" style="margin-top:8px"><input type="text" id="botGoal" placeholder="\u76ee\u6a19 (\u4f8b: \u30e9\u30a4\u30d5\u30d7\u30e9\u30f3\u7533\u8fbc\u3078\u306e\u8a98\u5c0e)"><input type="text" id="botAudience" placeholder="\u5bfe\u8c61 (\u4f8b: \u65b0\u898f\u53cb\u3060\u3061)"></div>
      <div class="form-row" style="margin-top:8px"><select id="botTone"><option value="professional">\u30d7\u30ed\u30d5\u30a7\u30c3\u30b7\u30e7\u30ca\u30eb</option><option value="friendly">\u30d5\u30ec\u30f3\u30c9\u30ea\u30fc</option><option value="casual">\u30ab\u30b8\u30e5\u30a2\u30eb</option><option value="formal">\u30d5\u30a9\u30fc\u30de\u30eb</option></select></div>
      <div class="form-row" style="margin-top:8px"><textarea id="botStrategy" placeholder="\u751f\u6210\u6226\u7565 (\u4f8b: 1\u65e5\u76ee\u306f\u6b53\u8fce\u3068\u671f\u5f85\u5024\u8a2d\u5b9a\u30022\u65e5\u76ee\u306f\u4e8b\u4f8b\u7d39\u4ecb\u30023\u65e5\u76ee\u306fCV\u8a34\u6c42\u3002)" style="flex:1;min-height:80px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;resize:vertical"></textarea></div>
      <div class="form-row" style="margin-top:8px"><button class="btn btn-primary" onclick="createBot()">\u4f5c\u6210</button></div>
    </div>
    <div id="botList">\u8aad\u307f\u8fbc\u307f\u4e2d...</div>
    <div id="detailPanel" style="display:none" class="card">
      <h3 id="detailTitle"></h3>
      <div id="detailInfo" style="margin:12px 0"></div>
      <h4 style="font-size:14px;margin-bottom:8px">\u7d10\u4ed8\u3051\u6e08\u307fKnowledge</h4>
      <div id="knowledgeList" style="margin-bottom:12px"></div>
      <h4 style="font-size:14px;margin-bottom:8px">Knowledge\u3092\u8ffd\u52a0</h4>
      <div id="availableKnowledge"></div>
    </div>
    <script>
    let currentBotId = null;
    async function loadBots() {
      const r = await fetch('/api/bots', {headers:authHeaders()});
      const d = await r.json(); const bots = d.bots || [];
      if (!bots.length) { document.getElementById('botList').innerHTML = '<div class="card" style="text-align:center;padding:40px;color:#999">Bot\u304c\u3042\u308a\u307e\u305b\u3093\u3002\u300c+ \u65b0\u898fBot\u300d\u304b\u3089\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044\u3002</div>'; return; }
      document.getElementById('botList').innerHTML = bots.map(b => '<div class="card" style="cursor:pointer" onclick="showBot(\''+b.id+'\')"><div style="display:flex;justify-content:space-between;align-items:center"><div><strong>'+esc(b.name)+'</strong><span class="badge badge-active" style="margin-left:8px">'+b.tone+'</span></div><span style="font-size:12px;color:#999">'+b.created_at.substring(0,10)+'</span></div>'+(b.goal?'<div style="font-size:13px;color:#666;margin-top:4px">\u76ee\u6a19: '+esc(b.goal)+'</div>':'')+(b.target_audience?'<div style="font-size:13px;color:#666">\u5bfe\u8c61: '+esc(b.target_audience)+'</div>':'')+'</div>').join('');
    }
    async function createBot() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');er.style.display='none';su.style.display='none';
      const name=document.getElementById('botName').value,strategy=document.getElementById('botStrategy').value;
      if(!name||!strategy){er.textContent='Bot\u540d\u3068\u751f\u6210\u6226\u7565\u306f\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/bots',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,strategy,tone:document.getElementById('botTone').value,goal:document.getElementById('botGoal').value||undefined,target_audience:document.getElementById('botAudience').value||undefined})});
      const d=await r.json();
      if(d.status==='ok'){su.textContent='\u4f5c\u6210\u3057\u307e\u3057\u305f';su.style.display='block';document.getElementById('botName').value='';document.getElementById('botStrategy').value='';document.getElementById('botGoal').value='';document.getElementById('botAudience').value='';loadBots();}
      else{er.textContent=d.message;er.style.display='block';}
    }
    async function showBot(id) {
      currentBotId = id;
      const r = await fetch('/api/bots/'+id, {headers:authHeaders()});
      const d = await r.json(); const bot = d.bot;
      document.getElementById('detailTitle').textContent = bot.name;
      document.getElementById('detailInfo').innerHTML = '<div style="font-size:13px;color:#666"><span class="badge badge-active">'+bot.tone+'</span>'+(bot.goal?' \u76ee\u6a19: '+esc(bot.goal):'')+(bot.target_audience?' \u5bfe\u8c61: '+esc(bot.target_audience):'')+'</div><div style="margin-top:8px;padding:10px;background:#f5f5f5;border-radius:8px;font-size:13px;white-space:pre-wrap">'+esc(bot.strategy)+'</div>';
      const kr = await fetch('/api/bots/'+id+'/knowledge', {headers:authHeaders()});
      const kd = await kr.json(); const knowledge = kd.knowledge || [];
      document.getElementById('knowledgeList').innerHTML = knowledge.length ? knowledge.map(k => '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0"><span>'+esc(k.title)+' <span class="badge badge-admin">'+k.category+'</span></span><button class="btn" style="padding:2px 8px;font-size:11px;background:#ffebee;color:#c62828" onclick="unbindKnowledge(\''+k.id+'\')">&times;</button></div>').join('') : '<span style="color:#999">\u7d10\u4ed8\u3051\u306a\u3057</span>';
      const ar = await fetch('/api/knowledge', {headers:authHeaders()});
      const ad = await ar.json(); const all = (ad.knowledge_items || []).filter(k => !knowledge.find(bk => bk.id === k.id));
      document.getElementById('availableKnowledge').innerHTML = all.length ? all.map(k => '<button class="btn" style="margin:2px;padding:4px 10px;font-size:12px;background:#e3f2fd;color:#1565c0" onclick="bindKnowledge(\''+k.id+'\')">'+ esc(k.title)+' +</button>').join('') : '<span style="color:#999">\u5168\u3066\u7d10\u4ed8\u3051\u6e08\u307f</span>';
      document.getElementById('detailPanel').style.display = 'block';
    }
    async function bindKnowledge(kid) { await fetch('/api/bots/'+currentBotId+'/knowledge',{method:'POST',headers:authHeaders(),body:JSON.stringify({knowledge_id:kid})}); showBot(currentBotId); }
    async function unbindKnowledge(kid) { await fetch('/api/bots/'+currentBotId+'/knowledge/'+kid,{method:'DELETE',headers:authHeaders()}); showBot(currentBotId); }
    loadBots();
    </script>
  `);
}

export function getKnowledgePageHtml(): string {
  return getShellHtml('knowledge', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>Knowledge\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row"><input type="text" id="kTitle" placeholder="\u30bf\u30a4\u30c8\u30eb (\u4f8b: \u30e9\u30a4\u30d5\u30d7\u30e9\u30f3\u5546\u54c1\u60c5\u5831)"><select id="kCat"><option value="product">\u5546\u54c1</option><option value="faq">FAQ</option><option value="case_study">\u4e8b\u4f8b</option><option value="lp">LP\u5185\u5bb9</option><option value="general">\u4e00\u822c</option></select></div>
      <div class="form-row" style="margin-top:8px"><textarea id="kContent" placeholder="\u5185\u5bb9 (\u5546\u54c1\u8aac\u660e\u3001FAQ\u3001\u4e8b\u4f8b\u306a\u3069\u3092\u8a73\u7d30\u306b\u8a18\u8f09)" style="flex:1;min-height:120px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;resize:vertical"></textarea></div>
      <div class="form-row" style="margin-top:8px"><button class="btn btn-primary" onclick="createKnowledge()">\u4f5c\u6210</button></div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>\u30bf\u30a4\u30c8\u30eb</th><th>\u30ab\u30c6\u30b4\u30ea</th><th>\u5185\u5bb9\u30d7\u30ec\u30d3\u30e5\u30fc</th><th>\u4f5c\u6210\u65e5</th></tr></thead>
        <tbody id="kList"><tr><td colspan="4">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadKnowledge() {
      const r = await fetch('/api/knowledge', {headers:authHeaders()});
      const d = await r.json(); const items = d.knowledge_items || [];
      if (!items.length) { document.getElementById('kList').innerHTML = '<tr><td colspan="4" style="color:#999">Knowledge\u306a\u3057</td></tr>'; return; }
      document.getElementById('kList').innerHTML = items.map(k =>
        '<tr><td><strong>'+esc(k.title)+'</strong></td><td><span class="badge badge-admin">'+k.category+'</span></td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:#666">'+esc(k.content.substring(0,80))+(k.content.length>80?'...':'')+'</td><td>'+k.created_at.substring(0,10)+'</td></tr>'
      ).join('');
    }
    async function createKnowledge() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');er.style.display='none';su.style.display='none';
      const title=document.getElementById('kTitle').value,content=document.getElementById('kContent').value;
      if(!title||!content){er.textContent='\u30bf\u30a4\u30c8\u30eb\u3068\u5185\u5bb9\u306f\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/knowledge',{method:'POST',headers:authHeaders(),body:JSON.stringify({title,content,category:document.getElementById('kCat').value})});
      const d=await r.json();
      if(d.status==='ok'){su.textContent='\u4f5c\u6210';su.style.display='block';document.getElementById('kTitle').value='';document.getElementById('kContent').value='';loadKnowledge();}
      else{er.textContent=d.message;er.style.display='block';}
    }
    loadKnowledge();
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
    { id: 'bots', label: 'Bot\u7ba1\u7406', icon: '&#x1f916;', path: '/dashboard/bots' },
    { id: 'knowledge', label: 'Knowledge', icon: '&#x1f4da;', path: '/dashboard/knowledge' },
  ];
  const menuHtml = menuItems.map(m => `<a href="${m.path}" class="menu-item ${m.id === activePage ? 'active' : ''}">${m.icon} ${m.label}</a>`).join('\n    ');
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lchatAI</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f0f2f5;display:flex;height:100vh}.sidebar{width:240px;background:#1a1a2e;color:white;display:flex;flex-direction:column;flex-shrink:0}.sidebar-header{padding:20px;border-bottom:1px solid rgba(255,255,255,.1)}.sidebar-header h1{font-size:20px;color:#06C755}.sidebar-header .tenant{font-size:12px;color:#888;margin-top:4px}.sidebar-menu{flex:1;padding:12px 0;overflow-y:auto}.menu-item{display:flex;align-items:center;gap:10px;padding:10px 20px;color:#aaa;text-decoration:none;font-size:14px;transition:all .2s}.menu-item:hover{background:rgba(255,255,255,.05);color:white}.menu-item.active{background:rgba(6,199,85,.15);color:#06C755;border-right:3px solid #06C755}.sidebar-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)}.sidebar-footer a{display:block;color:#888;text-decoration:none;font-size:13px;padding:6px 0}.sidebar-footer a:hover{color:white}.main{flex:1;display:flex;flex-direction:column;overflow:hidden}.topbar{background:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e0e0e0;box-shadow:0 1px 3px rgba(0,0,0,.05)}.topbar .user-area{display:flex;align-items:center;gap:12px;font-size:13px;color:#666}.topbar .logout{color:#c62828;cursor:pointer;font-size:12px}.content{flex:1;padding:24px;overflow-y:auto}.card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);padding:20px;margin-bottom:20px}.form-row{display:flex;gap:10px;flex-wrap:wrap}.form-row input,.form-row select,.form-row textarea{flex:1;min-width:120px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none}.form-row input:focus,.form-row select:focus,.form-row textarea:focus{border-color:#06C755}.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}.btn-primary{background:#06C755;color:white}.btn-primary:hover{background:#05a648}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px 10px;color:#888;border-bottom:2px solid #eee;font-weight:500;font-size:12px}td{padding:8px 10px;border-bottom:1px solid #f0f0f0}tr:hover td{background:#fafafa}.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}.badge-active{background:#e8f5e9;color:#2e7d32}.badge-admin{background:#e3f2fd;color:#1565c0}.msg{font-size:13px;padding:8px 12px;border-radius:8px;margin-bottom:10px;display:none}.msg.error{background:#ffebee;color:#c62828}.msg.success{background:#e8f5e9;color:#2e7d32}</style></head><body><div class="sidebar"><div class="sidebar-header"><h1>lchatAI</h1><div class="tenant" id="tenantName"></div></div><div class="sidebar-menu">${menuHtml}</div><div class="sidebar-footer"><a href="/chat">&#x1f4ac; AI \u30c1\u30e3\u30c3\u30c8</a><a href="/admin" id="superAdminLink" style="display:none">&#x2699; Super Admin</a></div></div><div class="main"><div class="topbar"><div></div><div class="user-area"><span id="userName"></span><span class="logout" onclick="logout()">\u30ed\u30b0\u30a2\u30a6\u30c8</span></div></div><div class="content">${content}</div></div><script>const user=JSON.parse(localStorage.getItem('lchatai_user')||'null'),token=localStorage.getItem('lchatai_token');if(!user||!token)window.location.href='/login';if(user){document.getElementById('userName').textContent=user.login_id+' ('+user.role+')';document.getElementById('tenantName').textContent=user.tenant_id?'Tenant: '+user.tenant_id.substring(0,8)+'...':'System';if(user.role==='super_admin')document.getElementById('superAdminLink').style.display='block'}function authHeaders(){return{'Content-Type':'application/json','Authorization':'Bearer '+token}}function logout(){localStorage.removeItem('lchatai_token');localStorage.removeItem('lchatai_user');window.location.href='/login'}function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}</script></body></html>`;
}
