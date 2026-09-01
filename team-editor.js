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
  let events=[];
  let loaded=false;
  let dirty=false;
  let eventEligible=[];
  let eventPairs=[];

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
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('/api/admin/teams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,code,...extra}),signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||'Team editor request failed.');
      return data;
    }catch(err){
      if(err?.name==='AbortError')throw new Error('Team editor request timed out. Refresh and try again.');
      throw err;
    }finally{clearTimeout(timeout)}
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
    grid.innerHTML=shown.map(p=>`<div class="team-editor-row" data-key="${esc(p.key)}"><div><strong>${esc(p.name)}</strong><small>${esc(divisionLabel(p))}${p.key?` · ${esc(p.key)}`:''}</small></div><select aria-label="Team for ${esc(p.name)}"><option value="">Unassigned</option>${TEAMS.map(t=>`<option value="${esc(t)}" ${p.team===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`).join('');
    grid.querySelectorAll('.team-editor-row select').forEach(select=>select.addEventListener('change',()=>{
      const row=select.closest('.team-editor-row');
      const p=participants.find(x=>x.key===row.dataset.key);
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

  function injectEventPairEditor(){
    if(document.querySelector('#event-team-editor'))return;
    const section=document.createElement('section');
    section.id='event-team-editor';
    section.className='panel event-team-editor';
    section.innerHTML=`
      <div class="panel__header panel__header--wrap">
        <div><p class="section-kicker">Event setup</p><h2>Event Team Editor</h2><p class="team-editor-note">Build two-person event teams. A pair can only contain people from the same Olympic team, and both people must be registered for the selected event.</p></div>
        <div class="team-editor-actions"><button id="event-pair-add" class="refresh" type="button">＋ Add Pair</button><button id="event-pair-clear" class="refresh" type="button">Clear Pairs</button><button id="event-pair-save" class="save-score" type="button">Save Event Pairs</button></div>
      </div>
      <div class="event-team-toolbar"><label><span>Event</span><select id="event-team-select"><option value="">Choose an event…</option></select></label><span id="event-team-message" class="team-editor-message"></span></div>
      <div id="event-team-summary" class="event-team-summary">Choose an event to begin.</div>
      <div id="event-pair-grid" class="event-pair-grid"></div>`;
    panel.appendChild(section);
    const style=document.createElement('style');
    style.id='event-team-editor-style';
    style.textContent=`.event-team-editor{margin-top:18px}.event-team-toolbar{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;margin:16px 0}.event-team-toolbar label{display:grid;gap:6px;min-width:min(100%,360px);font-size:.82rem;font-weight:850}.event-team-toolbar select,.event-pair select{min-height:42px;padding:8px 10px;border:1px solid #cbd7e4;border-radius:9px;background:#fff;font:inherit}.event-team-summary{padding:11px 13px;background:#f5f8fc;border-radius:11px;color:#65758a;font-size:.9rem}.event-pair-grid{display:grid;gap:10px;margin-top:12px}.event-pair{display:grid;grid-template-columns:auto minmax(0,1fr) auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:12px;border:1px solid #dbe3ed;border-radius:12px;background:#fff}.event-pair__number{font-weight:950;white-space:nowrap}.event-pair__team{font-size:.78rem;font-weight:900;padding:6px 8px;border-radius:999px;background:#eef3f8;color:#345b82;white-space:nowrap}.event-pair__remove{border:0;background:#f5f8fc;border-radius:9px;min-height:38px;padding:7px 10px;cursor:pointer;font-weight:850}.event-pair__plus{font-weight:950;color:#8190a2}.event-pair-empty{padding:15px;border-radius:11px;background:#f5f8fc;color:#65758a}@media(max-width:760px){.event-pair{grid-template-columns:1fr}.event-pair__plus{display:none}.event-pair__remove{justify-self:start}}`;
    document.head.appendChild(style);
    const eventSelect=section.querySelector('#event-team-select');
    eventSelect.innerHTML='<option value="">Choose an event…</option>'+events.map(e=>`<option value="${esc(e.key)}">#${e.number??'–'} ${esc(e.name)}${String(e.format||'').toLowerCase().includes('pair')?' · Pairs':''}</option>`).join('');
    eventSelect.addEventListener('change',loadEventPairs);
    section.querySelector('#event-pair-add').addEventListener('click',()=>{
      if(!eventSelect.value){setEventMessage('Choose an event first.','error');return;}
      eventPairs.push({member1Key:'',member2Key:''});
      renderEventPairs();
    });
    section.querySelector('#event-pair-clear').addEventListener('click',async()=>{
      if(!eventSelect.value)return;
      if(!confirm('Clear all saved pairs for this event?'))return;
      try{
        await api('saveEventPairs',{eventKey:eventSelect.value,pairs:[]});
        eventPairs=[];setEventMessage('✓ Event pairs cleared','success');renderEventPairs();
      }catch(err){setEventMessage(err.message,'error')}
    });
    section.querySelector('#event-pair-save').addEventListener('click',saveEventPairs);
  }

  function setEventMessage(text,type=''){
    const el=document.querySelector('#event-team-message');
    if(!el)return;el.textContent=text||'';el.className='team-editor-message'+(type?` ${type}`:'');
  }

  function groupedOptions(selected='',allowedTeam=''){
    const groups=TEAMS.map(team=>[team,eventEligible.filter(p=>p.team===team)]).filter(([,xs])=>xs.length);
    return '<option value="">— Choose person —</option>'+groups.filter(([team])=>!allowedTeam||team===allowedTeam).map(([team,people])=>`<optgroup label="${esc(team)}">${people.map(p=>`<option value="${esc(p.key)}" ${p.key===selected?'selected':''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
  }

  function renderEventPairs(){
    const box=document.querySelector('#event-pair-grid');
    const summaryBox=document.querySelector('#event-team-summary');
    if(!box||!summaryBox)return;
    const assigned=eventEligible.length;
    const byKey=new Map(eventEligible.map(p=>[p.key,p]));
    summaryBox.textContent=`${assigned} registered participant${assigned===1?'':'s'} with an Olympic team assignment · ${eventPairs.length} pair${eventPairs.length===1?'':'s'}`;
    if(!eventPairs.length){box.innerHTML='<div class="event-pair-empty">No pairs yet. Press “Add Pair” to create one.</div>';return;}
    box.innerHTML=eventPairs.map((pair,i)=>{
      const a=byKey.get(pair.member1Key)||null,b=byKey.get(pair.member2Key)||null,team=a?.team||b?.team||'';
      return `<div class="event-pair" data-index="${i}"><span class="event-pair__number">Pair ${i+1}</span><select data-member="1" aria-label="First person for pair ${i+1}">${groupedOptions(a?.key||'',team)}</select><span class="event-pair__plus">+</span><select data-member="2" aria-label="Second person for pair ${i+1}">${groupedOptions(b?.key||'',team)}</select><span class="event-pair__team">${esc(team||'Pick a team')}</span><button class="event-pair__remove" type="button">Remove</button></div>`;
    }).join('');
    box.querySelectorAll('.event-pair').forEach(row=>{
      const i=Number(row.dataset.index),sels=row.querySelectorAll('select');
      sels.forEach(sel=>sel.addEventListener('change',()=>{
        const key=sel.value,person=byKey.get(key)||null,which=sel.dataset.member==='1'?'member1Key':'member2Key',other=which==='member1Key'?'member2Key':'member1Key';
        eventPairs[i][which]=key;
        const otherPerson=byKey.get(eventPairs[i][other])||null;
        if(person&&otherPerson&&person.team!==otherPerson.team)eventPairs[i][other]='';
        const keys=eventPairs.flatMap(p=>[p.member1Key,p.member2Key]).filter(Boolean);
        if(key&&keys.filter(x=>x===key).length>1){eventPairs[i][which]='';setEventMessage('A person can only be used once in an event.','error');}
        else setEventMessage('Unsaved event pair changes','warn');
        renderEventPairs();
      }));
      row.querySelector('.event-pair__remove').addEventListener('click',()=>{eventPairs.splice(i,1);setEventMessage('Unsaved event pair changes','warn');renderEventPairs();});
    });
  }

  async function loadEventPairs(){
    const select=document.querySelector('#event-team-select'),box=document.querySelector('#event-pair-grid');
    const key=select?.value||'';
    eventEligible=[];eventPairs=[];setEventMessage('');
    if(!key){if(box)box.innerHTML='';const s=document.querySelector('#event-team-summary');if(s)s.textContent='Choose an event to begin.';return;}
    if(box)box.innerHTML='<div class="event-pair-empty">Loading event pairs…</div>';
    try{
      const data=await api('eventPairs',{eventKey:key});
      eventEligible=data.eligible||[];
      eventPairs=(data.pairs||[]).map(p=>({member1Key:p.member1Key||'',member2Key:p.member2Key||''}));
      renderEventPairs();
    }catch(err){if(box)box.innerHTML=`<div class="event-pair-empty">${esc(err.message)}</div>`;setEventMessage(err.message,'error')}
  }

  async function saveEventPairs(){
    const select=document.querySelector('#event-team-select'),button=document.querySelector('#event-pair-save');
    if(!select?.value){setEventMessage('Choose an event first.','error');return;}
    if(eventPairs.some(p=>!p.member1Key||!p.member2Key)){setEventMessage('Finish both people in every pair before saving.','error');return;}
    button.disabled=true;setEventMessage('Saving event pairs…');
    try{
      await api('saveEventPairs',{eventKey:select.value,pairs:eventPairs});
      setEventMessage(`✓ ${eventPairs.length} pair${eventPairs.length===1?'':'s'} saved`,'success');
      await loadEventPairs();
      setEventMessage(`✓ ${eventPairs.length} pair${eventPairs.length===1?'':'s'} saved`,'success');
    }catch(err){setEventMessage(err.message,'error')}
    finally{button.disabled=false}
  }

  async function load(){
    loaded=true;
    grid.innerHTML='<div class="team-editor-empty">Loading participants…</div>';
    try{
      const data=await api('list');
      participants=data.participants||[];
      events=data.events||[];
      dirty=false;
      setMessage('');
      render();
      injectEventPairEditor();
    }catch(err){
      loaded=false;
      grid.innerHTML=`<div class="team-editor-empty error-text">${esc(err.message)}</div>`;
      setMessage(err.message,'error');
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
        p.team=choices[0];totals[p.team]++;
      });
    }
  }

  tab.addEventListener('click',openPanel);
  filter?.addEventListener('change',render);
  balanceButton?.addEventListener('click',()=>{
    if(!participants.length)return;
    if(!confirm('Auto-balance everyone across Red, Blue, Green, and Gold? This changes the draft only until you press Save Teams.'))return;
    balancedAssignments();dirty=true;setMessage('Balanced draft ready — press Save Teams.','warn');render();
  });
  clearButton?.addEventListener('click',()=>{
    if(!participants.length||!confirm('Set every participant to Unassigned? This changes the draft only until you press Save Teams.'))return;
    participants.forEach(p=>p.team='');dirty=true;setMessage('All participants unassigned in draft — press Save Teams.','warn');render();
  });
  saveButton?.addEventListener('click',async()=>{
    if(!participants.length)return;
    saveButton.disabled=true;setMessage('Saving teams…');
    try{
      await api('save',{assignments:participants.map(p=>({participantKey:p.key,team:p.team||''}))});
      dirty=false;setMessage('✓ Teams saved','success');renderSummary();
      const selected=document.querySelector('#event-team-select')?.value;if(selected)await loadEventPairs();
    }catch(err){setMessage(err.message,'error')}
    finally{saveButton.disabled=false}
  });

  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
})();
