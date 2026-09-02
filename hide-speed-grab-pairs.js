(()=>{
  function remove(){
    const select=document.querySelector('#event-team-select');
    if(!select)return;
    const option=[...select.options].find(o=>o.value==='speed-grab');
    if(option){
      if(select.value==='speed-grab'){
        select.value='';
        select.dispatchEvent(new Event('change',{bubbles:true}));
      }
      option.remove();
    }
  }
  new MutationObserver(remove).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',remove);
  remove();
})();