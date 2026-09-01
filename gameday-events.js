(()=>{
  const grid=document.querySelector('#events-grid');
  if(!grid)return;

  const tabs=[...document.querySelectorAll('.tab')];
  tabs.find(x=>x.matches('a[href="/tournaments.html"]'))?.remove();

  let scoreData=null;
  let detail=null;
  let openRow=null;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const teamClass={'Team Red':'team-red','Team Blue':'team-blue','Team Green':'team-green','Team Gold':'team-gold'};
  const tournamentPath=name=>{const n=String(name||'').toLowerCase();if(n.includes('cornhole'))return'/cornhole-tournament.html';if(n.includes('adult soccer'))return'/adult-soccer-tournament.html';if(n.includes('wiffle ball'))return'/wiffle-ball-tournament.html';return''};
  const tournamentSrc=path=>`${path}${document.body.classList.contains('control-mode')?'?control=1':'?view=1'}`;
  const podium=p=>{const bits=[];const gold=Array.isArray(p['🥇 Team'])?p['🥇 Team'][0]:p['🥇 Team'];const silver=Array.isArray(p['🥈 Team'])?p['🥈 Team'][0]:p['🥈 Team'];const bronze=Array.isArray(p['🥉 Team'])?p['🥉 Team']:p['🥉 Team']?[p['🥉 Team']]:[];if(gold)bits.push(`🥇 ${esc(String(gold).replace('Team ',''))}`);if(silver)bits.push(`🥈 ${esc(String(silver).replace('Team ',''))}`);if(bronze.length)bits.push(`🥉 ${bronze.map(x=>esc(String(x).replace('Team ',''))).join(' + ')}`);return bits.join('<span>•</span>')};

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
    detail.innerHTML=`<button class="gameday-event-back" type="button">← All Events</button><div class="gameday-event-head"><div><p class="section-kicker">Event Control</p><h2 data-detail-title></h2><div class="gameday-event-tags" data-detail-tags></div></div><span data-detail-status class="status-badge"></span></div><div data-detail-result></div><div data-detail-action></div><div data-detail-tournament hidden></div><section class="gameday-mini-board"><div class="panel__header"><div><p class="section-kicker">Live overall race</p><h3>Leaderboard</h3></div></div><div data-detail-board></div></section>`;
    grid.parentElement.appendChild(detail);
    detail.querySelector('.gameday-event-back').addEventListener('click',closeDetail);
    return detail;
  }

  function compactBoard(container,standings=[]){
    const sorted=[...standings].sort((a,b)=>Number(b.points||0)-Number(a.points||0));
    container.innerHTML=sorted.map((t,i)=>`<div class="gameday-mini-row ${teamClass[t.team]||''}"><strong>${i+1}. ${esc(t.team)}</strong><span>${Number(t.points||0)} pts</span></div>`).join('')||'<div class="empty-state">No standings yet.</div>';
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
    try{
      const d=await getScores(true);
      const row=(d.rows||[]).find(r=>String(r.properties?.Event||'').trim()===String(title||'').trim());
      if(!row)return;
      openRow=row;
      const p=row.properties||{},path=tournamentPath(p.Event),st=p.Status||'Not Started',box=ensureDetail();
      grid.hidden=true;
      const header=grid.parentElement.querySelector('.panel__header');if(header)header.hidden=true;
      box.hidden=false;
      box.querySelector('[data-detail-title]').textContent=p.Event||'Untitled event';
      box.querySelector('[data-detail-tags]').innerHTML=[`Event ${p['Event #']??'—'}`,p.Format,Array.isArray(p['Division 2'])?p['Division 2'].join(' · '):p['Division 2']].filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join('');
      const badge=box.querySelector('[data-detail-status]');badge.textContent=st;badge.className=`status-badge ${String(st).toLowerCase().replaceAll(' ','-')}`;
      box.querySelector('[data-detail-result]').innerHTML=podium(p)?`<div class="gameday-event-podium">${podium(p)}</div>`:'<div class="gameday-event-pending">No final result entered yet.</div>';
      const action=box.querySelector('[data-detail-action]'),tour=box.querySelector('[data-detail-tournament]');
      if(path){
        action.innerHTML=document.body.classList.contains('control-mode')?'<p class="gameday-event-hint">Enter match scores directly in the live bracket below.</p>':'';
        tour.hidden=false;tour.innerHTML=`<iframe class="gameday-tournament-frame" title="${esc(p.Event)} bracket" src="${tournamentSrc(path)}"></iframe>`;
      }else{
        tour.hidden=true;tour.innerHTML='';
        if(document.body.classList.contains('control-mode')){
          action.innerHTML=`<button type="button" class="save-score gameday-score-event">${podium(p)?'Edit Event Result':'Enter Event Result'}</button>`;
          action.querySelector('button').addEventListener('click',()=>openAdmin(row));
        }else action.innerHTML='';
      }
      compactBoard(box.querySelector('[data-detail-board]'),d.standings||[]);
      box.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){alert(e.message||'Could not open event')}
  }

  function decorateCards(){
    grid.querySelectorAll('.event-card').forEach(card=>{
      if(card.dataset.gamedayReady==='1')return;
      card.dataset.gamedayReady='1';card.classList.add('event-card--clickable');card.setAttribute('role','button');card.tabIndex=0;
      const title=card.querySelector('.event-title')?.textContent?.trim()||'';
      const hint=document.createElement('div');hint.className='gameday-event-open';hint.innerHTML=`${tournamentPath(title)?'Live bracket':'Scoring & results'} <span>→</span>`;card.appendChild(hint);
      card.addEventListener('click',()=>openByTitle(title));
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openByTitle(title)}});
    });
  }

  new MutationObserver(decorateCards).observe(grid,{childList:true,subtree:true});
  decorateCards();
})();