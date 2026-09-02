(()=>{
const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'],STORAGE_KEY='schaferOlympicsControlCode';
const CONFIG={
  'kids-soccer':{combined:true,kids:true,title:'Kids Soccer'},
  'junior-basketball':{combined:true,title:'Junior Basketball'},
  'nuke-em':{combined:false,title:'Nuke ’Em'},
  'fill-the-water-bottle':{combined:false,title:'Fill the Water Bottle'},
  'protect-the-balloon-baby':{combined:false,title:'Protect the Balloon Baby'},
  'kids-dodgeball':{combined:true,title:'Kids Dodgeball'},
  'women-s-dodgeball':{combined:true,title:'Women’s Dodgeball'},
  'men-s-dodgeball':{combined:true,title:'Men’s Dodgeball'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rendering=false,lastData=null;
const code=()=>sessionStorage.getItem(STORAGE_KEY)||'';
const short=t=>String(t||'').replace('Team ','');
function hidePairControls(on){['#event-pair-picker','#event-pair-grid','#event-pair-undo','#event-pair-clear','#event-pair-save'].forEach(q=>{const e=document.querySelector(q);if(e)e.hidden=on})}
function options(value,used=[]){return '<option value="">Choose team…</option>'+TEAMS.map(t=>`<option value="${esc(t)}" ${t===value?'selected':''} ${used.includes(t)&&t!==value?'disabled':''}>${esc(short(t))}</option>`).join('')}
async function getData(key,cfg){if(cfg.kids){const r=await fetch('/api/kids-soccer',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load Kids Soccer teams.');return{kind:'kids',sides:d.sides||[],state:null}}const r=await fetch(`/api/event-scorecard?eventKey=${encodeURIComponent(key)}`,{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load event teams.');return{kind:'generic',sides:d.state?.sides||[[],[]],state:d.state||{},data:d}}
function flatSelections(){return [...document.querySelectorAll('.matchup-team-select')].map(s=>s.value)}
function renderSelectors(key,cfg,payload,message=''){
  const host=document.querySelector('#cornhole-seeding'),sum=document.querySelector('#event-team-summary');if(!host)return;rendering=true;lastData=payload;
  const size=cfg.combined?2:1;let vals=[];
  if(payload.kind==='kids'){for(const s of payload.sides)vals.push(s.team_a||'',s.team_b||'');vals=vals.slice(0,4)}else vals=[...(payload.sides?.[0]||[]),...(payload.sides?.[1]||[])];
  while(vals.length<size*2)vals.push('');
  if(sum)sum.innerHTML=`<strong>${cfg.title}</strong> · team matchup is controlled here in the Teams tab.`;
  host.innerHTML=`<div class="cornhole-seeding team-matchup-setup"><p class="section-kicker">Control View only</p><h3>${esc(cfg.title)} Team Matchup</h3><p class="team-editor-note">Choose the Olympic teams for each side here. The event page is scoring only.</p><div class="seed-grid">${[0,1].map(side=>`<div class="seed-row"><strong>Side ${side?'B':'A'}</strong><div class="event-pair">${Array.from({length:size},(_,j)=>{const idx=side*size+j;return `<select class="matchup-team-select" data-i="${idx}">${options(vals[idx],vals.filter(Boolean))}</select>`}).join('<span>+</span>')}</div></div>`).join('')}</div><div class="seed-actions"><button id="matchup-random" class="refresh" type="button">🎲 Randomize</button><button id="matchup-save" class="save-score seed-save" type="button">Save Matchup</button><span id="matchup-message" class="team-editor-message">${esc(message)}</span></div></div>`;
  host.querySelectorAll('.matchup-team-select').forEach(s=>s.onchange=()=>renderSelectors(key,cfg,{...payload,sides:cfg.kids?payload.sides:[flatSelections().slice(0,size),flatSelections().slice(size)]},'Unsaved matchup changes'));
  host.querySelector('#matchup-random').onclick=()=>{const x=[...TEAMS].sort(()=>Math.random()-.5);host.querySelectorAll('.matchup-team-select').forEach((s,i)=>s.value=x[i]);const m=host.querySelector('#matchup-message');if(m)m.textContent='🎲 Random matchup ready — press Save Matchup.'};
  host.querySelector('#matchup-save').onclick=()=>save(key,cfg,payload);
  rendering=false;
}
async function save(key,cfg,payload){const vals=flatSelections(),size=cfg.combined?2:1,msg=document.querySelector('#matchup-message'),btn=document.querySelector('#matchup-save');if(vals.length!==size*2||vals.some(x=>!x)||new Set(vals).size!==vals.length){if(msg)msg.textContent='Choose each Olympic team only once.';return}if(!code()){if(msg)msg.textContent='Control View is locked.';return}btn.disabled=true;if(msg)msg.textContent='Saving…';try{
  if(cfg.kids){let r=await fetch('/api/kids-soccer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'configure',teams:vals,forceReset:false,code:code()})}),d=await r.json().catch(()=>({}));if(r.status===409&&d.needsResetConfirmation){if(!confirm('Kids Soccer already has a recorded score. Changing teams will reset the score. Continue?'))return;r=await fetch('/api/kids-soccer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'configure',teams:vals,forceReset:true,code:code()})});d=await r.json().catch(()=>({}))}if(!r.ok)throw new Error(d.error||'Could not save Kids Soccer teams.');await load('✓ Matchup saved.');return}
  const state=JSON.parse(JSON.stringify(payload.state||{}));const hasResults=state.winnerSide===0||state.winnerSide===1||(state.games||[]).some(x=>x===0||x===1);if(hasResults&&!confirm(`${cfg.title} already has scoring entered. Changing the matchup will clear those game results. Continue?`))return;state.sides=[vals.slice(0,size),vals.slice(size,size*2)];state.games=[];delete state.winnerSide;state.complete=false;const r=await fetch(`/api/event-scorecard?eventKey=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',state,code:code()})}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not save matchup.');await load('✓ Matchup saved.');
}catch(e){if(msg)msg.textContent=e.message}finally{const b=document.querySelector('#matchup-save');if(b)b.disabled=false}}
async function load(message=''){const sel=document.querySelector('#event-team-select'),host=document.querySelector('#cornhole-seeding');if(!sel||!host)return false;const key=sel.value,cfg=CONFIG[key];if(!cfg){return false}hidePairControls(true);try{const d=await getData(key,cfg);renderSelectors(key,cfg,d,message)}catch(e){renderSelectors(key,cfg,{kind:cfg.kids?'kids':'generic',sides:cfg.kids?[]:[[],[]],state:{}},e.message||'Could not load matchup.')}return true}
function attach(){const sel=document.querySelector('#event-team-select'),host=document.querySelector('#cornhole-seeding');if(!sel||!host)return false;if(sel.dataset.matchupAttached!=='1'){sel.dataset.matchupAttached='1';sel.addEventListener('change',()=>setTimeout(()=>{const special=Boolean(CONFIG[sel.value]);if(special)load();},40))}if(host.dataset.matchupObserved!=='1'){host.dataset.matchupObserved='1';new MutationObserver(()=>{if(rendering)return;if(CONFIG[sel.value]&&!host.querySelector('.team-matchup-setup'))setTimeout(()=>load(),30)}).observe(host,{childList:true,subtree:false})}if(CONFIG[sel.value])load();return true}
if(!attach()){const o=new MutationObserver(()=>{if(attach())o.disconnect()});o.observe(document.body,{childList:true,subtree:true})}
})();