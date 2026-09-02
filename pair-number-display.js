(()=>{
  const clean=text=>String(text||'').replace(/^Pair\s+\d+\s*:\s*/i,'').trim();
  function update(){
    const board=document.querySelector('#leaderboard');
    if(!board)return;
    board.querySelectorAll('.standing strong').forEach(el=>{
      const next=clean(el.textContent);
      if(next&&next!==el.textContent)el.textContent=next;
    });
  }
  const board=document.querySelector('#leaderboard');
  if(!board)return;
  new MutationObserver(update).observe(board,{childList:true,subtree:true});
  update();
})();