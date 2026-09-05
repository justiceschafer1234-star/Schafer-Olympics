import app from './worker-public-teams.js';
import {adminMvpStats,getPlayerMvp,loadMvpSnapshot} from './worker-mvp-stats-lib.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const NFC_HASHES={
  'Team Red':'01a5fe816e17ebc20646f9d7f9b060834a7d10734bc61573cb17e9060f5ea3a1',
  'Team Blue':'ad7a8c7a3ce808bd6181f499a52b0b3b4e8edc16f74fafb3b5036c89608f456c',
  'Team Green':'135664d21bf91ac73af53b09c14d2c71bbf5bd65367c01864d18cdb1f6dd946a',
  'Team Gold':'5fb547298db39ef05bf26eb43c70cd97a90980546031d46b03331954e90fa461'
};
async function sha256(value){const bytes=new TextEncoder().encode(String(value||'')),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function nfcMvpStats(request,env){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  let body={};try{body=await request.json()}catch{return json({error:'Invalid request.'},400)}
  const team=String(body.team||''),expected=NFC_HASHES[team];
  if(!expected||await sha256(body.nfcToken)!==expected)return json({error:'Invalid NFC access.'},401);
  const forwarded=new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,code:env.ADMIN_SCORE_CODE,nfcToken:undefined})});
  return adminMvpStats(forwarded,env);
}
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
      if(path==='/api/nfc/mvp-stats')return nfcMvpStats(request,env);
      if(path==='/api/player-hq')return playerHqWithMvp(request,env,ctx);
      return app.fetch(request,env,ctx);
    }catch(e){return json({error:String(e?.message||e)},502)}
  }
};
