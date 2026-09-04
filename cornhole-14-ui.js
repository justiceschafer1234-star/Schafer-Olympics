(()=>{
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sub=document.querySelector('.page-header .subhead'),copy=document.querySelector('.seeding-section .section-copy');
if(sub)sub.textContent='14 pairs · double elimination';
if(copy)copy.textContent='Seeds 1 and 2 enter the Round of 8 directly. Seeds 3–14 play six preliminary matches, creating a full 8-team winners bracket.';
let running=false,pending=false;
function seedNumber(label){const m=String(label||'').match(/^Seed\s+(\d+)$/i);return m?Number(m[1]):null}
async function refreshFinal(){
  if(running){pending=true;return}running=true;
  try{
    const [tr,mr]=await Promise.all([fetch('/api/cornhole/teams',{cache:'no-store'}),fetch('/api/cornhole',{cache:'no-store'})]);
    if(!tr.ok||!mr.ok)return;const [td,md]=await Promise.all([tr.json(),mr.json()]),teams=td.teams||[],matches=md.matches||[];if(teams.length!==14)return;
    const byCode=c=>matches.find(m=>m.properties?.Match===c)?.properties||null,bySeed=new Map(teams.filter(t=>t.seed!=null).map(t=>[Number(t.seed),t]));
    const canonical=label=>{const n=seedNumber(label),t=n?bySeed.get(n):null;return t||{players:String(label||''),olympicTeam:'',seed:n}};
    const gf1=byCode('GF1'),gf2=byCode('GF2'),w7=byCode('W7');let champion='',runner='';
    if(gf2?.Status==='Complete'&&gf2.Winner){champion=gf2.Winner;runner=gf2.Loser}
    else if(gf1?.Status==='Complete'&&gf1.Winner&&w7?.Winner&&gf1.Winner===w7.Winner){champion=gf1.Winner;runner=gf1.Loser}
    const status=$('#leaderboard-status'),host=$('#final-leaderboard');if(!status||!host)return;
    if(!champion){status.textContent='Waiting for finish';return}
    const rows=[
      ['🥇 1st',champion],['🥈 2nd',runner],['🥉 3rd',byCode('L12')?.Loser],['4th',byCode('L11')?.Loser],
      ['T-5th',byCode('L9')?.Loser],['T-5th',byCode('L10')?.Loser],
      ['T-7th',byCode('L7')?.Loser],['T-7th',byCode('L8')?.Loser],
      ['T-9th',byCode('L3')?.Loser],['T-9th',byCode('L4')?.Loser],['T-9th',byCode('L5')?.Loser],['T-9th',byCode('L6')?.Loser],
      ['T-13th',byCode('L1')?.Loser],['T-13th',byCode('L2')?.Loser]
    ].filter(x=>x[1]);
    function recordFor(label){let w=0,l=0;for(const m of matches){const p=m.properties||{};if(p.Status!=='Complete')continue;if(p.Winner===label)w++;if(p.Loser===label)l++}return `${w}–${l}`}
    const html='<div class="leaderboard-row is-header"><span>Finish</span><span>Pair</span><span>Olympic Team</span><span>Record</span><span>Seed</span></div>'+rows.map(([finish,label])=>{const c=canonical(label),medal=/^(🥇|🥈|🥉)/.test(finish);return `<div class="leaderboard-row${medal?' is-medal':''}"><span class="leaderboard-finish">${esc(finish)}</span><span class="leaderboard-pair"><strong>${esc(c.players||label)}</strong><small>${esc(label)}</small></span><span class="leaderboard-team">${esc(c.olympicTeam||'—')}</span><span class="leaderboard-record">${esc(recordFor(label))}</span><span class="leaderboard-seed">${c.seed??'—'}</span></div>`}).join('');
    status.textContent='Final';if(host.innerHTML!==html)host.innerHTML=html;
  }catch{}finally{running=false;if(pending){pending=false;setTimeout(refreshFinal,50)}}
}
const host=$('#final-leaderboard'),status=$('#leaderboard-status');if(host&&status){const observer=new MutationObserver(()=>setTimeout(refreshFinal,0));observer.observe(host,{childList:true,subtree:true});observer.observe(status,{childList:true});}
window.addEventListener('focus',refreshFinal);setTimeout(refreshFinal,0);
})();
