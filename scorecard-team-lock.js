(()=>{
const key=new URLSearchParams(location.search).get('event')||'';
const TEAM_KEYS=new Set(['junior-basketball','nuke-em','fill-the-water-bottle','protect-the-balloon-baby','kids-dodgeball','women-s-dodgeball','men-s-dodgeball']);
if(!TEAM_KEYS.has(key))return;
const short=t=>String(t||'').replace('Team ','');
let latest=null,decorating=false;
async function load(){try{const r=await fetch(`/api/event-scorecard?eventKey=${encodeURIComponent(key)}`,{cache:'no-store'}),d=await r.json();if(r.ok){latest=d;decorate()}}catch{}}
function decorate(){if(decorating)return;const card=document.querySelector('#scorecard');if(!card||!latest)return;decorating=true;
  card.querySelectorAll('.team-picks,#random-sides').forEach(e=>e.remove());
  const sides=latest.state?.sides||[[],[]];card.querySelectorAll('.side').forEach((el,i)=>{let label=el.querySelector('.locked-team-label');if(!label){label=document.createElement('div');label.className='locked-team-label';const head=el.querySelector('.side-head');head?.after(label)}label.textContent=(sides[i]||[]).map(short).join(' + ')||'Set matchup in Game Day HQ → Teams'});
  const notice=document.querySelector('#notice');if(notice)notice.textContent='Team matchup is managed in Game Day HQ → Teams. This page is scoring only.';
  decorating=false;
}
new MutationObserver(()=>{if(!decorating)decorate()}).observe(document.querySelector('#scorecard')||document.body,{childList:true,subtree:true});
load();
})();