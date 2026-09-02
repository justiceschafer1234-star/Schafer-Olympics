(()=>{
const sheet=document.querySelector('#score-sheet'),form=document.querySelector('#score-sheet-form'),title=document.querySelector('#score-sheet-title'),status=document.querySelector('#score-sheet-status');
if(!sheet||!form||!title)return;
const endpoint=location.pathname.includes('cornhole')?'/api/cornhole':location.pathname.includes('wiffle')?'/api/wiffle-ball':'';
if(!endpoint)return;
const control=new URLSearchParams(location.search).get('control')==='1';
if(!control)return;
const btn=document.createElement('button');
btn.type='button';btn.id='clear-tournament-result';btn.className='score-sheet__save';btn.textContent='Clear Result';btn.hidden=true;btn.style.background='#b42318';
const save=form.querySelector('button[type="submit"]');save?.insertAdjacentElement('afterend',btn);
function sync(){btn.hidden=sheet.hidden||!String(title.textContent||'').includes('Edit Score')||!sheet.dataset.matchId}
new MutationObserver(sync).observe(sheet,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(sync).observe(title,{childList:true,subtree:true,characterData:true});
async function post(allowDownstreamReset){
  const code=sessionStorage.getItem('schaferOlympicsControlCode')||'';
  if(!code)throw new Error('Control View is locked. Re-enter Control View.');
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clear',matchId:sheet.dataset.matchId,code,allowDownstreamReset})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||'Could not clear result.');e.data=d;throw e}return d;
}
btn.onclick=async()=>{
  if(!confirm('Clear this result? The teams in this game will stay assigned.'))return;
  btn.disabled=true;if(status)status.textContent='Clearing…';
  try{
    let d;
    try{d=await post(false)}catch(e){
      if(e.data?.needsResetConfirmation){
        if(!confirm('Later tournament results depend on this game. Clearing it will also reset those affected results. Continue?'))throw Object.assign(new Error('Clear canceled.'),{canceled:true});
        d=await post(true);
      }else throw e;
    }
    if(status)status.textContent=d.resetCount?`Cleared. ${d.resetCount} downstream result${d.resetCount===1?'':'s'} reset.`:'Result cleared.';
    location.reload();
  }catch(e){if(!e.canceled&&status)status.textContent=e.message||'Could not clear result.'}
  finally{btn.disabled=false}
};
sync();
})();
