(()=>{
  const hash=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  let token=String(hash.get('nfc')||'').trim();
  if(!token)return;

  // Keep the NFC credential out of the address bar and this browser-history entry.
  try{
    history.replaceState(history.state,document.title,`${location.pathname}${location.search}`);
  }catch{}

  const nav=document.querySelector('.tabs');
  const shell=document.querySelector('.shell');
  if(!nav||!shell)return;

  document.body.classList.add('player-hq-mode');

  if(!document.querySelector('link[data-player-hq-style]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/player-hq.css?v=3';
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

  const IDLE_TIMEOUT_MS=10*60*1000;
  const activityEvents=['pointerdown','touchstart','keydown','scroll'];
  let idleTimer=null;
  let lastActivity=Date.now();
  let sessionActive=false;

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
  const statusClass=s=>String(s||'Not Started').toLowerCase().replaceAll(' ','-');
  const ordinal=n=>`${n}${n===1?'st':n===2?'nd':n===3?'rd':'th'}`;

  function activate(){
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('is-active'));
    document.querySelectorAll('.tab-panel').forEach(x=>{x.classList.remove('is-active');x.hidden=true});
    tab.classList.add('is-active');
    panel.classList.add('is-active');
    panel.hidden=false;
  }

  function removeActivityListeners(){
    activityEvents.forEach(type=>window.removeEventListener(type,noteActivity,true));
    document.removeEventListener('visibilitychange',checkIdleAfterBackground);
    window.removeEventListener('pagehide',expireSession);
  }

  function expireSession(){
    if(!sessionActive)return;
    sessionActive=false;
    token='';
    clearTimeout(idleTimer);
    idleTimer=null;
    removeActivityListeners();
    tab.textContent='🔒 My Day';
    panel.innerHTML='<section class="panel"><p class="section-kicker">Session ended</p><h2>Tap your player card</h2><p class="setup-message">Your personal Game Day view closes after 10 minutes without activity. Tap your NFC card again to view your schedule and stats.</p></section>';
  }

  function armIdleTimer(){
    if(!sessionActive)return;
    clearTimeout(idleTimer);
    const elapsed=Date.now()-lastActivity;
    const remaining=IDLE_TIMEOUT_MS-elapsed;
    if(remaining<=0){
      expireSession();
      return;
    }
    idleTimer=setTimeout(expireSession,remaining);
  }

  function noteActivity(){
    if(!sessionActive)return;
    lastActivity=Date.now();
    armIdleTimer();
  }

  function checkIdleAfterBackground(){
    if(!sessionActive||document.visibilityState!=='visible')return;
    if(Date.now()-lastActivity>=IDLE_TIMEOUT_MS)expireSession();
    else armIdleTimer();
  }

  function startSession(){
    sessionActive=true;
    lastActivity=Date.now();
    activityEvents.forEach(type=>window.addEventListener(type,noteActivity,{capture:true,passive:true}));
    document.addEventListener('visibilitychange',checkIdleAfterBackground);
    window.addEventListener('pagehide',expireSession,{once:true});
    armIdleTimer();
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
    if(p.kind==='bracket')return p.place?`Finished ${ordinal(Number(p.place))}`:'Bracket in progress';
    return '';
  }

  function eventResultMarkup(event){
    const personal=event.personal;
    const team=event.teamResult;
    const detail=personalDetail(event);
    let main='Pending';
    let sub='Your result will appear here when it is recorded.';
    let resultClass='is-pending';

    if(personal?.place){
      const medal=event.result?.medal||'';
      main=`${medal} ${ordinal(Number(personal.place))}`.trim();
      sub=detail||'Individual result recorded';
      resultClass='is-complete';
    }else if(personal){
      if(event.status==='Complete'){
        main='Complete';
        sub=detail||'Individual result recorded';
        resultClass='is-complete';
      }else if(detail){
        main='In progress';
        sub=detail;
        resultClass='is-live';
      }
    }else if(team){
      main=`${team.medal||''} ${team.label||ordinal(Number(team.place))}`.trim();
      sub=`Team result${Number(team.points||0)?` · +${fmtNumber(team.points)} team pts`:''}`;
      resultClass='is-complete';
    }

    return `<div class="player-event-result ${resultClass}">
      <span>YOUR RESULT</span>
      <strong>${esc(main)}</strong>
      <small>${esc(sub)}</small>
    </div>`;
  }

  function scheduleCard(event,isNext){
    const when=dateParts(event.scheduledTime);
    return `<article class="player-event-card${isNext?' is-next':''}">
      <div class="player-event-card__top">
        <div class="player-event-time">
          <strong>${esc(when.time||when.date)}</strong>
          ${when.time?`<span>${esc(when.date)}</span>`:''}
        </div>
        <div class="player-event-badges">
          ${isNext?'<span class="player-next-badge">NEXT</span>':''}
          <span class="status-badge ${statusClass(event.status)}">${esc(event.status)}</span>
        </div>
      </div>
      <div class="player-event-title">
        <span>Event ${esc(event.number??'–')}</span>
        <strong>${esc(event.name)}</strong>
        <small>${esc(event.format||'Event')}</small>
      </div>
      ${eventResultMarkup(event)}
    </article>`;
  }

  function render(data){
    const player=data.player||{};
    const summary=data.summary||{};
    const events=data.events||[];
    const next=data.nextEvent;
    const medals=summary.medals||{};

    panel.innerHTML=`
      <section class="player-hq-hero">
        <div class="player-hq-identity">
          <p class="section-kicker">My Game Day</p>
          <h2>${esc(player.name||'Player')}</h2>
          <span class="player-team-pill">${esc(player.team||'Team not assigned yet')}</span>
        </div>
      </section>

      <section class="panel player-schedule-panel">
        <div class="player-section-head">
          <div><p class="section-kicker">My events & results</p><h2>My Schedule</h2></div>
          <strong>${events.length}</strong>
        </div>
        <div class="player-schedule-list">
          ${events.length?events.map(event=>scheduleCard(event,Boolean(next)&&String(event.id)===String(next.id))).join(''):'<p class="player-empty">You are not currently registered for any events.</p>'}
        </div>
      </section>

      <section class="panel player-summary-section">
        <div class="player-section-head">
          <div><p class="section-kicker">At a glance</p><h2>Summary Statistics</h2></div>
        </div>
        <div class="player-summary-grid">
          <article class="player-summary-card"><strong>${Number(summary.registered||0)}</strong><span>Events entered</span></article>
          <article class="player-summary-card"><strong>${Number(summary.completed||0)}</strong><span>Completed</span></article>
          <article class="player-summary-card"><strong>${Number(summary.podiums||0)}</strong><span>Podium finishes</span></article>
          <article class="player-summary-card"><strong>${fmtNumber(summary.teamPoints||0)}</strong><span>Team points</span></article>
        </div>
        <div class="player-medal-summary" aria-label="Medal summary">
          <div><span>🥇</span><strong>${Number(medals.gold||0)}</strong><small>Gold</small></div>
          <div><span>🥈</span><strong>${Number(medals.silver||0)}</strong><small>Silver</small></div>
          <div><span>🥉</span><strong>${Number(medals.bronze||0)}</strong><small>Bronze</small></div>
          <div><span>🟤</span><strong>${Number(medals.copper||0)}</strong><small>Copper</small></div>
        </div>
      </section>`;
  }

  async function load(){
    try{
      const sessionToken=token;
      const r=await fetch('/api/player-hq',{headers:{'X-Player-NFC':sessionToken},cache:'no-store'});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Unable to load your player page.');
      render(data);
      startSession();
    }catch(e){
      token='';
      panel.innerHTML=`<section class="panel"><h2>Player page unavailable</h2><p class="setup-message">${esc(e.message||'Unable to load this player page.')}</p></section>`;
    }
    requestAnimationFrame(activate);
  }

  load();
})();
