(()=>{
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const control=new URLSearchParams(location.search).get('control')==='1';
const seedList=$('#seed-list'),wb=$('#winners-bracket'),lb=$('#losers-bracket'),finals=$('#finals-grid'),leaderboard=$('#final-leaderboard'),leaderboardStatus=$('#leaderboard-status');
let matches=[],teams=[];
const teamBySeed=new Map();
const roundNames={
  Winners:{1:'Preliminary Round',2:'Quarterfinals',3:'Semifinals',4:'Winners Final'},
  Losers:{1:'Losers Round 1',2:'Losers Round 2',3:'Losers Round 3',4:'Losers Semifinal',5:'Losers Final'},
  Finals:{1:'Grand Final',2:'Bracket Reset'}
};
function seedNumber(label){const m=String(label||'').match(/^Seed\s+(\d+)$/i);return m?Number(m[1]):null}
function canonical(label,fallback=''){
  const seed=seedNumber(label),t=seed?teamBySeed.get(seed):null;
  return t?{label:`Seed ${seed}`,seed,players:t.players,olympicTeam:t.olympicTeam}:{label:String(label||''),seed:null,players:String(fallback||''),olympicTeam:''};
}
function matchByCode(code){return matches.find(m=>m.properties?.Match===code)?.properties||null}
function inbound(code){
  const out=[];
  for(const m of matches){const p=m.properties||{};if(p['Winner To']===code)out.push(`Winner of ${p.Match}`);if(p['Loser To']===code)out.push(`Loser of ${p.Match}`)}
  return out;
}
function statusClass(s){return String(s||'Waiting').toLowerCase().replaceAll(' ','-')}
function slot(label,players,score,done,winner,placeholder){
  const c=canonical(label,players),won=done&&label&&label===winner,main=c.players||c.label||placeholder||'Awaiting result';
  const sub=[c.label,c.olympicTeam].filter(Boolean).join(' · ');
  return `<div class="slot${won?' is-winner':''}${label?'':' placeholder'}"><div><strong>${esc(main)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>${done&&score!=null?`<b class="score">${esc(score)}</b>`:''}</div>`;
}
function card(m){
  const p=m.properties||{},done=p.Status==='Complete',ready=p.Status==='Ready',inputs=inbound(p.Match),phA=inputs.shift()||'Awaiting result',phB=inputs.shift()||'Awaiting result';
  const clickable=control&&(ready||done)&&p['Team A']&&p['Team B'];
  return `<article class="match ${statusClass(p.Status)}${clickable?' clickable':''}" data-id="${esc(m.id)}" ${clickable?'tabindex="0" role="button"':''}>
    <div class="match-head"><strong>${esc(p.Match||'Match')}</strong><span>${clickable?(done?'Tap to edit score':'Tap to score'):esc(p.Status||'Waiting')}</span></div>
    ${slot(p['Team A'],p['Team A Players'],p['Score A'],done,p.Winner,phA)}
    ${slot(p['Team B'],p['Team B Players'],p['Score B'],done,p.Winner,phB)}
  </article>`;
}
function renderRounds(host,bracket){
  const list=matches.filter(m=>m.properties?.Bracket===bracket),rounds=[...new Set(list.map(m=>Number(m.properties?.Round||0)))].filter(Boolean).sort((a,b)=>a-b);
  host.innerHTML=rounds.map(r=>{const ms=list.filter(m=>Number(m.properties?.Round)===r);return `<section class="round"><div class="round-title"><strong>${esc(roundNames[bracket]?.[r]||`Round ${r}`)}</strong><span>${ms.length} match${ms.length===1?'':'es'}</span></div>${ms.map(card).join('')}</section>`}).join('')||'<div class="loading">No bracket matches found.</div>';
}
function renderSeeds(){
  const ordered=[...teams].sort((a,b)=>{
    if(a.seed!=null&&b.seed!=null)return a.seed-b.seed;
    if(a.seed!=null)return -1;
    if(b.seed!=null)return 1;
    return a.pairNumber-b.pairNumber;
  });
  seedList.innerHTML=ordered.length?ordered.map(t=>`<article class="seed-row${t.seed==null?' unseeded':''}">
    <div class="seed-badge"><span>Seed</span><strong>${t.seed==null?'N/A':esc(t.seed)}</strong></div>
    <div class="seed-team"><strong>${esc(t.players||'Unnamed pair')}</strong><small>Pair ${esc(t.pairNumber)} · ${esc(t.olympicTeam||'No Olympic team')}</small></div>
  </article>`).join(''):'<div class="loading">0 pairs</div>';
  const seeded=teams.filter(t=>t.seed!=null).length;
  $('#seeded-count').textContent=String(seeded);
  $('#pair-count').textContent=String(teams.length);
}
function renderStatus(){
  const complete=matches.filter(m=>m.properties?.Status==='Complete').length;
  const ready=matches.filter(m=>m.properties?.Status==='Ready').length;
  const el=$('#bracket-status');
  if(!teams.length){el.textContent='0 teams';return}
  if(!teams.some(t=>t.seed!=null)){el.textContent='Waiting for seeding';return}
  el.textContent=`${complete} complete · ${ready} ready`;
}
function recordFor(label){
  let wins=0,losses=0;
  for(const m of matches){
    const p=m.properties||{};
    if(p.Status!=='Complete'||!p['Team A']||!p['Team B'])continue;
    if(p.Winner===label)wins++;
    if(p.Loser===label)losses++;
  }
  return `${wins}–${losses}`;
}
function finishRow(finish,label){
  if(!label)return'';
  const c=canonical(label),medal=/^(🥇|🥈|🥉)/.test(finish);
  return `<div class="leaderboard-row${medal?' is-medal':''}"><span class="leaderboard-finish">${esc(finish)}</span><span class="leaderboard-pair"><strong>${esc(c.players||c.label)}</strong><small>${esc(c.label)}</small></span><span class="leaderboard-team">${esc(c.olympicTeam||'—')}</span><span class="leaderboard-record">${esc(recordFor(label))}</span><span class="leaderboard-seed">${c.seed??'—'}</span></div>`;
}
function renderLeaderboard(){
  if(!leaderboard||!leaderboardStatus)return;
  const gf1=matchByCode('GF1'),gf2=matchByCode('GF2'),w7=matchByCode('W7');
  let champion='',runnerUp='';
  if(gf2?.Status==='Complete'&&gf2.Winner){champion=gf2.Winner;runnerUp=gf2.Loser}
  else if(gf1?.Status==='Complete'&&gf1.Winner&&w7?.Winner&&gf1.Winner===w7.Winner){champion=gf1.Winner;runnerUp=gf1.Loser}
  if(!champion){leaderboardStatus.textContent='Waiting for finish';leaderboard.innerHTML='<div class="loading">Final standings will appear when the tournament is complete.</div>';return}

  const rows=[
    ['🥇 1st',champion],
    ['🥈 2nd',runnerUp],
    ['🥉 3rd',matchByCode('L8')?.Loser],
    ['4th',matchByCode('L7')?.Loser],
    ['T-5th',matchByCode('L5')?.Loser],
    ['T-5th',matchByCode('L6')?.Loser],
    ['T-7th',matchByCode('L3')?.Loser],
    ['T-7th',matchByCode('L4')?.Loser],
    ['T-9th',matchByCode('L1')?.Loser],
    ['T-9th',matchByCode('L2')?.Loser]
  ].filter(x=>x[1]);
  const orderValue=x=>{const n=Number(String(x[0]).match(/\d+/)?.[0]||99);return n};
  rows.sort((a,b)=>orderValue(a)-orderValue(b)||(seedNumber(a[1])??99)-(seedNumber(b[1])??99));
  leaderboardStatus.textContent='Final';
  leaderboard.innerHTML='<div class="leaderboard-row is-header"><span>Finish</span><span>Pair</span><span>Olympic Team</span><span>Record</span><span>Seed</span></div>'+rows.map(([finish,label])=>finishRow(finish,label)).join('');
}
function render(){
  renderSeeds();renderStatus();
  if(!teams.length){
    wb.innerHTML='<div class="loading">0</div>';
    lb.innerHTML='<div class="loading">0</div>';
    finals.innerHTML='<div class="loading">0</div>';
    renderLeaderboard();
    return;
  }
  renderRounds(wb,'Winners');renderRounds(lb,'Losers');
  const fs=matches.filter(m=>m.properties?.Bracket==='Finals').sort((a,b)=>Number(a.properties?.Round)-Number(b.properties?.Round));
  finals.innerHTML=fs.map(m=>`<section class="final-card"><h4>${esc(roundNames.Finals[m.properties?.Round]||m.properties?.Match)}</h4>${card(m)}</section>`).join('')||'<div class="loading">No championship matches found.</div>';
  renderLeaderboard();
  bindScoring();
}
function openScore(id){
  if(!control)return;
  const m=matches.find(x=>x.id===id);if(!m)return;
  const p=m.properties,done=p.Status==='Complete';
  if(!(p.Status==='Ready'||done)||!p['Team A']||!p['Team B'])return;
  const a=canonical(p['Team A'],p['Team A Players']),b=canonical(p['Team B'],p['Team B Players']),sheet=$('#score-sheet');
  sheet.dataset.matchId=id;
  sheet.dataset.wasComplete=done?'1':'0';
  $('#score-sheet-title').textContent=`${p.Match} · ${done?'Edit Score':'Enter Score'}`;
  $('#score-sheet-teams').innerHTML=`<div><strong>${esc(a.players||a.label)}</strong><small>${esc([a.label,a.olympicTeam].filter(Boolean).join(' · '))}</small></div><span>vs</span><div><strong>${esc(b.players||b.label)}</strong><small>${esc([b.label,b.olympicTeam].filter(Boolean).join(' · '))}</small></div>`;
  $('#score-sheet-fields').innerHTML=`<label><span>${esc(a.players||a.label)}</span><input name="a" type="number" min="0" value="${p['Score A']??''}" required></label><label><span>${esc(b.players||b.label)}</span><input name="b" type="number" min="0" value="${p['Score B']??''}" required></label>`;
  $('#score-sheet-status').textContent=done?'Editing a completed match. If the winner changes, affected later matches will be reset.':'';
  sheet.hidden=false;document.body.classList.add('modal-open');
}
function closeScore(){const s=$('#score-sheet');s.hidden=true;s.dataset.matchId='';s.dataset.wasComplete='';document.body.classList.remove('modal-open')}
function bindScoring(){document.querySelectorAll('.match.clickable').forEach(el=>{el.onclick=()=>openScore(el.dataset.id);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openScore(el.dataset.id)}}})}
async function postScore(m,a,b,code,allowWinnerChange){
  const r=await fetch('/api/cornhole',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({matchId:m.id,scoreA:a,scoreB:b,code,allowWinnerChange})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const err=new Error(d.error||'Could not save result.');err.data=d;throw err}
  return d;
}
async function saveScore(e){
  e.preventDefault();if(!control)return;
  const sheet=$('#score-sheet'),m=matches.find(x=>x.id===sheet.dataset.matchId),fd=new FormData(e.currentTarget),a=Number(fd.get('a')),b=Number(fd.get('b')),msg=$('#score-sheet-status'),btn=e.currentTarget.querySelector('button[type="submit"]');
  if(!m)return;if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0){msg.textContent='Enter both scores.';return}if(a===b){msg.textContent='Scores cannot tie.';return}
  const code=sessionStorage.getItem('schaferOlympicsControlCode')||'';if(!code){msg.textContent='Control View is locked. Re-enter Control View.';return}
  const p=m.properties||{},newWinner=a>b?p['Team A']:p['Team B'],winnerChanges=p.Status==='Complete'&&p.Winner&&p.Winner!==newWinner;
  let allowWinnerChange=false;
  if(winnerChanges){
    allowWinnerChange=confirm(`This changes the winner from ${p.Winner} to ${newWinner}. All affected downstream Cornhole matches and scores will be reset so the bracket stays valid. Continue?`);
    if(!allowWinnerChange)return;
  }
  btn.disabled=true;msg.textContent='Saving…';
  try{
    let d;
    try{d=await postScore(m,a,b,code,allowWinnerChange)}catch(err){
      if(err.data?.needsWinnerChangeConfirmation&&!allowWinnerChange){
        if(!confirm('This correction changes the winner and will reset affected downstream Cornhole matches. Continue?'))throw err;
        d=await postScore(m,a,b,code,true);
      }else throw err;
    }
    if(Array.isArray(d.matches)){matches=d.matches;render()}
    closeScore();
  }catch(err){msg.textContent=err.message||'Could not save result.'}finally{btn.disabled=false}
}
async function load(){
  try{
    const [tr,mr]=await Promise.all([fetch('/api/cornhole/teams',{cache:'no-store'}),fetch('/api/cornhole',{cache:'no-store'})]);
    const [td,md]=await Promise.all([tr.json(),mr.json()]);
    if(!tr.ok)throw new Error(td.error||'Could not load Cornhole teams.');if(!mr.ok)throw new Error(md.error||'Could not load Cornhole bracket.');
    teams=td.teams||[];teamBySeed.clear();teams.filter(t=>t.seed!=null).forEach(t=>teamBySeed.set(Number(t.seed),t));matches=md.matches||[];render();
  }catch(err){seedList.innerHTML=`<div class="loading error">${esc(err.message)}</div>`;wb.innerHTML=`<div class="loading error">${esc(err.message)}</div>`;lb.innerHTML='';finals.innerHTML='';if(leaderboard)leaderboard.innerHTML='';$('#seeded-count').textContent='0';$('#pair-count').textContent='0';$('#bracket-status').textContent='Load error';if(leaderboardStatus)leaderboardStatus.textContent='Load error'}
}
$('#score-sheet-form').addEventListener('submit',saveScore);document.querySelectorAll('[data-close-score]').forEach(x=>x.addEventListener('click',closeScore));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeScore()});
load();
})();
