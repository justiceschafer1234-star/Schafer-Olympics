(()=>{
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const control=new URLSearchParams(location.search).get('control')==='1';
const TEAM_CLASS={'Team Red':'team-red','Team Blue':'team-blue','Team Green':'team-green','Team Gold':'team-gold'};
let matches=[],rosters={};
const code=()=>sessionStorage.getItem('schaferOlympicsControlCode')||'';
const by=c=>matches.find(m=>m.properties?.Match===c),p=c=>by(c)?.properties||{};
const teamShort=t=>String(t||'').replace('Team ','');
const teamClass=t=>TEAM_CLASS[t]||'';
const members=t=>(rosters[t]||[]).filter(Boolean);
function memberLine(team){const people=members(team);return people.length?`<div class="team-members">${people.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`:'<div class="team-members empty">No registered members</div>'}
function teamBlock(team,sub=''){if(!team)return `<div class="team-block placeholder"><strong>${esc(sub||'Awaiting result')}</strong></div>`;return `<div class="team-block ${teamClass(team)}"><div class="team-name-row"><span class="team-dot" aria-hidden="true"></span><strong>${esc(team)}</strong></div>${memberLine(team)}</div>`}
function seedOrder(){const a=p('SF1'),b=p('SF2');return [a['Team A'],b['Team A'],b['Team B'],a['Team B']].filter(Boolean)}
function statusClass(s){return String(s||'Waiting').toLowerCase().replaceAll(' ','-')}
function slot(team,score,done,winner,placeholder='Awaiting result'){return `<div class="slot ${teamClass(team)}${done&&team===winner?' is-winner':''}${team?'':' placeholder'}">${teamBlock(team,placeholder)}${done&&score!=null?`<b class="score">${esc(score)}</b>`:''}</div>`}
function card(c,title,placeholderA='Awaiting result',placeholderB='Awaiting result'){
  const m=by(c),x=m?.properties||{},done=x.Status==='Complete',ready=x.Status==='Ready',clickable=control&&(ready||done)&&x['Team A']&&x['Team B'];
  return `<article class="match ${statusClass(x.Status)}${clickable?' clickable':''}" data-id="${esc(m?.id||'')}" ${clickable?'tabindex="0" role="button"':''}><div class="match-head"><strong>${esc(title)}</strong><span>${clickable?(done?'Tap to edit score':'Tap to score'):esc(x.Status||'Waiting')}</span></div>${slot(x['Team A'],x['Score A'],done,x.Winner,placeholderA)}${slot(x['Team B'],x['Score B'],done,x.Winner,placeholderB)}</article>`;
}
function finishRow(label,place,team){return `<article class="seed-row ${teamClass(team)}"><div class="seed-badge"><span>${label}</span><strong>${place}</strong></div>${teamBlock(team,'Awaiting result')}</article>`}
function render(){
  const seeds=seedOrder(),complete=matches.filter(m=>m.properties?.Status==='Complete').length,ready=matches.filter(m=>m.properties?.Status==='Ready').length;
  $('#seed-list').innerHTML=seeds.length===4?seeds.map((t,i)=>`<article class="seed-row ${teamClass(t)}"><div class="seed-badge"><span>Seed</span><strong>${i+1}</strong></div>${teamBlock(t)}</article>`).join(''):'<div class="loading">0 teams seeded</div>';
  $('#seeded-count').textContent=String(seeds.length);
  $('#bracket-status').textContent=seeds.length?`${complete} complete · ${ready} ready`:'0 teams';
  $('#semifinals').innerHTML=`<section class="round"><div class="round-title"><strong>Semifinals</strong><span>2 matches</span></div>${card('SF1','Semifinal 1')}${card('SF2','Semifinal 2')}</section>`;
  $('#medal-games').innerHTML=`<section class="round"><div class="round-title"><strong>Medal Games</strong><span>2 matches</span></div>${card('B','🥉 Third Place','Loser of Semifinal 1','Loser of Semifinal 2')}${card('F','🏆 Championship','Winner of Semifinal 1','Winner of Semifinal 2')}</section>`;
  const f=p('F'),b=p('B');
  $('#podium').innerHTML=`<div class="seed-list">${finishRow('🥇','1',f.Winner)}${finishRow('🥈','2',f.Loser)}${finishRow('🥉','3',b.Winner)}${finishRow('4th','4',b.Loser)}</div>`;
  bind();
}
function bind(){document.querySelectorAll('.match.clickable').forEach(el=>{el.onclick=()=>openScore(el.dataset.id);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openScore(el.dataset.id)}}})}
function openScore(id){
  const m=matches.find(x=>x.id===id);if(!m||!control)return;
  const x=m.properties,done=x.Status==='Complete',s=$('#score-sheet');if(!(x.Status==='Ready'||done)||!x['Team A']||!x['Team B'])return;
  s.dataset.matchId=id;
  $('#score-sheet-title').textContent=`${x.Match} · ${done?'Edit Score':'Enter Score'}`;
  $('#score-sheet-teams').innerHTML=`${teamBlock(x['Team A'])}<span>vs</span>${teamBlock(x['Team B'])}`;
  $('#score-sheet-fields').innerHTML=`<label class="${teamClass(x['Team A'])}"><span>${esc(x['Team A'])}</span><input name="a" type="number" min="0" value="${x['Score A']??''}" required></label><label class="${teamClass(x['Team B'])}"><span>${esc(x['Team B'])}</span><input name="b" type="number" min="0" value="${x['Score B']??''}" required></label>`;
  $('#score-sheet-status').textContent=done?'Editing a completed game. If the winner changes, affected medal games will be reset.':'';
  s.hidden=false;document.body.classList.add('modal-open');
}
function close(){const s=$('#score-sheet');s.hidden=true;s.dataset.matchId='';document.body.classList.remove('modal-open')}
async function postScore(m,a,b,allowWinnerChange){
  const r=await fetch('/api/wiffle-ball',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({matchId:m.id,scoreA:a,scoreB:b,code:code(),allowWinnerChange})}),d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||'Could not save result.');e.data=d;throw e}return d;
}
async function save(e){
  e.preventDefault();const s=$('#score-sheet'),m=matches.find(x=>x.id===s.dataset.matchId),fd=new FormData(e.currentTarget),a=Number(fd.get('a')),b=Number(fd.get('b')),msg=$('#score-sheet-status'),btn=e.currentTarget.querySelector('button[type="submit"]');
  if(!m)return;if(!code()){msg.textContent='Control View is locked.';return}if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0||a===b){msg.textContent='Enter two valid, non-tied scores.';return}
  const x=m.properties||{},newWinner=a>b?x['Team A']:x['Team B'],winnerChanges=x.Status==='Complete'&&x.Winner&&x.Winner!==newWinner;
  let allowWinnerChange=false;
  if(winnerChanges){allowWinnerChange=confirm(`This changes the winner from ${x.Winner} to ${newWinner}. Any affected Championship or Third Place result will be reset so the bracket stays valid. Continue?`);if(!allowWinnerChange)return}
  btn.disabled=true;msg.textContent='Saving…';
  try{
    let d;try{d=await postScore(m,a,b,allowWinnerChange)}catch(err){if(err.data?.needsWinnerChangeConfirmation&&!allowWinnerChange){if(!confirm('This correction changes the winner and may reset affected medal games. Continue?'))throw err;d=await postScore(m,a,b,true)}else throw err}
    matches=d.matches||matches;render();close();
  }catch(err){msg.textContent=err.message||'Could not save result.'}finally{btn.disabled=false}
}
async function randomSeed(){
  if(!code()){alert('Control View is locked.');return}
  const btn=$('#random-seed'),msg=$('#seed-message');btn.disabled=true;if(msg)msg.textContent='Drawing random seeds…';
  try{
    let r=await fetch('/api/wiffle-ball/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code(),forceReset:false})}),d=await r.json().catch(()=>({}));
    if(r.status===409&&d.needsResetConfirmation){if(!confirm('Random seeding will reset all Wiffle Ball scores. Continue?'))return;r=await fetch('/api/wiffle-ball/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code(),forceReset:true})});d=await r.json().catch(()=>({}))}
    if(!r.ok)throw new Error(d.error||'Could not seed Wiffle Ball.');matches=d.matches||matches;render();if(msg)msg.textContent='🎲 Random seeding saved.';
  }catch(e){if(msg)msg.textContent=e.message||'Could not seed Wiffle Ball.';else alert(e.message)}finally{btn.disabled=false}
}
async function loadRosters(){
  try{
    const scoresResponse=await fetch('/api/scores',{cache:'no-store'}),scores=await scoresResponse.json();
    if(!scoresResponse.ok)throw new Error('Could not locate Wiffle Ball event.');
    const row=(scores.rows||[]).find(r=>/wiffle ball/i.test(String(r.properties?.Event||'')));
    if(!row?.id)throw new Error('Wiffle Ball event not found.');
    const r=await fetch(`/api/event-rosters?eventId=${encodeURIComponent(row.id)}`,{cache:'no-store'}),d=await r.json();
    if(!r.ok)throw new Error(d.error||'Could not load Wiffle Ball rosters.');
    rosters=Object.fromEntries((d.rosters||[]).map(x=>[x.team,x.participants||[]]));
  }catch{rosters={}}
}
async function load(){try{const [r]=await Promise.all([fetch('/api/wiffle-ball',{cache:'no-store'}),loadRosters()]),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load Wiffle Ball.');matches=d.matches||[];render()}catch(e){$('#bracket-status').textContent='Load error';$('#semifinals').innerHTML=`<div class="loading error">${esc(e.message)}</div>`;$('#medal-games').innerHTML=''}}
if(!control)$('#seed-actions').hidden=true;else $('#random-seed').onclick=randomSeed;
$('#score-sheet-form').addEventListener('submit',save);document.querySelectorAll('[data-close-score]').forEach(x=>x.onclick=close);document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});load();
})();
