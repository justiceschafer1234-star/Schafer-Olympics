(()=>{
  let scheduled=false;

  function setText(el,text){
    if(el&&el.textContent!==text)el.textContent=text;
  }

  function apply(){
    scheduled=false;
    const generate=document.querySelector('#generate');
    const reset=document.querySelector('#reset');
    if(generate)generate.remove();
    if(reset)reset.remove();

    const bracketText=document.querySelector('#bracket')?.textContent||'';
    const message=document.querySelector('#message');
    if(message&&/No bracket yet/i.test(bracketText)){
      setText(message,'Create the Speed Grab bracket in Game Day HQ → Teams.');
    }

    const subtitle=document.querySelector('.subtitle');
    setText(subtitle,'Bracket setup is controlled in Game Day HQ → Teams. During the event, tap each matchup winner to advance them.');
  }

  function scheduleApply(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(apply);
  }

  document.addEventListener('DOMContentLoaded',scheduleApply);
  new MutationObserver(scheduleApply).observe(document.documentElement,{childList:true,subtree:true});
  scheduleApply();
})();
