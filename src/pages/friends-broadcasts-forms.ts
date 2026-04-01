import { getShellHtml } from './shared-shell';

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
      try {
        const d = await fetchJson('/api/friends');
        showList('fList', d.friends || [], 5, '\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093', items =>
          items.map(f =>
            '<tr><td>'+esc(f.display_name)+'</td><td style="font-size:11px;color:#999">'+(f.line_user_id||'-')+'</td><td>'+(f.ref_code||'-')+'</td><td><span class="badge badge-active">'+f.status+'</span></td><td>'+f.created_at.substring(0,10)+'</td></tr>'
          ).join('')
        );
      } catch(e) { showError('fList', 5, e.message); }
    }
    async function addFriend() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');if(!requireTenantForCreate()){er.textContent='\u30c6\u30ca\u30f3\u30c8\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044';er.style.display='block';return;}er.style.display='none';su.style.display='none';
      const name=document.getElementById('fName').value;
      if(!name){er.textContent='\u8868\u793a\u540d\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/friends',{method:'POST',headers:authHeaders(),body:JSON.stringify({display_name:name,ref_code:document.getElementById('fRef').value||undefined,tenant_id:getSelectedTenantId()||undefined})});
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
      try {
        const d = await fetchJson('/api/broadcasts');
        showList('bList', d.broadcasts || [], 4, '\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093', items =>
          items.map(b =>
            '<tr><td>'+esc(b.name)+'</td><td><span class="badge '+(b.status==='sent'?'badge-active':'badge-admin')+'">'+b.status+'</span></td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">'+esc(b.message_content.substring(0,50))+'</td><td>'+b.created_at.substring(0,10)+'</td></tr>'
          ).join('')
        );
      } catch(e) { showError('bList', 4, e.message); }
    }
    async function createBroadcast() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');if(!requireTenantForCreate()){er.textContent='\u30c6\u30ca\u30f3\u30c8\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044';er.style.display='block';return;}er.style.display='none';su.style.display='none';
      const name=document.getElementById('bName').value,content=document.getElementById('bContent').value;
      if(!name||!content){er.textContent='\u914d\u4fe1\u540d\u3068\u5185\u5bb9\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/broadcasts',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,message_content:content,tenant_id:getSelectedTenantId()||undefined})});
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
      try {
        const d = await fetchJson('/api/forms');
        showList('formList', d.forms || [], 4, '\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093', items =>
          items.map(f =>
            '<tr><td>'+esc(f.name)+'</td><td>'+(f.description||'-')+'</td><td><span class="badge badge-active">'+f.status+'</span></td><td>'+f.created_at.substring(0,10)+'</td></tr>'
          ).join('')
        );
      } catch(e) { showError('formList', 4, e.message); }
    }
    async function createForm() {
      const er=document.getElementById('cErr'),su=document.getElementById('cSuc');if(!requireTenantForCreate()){er.textContent='\u30c6\u30ca\u30f3\u30c8\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044';er.style.display='block';return;}er.style.display='none';su.style.display='none';
      const name=document.getElementById('formName').value;
      if(!name){er.textContent='\u30d5\u30a9\u30fc\u30e0\u540d\u5fc5\u9808';er.style.display='block';return;}
      const r=await fetch('/api/forms',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,description:document.getElementById('formDesc').value||undefined,tenant_id:getSelectedTenantId()||undefined})});
      const d=await r.json();
      if(d.status==='ok'){su.textContent='\u4f5c\u6210';su.style.display='block';document.getElementById('formName').value='';loadForms();}
      else{er.textContent=d.message;er.style.display='block';}
    }
    loadForms();
    </script>
  `);
}
