(()=>{
const STORAGE_KEY='schaferOlympicsControlCode';
const isWiffle=k=>String(k||'').toLowerCase().includes('wiffle');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rendering=false;

function seedOrder(matches=[]){
  const by=code=>matches.find(m=>m.properties?.Match===code)?.properties||{};
  const sf1=by('SF1'),sf2=by('SF2');
  return [sf1['Team A'],sf2['Team A'],sf2['Team B'],sf1['Team B']].filter(Boolean);
}

function setPairingMode(wiffle){
  const picker=document.querySelector('#event-pair-picker');
  const grid=document.querySelector('#event-pair-grid');
  const summary=document.querySelector('#event-team-summary');
  const undo=document.querySelector('#event-pair-undo');
  const clear=document.querySelector('#event-pair-clear');
  const save=document.querySelector('#event-pair-save');
  [picker,grid,undo,clear,save].forEach(el=>{if(el)el.hidden=wiffle});
  if(wiffle&&summary)summary.innerHTML='<strong>4 Olympic teams</strong> · Wiffle Ball uses Red, Blue, Green, and Gold. Randomize the bracket below.';
}

async function draw(forceReset=false){
  const code=sessionStorage.getItem(STORAGE_KEY)||'';
  const msg=document.querySelector('#wiffle-seed-message');
  const btn=document.querySelector('#wiffle-seed-random');
  if(!code){if(msg)msg.textContent='Control View is locked.';return}
  if(btn)btn.disabled=true;if(msg)msg.textContent='Drawing random seeds…';
  try{
    let r=await fetch('/api/wiffle-ball/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,forceReset})});
    let d=await r.json().catch(()=>({}));
    if(r.status===409&&d.needsResetConfirmation&&!forceReset){
      if(!confirm('Wiffle Ball already has results. Random seeding will RESET all Wiffle Ball scores. Continue?')){if(msg)msg.textContent='Seeding unchanged.';return}
      return draw(true);
    }
    if(!r.ok)throw new Error(d.error||'Could not seed Wiffle Ball.');
    renderPanel(d.matches||[], '🎲 Random seeding saved.');
  }catch(e){if(msg)msg.textContent=e.message||'Could not seed Wiffle Ball.'}
  finally{const b=document.querySelector('#wiffle-seed-random');if(b)b.disabled=false}
}

function renderPanel(matches=[],message=''){
  const host=document.querySelector('#cornhole-seeding');
  const sel=document.querySelector('#event-team-select');
  if(!host||!sel||!isWiffle(sel.value))return;
  rendering=true;
  const seeds=seedOrder(matches);
  host.innerHTML=`<div class="cornhole-seeding wiffle-team-seeding"><p class="section-kicker">Control View only</p><h3>Wiffle Ball Seeding</h3><p class="team-editor-note">The four Olympic teams are randomly seeded. Seed 1 plays Seed 4, and Seed 2 plays Seed 3.</p><div class="seed-grid">${Array.from({length:4},(_,i)=>`<div class="seed-row"><strong>Seed ${i+1}</strong><div class="event-pair"><span>${esc(seeds[i]||'Not seeded')}</span></div></div>`).join('')}</div><div class="seed-warning">Randomizing after Wiffle Ball has started requires confirmation and resets all Wiffle Ball game results.</div><div class="seed-actions"><button id="wiffle-seed-random" class="save-score seed-save" type="button">🎲 Random Seed &amp; Save</button><span id="wiffle-seed-message" class="team-editor-message">${esc(message)}</span></div></div>`;
  host.querySelector('#wiffle-seed-random').onclick=()=>draw(false);
  rendering=false;
}

async function loadPanel(){
  const sel=document.querySelector('#event-team-select');
  const host=document.querySelector('#cornhole-seeding');
  if(!sel||!host)return;
  const wiffle=isWiffle(sel.value);
  setPairingMode(wiffle);
  if(!wiffle)return;
  try{
    const r=await fetch('/api/wiffle-ball',{cache:'no-store'}),d=await r.json();
    if(!r.ok)throw new Error(d.error||'Could not load Wiffle Ball seeding.');
    renderPanel(d.matches||[]);
  }catch(e){renderPanel([],e.message||'Could not load Wiffle Ball seeding.')}
}

function attach(){
  const sel=document.querySelector('#event-team-select');
  const host=document.querySelector('#cornhole-seeding');
  if(!sel||!host)return false;
  if(sel.dataset.wiffleSeedAttached!=='1'){
    sel.dataset.wiffleSeedAttached='1';
    sel.addEventListener('change',()=>setTimeout(loadPanel,0));
  }
  if(host.dataset.wiffleSeedObserved!=='1'){
    host.dataset.wiffleSeedObserved='1';
    new MutationObserver(()=>{
      if(rendering)return;
      if(isWiffle(sel.value)&&!host.querySelector('.wiffle-team-seeding'))setTimeout(loadPanel,0);
    }).observe(host,{childList:true,subtree:false});
  }
  loadPanel();
  return true;
}

if(!attach()){
  const observer=new MutationObserver(()=>{if(attach())observer.disconnect()});
  observer.observe(document.body,{childList:true,subtree:true});
}
})();