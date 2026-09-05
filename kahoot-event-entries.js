(()=>{
  const params=new URLSearchParams(location.search);
  if((params.get('event')||'').toLowerCase()!=='kahoot')return;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function renderKahootEntries(){
    const panel=document.querySelector('#team-rosters-panel');
    const host=document.querySelector('#team-rosters');
    if(!panel||!host)return;

    try{
      const r=await fetch('/api/event-rosters?eventKey=kahoot',{cache:'no-store'});
      const d=await r.json();
      if(!r.ok||d.error)throw new Error(d.error||'Could not load Kahoot entries');

      const groups=new Map();
      for(const p of d.participants||[]){
        const n=Number(p.eventTeamNumber);
        if(!Number.isFinite(n)||n<=0)continue;
        if(!groups.has(n))groups.set(n,[]);
        groups.get(n).push(p);
      }

      const entries=[...groups.entries()].sort((a,b)=>a[0]-b[0]);
      panel.hidden=false;
      const head=panel.querySelector('.panel-head');
      if(head)head.innerHTML='<div><p class="eyebrow">Playing this event</p><h2>Kahoot Pairs & Singles</h2></div>';

      host.innerHTML=entries.length
        ? entries.map(([number,players])=>{
            const names=players.map(p=>p.name).filter(Boolean);
            const teams=[...new Set(players.map(p=>p.olympicTeam).filter(Boolean))];
            const label=names.join(' + ');
            const type=names.length===1?'Solo':'Pair';
            return `<article class="roster-card kahoot-entry"><h3>${esc(type)} ${number}</h3><div class="roster-names"><span>${esc(label)}</span></div>${teams.length?`<div class="roster-empty">${esc(teams.map(t=>t.replace('Team ','')).join(' + '))}</div>`:''}</article>`;
          }).join('')
        : '<div class="roster-empty">No Kahoot pairs or singles are assigned yet.</div>';
    }catch(e){
      panel.hidden=false;
      host.innerHTML=`<div class="roster-empty">${esc(e.message||'Could not load Kahoot entries.')}</div>`;
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(renderKahootEntries,0));
  else setTimeout(renderKahootEntries,0);
})();
