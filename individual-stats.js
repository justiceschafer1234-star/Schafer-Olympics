(()=>{
  const STORAGE_KEY='schaferOlympicsControlCode';
  const TEAM_MAP={red:'Team Red',blue:'Team Blue',green:'Team Green',gold:'Team Gold'};
  const qs=new URLSearchParams(location.search),teamKey=String(qs.get('team')||'').toLowerCase(),team=TEAM_MAP[teamKey]||'';
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  let events=[],current=null,pending=0,saveQueue=Promise.resolve(),latestResponse=null;

  const launcher=$('#team-launcher'),unlock=$('#unlock-panel'),app=$('#stats-app'),unlockForm=$('#unlock-form'),codeInput=$('#control-code'),unlockMessage=$('#unlock-message'),eventSelect=$('#event-select'),players=$('#players'),saveStrip=$('#save-strip');

  if(!team){launcher.hidden=false;return}
  $('#team-title').textContent=team;
  $('#team-pill').textContent=team;
  $('#mvp-hero-subtitle').textContent=`Private ${team} MVP stat entry. This view only loads ${team} participants.`;
  document.body.dataset.team=teamKey;

  async function verify(code){
    const r=await fetch('/api/admin/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),cache:'no-store'}),d=await r.json().catch(()=>({}));
    if(r.status===401)return false;if(!r.ok)throw new Error(d.error||'Could not verify the control code.');return d.ok===true;
  }
  async function api(action,extra={}){
    const code=sessionStorage.getItem(STORAGE_KEY)||'';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const r=await fetch('/api/admin/mvp-stats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,team,action,...extra}),cache:'no-store',signal:controller.signal}),d=await r.json().catch(()=>({}));
      if(!r.ok||!d.ok)throw new Error(d.error||'MVP stats request failed.');return d;
    }catch(e){if(e?.name==='AbortError')throw new Error('MVP stats request timed out.');throw e}finally{clearTimeout(timer)}
  }
  function setSave(text,state=''){saveStrip.textContent=text;saveStrip.className='save-strip'+(state?` is-${state}`:'')}
  function eventIndex(){return Math.max(0,events.findIndex(e=>e.key===eventSelect.value))}
  function setNav(){const i=eventIndex(),locked=pending>0;eventSelect.disabled=locked;$('#previous-event').disabled=locked||!events.length||i<=0;$('#next-event').disabled=locked||!events.length||i>=events.length-1;$('#refresh-event').disabled=locked}
  function eventDescription(e){
    if(!e)return 'Stats and MVP values will appear here.';
    if(e.manual){const bits=(e.metrics||[]).map(m=>`${m.label} ×${fmt(m.weight)}`);return `${bits.join(' · ')}. MVP points are relative to the best raw performance across all teams.`}
    return `${e.modeLabel}. This event reads the official result automatically; there is nothing extra for this team editor to enter.`;
  }
  function renderEventMeta(e){
    $('#event-title').textContent=e?`#${e.number} ${e.name}`:'Choose an event';
    $('#event-description').textContent=eventDescription(e);
    $('#event-mode').textContent=e?.modeLabel||'—';
    $('#event-max').textContent=e?`Max ${fmt(e.maxPoints)} MVP pts`:'—';
    $('#event-max-large').textContent=e?fmt(e.maxPoints):'—';
    setNav();
  }
  function statRow(player,metric){
    const value=Number(player.stats?.[metric.key]||0);
    return `<div class="stat-row"><div class="stat-label"><strong>${esc(metric.label)}</strong><small>Raw value × ${esc(fmt(metric.weight))}</small></div><div class="stat-counter"><button type="button" data-stat="${esc(metric.key)}" data-player="${esc(player.id)}" data-delta="-1" aria-label="Subtract one ${esc(metric.label)} from ${esc(player.name)}">−</button><output>${value}</output><button type="button" data-stat="${esc(metric.key)}" data-player="${esc(player.id)}" data-delta="1" aria-label="Add one ${esc(metric.label)} to ${esc(player.name)}">+</button></div></div>`;
  }
  function playerCard(player,e){
    const score=`${fmt(player.mvpPoints)} / ${fmt(e.maxPoints)}`;
    if(e.manual)return `<article class="player-stat-card" data-player-card="${esc(player.id)}"><div class="player-stat-head"><div><h3>${esc(player.name)}</h3><small>${esc(team)}</small></div><div class="player-mvp-score"><span>MVP POINTS</span><strong>${esc(score)}</strong></div></div><div class="stat-rows">${(e.metrics||[]).map(m=>statRow(player,m)).join('')}</div><div class="raw-line"><span>Raw performance score</span><strong>${esc(fmt(player.rawScore))}</strong></div></article>`;
    const details=(player.details||[]).map(d=>`<span class="auto-chip"><span>${esc(d.label)}</span><strong>${d.key==='finish'||d.key==='team_finish'?esc(String(d.value)):esc(fmt(d.value))}</strong></span>`).join('');
    return `<article class="player-stat-card"><div class="player-stat-head"><div><h3>${esc(player.name)}</h3><small>${esc(team)}</small></div><div class="player-mvp-score"><span>MVP POINTS</span><strong>${esc(score)}</strong></div></div><div class="automatic-note">Calculated automatically from the official event result.</div>${details?`<div class="auto-details">${details}</div>`:''}<div class="raw-line"><span>Performance score</span><strong>${esc(fmt(player.rawScore))}</strong></div></article>`;
  }
  function renderPlayers(){
    const e=current?.event;if(!e){players.innerHTML='';return}
    renderEventMeta(e);
    const list=current.players||[];
    players.innerHTML=list.length?list.map(p=>playerCard(p,e)).join(''):`<div class="empty-state"><strong>No ${esc(team)} players are registered for this event.</strong><br>Nothing to enter in this team view.</div>`;
    if(e.manual)players.querySelectorAll('[data-stat]').forEach(b=>b.addEventListener('click',()=>changeStat(b.dataset.player,b.dataset.stat,Number(b.dataset.delta))));
  }
  async function loadEvent(key,{quiet=false}={}){
    if(!key||pending>0)return;if(!quiet){players.innerHTML='<div class="empty-state">Loading team participants…</div>';setSave('Loading…')}
    try{const d=await api('event',{eventKey:key});current={event:d.event,players:d.players||[]};renderPlayers();if(!quiet)setSave('Ready')}
    catch(e){players.innerHTML=`<div class="error-card">${esc(e.message)}</div>`;setSave(e.message,'error')}
  }
  function changeStat(playerId,statKey,delta){
    if(!current?.event?.manual)return;const p=current.players.find(x=>x.id===playerId);if(!p)return;
    const eventKey=current.event.key,next=Math.max(0,Number(p.stats?.[statKey]||0)+delta);p.stats={...(p.stats||{}),[statKey]:next};pending++;renderPlayers();setSave(`Saving ${pending} change${pending===1?'':'s'}…`,'saving');
    saveQueue=saveQueue.then(async()=>{
      try{latestResponse=await api('setStat',{eventKey,participantId:playerId,statKey,value:next})}
      catch(e){latestResponse=null;setSave(e.message,'error');throw e}
      finally{pending=Math.max(0,pending-1);setNav()}
      if(pending===0&&latestResponse&&current?.event?.key===eventKey){current={event:latestResponse.event,players:latestResponse.players||[]};latestResponse=null;renderPlayers();setSave('✓ All changes saved','saved')}
    }).catch(async()=>{if(pending===0&&current?.event?.key===eventKey)await loadEvent(eventKey,{quiet:true})});
  }
  async function loadApp(){
    app.hidden=false;unlock.hidden=true;setSave('Loading events…');
    try{
      const d=await api('load');events=d.events||[];
      eventSelect.innerHTML=events.length?events.map(e=>`<option value="${esc(e.key)}">#${esc(e.number)} ${esc(e.name)} · ${esc(fmt(e.maxPoints))} max</option>`).join(''):'<option value="">No MVP events found</option>';
      const firstWithPeople=events.find(e=>e.registeredCount>0)||events[0];if(firstWithPeople){eventSelect.value=firstWithPeople.key;await loadEvent(firstWithPeople.key)}else{renderEventMeta(null);setSave('No events found')}
    }catch(e){app.hidden=true;unlock.hidden=false;unlockMessage.textContent=e.message;sessionStorage.removeItem(STORAGE_KEY)}
  }
  async function unlockWith(code){
    unlockMessage.textContent='Checking…';try{if(!await verify(code)){unlockMessage.textContent='Incorrect control code.';return false}sessionStorage.setItem(STORAGE_KEY,code);await loadApp();return true}catch(e){unlockMessage.textContent=e.message;return false}
  }
  unlockForm.addEventListener('submit',async e=>{e.preventDefault();await unlockWith(codeInput.value.trim())});
  eventSelect.addEventListener('change',()=>loadEvent(eventSelect.value));
  $('#previous-event').addEventListener('click',()=>{const i=eventIndex();if(pending===0&&i>0){eventSelect.value=events[i-1].key;loadEvent(eventSelect.value)}});
  $('#next-event').addEventListener('click',()=>{const i=eventIndex();if(pending===0&&i<events.length-1){eventSelect.value=events[i+1].key;loadEvent(eventSelect.value)}});
  $('#refresh-event').addEventListener('click',()=>{if(pending===0)loadEvent(eventSelect.value)});

  const saved=sessionStorage.getItem(STORAGE_KEY)||'';
  if(saved){verify(saved).then(ok=>{if(ok)loadApp();else{sessionStorage.removeItem(STORAGE_KEY);unlock.hidden=false}}).catch(()=>{sessionStorage.removeItem(STORAGE_KEY);unlock.hidden=false})}
  else unlock.hidden=false;
})();
