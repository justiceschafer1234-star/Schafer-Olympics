import app from './worker-kids-soccer.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const base=e=>String(e.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const filter=v=>encodeURIComponent(String(v));

async function sb(env,path,init={}){
  const url=base(env);
  if(!url||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime secrets are missing.');
  const r=await fetch(`${url}/rest/v1/${path}`,{
    ...init,
    headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...(init.headers||{})},
  });
  const text=await r.text();
  let data=null;
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||`Supabase ${r.status}`));
  return data;
}

const select=(env,table,query='')=>sb(env,`${table}?${query}`);
const patch=(env,table,query,body)=>sb(env,`${table}?${query}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});
const insert=(env,table,body)=>sb(env,table,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});

function newToken(){
  return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
}

async function resolvePlayer(env,rawToken){
  const token=String(rawToken||'').trim();
  if(token.length<32||token.length>256)return null;
  const tokens=await select(env,'player_nfc_tokens',`select=participant_id,token,active&token=eq.${filter(token)}&active=eq.true&limit=1`);
  const row=tokens[0];
  if(!row)return null;
  const people=await select(env,'participants',`select=id,notion_page_id,participant,team,divisions&id=eq.${filter(row.participant_id)}&limit=1`);
  const person=people[0];
  return person?{...person,token}:null;
}

function touchToken(env,player,ctx){
  const promise=patch(env,'player_nfc_tokens',`participant_id=eq.${filter(player.id)}`,{last_used_at:new Date().toISOString()}).catch(e=>console.error('Unable to update NFC last-used time',e));
  if(ctx?.waitUntil)ctx.waitUntil(promise);
}

async function nfcRegistration(request,env,ctx){
  if(request.method==='GET'){
    const token=request.headers.get('x-player-nfc');
    if(!token)return app.fetch(request,env,ctx);
    const player=await resolvePlayer(env,token);
    if(!player)return json({error:'This NFC player card is invalid or inactive.'},401);
    const upstream=await app.fetch(request,env,ctx);
    let data;
    try{data=await upstream.json()}catch{return json({error:'Unable to load player registration.'},502)}
    if(!upstream.ok)return json(data,upstream.status);
    const participant=(data.participants||[]).find(p=>p.id===player.notion_page_id);
    if(!participant)return json({error:'The player linked to this NFC card was not found.'},404);
    touchToken(env,player,ctx);
    return json({
      ...data,
      playerMode:true,
      participants:[{...participant,team:player.team||null}],
      player:{id:participant.id,name:participant.name,team:player.team||null},
    });
  }

  if(request.method==='POST'){
    let body=null;
    try{body=await request.clone().json()}catch{}
    const token=String(body?.nfcToken||'').trim();
    if(!token)return app.fetch(request,env,ctx);
    const player=await resolvePlayer(env,token);
    if(!player)return json({error:'This NFC player card is invalid or inactive.'},401);
    if(String(body?.participantId||'')!==String(player.notion_page_id||''))return json({error:'This NFC card can only update its assigned player.'},403);
    touchToken(env,player,ctx);
    return app.fetch(request,env,ctx);
  }

  return app.fetch(request,env,ctx);
}

async function ensureTokens(env,participants){
  const rows=await select(env,'player_nfc_tokens','select=participant_id,token,active,created_at,updated_at,last_used_at');
  const byParticipant=new Map(rows.map(r=>[r.participant_id,r]));
  const missing=participants.filter(p=>!byParticipant.has(p.id)).map(p=>({participant_id:p.id,token:newToken(),active:true}));
  if(missing.length){
    await insert(env,'player_nfc_tokens',missing);
    const created=await select(env,'player_nfc_tokens','select=participant_id,token,active,created_at,updated_at,last_used_at');
    return new Map(created.map(r=>[r.participant_id,r]));
  }
  return byParticipant;
}

async function adminNfc(request,env){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  let body={};
  try{body=await request.json()}catch{return json({error:'Invalid request.'},400)}
  if(!env.ADMIN_SCORE_CODE||String(body.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);

  const participants=await select(env,'participants','select=id,notion_page_id,participant,team&order=participant.asc');
  let tokenMap=await ensureTokens(env,participants);

  if(body.action==='rotate'){
    const participant=participants.find(p=>p.notion_page_id===String(body.participantId||''));
    if(!participant)return json({error:'Player not found.'},404);
    await patch(env,'player_nfc_tokens',`participant_id=eq.${filter(participant.id)}`,{token:newToken(),active:true,updated_at:new Date().toISOString(),last_used_at:null});
    tokenMap=await ensureTokens(env,participants);
  }else if(body.action&&body.action!=='list'){
    return json({error:'Unknown action.'},400);
  }

  const origin=new URL(request.url).origin;
  const cards=participants.map(p=>{
    const row=tokenMap.get(p.id);
    return {
      participantId:p.notion_page_id,
      name:p.participant,
      team:p.team||null,
      active:Boolean(row?.active),
      lastUsedAt:row?.last_used_at||null,
      url:row?.token?`${origin}/#nfc=${encodeURIComponent(row.token)}`:null,
    };
  });
  return json({ok:true,cards,count:cards.length});
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    try{
      if(path==='/api/admin/nfc-cards')return adminNfc(request,env);
      if(path==='/api/registration')return nfcRegistration(request,env,ctx);
      return app.fetch(request,env,ctx);
    }catch(e){
      return json({error:String(e?.message||e)},502);
    }
  }
};
