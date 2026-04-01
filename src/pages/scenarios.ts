import { getShellHtml } from './shared-shell';

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
    let allScenarios = [];
    function toggleCreate() { const f=document.getElementById('createForm'); f.style.display=f.style.display==='none'?'block':'none'; }
    async function loadScenarios() {
      try {
        const d = await fetchJson('/lh/api/scenarios');
        allScenarios = d.data || d.scenarios || [];
        const items = d.data || d.scenarios || [];
        showList('scenarioList', items, 5, '\u30b7\u30ca\u30ea\u30aa\u304c\u3042\u308a\u307e\u305b\u3093', list =>
          list.map(s =>
            '<tr onclick="showDetail(\\\''+s.id+'\\\')" style="cursor:pointer"><td>'+esc(s.name)+'</td>' +
            '<td><span class="badge badge-active">'+(s.triggerType||s.trigger_type)+'</span></td>' +
            '<td><span class="badge '+((s.isActive!==undefined?s.isActive:s.status==='active')?'badge-active':'badge-admin')+'">'+(s.isActive!==undefined?(s.isActive?'active':'inactive'):s.status)+'</span></td>' +
            '<td>'+(s.createdAt||s.created_at||'').substring(0,10)+'</td>' +
            '<td><button class="btn btn-primary" onclick="event.stopPropagation();showDetail(\\\''+s.id+'\\\')" style="padding:4px 12px;font-size:12px">\u8a73\u7d30</button></td></tr>'
          ).join('')
        );
      } catch(e) {
        showError('scenarioList', 5, e.message);
      }
    }
    async function createScenario() {
      const er=document.getElementById('createError'),su=document.getElementById('createSuccess');
      if(!requireTenantForCreate()){er.textContent='\u30c6\u30ca\u30f3\u30c8\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044';er.style.display='block';return;}er.style.display='none';su.style.display='none';
      const name=document.getElementById('scenarioName').value;
      const trigger=document.getElementById('triggerType').value;
      const desc=document.getElementById('scenarioDesc').value;
      if(!name){er.textContent='\u30b7\u30ca\u30ea\u30aa\u540d\u306f\u5fc5\u9808';er.style.display='block';return;}
      try {
        const r=await fetch('/api/scenarios',{method:'POST',headers:authHeaders(),body:JSON.stringify({name,trigger_type:trigger,description:desc||undefined,tenant_id:getSelectedTenantId()||undefined})});
        const d=await r.json();
        if(d.status==='ok'){su.textContent='\u4f5c\u6210\u3057\u307e\u3057\u305f';su.style.display='block';document.getElementById('scenarioName').value='';document.getElementById('scenarioDesc').value='';loadScenarios();}
        else{er.textContent=d.message;er.style.display='block';}
      }catch(e){er.textContent=e.message;er.style.display='block';}
    }
    async function showDetail(id) {
      currentScenarioId = id;
      try {
        const s = allScenarios.find(function(x) { return x.id === id; }) || {};
        const stepsRes = await fetch('/api/scenarios/' + id + '/steps', { headers: authHeaders() });
        const str = stepsRes.ok ? await stepsRes.json() : { steps: [] };
        document.getElementById('detailTitle').textContent = s.name || id;
        document.getElementById('detailInfo').innerHTML = '<span class="badge badge-active">'+(s.triggerType||s.trigger_type||'-')+'</span> <span class="badge '+(s.isActive||s.status==='active'?'badge-active':'badge-admin')+'">'+(s.isActive!==undefined?(s.isActive?'active':'draft'):(s.status||'draft'))+'</span> <button class="btn" style="padding:2px 8px;font-size:11px;background:#ffebee;color:#c62828;border:none;border-radius:4px;cursor:pointer;margin-left:8px" onclick="deleteScenario()">削除</button>';
        const steps = str.data || str.steps || [];
        if(steps.length===0){document.getElementById('stepList').innerHTML='<tr><td colspan="5" style="color:#999">\u30b9\u30c6\u30c3\u30d7\u306a\u3057</td></tr>';}
        else{document.getElementById('stepList').innerHTML=steps.map(function(st){return '<tr><td>'+(st.stepOrder||st.step_order)+'</td><td>'+(st.delayMinutes||st.delay_minutes||0)+'</td><td>'+(st.messageType||st.message_type||'text')+'</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">'+esc(st.messageContent||st.message_content)+'</td><td>'+(st.goalLabel||st.goal_label||'-')+'</td></tr>'}).join('');}
        document.getElementById('detailPanel').style.display='block';
        document.getElementById('stepOrder').value = steps.length+1;
      }catch(e){alert('詳細の取得に失敗: '+e.message);}
    }
    async function deleteScenario() {
      if(!currentScenarioId) return;
      if(!confirm('このシナリオを削除しますか？')) return;
      try {
        const r = await fetch('/api/scenarios/'+currentScenarioId, {method:'DELETE', headers:authHeaders()});
        if(r.ok || r.status === 200) { document.getElementById('detailPanel').style.display='none'; loadScenarios(); }
        else { alert('削除に失敗しました'); }
      } catch(e) { alert('エラー: '+e.message); }
    }
    async function addStep() {
      const er=document.getElementById('stepError'),su=document.getElementById('stepSuccess');
      if(!requireTenantForCreate()){er.textContent='\u30c6\u30ca\u30f3\u30c8\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044';er.style.display='block';return;}er.style.display='none';su.style.display='none';
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
