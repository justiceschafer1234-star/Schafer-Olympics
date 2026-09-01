(()=>{
  const body=document.body;
  const adminTab=document.querySelector('.admin-tab');
  const adminPanel=document.querySelector('[data-panel="admin"]');
  const adminCode=document.querySelector('#admin-code');
  const controlButton=document.querySelector('#control-mode-button');
  const modeLabel=document.querySelector('#view-mode-label');
  const logoutButton=document.querySelector('#control-mode-exit');
  const STORAGE_KEY='schaferOlympicsControlCode';
  const PAIR_KEY='schaferOlympicsPairings:';
  let registrationData=null;
  let pairMakerReady=false;

  function setViewer(){
    body.classList.add('viewer-mode');
    body.classList.remove('control-mode');
    if(modeLabel)modeLabel.textContent='Viewing View · Read Only';
    if(controlButton){controlButton.hidden=false;controlButton.textContent='🔐 Control';}
    if(logoutButton)logoutButton.hidden=true;
    if(adminCode)adminCode.value='';
    if(adminPanel&&!adminPanel.hidden){
      adminPanel.hidden=true;
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('is-active'));
      document.querySelectorAll('.tab-panel').forEach(p=>{p.hidden=true;p.classList.remove('is-active')});
      const overviewTab=document.querySelector('[data-tab="overview"]');
      const overviewPanel=document.querySelector('[data-panel="overview"]');
      if(overviewTab)overviewTab.classList.add('is-active');
      if(overviewPanel){overviewPanel.hidden=false;overviewPanel.classList.add('is-active');}
    }
  }

  function setControl(code){
    body.classList.remove('viewer-mode');
    body.classList.add('control-mode');
    if(modeLabel)modeLabel.textContent='Control View · Unlocked';
    if(controlButton)controlButton.hidden=true;
    if(logoutButton)logoutButton.hidden=false;
    if(adminCode)adminCode.value=code;
    setupPairMaker();
    window.dispatchEvent(new CustomEvent('schafer-control-unlocked',{detail:{code}}));
  }

  async function verify(code){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch('/api/admin/verify',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({code}),
        signal:controller.signal,
        cache:'no-store'
      });
      const data=await response.json().catch(()=>({}));
      if(response.status===401)return false;
      if(!response.ok)throw new Error(data.error||`Control verification failed (${response.status}).`);
      return data.ok===true;
    }catch(err){
      if(err?.name==='AbortError')throw new Error('Control verification timed out. The newest Worker may not be deployed yet.');
      throw err;
    }finally{
      clearTimeout(timer);
    }
  }

  async function unlock(){
    const code=prompt('Enter the private control code:');
    if(code===null)return;
    if(!code.trim()){alert('Enter the control code.');return;}
    if(controlButton){controlButton.disabled=true;controlButton.textContent='Checking…';}
    try{
      const ok=await verify(code);
      if(!ok){alert('Incorrect control code.');return;}
      sessionStorage.setItem(STORAGE_KEY,code);
      setControl(code);
    }catch(err){
      alert(err.message||'Could not verify the control code.');
    }finally{
      if(controlButton){controlButton.disabled=false;if(!body.classList.contains('control-mode'))controlButton.textContent='🔐 Control';}
    }
  }

  async function restore(){
    const code=sessionStorage.getItem(STORAGE_KEY);
    if(!code)return;
    try{
      if(await verify(code))setControl(code);
      else sessionStorage.removeItem(STORAGE_KEY);
    }catch{sessionStorage.removeItem(STORAGE_KEY);}
  }

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};

  function injectPairStyles(){
    if(document.querySelector('#pair-maker-styles'))return;
    const style=document.createElement('style');
    style.id='pair-maker-styles';
    style.textContent=`
      .pair-maker{margin-top:18px}.pair-maker__head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.pair-maker__head h2{margin:2px 0 4px}.pair-maker__note{margin:0;color:#65758a;font-size:.88rem}.pair-maker__controls{display:grid;grid-template-columns:minmax(220px,1fr) auto auto auto;gap:10px;align-items:end;margin-top:16px}.pair-maker__controls label{display:grid;gap:6px;font-size:.82rem;font-weight:850}.pair-maker__controls select{min-height:44px;padding:9px 11px;border:1px solid #cbd7e4;border-radius:10px;background:#fff;font:inherit}.pair-maker__button{min-height:44px;padding:9px 13px;border:0;border-radius:10px;background:#244b73;color:#fff;font:inherit;font-weight:900;cursor:pointer}.pair-maker__button.secondary{background:#eef3f8;color:#244b73}.pair-maker__summary{margin:12px 0 0;color:#65758a;font-size:.88rem}.pair-maker__teams{display:grid;gap:10px;margin-top:14px}.pair-team{display:grid;grid-template-columns:auto minmax(0,1fr) auto minmax(0,1fr);gap:9px;align-items:center;padding:11px;border:1px solid #dbe3ed;border-radius:12px;background:#f8fafc}.pair-team strong{white-space:nowrap}.pair-team select{width:100%;min-height:42px;padding:8px;border:1px solid #cbd7e4;border-radius:9px;background:#fff;font:inherit}.pair-team__plus{font-weight:900;color:#8190a2}.pair-maker__empty{padding:14px;border-radius:11px;background:#f5f8fc;color:#65758a}.pair-maker__unpaired{padding:11px;border-radius:11px;background:#fff4db;font-weight:850}@media(max-width:700px){.pair-maker__controls{grid-template-columns:1fr 1fr}.pair-maker__controls label{grid-column:1/-1}.pair-team{grid-template-columns:1fr}.pair-team__plus{display:none}}
    `;
    document.head.appendChild(style);
  }

  function pairStorageKey(eventId){return PAIR_KEY+eventId;}
  function savePairs(eventId,pairs){localStorage.setItem(pairStorageKey(eventId),JSON.stringify(pairs));}
  function loadPairs(eventId){try{return JSON.parse(localStorage.getItem(pairStorageKey(eventId))||'null');}catch{return null;}}

  function registeredFor(eventId){
    if(!registrationData)return[];
    return registrationData.participants.filter(p=>(p.registeredEventIds||[]).includes(eventId));
  }

  function makePairs(participants){
    const mixed=shuffle(participants.map(p=>({id:p.id,name:p.name})));
    const pairs=[];
    for(let i=0;i<mixed.length;i+=2)pairs.push([mixed[i]||null,mixed[i+1]||null]);
    return pairs;
  }

  function normalizeSaved(saved,participants){
    if(!Array.isArray(saved))return null;
    const byId=new Map(participants.map(p=>[p.id,{id:p.id,name:p.name}]));
    const used=new Set();
    const out=[];
    for(const pair of saved){
      if(!Array.isArray(pair))continue;
      const row=pair.slice(0,2).map(x=>x&&byId.get(x.id)?byId.get(x.id):null);
      row.forEach(x=>{if(x)used.add(x.id)});
      if(row[0]||row[1])out.push(row);
    }
    for(const p of participants)if(!used.has(p.id)){
      let slot=out.find(x=>!x[0]||!x[1]);
      if(!slot){slot=[null,null];out.push(slot);}
      if(!slot[0])slot[0]={id:p.id,name:p.name};else slot[1]={id:p.id,name:p.name};
    }
    return out;
  }

  function renderPairs(eventId,pairs){
    const box=document.querySelector('#pair-maker-teams');
    const summary=document.querySelector('#pair-maker-summary');
    const participants=registeredFor(eventId);
    if(!box||!summary)return;
    if(!eventId){summary.textContent='Choose a pairs event.';box.innerHTML='';return;}
    summary.textContent=`${participants.length} registered participant${participants.length===1?'':'s'} · ${Math.floor(participants.length/2)} full pair${Math.floor(participants.length/2)===1?'':'s'}${participants.length%2?' · 1 unpaired':''}`;
    if(!participants.length){box.innerHTML='<div class="pair-maker__empty">Nobody is registered for this event yet.</div>';return;}
    const options=(selected,other)=>'<option value="">— Unassigned —</option>'+participants.map(p=>`<option value="${esc(p.id)}" ${selected===p.id?'selected':''} ${other===p.id?'disabled':''}>${esc(p.name)}</option>`).join('');
    box.innerHTML=pairs.map((pair,i)=>{
      const a=pair?.[0]||null,b=pair?.[1]||null;
      if(a&&!b&&i===pairs.length-1)return `<div class="pair-team" data-pair="${i}"><strong>Pair ${i+1}</strong><select data-slot="0">${options(a.id,'')}</select><span class="pair-team__plus">+</span><select data-slot="1">${options('',a.id)}</select></div><div class="pair-maker__unpaired">Waiting for one more partner.</div>`;
      return `<div class="pair-team" data-pair="${i}"><strong>Pair ${i+1}</strong><select data-slot="0">${options(a?.id||'',b?.id||'')}</select><span class="pair-team__plus">+</span><select data-slot="1">${options(b?.id||'',a?.id||'')}</select></div>`;
    }).join('');
    box.querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>{
      const rows=[...box.querySelectorAll('.pair-team')];
      const byId=new Map(participants.map(p=>[p.id,{id:p.id,name:p.name}]));
      const next=rows.map(row=>{
        const sels=row.querySelectorAll('select');
        return [byId.get(sels[0].value)||null,byId.get(sels[1].value)||null];
      });
      const ids=next.flat().filter(Boolean).map(x=>x.id);
      if(new Set(ids).size!==ids.length){alert('Each person can only be used once.');renderPairs(eventId,pairs);return;}
      savePairs(eventId,next);
      renderPairs(eventId,next);
    }));
  }

  async function setupPairMaker(){
    if(pairMakerReady)return;
    pairMakerReady=true;
    injectPairStyles();
    const host=adminPanel?.querySelector('.admin-panel')||adminPanel;
    if(!host)return;
    const section=document.createElement('section');
    section.className='panel pair-maker';
    section.innerHTML=`<div class="pair-maker__head"><div><p class="section-kicker">Pairs organizer</p><h2>Quick Pair Team Maker</h2><p class="pair-maker__note">Uses the people registered for the event. Pairings are saved on this device.</p></div></div><div class="pair-maker__controls"><label><span>Pairs event</span><select id="pair-maker-event"><option value="">Loading pairs events…</option></select></label><button id="pair-maker-shuffle" class="pair-maker__button" type="button">🔀 Shuffle Pairs</button><button id="pair-maker-copy" class="pair-maker__button secondary" type="button">📋 Copy</button><button id="pair-maker-clear" class="pair-maker__button secondary" type="button">Clear</button></div><p id="pair-maker-summary" class="pair-maker__summary"></p><div id="pair-maker-teams" class="pair-maker__teams"></div>`;
    host.insertAdjacentElement('afterend',section);
    const eventSelect=section.querySelector('#pair-maker-event');
    const shuffleButton=section.querySelector('#pair-maker-shuffle');
    const clearButton=section.querySelector('#pair-maker-clear');
    const copyButton=section.querySelector('#pair-maker-copy');
    try{
      const response=await fetch('/api/registration');
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not load registrations.');
      registrationData=data;
      const pairEvents=data.events.filter(e=>String(e.format||'').toLowerCase().includes('pair'));
      eventSelect.innerHTML='<option value="">Choose a pairs event…</option>'+pairEvents.map(e=>`<option value="${esc(e.id)}">#${e.number??'–'} ${esc(e.name)}</option>`).join('');
      if(!pairEvents.length){eventSelect.innerHTML='<option value="">No events marked Pairs</option>';eventSelect.disabled=true;}
    }catch(err){
      eventSelect.innerHTML=`<option value="">${esc(err.message||'Could not load')}</option>`;
      eventSelect.disabled=true;
    }
    eventSelect.addEventListener('change',()=>{
      const id=eventSelect.value,people=registeredFor(id),saved=normalizeSaved(loadPairs(id),people);
      const pairs=saved||makePairs(people);
      if(id&&!saved)savePairs(id,pairs);
      renderPairs(id,pairs);
    });
    shuffleButton.addEventListener('click',()=>{
      const id=eventSelect.value;if(!id){alert('Choose a pairs event first.');return;}
      const pairs=makePairs(registeredFor(id));savePairs(id,pairs);renderPairs(id,pairs);
    });
    clearButton.addEventListener('click',()=>{
      const id=eventSelect.value;if(!id)return;
      localStorage.removeItem(pairStorageKey(id));renderPairs(id,[]);
    });
    copyButton.addEventListener('click',async()=>{
      const id=eventSelect.value;if(!id){alert('Choose a pairs event first.');return;}
      const event=registrationData.events.find(e=>e.id===id),pairs=normalizeSaved(loadPairs(id),registeredFor(id))||[];
      const lines=[event?`#${event.number??'–'} ${event.name}`:'Pairs'];
      pairs.forEach((p,i)=>lines.push(`Pair ${i+1}: ${(p[0]?.name||'TBD')} + ${(p[1]?.name||'TBD')}`));
      try{await navigator.clipboard.writeText(lines.join('\n'));copyButton.textContent='✓ Copied';setTimeout(()=>copyButton.textContent='📋 Copy',1200);}catch{alert(lines.join('\n'));}
    });
  }

  setViewer();
  controlButton?.addEventListener('click',unlock);
  logoutButton?.addEventListener('click',()=>{sessionStorage.removeItem(STORAGE_KEY);setViewer();});
  restore();
})();
