import app from './worker-public-teams.js';
import {adminMvpStats,getPlayerMvp,loadMvpSnapshot} from './worker-mvp-stats-lib.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const base=e=>String(e.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
async function sha256(value){const bytes=new TextEncoder().encode(String(value||'')),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function validNfcToken(env,team,token){
  const url=base(env);if(!url||!env.SUPABASE_SECRET_KEY||!team||!token)return false;
  const r=await fetch(`${url}/rest/v1/nfc_team_access_tokens?select=token_hash,enabled&team=eq.${encodeURIComponent(team)}&limit=1`,{headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},cache:'no-store'});
  if(!r.ok)return false;const rows=await r.json().catch(()=>[]),row=rows?.[0];
  return Boolean(row?.enabled)&&String(row.token_hash||'')===await sha256(token);
}
async function nfcMvpStats(request,env){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  let body={};try{body=await request.json()}catch{return json({error:'Invalid request.'},400)}
  const team=String(body.team||'');
  if(!await validNfcToken(env,team,body.nfcToken))return json({error:'Invalid NFC access.'},401);
  const safeBody={...body,code:env.ADMIN_SCORE_CODE};delete safeBody.nfcToken;
  const forwarded=new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(safeBody)});
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
