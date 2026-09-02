(()=>{
const key=new URLSearchParams(location.search).get('event')||'';
const TEAM_KEYS=new Set(['junior-basketball','nuke-em','fill-the-water-bottle','protect-the-balloon-baby','kids-dodgeball','women-s-dodgeball','men-s-dodgeball']);
if(!TEAM_KEYS.has(key))return;
const short=t=>String(t||'').replace('Team ','');
let latest=null,scheduled=false,working=false;
async function load(){try{const r=await fetch(`/api/event-scorecard?eventKey=${encodeURIComponent(key)}`,{cache:'no-store'}),d=await r.json();if(r.ok){latest=d;queueDecorate()}}catch{}}
function currentSides(card){
  if(latest?.state?.sides)return latest.state.sides;
  return [...card.querySelectorAll('.side')].map(el=>[...el.querySelectorAll('.team-picks input:checked')].map(x=>x.value));
}
function decorate(){
  scheduled=false;
  if(working)return;
  const card=document.querySelector('#scorecard');if(!card)return;
  working=true;
  try{
    const sides=currentSides(card);
    card.querySelectorAll('.team-picks,#random-sides').forEach(e=>e.remove());
    card.querySelectorAll('.side').forEach((el,i)=>{
      const wanted=(sides[i]||[]).map(short).join(' + ')||'Set matchup in Game Day HQ → Teams';
      let label=el.querySelector('.locked-team-label');
      if(!label){label=document.createElement('div');label.className='locked-team-label';el.querySelector('.side-head')?.after(label)}
      if(label.textContent!==wanted)label.textContent=wanted;
    });
    const notice=document.querySelector('#notice');
    const text='Team matchup is managed in Game Day HQ → Teams. This page is scoring only.';
    if(notice&&notice.textContent!==text)notice.textContent=text;
  }finally{working=false}
}
function queueDecorate(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
const target=document.querySelector('#scorecard')||document.body;
new MutationObserver(()=>{if(!working)queueDecorate()}).observe(target,{childList:true,subtree:true});
queueDecorate();
load();
})();