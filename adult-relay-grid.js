(()=>{
const TEAM_CLASSES=['team-red','team-blue','team-green','team-gold'];
let working=false;
function apply(){
  if(working)return;
  const detail=document.querySelector('#gameday-event-detail');
  if(!detail||detail.hidden)return;
  const title=detail.querySelector('[data-detail-title]')?.textContent?.trim().toLowerCase()||'';
  const host=detail.querySelector('[data-detail-rosters]');
  const grid=host?.querySelector('.event-roster-grid');
  if(!grid)return;
  const isAdultRelay=title.includes('adult')&&title.includes('relay');
  grid.classList.toggle('adult-relay-grid',isAdultRelay);
  host.classList.toggle('adult-relay-rosters',isAdultRelay);
  if(!isAdultRelay)return;
  working=true;
  try{
    const cards=[...grid.querySelectorAll('.event-roster-card')];
    cards.forEach((card,index)=>{
      card.classList.add('adult-relay-team');
      if(!TEAM_CLASSES.some(c=>card.classList.contains(c))&&TEAM_CLASSES[index])card.classList.add(TEAM_CLASSES[index]);
      const names=card.querySelector('.event-roster-names');
      if(!names)return;
      names.classList.add('adult-relay-members');
      const current=[...names.querySelectorAll('span:not(.adult-relay-empty)')];
      names.querySelectorAll('.adult-relay-empty').forEach(x=>x.remove());
      for(let i=current.length;i<4;i++){
        const slot=document.createElement('span');
        slot.className='adult-relay-empty';
        slot.textContent='Open slot';
        names.appendChild(slot);
      }
    });
  }finally{working=false}
}
const observer=new MutationObserver(()=>queueMicrotask(apply));
observer.observe(document.body,{childList:true,subtree:true,characterData:true});
apply();
})();
