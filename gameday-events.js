(()=>{
  const grid=document.querySelector('#events-grid');
  if(!grid)return;

  const tabs=[...document.querySelectorAll('.tab')];
  tabs.find(x=>x.matches('a[href="/tournaments.html"]'))?.remove();

  let scoreData=null;
  let detail=null;
  let openRow=null;
  const TOURNAMENT_ASSET_VERSION='2026-09-02-adult-soccer-standalone-1';

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const teamClass={'Team Red':'team-red','Team Blue':'team-blue','Team Green':'team-green','Team Gold':'team-gold'};
  const teamShort=t=>String(t||'').replace('Team ','');
  const SCORECARD_EVENTS={
    'kahoot':'kahoot','junior basketball':'junior-basketball',
    'women’s three-point contest':'women-s-three-point-contest','men’s three-point contest':'men-s-three-point-contest',
    'speed grab':'speed-grab','nuke ’em':'nuke-em','speed volleyball / volleyball':'speed-volleyball-volleyball',
    'water tasting':'water-tasting','fill the water bottle':'fill-the-water-bottle','protect the balloon baby':'protect-the-balloon-baby',
    'kids dodgeball':'kids-dodgeball','women’s dodgeball':'women-s-dodgeball','men’s dodgeball':'men-s-dodgeball'
  };
  const tournamentPath=name=>{const n=String(name||'').trim().toLowerCase();if(n.includes('cornhole'))return'/cornhole-tournament.html';if(n.includes('adult soccer'))return'/adult-soccer.html';if(n==='kids soccer')return'/kids-soccer.html';if(n.includes('wiffle ball'))return'/wiffle-ball-tournament.html';if(n.includes('kids slip-and-slide'))return'/kids-slip-and-slide.html';if(n.includes('adult slip-and-slide'))return'/adult-slip-and-slide.html';if(n.includes('egg toss'))return'/egg-toss.html';return SCORECARD_EVENTS[n]?`/event-scorecard.html?event=${encodeURIComponent(SCORECARD_EVENTS[n])}`:''};
  const isStandaloneTournament=name=>Boolean(tournamentPath(name));
  const tournamentSrc=path=>`${path}${path.includes('?')?'&':'?'}${document.body.classList.contains('control-mode')?'control=1':'view=1'}&v=${encodeURIComponent(TOURNAMENT_ASSET_VERSION)}`;
  const openStandaloneTournament=path=>{sessionStorage.setItem('schaferOlympicsReturnTab','events');window.location.href=tournamentSrc(path)};
  const isTeamEvent=p=>!/individual/i.test(String(p?.Format||''));
  const asTeams=v=>(Array.isArray(v)?v:v?[v]:[]).filter(Boolean);
  const podium=p=>{const bits=[];const gold=asTeams(p['🥇 Team']),silver=asTeams(p['🥈 Team']),bronze=asTeams(p['🥉 Team']);if(gold.length)bits.push(`🥇 ${gold.map(x=>esc(String(x).replace('Team ',''))).join(' + ')}`);if(silver.length)bits.push(`🥈 ${silver.map(x=>esc(String(x).replace('Team ',''))).join(' + ')}`);if(bronze.length)bits.push(`🥉 ${bronze.map(x=>esc(String(x).replace('Team ',''))).join(' + ')}`);return bits.join('<span>•</span>')};

  async function getScores(force=false){
    if(scoreData&&!force)return scoreData;
    const r=await fetch('/api/scores',{cache:'no-store'}),d=await r.json();
    if(!r.ok||d.error)throw new Error(d.error||'Unable to load event data');
    scoreData=d;return d;
  }

  function ensureDetail(){
    if(detail)return detail;
    detail=document.createElement('section');
    detail.id='gameday-event-detail';
    detail.className='gameday-event-detail';
    detail.hidden=true;
    detail.innerHTML=`<button class="gameday-event-back" type="button">← All Events</button><div class="gameday-event-head"><div><p class="section-kicker">Event Control</p><h2 data-detail-title></h2><div class="gameday-event-tags" data-detail-tags></div></div><span data-detail-status class="status-badge"></span></div><div data-detail-result></div><div data-detail-action></div><div data-detail-tournament hidden></div><section class="gameday-mini-board"><div class="panel__header"><div><p class="section-kicker">Live overall race</p><h3>Leaderboard</h3></div></div><div data-detail-board></div></section><section data-detail-rosters class="gameday-event-rosters" hidden></section>`;
    grid.parentElement.appendChild(detail);
    detail.querySelector('.gameday-event-back').addEventListener('click',closeDetail);
    return detail;
  }

  function compactBoard(container,standings=[]){
    const sorted=[...standings].sort((a,b)=>Number(b.points||0)-Number(a.points||0));
    container.innerHTML=sorted.map((t,i)=>`<div class="gameday-mini-row ${teamClass[t.team]||''}"><strong>${i+1}. ${esc(t.team)}</strong><span>${Number(t.points||0)} pts</span></div>`).join('')||'<div class="empty-state">No standings yet.</div>';
  }

  async function renderEventRosters(box,row){
    const host=box.querySelector('[data-detail-rosters]'),p=row.properties||{};
    if(!host)return;
    if(!isTeamEvent(p)){host.hidden=true;host.innerHTML='';return}
    host.hidden=false;
    host.innerHTML='<div class="panel__header"><div><p class="section-kicker">Registered for this event</p><h3>Teams</h3></div></div><div class="event-roster-loading">Loading team participants…</div>';
    try{
      const r=await fetch(`/api/event-rosters?eventId=${encodeURIComponent(row.id)}`,{cache:'no-store'}),d=await r.json();
      if(!r.ok||d.error)throw new Error(d.error||'Could not load event participants');
      host.innerHTML=`<div class="panel__header"><div><p class="section-kicker">Registered for this event</p><h3>Teams</h3></div><strong class="event-roster-total">${Number(d.registeredCount||0)} registered</strong></div><div class="event-roster-grid">${(d.rosters||[]).map(x=>`<article class="event-roster-card ${teamClass[x.team]||''}"><h4>${esc(teamShort(x.team))} Team</h4>${x.participants?.length?`<div class="event-roster-names">${x.participants.map(name=>`<span>${esc(name)}</span>`).join('')}</div>`:'<p>No registered participants.</p>'}</article>`).join('')}</div>${d.unassigned?.length?`<div class="event-roster-unassigned"><strong>Registered but not assigned to an Olympic team:</strong> ${d.unassigned.map(esc).join(', ')}</div>`:''}`;
    }catch(e){host.innerHTML=`<div class="panel__header"><div><p class="section-kicker">Registered for this event</p><h3>Teams</h3></div></div><div class="event-roster-error">${esc(e.message||'Could not load participants.')}</div>`}
  }

  function closeDetail(){
    openRow=null;
    if(detail){detail.hidden=true;const frame=detail.querySelector('iframe');if(frame)frame.src='about:blank'}
    grid.hidden=false;
    const header=grid.parentElement.querySelector('.panel__header');if(header)header.hidden=false;
  }

  function openAdmin(row){
    if(!document.body.classList.contains('control-mode'))return;
    closeDetail();
    const adminTab=document.querySelector('[data-tab="admin"]');
    adminTab?.click();
    const select=document.querySelector('#admin-event');
    if(select){select.value=row.id;select.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>select.scrollIntoView({behavior:'smooth',block:'start'}),50)}
  }

  async function openByTitle(title){
    const directPath=tournamentPath(title);
    if(isStandaloneTournament(title)&&directPath){openStandaloneTournament(directPath);return}
    try{
      const d=await getScores(true);
      const row=(d.rows||[]).find(r=>String(r.properties?.Event||'').trim()===String(title||'').trim());
      if(!row)return;
      openRow=row;
      const p=row.properties||{},path=tournamentPath(p.Event),st=p.Status||'Not Started',box=ensureDetail();
      if(isStandaloneTournament(p.Event)&&path){openStandaloneTournament(path);return}
      grid.hidden=true;
      const header=grid.parentElement.querySelector('.panel__header');if(header)header.hidden=true;
      box.hidden=false;
      box.querySelector('[data-detail-title]').textContent=p.Event||'Untitled event';
      box.querySelector('[data-detail-tags]').innerHTML=[`Event ${p['Event #']??'—'}`,p.Format,Array.isArray(p['Division 2'])?p['Division 2'].join(' · '):p['Division 2']].filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join('');
      const badge=box.querySelector('[data-detail-status]');badge.textContent=st;badge.className=`status-badge ${String(st).toLowerCase().replaceAll(' ','-')}`;
      box.querySelector('[data-detail-result]').innerHTML=podium(p)?`<div class="gameday-event-podium">${podium(p)}</div>`:'<div class="gameday-event-pending">No final result entered yet.</div>';
      const action=box.querySelector('[data-detail-action]'),tour=box.querySelector('[data-detail-tournament]');
      if(path){
        action.innerHTML=document.body.classList.contains('control-mode')?'<p class="gameday-event-hint">Enter scores/times directly on the live event page below.</p>':'';
        tour.hidden=false;tour.innerHTML=`<iframe class="gameday-tournament-frame" title="${esc(p.Event)}" src="${tournamentSrc(path)}"></iframe>`;
      }else{
        tour.hidden=true;tour.innerHTML='';
        if(document.body.classList.contains('control-mode')){
          action.innerHTML=`<button type="button" class="save-score gameday-score-event">${podium(p)?'Edit Event Result':'Enter Event Result'}</button>`;
          action.querySelector('button').addEventListener('click',()=>openAdmin(row));
        }else action.innerHTML='';
      }
      compactBoard(box.querySelector('[data-detail-board]'),d.standings||[]);
      renderEventRosters(box,row);
      box.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){alert(e.message||'Could not open event')}
  }

  function decorateCards(){
    grid.querySelectorAll('.event-card').forEach(card=>{
      if(card.dataset.gamedayReady==='1')return;
      card.dataset.gamedayReady='1';card.classList.add('event-card--clickable');card.setAttribute('role','button');card.tabIndex=0;
      const title=card.querySelector('.event-title')?.textContent?.trim()||'',path=tournamentPath(title),standalone=isStandaloneTournament(title);
      const hint=document.createElement('div');hint.className='gameday-event-open';hint.innerHTML=`${standalone&&path?`Open ${title} Page`:path?'Live bracket':'Scoring & results'} <span>→</span>`;card.appendChild(hint);
      card.addEventListener('click',()=>openByTitle(title));
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openByTitle(title)}});
    });
  }

  document.querySelectorAll('a[data-cornhole-link]').forEach(link=>{
    link.addEventListener('click',e=>{
      e.preventDefault();
      openStandaloneTournament('/cornhole-tournament.html');
    });
  });

  new MutationObserver(decorateCards).observe(grid,{childList:true,subtree:true});
  decorateCards();
})();