(()=>{
const button=document.querySelector('#team-editor-clear');
if(!button)return;
const STORAGE_KEY='schaferOlympicsControlCode';
const PAIR_PREFIX='schaferOlympicsPairings:';
const setMessage=(text,type='')=>{const el=document.querySelector('#team-editor-message');if(!el)return;el.textContent=text;el.className='team-editor-message'+(type?` ${type}`:'')};
const code=()=>sessionStorage.getItem(STORAGE_KEY)||'';
async function admin(action,extra={}){
  const r=await fetch('/api/admin/teams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,code:code(),...extra})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)throw new Error(d.error||'Could not clear team setup.');
  return d;
}
function clearLocalPairDrafts(){
  const keys=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith(PAIR_PREFIX))keys.push(k);
  }
  keys.forEach(k=>localStorage.removeItem(k));
}
function clearVisibleTeamDraft(){
  document.querySelectorAll('#team-editor-grid .team-editor-row select').forEach(select=>{
    if(select.value!==''){
      select.value='';
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
}
function clearVisibleEventPairDraft(){
  const clear=document.querySelector('#event-pair-clear');
  const grid=document.querySelector('#event-pair-grid');
  const picker=document.querySelector('#event-pair-picker');
  const seeding=document.querySelector('#cornhole-seeding');
  if(grid)grid.innerHTML='<div class="pair-team-empty">No pairs yet.</div>';
  if(picker)picker.innerHTML='';
  if(seeding)seeding.innerHTML='';
  if(clear)clear.disabled=false;
}
async function clearSavedEventPairs(){
  const d=await admin('list');
  const events=d.events||[];
  let cleared=0;
  for(const event of events){
    const key=event.key||'';
    if(!key)continue;
    try{
      const current=await admin('eventPairs',{eventKey:key});
      if((current.pairs||[]).length){
        await admin('saveEventPairs',{eventKey:key,pairs:[]});
        cleared++;
      }
    }catch(e){
      // Some events do not use participant pairs. Leave those alone.
    }
  }
  return cleared;
}
button.addEventListener('click',async e=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  if(!code()){setMessage('Control View is locked.','error');return}
  const ok=confirm('Clear ALL team setup drafts? This will unassign the current team draft, clear saved event participant pairs, local pair drafts, and any unsaved pair/seeding layout on this page. Event scores and completed results will NOT be erased.');
  if(!ok)return;
  button.disabled=true;
  setMessage('Clearing all team setup drafts…','warn');
  try{
    clearVisibleTeamDraft();
    clearLocalPairDrafts();
    const cleared=await clearSavedEventPairs();
    clearVisibleEventPairDraft();
    const selector=document.querySelector('#event-team-select');
    if(selector){selector.value='';selector.dispatchEvent(new Event('change',{bubbles:true}))}
    setMessage(`✓ Draft cleared — team assignments are unassigned in the draft and ${cleared} saved event pair setup${cleared===1?'':'s'} cleared.`,'success');
  }catch(err){
    setMessage(err.message||'Could not clear all setup drafts.','error');
  }finally{
    button.disabled=false;
  }
},true);
})();