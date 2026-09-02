(()=>{
  const hash=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  const token=String(hash.get('nfc')||'').trim();
  if(!token)return;

  const nav=document.querySelector('.tabs');
  const shell=document.querySelector('.shell');
  if(!nav||!shell)return;

  document.body.classList.add('player-hq-mode');

  if(!document.querySelector('link[data-player-hq-style]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/player-hq.css?v=2';
    link.dataset.playerHqStyle='1';
    document.head.appendChild(link);
  }

  const tab=document.createElement('button');
  tab.className='tab player-hq-tab';
  tab.type='button';
  tab.dataset.tab='player';
  tab.textContent='👤 My Day';
  nav.appendChild(tab);

  const panel=document.createElement('section');
  panel.className='tab-panel player-hq-panel';
  panel.dataset.panel='player';
  panel.hidden=true;
  panel.innerHTML='<section class="panel player-hq-loading"><strong>Loading your Game Day…</strong></section>';
  const updated=document.querySelector('#updated-at');
  shell.insertBefore(panel,updated||null);

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtNumber=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const dateParts=value=>{
    if(!value)return{date:'Time TBD',time:''};
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return{date:String(value),time:''};
    return{
      date:d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}),
      time:d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}),
    };
  };
  const fmtTime=value=>{
    const x=dateParts(value);
    return x.time?`${x.date} · ${x.time}`:x.date;
  };
  const statusClass=s=>String(s||'Not Started').toLowerCase().replaceAll(' ','-');

  function activate(){
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('is-active'));
    document.querySelectorAll('.tab-panel').forEach(x=>{x.classList.remove('is-active');x.hidden=true});
    tab.classList.add('is-active');
    panel.classList.add('is-active');
    panel.hidden=false;
  }

  tab.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    activate();
  });

  nav.addEventListener('click',e=>{
    const other=e.target.closest('.tab');
    if(!other||other===tab)return;
    tab.classList.remove('is-active');
    panel.classList.remove('is-active');
    panel.hidden=true;
  },true);

  function resultMarkup(event){
    if(!event.result)return '<span class="player-result pending">Pending</span>';
    return `<span class="player-result">${esc(event.result.medal||'')} ${esc(event.result.label||'Placed')}</span>`;
  }

  function personalDetail(event){
    const p=event.personal;
    if(!p)return '';
    if(p.kind==='two-stage'){
      const bits=[];
      if(p.round1!=null)bits.push(`Round 1: ${fmtNumber(p.round1)}`);
      bits.push(p.advanced?'Advanced to final':'Did not advance');
      if(p.finalScore!=null)bits.push(`Final: ${fmtNumber(p.finalScore)}`);
      return bits.join(' · ');
    }
    if(p.kind==='individual'||p.kind==='pairs')return p.score==null?'':`Score: ${fmtNumber(p.score)}`;
    if(p.kind==='bracket')return p.place?`Finished ${p.place}${p.place===1?'st':p.place===2?'nd':p.place===3?'rd':'th'}`:'Bracket in progress';
    return '';
  }

  function scheduleRow(event){
    const when=dateParts(event.scheduledTime);
    return `<article class="player-schedule-row">
      <div class="player-schedule-top">
        <div class="player-schedule-time"><strong>${esc(when.time||when.date)}</strong>${when.time?`<span>${esc(when.date)}</span>`:''}</div>
        <span class="status-badge ${statusClass(event.status)}">${esc(event.status)}</span>
      </div>
      <div class="player-schedule-main"><strong>#${esc(event.number??'–')} ${esc(event.name)}</strong><span>${esc(event.format||'Event')}</span></div>
      <div class="player-schedule-bottom">${resultMarkup(event)}</div>
    </article>`;
  }

  function render(data){
    const player=data.player||{};
    const summary=data.summary||{};
    const events=data.events||[];
    const next=data.nextEvent;
    const medals=summary.medals||{};
    const nextWhen=next?dateParts(next.scheduledTime):null;

    panel.innerHTML=`
      <section class="player-hq-hero">
        <div class="player-hq-identity">
          <p class="section-kicker">My Game Day</p>
          <h2>${esc(player.name||'Player')}</h2>
          <span class="player-team-pill">${esc(player.team||'Team not assigned yet')}</span>
        </div>
        <div class="player-hq-medals" aria-label="Podium finishes">
          <span><b>🥇</b>${Number(medals.gold||0)}</span><span><b>🥈</b>${Number(medals.silver||0)}</span><span><b>🥉</b>${Number(medals.bronze||0)}</span><span><b>🟤</b>${Number(medals.copper||0)}</span>
        </div>
      </section>

      <section class="player-next-event">
        <div class="player-next-label">NEXT UP</div>
        ${next?`<div class="player-next-event__body">
          <div class="player-next-time"><strong>${esc(nextWhen?.time||nextWhen?.date||'Time TBD')}</strong>${nextWhen?.time?`<span>${esc(nextWhen.date)}</span>`:''}</div>
          <div class="player-next-main"><span>Event ${esc(next.number??'–')}</span><strong>${esc(next.name)}</strong></div>
          <span class="status-badge ${statusClass(next.status)}">${esc(next.status)}</span>
        </div>`:'<p class="player-empty">No remaining registered events.</p>'}
      </section>

      <div class="player-summary-grid">
        <article class="player-summary-card"><strong>${Number(summary.registered||0)}</strong><span>Events</span></article>
        <article class="player-summary-card"><strong>${Number(summary.completed||0)}</strong><span>Done</span></article>
        <article class="player-summary-card"><strong>${Number(summary.podiums||0)}</strong><span>Podiums</span></article>
        <article class="player-summary-card"><strong>${fmtNumber(summary.teamPoints||0)}</strong><span>Team pts</span></article>
      </div>

      <section class="panel player-schedule-panel">
        <div class="player-section-head"><div><p class="section-kicker">Only my events</p><h2>My Schedule</h2></div><strong>${events.length}</strong></div>
        <div class="player-schedule-list">
          ${events.length?events.map(scheduleRow).join(''):'<p class="player-empty">You are not currently registered for any events.</p>'}
        </div>
      </section>

      <section class="panel player-stats-panel">
        <div class="player-section-head"><div><p class="section-kicker">Results & scores</p><h2>My Stats</h2></div></div>
        <div class="player-event-stats">
          ${events.length?events.map(event=>{
            const detail=personalDetail(event);
            const teamPoints=Number(event.teamResult?.points||0);
            return `<article class="player-stat-row">
              <div class="player-stat-head"><div><span>Event ${esc(event.number??'–')}</span><strong>${esc(event.name)}</strong></div>${resultMarkup(event)}</div>
              <div class="player-stat-meta"><span>${esc(event.status)}</span>${detail?`<span>${esc(detail)}</span>`:''}${teamPoints?`<span>+${fmtNumber(teamPoints)} team pts</span>`:''}</div>
            </article>`;
          }).join(''):'<p class="player-empty">Stats will appear here once you are registered for events.</p>'}
        </div>
      </section>`;
  }

  async function load(){
    try{
      const r=await fetch('/api/player-hq',{headers:{'X-Player-NFC':token},cache:'no-store'});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Unable to load your player page.');
      render(data);
    }catch(e){
      panel.innerHTML=`<section class="panel"><h2>Player page unavailable</h2><p class="setup-message">${esc(e.message||'Unable to load this player page.')}</p></section>`;
    }
    requestAnimationFrame(activate);
  }

  load();
})();
