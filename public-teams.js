(()=>{
  const TEAM_ORDER=['Team Red','Team Blue','Team Green','Team Gold'];
  const META={
    'Team Red':{icon:'🔴',label:'Red Team'},
    'Team Blue':{icon:'🔵',label:'Blue Team'},
    'Team Green':{icon:'🟢',label:'Green Team'},
    'Team Gold':{icon:'🟡',label:'Gold Team'}
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let loaded=false;

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

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('.tab[data-tab="public-teams"]')?.addEventListener('click',()=>{if(!loaded)load()});
  });
})();
