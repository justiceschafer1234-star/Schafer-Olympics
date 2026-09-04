import app from './worker-pair-events.js';
import {adminMvpStats,getPlayerMvp,loadMvpSnapshot} from './worker-mvp-14.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});

async function playerHqWithMvp(request,env,ctx){
  const response=await app.fetch(request,env,ctx);
  if(!response.ok)return response;
  let data;try{data=await response.json()}catch{return response}
  if(!data?.ok||!data?.player?.id)return json(data,response.status);
  const snapshot=await loadMvpSnapshot(env);
  const person=snapshot.participants.find(p=>String(p.notion_page_id||'')===String(data.player.id)||String(p.id)===String(data.player.id));
  if(!person)return json(data,response.status);
  const mvp=await getPlayerMvp(env,person.id);
  data.summary={...(data.summary||{}),mvpPoints:mvp.totalPoints};
  const byKey=new Map((mvp.events||[]).map(x=>[String(x.eventKey),x]));
  data.events=(data.events||[]).map(event=>({...event,mvp:byKey.get(String(event.eventKey))||null}));
  if(data.nextEvent?.eventKey)data.nextEvent={...data.nextEvent,mvp:byKey.get(String(data.nextEvent.eventKey))||null};
  return json(data,response.status);
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    try{
      if(path==='/api/admin/mvp-stats')return adminMvpStats(request,env);
      if(path==='/api/player-hq')return playerHqWithMvp(request,env,ctx);
      return app.fetch(request,env,ctx);
    }catch(e){return json({error:String(e?.message||e)},502)}
  }
};
