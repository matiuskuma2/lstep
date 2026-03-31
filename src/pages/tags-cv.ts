import { getShellHtml } from './shared-shell';

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
      try {
        const r = await fetch('/api/tags', {headers:authHeaders()});
        if (!r.ok) {
          document.getElementById('tagList').innerHTML = '<span style="color:#c62828">\u30c7\u30fc\u30bf\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f\uff08' + r.status + '\uff09</span>';
          return;
        }
        const d = await r.json();
        const tags = d.tags || [];
        if (!tags.length) { document.getElementById('tagList').innerHTML = '<span style="color:#999">\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093</span>'; return; }
        document.getElementById('tagList').innerHTML = tags.map(t =>
          '<div style="background:'+t.color+'22;border:1px solid '+t.color+';color:'+t.color+';padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500">'+esc(t.name)+'</div>'
        ).join('');
      } catch(e) {
        const message = e instanceof Error ? e.message : String(e);
        document.getElementById('tagList').innerHTML = '<span style="color:#c62828">\u8aad\u307f\u8fbc\u307f\u30a8\u30e9\u30fc: ' + message + '</span>';
      }
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
      try {
        const r = await fetch('/api/conversion-points', {headers:authHeaders()});
        if (!r.ok) {
          document.getElementById('cvList').innerHTML = '<tr><td colspan="5" style="color:#c62828">\u30c7\u30fc\u30bf\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f\uff08' + r.status + '\uff09</td></tr>';
          return;
        }
        const d = await r.json();
        const items = d.conversion_points || [];
        if (!items.length) { document.getElementById('cvList').innerHTML = '<tr><td colspan="5" style="color:#999">\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093</td></tr>'; return; }
        document.getElementById('cvList').innerHTML = items.map(c =>
          '<tr><td>'+esc(c.name)+'</td><td><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:12px">'+esc(c.code)+'</code></td><td><span class="badge badge-active">'+c.scope+'</span></td><td>'+c.verification_method+'</td><td>'+c.created_at.substring(0,10)+'</td></tr>'
        ).join('');
      } catch(e) {
        const message = e instanceof Error ? e.message : String(e);
        document.getElementById('cvList').innerHTML = '<tr><td colspan="5" style="color:#c62828">\u8aad\u307f\u8fbc\u307f\u30a8\u30e9\u30fc: ' + message + '</td></tr>';
      }
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
