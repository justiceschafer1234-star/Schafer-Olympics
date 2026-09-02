(()=>{
  const TEAM_INFO={
    'Team Red':{key:'red',color:'#dc3545'},
    'Team Blue':{key:'blue',color:'#2376d8'},
    'Team Green':{key:'green',color:'#25a45a'},
    'Team Gold':{key:'gold',color:'#e0a500'}
  };
  const SELECTORS=['.team-card','.trial-card','.leader-row','.entry-card','.roster-card','.score-row','.result-row','.result','.player','.slot','.match','.match-card','.side-card','.team-row','.standing-row','.participant-row'];
  const style=document.createElement('style');
  style.textContent=`
    .so-team-accent{position:relative;overflow:hidden}
    .so-team-accent::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--so-team-color);border-radius:inherit 0 0 inherit;pointer-events:none;z-index:2}
    .so-team-accent[data-so-team="red"]{--so-team-color:#dc3545}
    .so-team-accent[data-so-team="blue"]{--so-team-color:#2376d8}
    .so-team-accent[data-so-team="green"]{--so-team-color:#25a45a}
    .so-team-accent[data-so-team="gold"]{--so-team-color:#e0a500}
    .so-team-split{position:relative;overflow:hidden}
    .so-team-split::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:linear-gradient(to bottom,var(--so-team-color-a) 0 50%,var(--so-team-color-b) 50% 100%);border-radius:inherit 0 0 inherit;pointer-events:none;z-index:2}
    @media(max-width:700px){.so-team-accent::before,.so-team-split::before{width:5px}}
  `;
  document.head.appendChild(style);

  function teamsIn(el){
    const text=(el.textContent||'').replace(/\s+/g,' ');
    return Object.keys(TEAM_INFO).filter(team=>text.includes(team));
  }
  function applyTo(el){
    const teams=teamsIn(el);
    if(!teams.length){
      el.classList.remove('so-team-accent','so-team-split');
      el.removeAttribute('data-so-team');
      el.style.removeProperty('--so-team-color-a');
      el.style.removeProperty('--so-team-color-b');
      return;
    }
    if(teams.length===1){
      el.classList.add('so-team-accent');
      el.classList.remove('so-team-split');
      el.dataset.soTeam=TEAM_INFO[teams[0]].key;
      el.style.removeProperty('--so-team-color-a');
      el.style.removeProperty('--so-team-color-b');
      return;
    }
    el.classList.remove('so-team-accent');
    el.classList.add('so-team-split');
    el.removeAttribute('data-so-team');
    el.style.setProperty('--so-team-color-a',TEAM_INFO[teams[0]].color);
    el.style.setProperty('--so-team-color-b',TEAM_INFO[teams[1]].color);
  }
  function apply(root=document){
    const found=new Set();
    for(const sel of SELECTORS)root.querySelectorAll?.(sel).forEach(el=>found.add(el));
    found.forEach(applyTo);
  }
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply()});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener('DOMContentLoaded',()=>apply());
  apply();
})();