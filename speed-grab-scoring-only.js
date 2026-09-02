(()=>{
  function apply(){
    const generate=document.querySelector('#generate');
    const reset=document.querySelector('#reset');
    if(generate)generate.remove();
    if(reset)reset.remove();
    const message=document.querySelector('#message');
    if(message&&/No bracket yet/i.test(document.querySelector('#bracket')?.textContent||'')){
      message.textContent='Create the Speed Grab bracket in Game Day HQ → Teams.';
    }
    const subtitle=document.querySelector('.subtitle');
    if(subtitle)subtitle.textContent='Bracket setup is controlled in Game Day HQ → Teams. During the event, tap each matchup winner to advance them.';
  }
  document.addEventListener('DOMContentLoaded',apply);
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
})();