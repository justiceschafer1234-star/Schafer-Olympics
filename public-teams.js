(()=>{
  const TEAM_ORDER=['Team Red','Team Blue','Team Green','Team Gold'];
  const META={
    'Team Red':{icon:'🔴',label:'Red Team'},
    'Team Blue':{icon:'🔵',label:'Blue Team'},
    'Team Green':{icon:'🟢',label:'Green Team'},
    'Team Gold':{icon:'🟡',label:'Yellow Team'}
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let loaded=false;

  function injectUi(){
    if(document.querySelector('.tab[data-tab="public-teams"]'))return;
    const nav=document.querySelector('nav.tabs');
    const main=document.querySelector('main.shell');
    if(!nav||!main)return;
    const adminTab=nav.querySelector('.admin-tab');
    const tab=document.createElement('button');
    tab.className='tab';tab.type='button';tab.dataset.tab='public-teams';tab.textContent='👥 Team Rosters';
    nav.insertBefore(tab,adminTab||null);
    const panel=document.createElement('section');
    panel.className='tab-panel';panel.dataset.panel='public-teams';panel.hidden=true;
    panel.innerHTML='<section class="panel"><div class="panel__header panel__header--wrap"><div><p class="section-kicker">Olympic teams</p><h2>Team Rosters</h2><p id="public-team-rosters-note" class="public-team-rosters-note">Current official team assignments</p></div><button id="public-team-rosters-refresh" class="refresh" type="button">↻ Refresh</button></div><div id="public-team-rosters" class="public-team-rosters"><div class="team-rosters-loading">Open this tab to load the rosters.</div></div></section>';
    const firstPanel=main.querySelector('.tab-panel');
    main.insertBefore(panel,firstPanel||null);

    tab.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('is-active',t===tab));
      document.querySelectorAll('.tab-panel').forEach(p=>{const active=p===panel;p.hidden=!active;p.classList.toggle('is-active',active)});
      if(!loaded)load();
    });
    panel.querySelector('#public-team-rosters-refresh')?.addEventListener('click',()=>{loaded=false;load()});
  }

  async function load(){
    const root=document.getElementById('public-team-rosters');
    const note=document.getElementById('public-team-rosters-note');
    if(!root)return;
    root.innerHTML='<div class="team-rosters-loading">Loading team rosters…</div>';
    try{
      const r=await fetch('/api/public-teams',{cache:'no-store'});
      const d=await r.json();
      if(!r.ok||!d?.ok)throw new Error(d?.error||'Could not load team rosters.');
      const grouped=new Map(TEAM_ORDER.map(t=>[t,[]]));
      for(const p of d.participants||[])if(grouped.has(p.team))grouped.get(p.team).push(p);
      root.innerHTML=TEAM_ORDER.map(team=>{
        const people=grouped.get(team)||[],meta=META[team];
        return `<article class="public-team-card" data-team="${esc(team)}">
          <div class="public-team-card__header"><div><span class="public-team-icon">${meta.icon}</span><h3>${meta.label}</h3></div><span class="public-team-count">${people.length} player${people.length===1?'':'s'}</span></div>
          <div class="public-team-list">${people.length?people.map((p,i)=>`<div class="public-team-person"><span class="public-team-number">${i+1}</span><span>${esc(p.name)}</span></div>`).join(''):'<div class="public-team-empty">No players assigned.</div>'}</div>
        </article>`;
      }).join('');
      if(note)note.textContent=`${(d.participants||[]).length} Olympians across 4 teams`;
      loaded=true;
    }catch(e){
      root.innerHTML=`<div class="team-rosters-error">${esc(e.message||'Could not load team rosters.')}</div>`;
      if(note)note.textContent='Roster unavailable';
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectUi,{once:true});else injectUi();
})();
