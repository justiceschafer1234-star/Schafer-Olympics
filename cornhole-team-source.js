(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let teams=[];
const bySeed=n=>teams.find(t=>Number(t.seed)===Number(n));
const seedFrom=s=>{const m=String(s||'').match(/^Seed\s+(\d+)$/i);return m?Number(m[1]):null};
function renderTeamList(){
 const grid=document.querySelector('#team-grid');if(!grid)return;
 grid.innerHTML=teams.length?teams.map(t=>`<article class="team-card"><span class="seed">Seed ${t.seed}</span><strong>${esc(t.players)}</strong><span class="player">${esc(t.olympicTeam)}</span></article>`).join(''):'<p class="load-error">No saved Cornhole seeds yet.</p>';
 const tc=document.querySelector('#team-count'),rc=document.querySelector('#registered-count');if(tc)tc.textContent=String(teams.length);if(rc)rc.textContent=String(teams.reduce((n,t)=>n+(t.player1?1:0)+(t.player2?1:0),0));
}
function fixSeededLabels(root=document){
 root.querySelectorAll?.('.slot').forEach(slot=>{const small=slot.querySelector('small'),b=slot.querySelector('b');if(!small||!b)return;const raw=small.textContent.trim().split(' · ')[0],seed=seedFrom(raw);if(!seed)return;const t=bySeed(seed);if(!t)return;if(b.textContent!==t.players)b.textContent=t.players;const label=`Seed ${seed} · ${t.olympicTeam}`;if(small.textContent!==label)small.textContent=label});
 root.querySelectorAll?.('.score-sheet__teams>div').forEach(box=>{const small=box.querySelector('small'),strong=box.querySelector('strong');if(!small||!strong)return;const raw=small.textContent.trim().split(' · ')[0],seed=seedFrom(raw);if(!seed)return;const t=bySeed(seed);if(!t)return;if(strong.textContent!==t.players)strong.textContent=t.players;const label=`Seed ${seed} · ${t.olympicTeam}`;if(small.textContent!==label)small.textContent=label});
}
async function load(){try{const r=await fetch('/api/cornhole/teams',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load Cornhole teams');teams=d.teams||[];renderTeamList();fixSeededLabels()}catch(e){console.error('Cornhole team source:',e)}}
const obs=new MutationObserver(records=>{for(const rec of records){for(const node of rec.addedNodes){if(node.nodeType===1)fixSeededLabels(node)}}});obs.observe(document.body,{childList:true,subtree:true});
load();
})();