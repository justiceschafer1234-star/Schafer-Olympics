(()=>{
  const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
  const STORAGE_KEY='schaferOlympicsControlCode';
  const tab=document.querySelector('[data-tab="teams"]');
  const panel=document.querySelector('[data-panel="teams"]');
  const grid=document.querySelector('#team-editor-grid');
  const summary=document.querySelector('#team-editor-summary');
  const message=document.querySelector('#team-editor-message');
  const saveButton=document.querySelector('#team-editor-save');
  const balanceButton=document.querySelector('#team-editor-balance');
  const clearButton=document.querySelector('#team-editor-clear');
  const filter=document.querySelector('#team-editor-filter');
  if(!tab||!panel||!grid)return;

  let participants=[];
  let loaded=false;
  let dirty=false;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
  const divisionLabel=p=>(p.divisions||[]).join(' / ')||'—';

  function openPanel(){
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('is-active'));
    document.querySelectorAll('.tab-panel').forEach(p=>{p.hidden=true;p.classList.remove('is-active')});
    tab.classList.add('is-active');
    panel.hidden=false;
    panel.classList.add('is-active');
    if(!loaded)load();
  }

  async function api(action,extra={}){
    const code=sessionStorage.getItem(STORAGE_KEY)||'';
    if(!code)throw new Error('Control View is locked.');
    const response=await fetch('/api/admin/teams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,code,...extra})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw new Error(data.error||'Team editor request failed.');
    return data;
  }

  function counts(){
    return TEAMS.map(team=>{
      const people=participants.filter(p=>p.team===team);
      const men=people.filter(p=>(p.divisions||[]).includes('Man')).length;
      const women=people.filter(p=>(p.divisions||[]).includes('Woman')).length;
      const kids=people.filter(p=>(p.divisions||[]).includes('Kid')).length;
      return {team,total:people.length,men,women,kids};
    });
  }

  function renderSummary(){
    const assigned=participants.filter(p=>p.team).length;
    const cards=counts().map(c=>`<div class="team-editor-card ${c.team.toLowerCase().replaceAll(' ','-')}"><strong>${esc(c.team.replace('Team ',''))}</strong><span>${c.total}</span><small>${c.men} men · ${c.women} women · ${c.kids} kids</small></div>`).join('');
    summary.innerHTML=`<div class="team-editor-countline"><strong>${assigned}/${participants.length} assigned</strong><span>${participants.length-assigned} unassigned</span></div><div class="team-editor-cards">${cards}</div>`;
  }

  function render(){
    renderSummary();
    const mode=filter?.value||'all';
    const shown=participants.filter(p=>mode==='unassigned'?!p.team:mode==='assigned'?!!p.team:true);
    if(!shown.length){grid.innerHTML='<div class="team-editor-empty">No participants match this filter.</div>';return;}
    grid.innerHTML=shown.map(p=>`<div class="team-editor-row" data-id="${esc(p.id)}"><div><strong>${esc(p.name)}</strong><small>${esc(divisionLabel(p))}</small></div><select aria-label="Team for ${esc(p.name)}"><option value="">Unassigned</option>${TEAMS.map(t=>`<option value="${esc(t)}" ${p.team===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`).join('');
    grid.querySelectorAll('.team-editor-row select').forEach(select=>select.addEventListener('change',()=>{
      const row=select.closest('.team-editor-row');
      const p=participants.find(x=>x.id===row.dataset.id);
      if(p)p.team=select.value;
      dirty=true;
      setMessage('Unsaved changes','warn');
      renderSummary();
    }));
  }

  function setMessage(text,type=''){
    message.textContent=text||'';
    message.className='team-editor-message'+(type?` ${type}`:'');
  }

  async function load(){
    loaded=true;
    grid.innerHTML='<div class="team-editor-empty">Loading participants…</div>';
    try{
      const data=await api('list');
      participants=data.participants||[];
      dirty=false;
      setMessage('');
      render();
    }catch(err){
      loaded=false;
      grid.innerHTML=`<div class="team-editor-empty error-text">${esc(err.message)}</div>`;
    }
  }

  function balancedAssignments(){
    const groups=new Map();
    participants.forEach(p=>{
      const key=(p.divisions||[]).slice().sort().join('|')||'Other';
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(p);
    });
    const totals=Object.fromEntries(TEAMS.map(t=>[t,0]));
    for(const people of groups.values()){
      const mixed=shuffle(people);
      mixed.forEach(p=>{
        const lowest=Math.min(...TEAMS.map(t=>totals[t]));
        const choices=shuffle(TEAMS.filter(t=>totals[t]===lowest));
        p.team=choices[0];
        totals[p.team]++;
      });
    }
  }

  tab.addEventListener('click',openPanel);
  filter?.addEventListener('change',render);
  balanceButton?.addEventListener('click',()=>{
    if(!participants.length)return;
    if(!confirm('Auto-balance everyone across Red, Blue, Green, and Gold? This changes the draft only until you press Save Teams.'))return;
    balancedAssignments();
    dirty=true;
    setMessage('Balanced draft ready — press Save Teams.','warn');
    render();
  });
  clearButton?.addEventListener('click',()=>{
    if(!participants.length||!confirm('Set every participant to Unassigned? This changes the draft only until you press Save Teams.'))return;
    participants.forEach(p=>p.team='');
    dirty=true;
    setMessage('All participants unassigned in draft — press Save Teams.','warn');
    render();
  });
  saveButton?.addEventListener('click',async()=>{
    if(!participants.length)return;
    saveButton.disabled=true;
    setMessage('Saving teams…');
    try{
      await api('save',{assignments:participants.map(p=>({participantId:p.id,team:p.team||''}))});
      dirty=false;
      setMessage('✓ Teams saved','success');
      renderSummary();
    }catch(err){setMessage(err.message,'error');}
    finally{saveButton.disabled=false;}
  });

  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
})();
