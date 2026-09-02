(()=>{
  const nativeFetch=window.fetch.bind(window);
  const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
  const isSpeedGrab=url=>{
    try{
      const u=new URL(typeof url==='string'?url:url?.url||'',location.href);
      return u.pathname==='/api/event-scorecard'&&u.searchParams.get('eventKey')==='speed-grab';
    }catch{return false}
  };
  const validTeamState=state=>Array.isArray(state?.entries)&&state.entries.length===4&&state.entries.every(e=>TEAMS.includes(e?.id));
  window.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    if(!isSpeedGrab(input)||!response.ok)return response;
    let data;
    try{data=await response.clone().json()}catch{return response}
    if(!data||data.rule?.mode!=='bracket')return response;
    data.participants=TEAMS.map(team=>({id:team,key:team.toLowerCase().replaceAll(' ','-'),name:team.replace('Team ','')+' Team',team}));
    if(!validTeamState(data.state))data.state={};
    return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:response.headers});
  };

  function relabel(){
    if(new URLSearchParams(location.search).get('event')!=='speed-grab')return;
    const notice=document.querySelector('#notice');
    if(notice&&/Random seeding pairs members/i.test(notice.textContent))notice.textContent='Press Random Team Matchups to randomly draw the four Olympic teams into two opening matches. Winners advance through the bracket.';
    const seed=document.querySelector('#seed-bracket');
    if(seed)seed.textContent='🎲 Random Team Matchups';
  }
  new MutationObserver(relabel).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',relabel);
})();