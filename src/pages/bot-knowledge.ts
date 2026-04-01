import { getShellHtml } from './shared-shell';

export function getBotsPageHtml(): string {
  return getShellHtml('bots', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>Bot\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f\u4f5c\u6210</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <h3 style="font-size:15px;margin-bottom:12px">Bot\u4f5c\u6210</h3>
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row">
        <input type="text" id="botName" placeholder="Bot\u540d" style="flex:1">
        <input type="text" id="botDesc" placeholder="\u8aac\u660e\uff08\u4efb\u610f\uff09" style="flex:2">
      </div>
      <div style="margin-top:8px">
        <textarea id="botPrompt" placeholder="\u30b7\u30b9\u30c6\u30e0\u30d7\u30ed\u30f3\u30d7\u30c8\uff08Bot\u306e\u6307\u793a\u3092\u8a73\u3057\u304f\u8a18\u8ff0\uff09" style="width:100%;min-height:120px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none;resize:vertical;font-family:inherit"></textarea>
      </div>
      <div style="margin-top:8px;text-align:right">
        <button class="btn btn-primary" onclick="createBot()">\u4f5c\u6210</button>
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Bot\u540d</th><th>\u8aac\u660e</th><th>\u30d7\u30ed\u30f3\u30d7\u30c8</th><th>\u30b9\u30c6\u30fc\u30bf\u30b9</th><th>\u4f5c\u6210\u65e5</th></tr></thead>
        <tbody id="botList"><tr><td colspan="5">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <div id="detailPanel" style="display:none" class="card">
      <h3 id="detailTitle" style="font-size:16px;margin-bottom:8px"></h3>
      <div id="detailInfo" style="margin-bottom:12px;font-size:13px;color:#666"></div>
      <h4 style="font-size:14px;margin-bottom:8px">\u7d10\u4ed8\u3051\u6e08\u307fKnowledge</h4>
      <div id="knowledgeBindings" style="margin-bottom:12px">\u8aad\u307f\u8fbc\u307f\u4e2d...</div>
      <div class="form-row">
        <select id="knowledgeSelect"><option value="">\u9078\u629e...</option></select>
        <button class="btn btn-primary" onclick="bindKnowledge()" style="padding:6px 14px;font-size:12px">\u7d10\u4ed8\u3051</button>
      </div>
    </div>
    <script>
    let currentBotId = null;
    async function loadBots() {
      try {
        const d = await fetchJson('/api/bots');
        showList('botList', d.bots || [], 5, '\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093', items =>
          items.map(b =>
            '<tr style="cursor:pointer" onclick="showBot(\\''+b.id+'\\')"><td>'+esc(b.name)+'</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis">'+esc(b.description||'-')+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:#666">'+esc((b.system_prompt||'').substring(0,50))+'</td><td><span class="badge badge-active">'+b.status+'</span></td><td>'+b.created_at.substring(0,10)+'</td></tr>'
          ).join('')
        );
      } catch(e) { showError('botList', 5, e.message); }
    }
    async function createBot() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');
      er.style.display='none';su.style.display='none';
      const name=document.getElementById('botName').value;
      const prompt=document.getElementById('botPrompt').value;
      if(!name){er.textContent='Bot\u540d\u306f\u5fc5\u9808';er.style.display='block';return;}
      try {
        const r=await fetch('/api/bots',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,system_prompt:prompt,description:document.getElementById('botDesc').value||undefined,tenant_id:getSelectedTenantId()||undefined})});
        const d=await r.json();
        if(d.status==='ok'){su.textContent='Bot\u3092\u4f5c\u6210\u3057\u307e\u3057\u305f';su.style.display='block';document.getElementById('botName').value='';document.getElementById('botPrompt').value='';loadBots();}
        else{er.textContent=d.message||'\u4f5c\u6210\u5931\u6557';er.style.display='block';}
      }catch(e){er.textContent=e.message;er.style.display='block';}
    }
    async function showBot(id) {
      currentBotId=id;
      try {
        const r=await fetch('/api/bots/'+id,{headers:authHeaders()});
        const d=await r.json();
        if(d.status!=='ok') return;
        const b=d.bot;
        document.getElementById('detailTitle').textContent=b.name;
        document.getElementById('detailInfo').innerHTML=(b.description?'<div style="margin-bottom:8px;color:#666">'+esc(b.description)+'</div>':'')+(b.system_prompt?'<div style="background:#f5f5f5;padding:10px 12px;border-radius:8px;font-size:12px;font-family:monospace;white-space:pre-wrap;max-height:200px;overflow-y:auto">'+esc(b.system_prompt)+'</div>':'<div style="color:#999;font-size:13px">\u30d7\u30ed\u30f3\u30d7\u30c8\u672a\u8a2d\u5b9a</div>');
        const kl=b.knowledge||[];
        document.getElementById('knowledgeBindings').innerHTML=kl.length?kl.map(k=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0"><span>'+esc(k.title)+' <span style="color:#999;font-size:11px">['+k.category+']</span></span><button class="btn" style="padding:2px 8px;font-size:11px;background:#ffebee;color:#c62828" onclick="unbindKnowledge(\\''+k.id+'\\')">\u89e3\u9664</button></div>').join(''):'<span style="color:#999">\u7d10\u4ed8\u3051\u306a\u3057</span>';
        document.getElementById('detailPanel').style.display='block';
        loadKnowledgeSelect();
      }catch(e){console.error(e);}
    }
    async function loadKnowledgeSelect() {
      try {
        const r=await fetch('/api/knowledge',{headers:authHeaders()});
        const d=await r.json();
        const items=d.knowledge||[];
        const sel=document.getElementById('knowledgeSelect');
        sel.innerHTML='<option value="">\u9078\u629e...</option>'+items.map(k=>'<option value="'+k.id+'">'+esc(k.title)+'</option>').join('');
      }catch(e){console.error(e);}
    }
    async function bindKnowledge() {
      const kid=document.getElementById('knowledgeSelect').value;
      if(!kid||!currentBotId) return;
      await fetch('/api/bots/'+currentBotId+'/knowledge',{method:'POST',headers:authHeaders(),body:JSON.stringify({knowledge_id:kid})});
      showBot(currentBotId);
    }
    async function unbindKnowledge(kid) {
      if(!currentBotId) return;
      await fetch('/api/bots/'+currentBotId+'/knowledge/'+kid,{method:'DELETE',headers:authHeaders()});
      showBot(currentBotId);
    }
    loadBots();
    </script>
  `);
}

export function getKnowledgePageHtml(): string {
  return getShellHtml('knowledge', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>Knowledge\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f\u4f5c\u6210</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <h3 style="font-size:15px;margin-bottom:12px">Knowledge\u4f5c\u6210</h3>
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row">
        <input type="text" id="kTitle" placeholder="\u30bf\u30a4\u30c8\u30eb">
        <select id="kCategory"><option value="general">\u4e00\u822c</option><option value="product">\u88fd\u54c1</option><option value="faq">FAQ</option><option value="policy">\u30dd\u30ea\u30b7\u30fc</option></select>
        <button class="btn btn-primary" onclick="createKnowledge()">\u4f5c\u6210</button>
      </div>
      <div style="margin-top:8px">
        <textarea id="kContent" placeholder="\u5185\u5bb9\uff08\u5fc5\u9808\uff09" style="width:100%;min-height:80px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;outline:none;resize:vertical"></textarea>
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>\u30bf\u30a4\u30c8\u30eb</th><th>\u30ab\u30c6\u30b4\u30ea</th><th>\u5185\u5bb9</th><th>\u30b9\u30c6\u30fc\u30bf\u30b9</th><th>\u4f5c\u6210\u65e5</th></tr></thead>
        <tbody id="kList"><tr><td colspan="5">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadKnowledge() {
      try {
        const d = await fetchJson('/api/knowledge');
        showList('kList', d.knowledge || [], 5, '\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093', items =>
          items.map(k =>
            '<tr><td>'+esc(k.title)+'</td><td><span class="badge badge-active">'+k.category+'</span></td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">'+esc(k.content.substring(0,80))+'</td><td><span class="badge badge-active">'+k.status+'</span></td><td>'+k.created_at.substring(0,10)+'</td></tr>'
          ).join('')
        );
      } catch(e) { showError('kList', 5, e.message); }
    }
    async function createKnowledge() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');
      er.style.display='none';su.style.display='none';
      const title=document.getElementById('kTitle').value;
      const content=document.getElementById('kContent').value;
      if(!title||!content){er.textContent='\u30bf\u30a4\u30c8\u30eb\u3068\u5185\u5bb9\u306f\u5fc5\u9808';er.style.display='block';return;}
      try {
        const r=await fetch('/api/knowledge',{method:'POST',headers:authHeaders(),body:JSON.stringify({title,content,category:document.getElementById('kCategory').value,tenant_id:getSelectedTenantId()||undefined})});
        const d=await r.json();
        if(d.status==='ok'){su.textContent='\u4f5c\u6210\u3057\u307e\u3057\u305f';su.style.display='block';document.getElementById('kTitle').value='';document.getElementById('kContent').value='';loadKnowledge();}
        else{er.textContent=d.message||'\u4f5c\u6210\u5931\u6557';er.style.display='block';}
      }catch(e){er.textContent=e.message;er.style.display='block';}
    }
    loadKnowledge();
    </script>
  `);
}
