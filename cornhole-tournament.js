(()=>{
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const control=new URLSearchParams(location.search).get('control')==='1';
const seedList=$('#seed-list'),wb=$('#winners-bracket'),lb=$('#losers-bracket'),finals=$('#finals-grid');
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
  return t?{label:`Seed ${seed}`,players:t.players,olympicTeam:t.olympicTeam}:{label:String(label||''),players:String(fallback||''),olympicTeam:''};
}
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
  const clickable=control&&ready&&!done;
  return `<article class="match ${statusClass(p.Status)}${clickable?' clickable':''}" data-id="${esc(m.id)}" ${clickable?'tabindex="0" role="button"':''}>
    <div class="match-head"><strong>${esc(p.Match||'Match')}</strong><span>${clickable?'Tap to score':esc(p.Status||'Waiting')}</span></div>
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
function render(){
  renderSeeds();renderStatus();
  if(!teams.length){
    wb.innerHTML='<div class="loading">0</div>';
    lb.innerHTML='<div class="loading">0</div>';
    finals.innerHTML='<div class="loading">0</div>';
    return;
  }
  renderRounds(wb,'Winners');renderRounds(lb,'Losers');
  const fs=matches.filter(m=>m.properties?.Bracket==='Finals').sort((a,b)=>Number(a.properties?.Round)-Number(b.properties?.Round));
  finals.innerHTML=fs.map(m=>`<section class="final-card"><h4>${esc(roundNames.Finals[m.properties?.Round]||m.properties?.Match)}</h4>${card(m)}</section>`).join('')||'<div class="loading">No championship matches found.</div>';
  bindScoring();
}
function openScore(id){if(!control)return;const m=matches.find(x=>x.id===id);if(!m||m.properties?.Status!=='Ready')return;const p=m.properties,a=canonical(p['Team A'],p['Team A Players']),b=canonical(p['Team B'],p['Team B Players']),sheet=$('#score-sheet');sheet.dataset.matchId=id;$('#score-sheet-title').textContent=`${p.Match} · Enter Score`;$('#score-sheet-teams').innerHTML=`<div><strong>${esc(a.players||a.label)}</strong><small>${esc([a.label,a.olympicTeam].filter(Boolean).join(' · '))}</small></div><span>vs</span><div><strong>${esc(b.players||b.label)}</strong><small>${esc([b.label,b.olympicTeam].filter(Boolean).join(' · '))}</small></div>`;$('#score-sheet-fields').innerHTML=`<label><span>${esc(a.players||a.label)}</span><input name="a" type="number" min="0" required></label><label><span>${esc(b.players||b.label)}</span><input name="b" type="number" min="0" required></label>`;$('#score-sheet-status').textContent='';sheet.hidden=false;document.body.classList.add('modal-open')}
function closeScore(){const s=$('#score-sheet');s.hidden=true;s.dataset.matchId='';document.body.classList.remove('modal-open')}
function bindScoring(){document.querySelectorAll('.match.clickable').forEach(el=>{el.onclick=()=>openScore(el.dataset.id);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openScore(el.dataset.id)}}})}
async function saveScore(e){e.preventDefault();if(!control)return;const sheet=$('#score-sheet'),m=matches.find(x=>x.id===sheet.dataset.matchId),fd=new FormData(e.currentTarget),a=Number(fd.get('a')),b=Number(fd.get('b')),msg=$('#score-sheet-status'),btn=e.currentTarget.querySelector('button[type="submit"]');if(!m)return;if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0){msg.textContent='Enter both scores.';return}if(a===b){msg.textContent='Scores cannot tie.';return}const code=sessionStorage.getItem('schaferOlympicsControlCode')||'';if(!code){msg.textContent='Control View is locked. Re-enter Control View.';return}btn.disabled=true;msg.textContent='Saving…';try{const r=await fetch('/api/cornhole',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({matchId:m.id,scoreA:a,scoreB:b,code})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not save result.');if(Array.isArray(d.matches)){matches=d.matches;render()}closeScore()}catch(err){msg.textContent=err.message||'Could not save result.'}finally{btn.disabled=false}}
async function load(){
  try{
    const [tr,mr]=await Promise.all([fetch('/api/cornhole/teams',{cache:'no-store'}),fetch('/api/cornhole',{cache:'no-store'})]);
    const [td,md]=await Promise.all([tr.json(),mr.json()]);
    if(!tr.ok)throw new Error(td.error||'Could not load Cornhole teams.');if(!mr.ok)throw new Error(md.error||'Could not load Cornhole bracket.');
    teams=td.teams||[];teamBySeed.clear();teams.filter(t=>t.seed!=null).forEach(t=>teamBySeed.set(Number(t.seed),t));matches=md.matches||[];render();
  }catch(err){seedList.innerHTML=`<div class="loading error">${esc(err.message)}</div>`;wb.innerHTML=`<div class="loading error">${esc(err.message)}</div>`;lb.innerHTML='';finals.innerHTML='';$('#seeded-count').textContent='0';$('#pair-count').textContent='0';$('#bracket-status').textContent='Load error'}
}
$('#score-sheet-form').addEventListener('submit',saveScore);document.querySelectorAll('[data-close-score]').forEach(x=>x.addEventListener('click',closeScore));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeScore()});
load();
})();
