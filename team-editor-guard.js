(()=>{
  const message=()=>document.querySelector('#event-team-message');
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
})();
