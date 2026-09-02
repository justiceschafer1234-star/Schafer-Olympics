(()=>{
  const hash=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  const token=String(hash.get('nfc')||'').trim();
  if(!token)return;

  const nav=document.querySelector('.tabs');
  const shell=document.querySelector('.shell');
  if(!nav||!shell)return;

  if(!document.querySelector('link[data-player-hq-style]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/player-hq.css?v=1';
    link.dataset.playerHqStyle='1';
    document.head.appendChild(link);
  }

  const tab=document.createElement('button');
  tab.className='tab player-hq-tab';
  tab.type='button';
  tab.dataset.tab='player';
  tab.textContent='👤 My Stats';
  nav.appendChild(tab);

  const panel=document.createElement('section');
  panel.className='tab-panel player-hq-panel';
  panel.dataset.panel='player';
  panel.hidden=true;
  panel.innerHTML='<section class="panel player-hq-loading"><strong>Loading your Game Day HQ…</strong></section>';
  const updated=document.querySelector('#updated-at');
  shell.insertBefore(panel,updated||null);

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtNumber=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const fmtTime=value=>{
    if(!value)return 'Time TBD';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return String(value);
    return d.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
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
    if(p.kind==='individual'||p.kind==='pairs')return p.score==null?'':`Recorded score: ${fmtNumber(p.score)}`;
    if(p.kind==='bracket')return p.place?`Finished ${p.place}${p.place===1?'st':p.place===2?'nd':p.place===3?'rd':'th'}`:'Bracket in progress';
    return '';
  }

  function render(data){
    const player=data.player||{};
    const summary=data.summary||{};
    const events=data.events||[];
    const next=data.nextEvent;
    const medals=summary.medals||{};

    panel.innerHTML=`
      <section class="player-hq-hero">
        <div>
          <p class="section-kicker">NFC Player Pass</p>
          <h2>${esc(player.name||'Player')}’s Game Day</h2>
          <p>${esc(player.team||'Olympic team not assigned yet')}</p>
        </div>
        <div class="player-hq-medals" aria-label="Player podium count">
          <span>🥇 ${Number(medals.gold||0)}</span><span>🥈 ${Number(medals.silver||0)}</span><span>🥉 ${Number(medals.bronze||0)}</span><span>🟤 ${Number(medals.copper||0)}</span>
        </div>
      </section>

      <div class="player-summary-grid">
        <article class="panel player-summary-card"><strong>${Number(summary.registered||0)}</strong><span>My events</span></article>
        <article class="panel player-summary-card"><strong>${Number(summary.completed||0)}</strong><span>Completed</span></article>
        <article class="panel player-summary-card"><strong>${Number(summary.podiums||0)}</strong><span>Podium finishes</span></article>
        <article class="panel player-summary-card"><strong>${fmtNumber(summary.teamPoints||0)}</strong><span>Team pts from my events</span></article>
      </div>

      <section class="panel player-next-event">
        <div class="panel__header"><div><p class="section-kicker">Up next</p><h2>My Next Event</h2></div></div>
        ${next?`<div class="player-next-event__body"><div><strong>#${esc(next.number??'–')} ${esc(next.name)}</strong><span>${esc(fmtTime(next.scheduledTime))}</span></div><span class="status-badge ${statusClass(next.status)}">${esc(next.status)}</span></div>`:'<p class="player-empty">No remaining registered events.</p>'}
      </section>

      <section class="panel player-schedule-panel">
        <div class="panel__header"><div><p class="section-kicker">Personal itinerary</p><h2>My Schedule</h2></div><strong>${events.length} event${events.length===1?'':'s'}</strong></div>
        <div class="player-schedule-list">
          ${events.length?events.map(event=>`<article class="player-schedule-row">
            <div class="player-schedule-time">${esc(fmtTime(event.scheduledTime))}</div>
            <div class="player-schedule-main"><strong>#${esc(event.number??'–')} ${esc(event.name)}</strong><span>${esc(event.format||'Event')}</span></div>
            <span class="status-badge ${statusClass(event.status)}">${esc(event.status)}</span>
            ${resultMarkup(event)}
          </article>`).join(''):'<p class="player-empty">You are not currently registered for any events.</p>'}
        </div>
      </section>

      <section class="panel player-stats-panel">
        <div class="panel__header"><div><p class="section-kicker">Results & scores</p><h2>My Event Stats</h2></div></div>
        <div class="player-event-stats">
          ${events.length?events.map(event=>{
            const detail=personalDetail(event);
            const teamPoints=Number(event.teamResult?.points||0);
            return `<article class="player-stat-row"><div class="player-stat-head"><div><span>Event ${esc(event.number??'–')}</span><strong>${esc(event.name)}</strong></div>${resultMarkup(event)}</div><div class="player-stat-meta"><span>${esc(event.status)}</span>${detail?`<span>${esc(detail)}</span>`:''}${teamPoints?`<span>+${fmtNumber(teamPoints)} team pts</span>`:''}</div></article>`;
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
      panel.innerHTML=`<section class="panel"><h2>Player pass unavailable</h2><p class="setup-message">${esc(e.message||'Unable to load this NFC player pass.')}</p></section>`;
    }
    requestAnimationFrame(activate);
  }

  load();
})();
