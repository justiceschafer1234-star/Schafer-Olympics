(()=>{
  const nativeFetch=window.fetch.bind(window);
  const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
  const isSpeedGrab=url=>{
    try{
      const u=new URL(typeof url==='string'?url:url?.url||'',location.href);
      return u.pathname==='/api/event-scorecard'&&u.searchParams.get('eventKey')==='speed-grab';
    }catch{return false}
  };
  const isOldTeamOnlyState=state=>Array.isArray(state?.entries)&&state.entries.length===4&&state.entries.every(e=>TEAMS.includes(e?.id));

  window.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    if(!isSpeedGrab(input)||!response.ok)return response;
    let data;
    try{data=await response.clone().json()}catch{return response}
    if(!data||data.rule?.mode!=='bracket')return response;

    // Remove the temporary four-team bracket state from the previous setup.
    // Leaving state empty lets the normal scorecard build entries from the
    // actual registered Speed Grab participants and their Olympic teams.
    if(isOldTeamOnlyState(data.state))data.state={};

    return new Response(JSON.stringify(data),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };

  function relabel(){
    if(new URLSearchParams(location.search).get('event')!=='speed-grab')return;
    const notice=document.querySelector('#notice');
    if(notice&&/Random seeding pairs members/i.test(notice.textContent)){
      notice.textContent='Press Random Teammate Bracket. Opening matches will pair registered participants with someone from their own Olympic team whenever possible. Winners then advance normally.';
    }
    const seed=document.querySelector('#seed-bracket');
    if(seed)seed.textContent='🎲 Random Teammate Bracket';
  }

  new MutationObserver(relabel).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',relabel);
})();