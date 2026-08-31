(()=>{
  const els={
    status:document.querySelector('#status-message'),total:document.querySelector('#stat-total'),registered:document.querySelector('#stat-registered'),unregistered:document.querySelector('#stat-unregistered'),entries:document.querySelector('#stat-entries'),average:document.querySelector('#stat-average'),divisionSummary:document.querySelector('#division-summary'),rows:document.querySelector('#participant-rows'),count:document.querySelector('#participant-count'),eventSummary:document.querySelector('#event-summary'),search:document.querySelector('#participant-search'),registrationFilter:document.querySelector('#registration-filter'),divisionFilter:document.querySelector('#division-filter'),refresh:document.querySelector('#refresh-dashboard')
  };
  let data={participants:[],events:[]};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eventMap=()=>new Map(data.events.map(e=>[e.id,e]));
  const divisionNames={Man:'Men',Woman:'Women',Kid:'Kids'};

  function stats(){
    const total=data.participants.length;
    const registered=data.participants.filter(p=>p.registeredEventIds.length>0).length;
    const entries=data.participants.reduce((sum,p)=>sum+p.registeredEventIds.length,0);
    els.total.textContent=total;
    els.registered.textContent=registered;
    els.unregistered.textContent=total-registered;
    els.entries.textContent=entries;
    els.average.textContent=registered?(entries/registered).toFixed(1):'0.0';
  }

  function divisions(){
    const counts={};
    for(const p of data.participants)for(const d of p.divisions||[])counts[d]=(counts[d]||0)+1;
    const keys=Object.keys(counts).sort((a,b)=>(divisionNames[a]||a).localeCompare(divisionNames[b]||b));
    els.divisionSummary.innerHTML=keys.length?keys.map(k=>`<article class="division-card"><span>${esc(divisionNames[k]||k)}</span><strong>${counts[k]}</strong></article>`).join(''):'<p class="empty-state">No division data available.</p>';
    els.divisionFilter.innerHTML='<option value="all">All divisions</option>'+keys.map(k=>`<option value="${esc(k)}">${esc(divisionNames[k]||k)}</option>`).join('');
  }

  function participants(){
    const q=els.search.value.trim().toLowerCase(),rf=els.registrationFilter.value,df=els.divisionFilter.value,map=eventMap();
    const filtered=data.participants.filter(p=>{
      const registered=p.registeredEventIds.length>0;
      if(q&&!p.name.toLowerCase().includes(q))return false;
      if(rf==='registered'&&!registered)return false;
      if(rf==='unregistered'&&registered)return false;
      if(df!=='all'&&!(p.divisions||[]).includes(df))return false;
      return true;
    });
    els.rows.innerHTML=filtered.length?filtered.map(p=>{
      const names=p.registeredEventIds.map(id=>map.get(id)).filter(Boolean).map(e=>`#${e.number??'–'} ${e.name}`);
      return `<tr><td><strong>${esc(p.name)}</strong></td><td>${(p.divisions||[]).map(d=>esc(divisionNames[d]||d)).join(', ')||'—'}</td><td><span class="status-pill ${names.length?'is-registered':'is-unregistered'}">${names.length?'Registered':'Not registered'}</span></td><td>${names.length}</td><td>${names.length?names.map(n=>`<span class="event-chip">${esc(n)}</span>`).join(' '):'<span class="muted">None yet</span>'}</td></tr>`;
    }).join(''):'<tr><td colspan="5" class="empty-cell">No participants match these filters.</td></tr>';
    els.count.textContent=`Showing ${filtered.length} of ${data.participants.length} participants`;
  }

  function events(){
    const counts=new Map(data.events.map(e=>[e.id,0]));
    for(const p of data.participants)for(const id of p.registeredEventIds)counts.set(id,(counts.get(id)||0)+1);
    const ordered=[...data.events].sort((a,b)=>(counts.get(b.id)||0)-(counts.get(a.id)||0)||Number(a.number||999)-Number(b.number||999));
    const max=Math.max(1,...ordered.map(e=>counts.get(e.id)||0));
    els.eventSummary.innerHTML=ordered.length?ordered.map(e=>{const n=counts.get(e.id)||0;return `<article class="event-row"><div class="event-title"><strong>#${esc(e.number??'–')} ${esc(e.name)}</strong><span>${esc(e.format||'Event')}</span></div><div class="event-meter"><div class="event-meter-fill" style="width:${Math.round((n/max)*100)}%"></div></div><strong class="event-count">${n}</strong></article>`}).join(''):'<p class="empty-state">No events available.</p>';
  }

  function render(){stats();divisions();participants();events();}

  async function load(){
    els.status.hidden=false;els.status.textContent='Loading registration data…';els.refresh.disabled=true;
    try{
      const r=await fetch('/api/registration',{cache:'no-store'}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Unable to load registration data.');
      data={participants:Array.isArray(d.participants)?d.participants:[],events:Array.isArray(d.events)?d.events:[]};
      render();
      els.status.textContent=`Updated ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
      setTimeout(()=>{els.status.hidden=true},1800);
    }catch(e){els.status.hidden=false;els.status.textContent=e.message;}
    finally{els.refresh.disabled=false;}
  }
  els.search.addEventListener('input',participants);
  els.registrationFilter.addEventListener('change',participants);
  els.divisionFilter.addEventListener('change',participants);
  els.refresh.addEventListener('click',load);
  load();
})();
