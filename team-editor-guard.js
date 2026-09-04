(()=>{
  const message=()=>document.querySelector('#event-team-message');
  const LOCK_NOTE='Final Olympic team assignments are locked for Game Day. Event pair setup and tournament seeding below are still available.';

  function lockMasterTeamEditor(){
    const save=document.querySelector('#team-editor-save');
    const balance=document.querySelector('#team-editor-balance');
    const clear=document.querySelector('#team-editor-clear');
    [save,balance,clear].forEach(btn=>{if(btn){btn.disabled=true;btn.dataset.forceDisabled='1';}});
    if(save&&save.textContent!=='🔒 Teams Locked')save.textContent='🔒 Teams Locked';
    if(balance&&balance.textContent!=='⚖️ Final Teams Locked')balance.textContent='⚖️ Final Teams Locked';
    document.querySelectorAll('#team-editor-grid select').forEach(select=>{
      select.disabled=true;
      select.setAttribute('aria-disabled','true');
    });
    const note=document.querySelector('.team-editor-panel .team-editor-note');
    if(note&&note.textContent!==LOCK_NOTE)note.textContent=LOCK_NOTE;
    const msg=document.querySelector('#team-editor-message');
    if(msg&&!msg.textContent.trim()){
      msg.textContent='🔒 Final team assignments locked';
      msg.className='team-editor-message success';
    }
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('.pair-person');
    if(!btn)return;
    if(btn.classList.contains('selected')){
      e.preventDefault();
      e.stopImmediatePropagation();
      const msg=message();
      if(msg){
        msg.textContent='Pick a different teammate. A person cannot be paired with themselves.';
        msg.className='team-editor-message error';
      }
    }
  },true);

  const observer=new MutationObserver(lockMasterTeamEditor);
  if(document.body)observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',lockMasterTeamEditor,{once:true});
  window.addEventListener('schafer-control-unlocked',()=>requestAnimationFrame(lockMasterTeamEditor));
  lockMasterTeamEditor();

  if(!document.querySelector('script[data-slip-slide-team-setup]')){
    const s=document.createElement('script');
    s.src='/slip-slide-team-setup.js?v=1';
    s.defer=true;
    s.dataset.slipSlideTeamSetup='1';
    document.head.appendChild(s);
  }
})();
