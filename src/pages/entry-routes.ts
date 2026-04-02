import { getShellHtml } from './shared-shell';

export function getEntryRoutesPageHtml(): string {
  return getShellHtml('entry-routes', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>\u6d41\u5165\u5143\u7ba1\u7406</h2>
      <button class="btn btn-primary" onclick="document.getElementById('cf').style.display=document.getElementById('cf').style.display==='none'?'block':'none'">+ \u65b0\u898f\u4f5c\u6210</button>
    </div>
    <div id="cf" style="display:none" class="card">
      <h3 style="font-size:15px;margin-bottom:12px">\u6d41\u5165\u5143\u4f5c\u6210</h3>
      <div class="msg error" id="cErr"></div><div class="msg success" id="cSuc"></div>
      <div class="form-row">
        <input type="text" id="routeName" placeholder="\u6d41\u5165\u5143\u540d\uff08\u4f8b: YouTube\u5e83\u544a\uff09">
        <input type="text" id="routeCode" placeholder="\u30b3\u30fc\u30c9\uff08\u4f8b: youtube\uff09">
        <button class="btn btn-primary" onclick="createRoute()">\u4f5c\u6210</button>
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>\u6d41\u5165\u5143\u540d</th><th>\u30b3\u30fc\u30c9</th><th>\u767b\u9332URL</th><th>\u4f5c\u6210\u65e5</th><th>\u64cd\u4f5c</th></tr></thead>
        <tbody id="routeList"><tr><td colspan="5">\u8aad\u307f\u8fbc\u307f\u4e2d...</td></tr></tbody>
      </table>
    </div>
    <script>
    async function loadRoutes() {
      try {
        const d = await fetchJson('/api/entry-routes');
        showList('routeList', d.entry_routes || [], 5, '\u6d41\u5165\u5143\u304c\u3042\u308a\u307e\u305b\u3093', items =>
          items.map(function(r) {
            var regUrl = window.location.origin + '/r/' + r.code;
            return '<tr><td>'+esc(r.name)+'</td><td><code>'+esc(r.code)+'</code></td><td style="font-size:11px"><a href="'+regUrl+'" target="_blank" style="color:#1976d2">'+esc(regUrl)+'</a></td><td>'+(r.created_at||'').substring(0,10)+'</td><td><button class="btn" style="padding:2px 8px;font-size:11px;background:#ffebee;color:#c62828;border:none;border-radius:4px;cursor:pointer" onclick="deleteRoute(\\''+r.id+'\\')">\\u524a\\u9664</button></td></tr>';
          }).join('')
        );
      } catch(e) { showError('routeList', 5, e.message); }
    }
    async function createRoute() {
      var er=document.getElementById('cErr'),su=document.getElementById('cSuc');
      er.style.display='none';su.style.display='none';
      var name=document.getElementById('routeName').value;
      var code=document.getElementById('routeCode').value;
      if(!name||!code){er.textContent='\u540d\u524d\u3068\u30b3\u30fc\u30c9\u306f\u5fc5\u9808';er.style.display='block';return;}
      try {
        var r=await fetch('/api/entry-routes',{method:'POST',headers:authHeaders(),body:JSON.stringify({name:name,code:code})});
        var d=await r.json();
        if(d.status==='ok'){su.textContent='\u4f5c\u6210\u3057\u307e\u3057\u305f';su.style.display='block';document.getElementById('routeName').value='';document.getElementById('routeCode').value='';loadRoutes();}
        else{er.textContent=d.message||'\u4f5c\u6210\u5931\u6557';er.style.display='block';}
      }catch(e){er.textContent=e.message;er.style.display='block';}
    }
    async function deleteRoute(id) {
      if(!confirm('\u524a\u9664\u3057\u307e\u3059\u304b\uff1f'))return;
      await fetch('/api/entry-routes/'+id,{method:'DELETE',headers:authHeaders()});
      loadRoutes();
    }
    loadRoutes();
    </script>
  `);
}
