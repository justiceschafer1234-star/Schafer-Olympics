(()=>{
  const TEAM_RE=/(Team\s+(?:Red|Blue|Green|Gold))/i;
  let working=false;

  function seedMap(){
    const map=new Map();
    document.querySelectorAll('#seed-list .seed-row').forEach(row=>{
      const seed=Number(row.querySelector('.seed-badge strong')?.textContent?.trim());
      if(!Number.isFinite(seed))return;
      const players=row.querySelector('.seed-team strong')?.textContent?.trim()||'';
      const meta=row.querySelector('.seed-team small')?.textContent||'';
      const olympicTeam=meta.match(TEAM_RE)?.[1]||'';
      map.set(seed,{players,olympicTeam});
    });
    return map;
  }

  function enhance(){
    if(working)return;
    const finals=document.querySelector('#finals-grid');
    if(!finals)return;
    const seeds=seedMap();
    if(!seeds.size)return;
    working=true;
    try{
      finals.querySelectorAll('.final-card .slot:not(.placeholder)').forEach(slot=>{
        const strong=slot.querySelector('strong');
        const small=slot.querySelector('small');
        if(!strong)return;
        const text=`${strong.textContent||''} ${small?.textContent||''}`;
        const seed=Number(text.match(/Seed\s+(\d+)/i)?.[1]);
        if(!Number.isFinite(seed))return;
        const info=seeds.get(seed);
        if(!info)return;
        strong.textContent=info.players||`Seed ${seed}`;
        let meta=small;
        if(!meta){meta=document.createElement('small');strong.after(meta)}
        meta.className='cornhole-final-meta';
        meta.innerHTML=`${info.olympicTeam?`<span class="cornhole-final-team">${info.olympicTeam}</span>`:''}<span class="cornhole-final-seed">Seed ${seed}</span>`;
      });
    }finally{working=false}
  }

  const style=document.createElement('style');
  style.textContent=`
    .final-card .slot{min-height:78px;padding:12px}
    .final-card .slot strong{font-size:1rem;line-height:1.25}
    .cornhole-final-meta{display:flex!important;align-items:center;gap:7px;flex-wrap:wrap;margin-top:6px!important}
    .cornhole-final-team,.cornhole-final-seed{display:inline-flex;align-items:center;min-height:24px;padding:4px 8px;border-radius:999px;font-size:.68rem;font-weight:900;line-height:1}
    .cornhole-final-team{background:#eef3f8;color:#27364a}
    .cornhole-final-seed{background:#eef0ff;color:#5059b5}
  `;
  document.head.appendChild(style);

  new MutationObserver(()=>queueMicrotask(enhance)).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',enhance);
  enhance();
})();
