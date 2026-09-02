import app from './worker-kids-soccer.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const base=e=>String(e.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const filter=v=>encodeURIComponent(String(v));
const asArray=v=>(Array.isArray(v)?v:v?[v]:[]).filter(Boolean);
const number=v=>Number.isFinite(Number(v))?Number(v):0;

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
  const people=await select(env,'participants',`select=id,notion_page_id,participant,participant_key,team,divisions&id=eq.${filter(row.participant_id)}&limit=1`);
  const person=people[0];
  return person?{...person,token}:null;
}

function touchToken(env,player,ctx){
  const promise=patch(env,'player_nfc_tokens',`participant_id=eq.${filter(player.id)}`,{last_used_at:new Date().toISOString()}).catch(e=>console.error('Unable to update NFC last-used time',e));
  if(ctx?.waitUntil)ctx.waitUntil(promise);
}

function teamResult(event,team){
  if(!team)return null;
  const places=[
    {place:1,label:'Gold',medal:'🥇',teams:event.gold_teams,points:event.gold_points},
    {place:2,label:'Silver',medal:'🥈',teams:event.silver_teams,points:event.silver_points},
    {place:3,label:'Bronze',medal:'🥉',teams:event.bronze_1_teams,points:event.bronze_1_points},
    {place:4,label:'Copper',medal:'🟤',teams:event.bronze_2_teams,points:event.bronze_2_points},
  ];
  const found=places.find(x=>asArray(x.teams).includes(team));
  return found?{place:found.place,label:found.label,medal:found.medal,points:number(found.points)}:null;
}

function rankedPlace(entries,value,target){
  const rows=(entries||[]).filter(x=>value(x)!==null&&value(x)!==''&&Number.isFinite(Number(value(x)))).sort((a,b)=>Number(value(b))-Number(value(a))||String(a.label||'').localeCompare(String(b.label||'')));
  let last=null,place=0;
  for(let i=0;i<rows.length;i++){
    const score=Number(value(rows[i]));
    if(last===null||score!==last)place=i+1;
    last=score;
    if(target(rows[i]))return{place,score};
  }
  return null;
}

function personalScore(card,player,pairIds){
  const state=card?.state&&typeof card.state==='object'?card.state:{};
  const entries=Array.isArray(state.entries)?state.entries:[];
  const mode=String(card?.format_key||'');
  const isPlayer=e=>String(e?.id||'')===String(player.id)||String(e?.label||'').trim()===String(player.participant||'').trim();
  const isPair=e=>pairIds.has(String(e?.id||''));
  const target=mode==='pairs'?isPair:isPlayer;
  const entry=entries.find(target);
  if(!entry)return null;

  if(mode==='bracket'){
    const placements=Array.isArray(state.placements)?state.placements.map(String):[];
    const idx=placements.indexOf(String(entry.id));
    return{kind:'bracket',place:idx>=0?idx+1:null,label:entry.label||player.participant};
  }
  if(mode==='two-stage'){
    const final=entry.advanced?rankedPlace(entries.filter(x=>x.advanced),x=>x.finalScore,target):null;
    return{kind:'two-stage',place:final?.place||null,round1:entry.round1??entry.score??null,finalScore:entry.finalScore??null,advanced:Boolean(entry.advanced),label:entry.label||player.participant};
  }
  if(mode==='individual'||mode==='pairs'){
    const ranked=rankedPlace(entries,x=>x.score,target);
    return{kind:mode,place:ranked?.place||null,score:entry.score??null,label:entry.label||player.participant};
  }
  return null;
}

async function playerHq(request,env,ctx){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  const token=request.headers.get('x-player-nfc');
  const player=await resolvePlayer(env,token);
  if(!player)return json({error:'This NFC player card is invalid or inactive.'},401);

  const [registrations,allEvents,cards,pairs]=await Promise.all([
    select(env,'registrations',`select=event_id&participant_id=eq.${filter(player.id)}`),
    select(env,'olympic_events','select=id,notion_page_id,event,event_key,event_number,division,divisions,format,scheduled_time,status,gold_points,gold_teams,silver_points,silver_teams,bronze_1_points,bronze_1_teams,bronze_2_points,bronze_2_teams&order=event_number.asc'),
    select(env,'event_scorecards','select=event_id,format_key,state,updated_at'),
    select(env,'event_pairs','select=id,event_id,pair_number,olympic_team,participant_1_id,participant_2_id'),
  ]);

  const registered=new Set(registrations.map(x=>String(x.event_id)));
  const cardByEvent=new Map(cards.map(x=>[String(x.event_id),x]));
  const pairIdsByEvent=new Map();
  for(const pair of pairs){
    if(String(pair.participant_1_id)!==String(player.id)&&String(pair.participant_2_id)!==String(player.id))continue;
    const key=String(pair.event_id);
    if(!pairIdsByEvent.has(key))pairIdsByEvent.set(key,new Set());
    pairIdsByEvent.get(key).add(String(pair.id));
  }

  const events=allEvents.filter(e=>registered.has(String(e.id))).map(e=>{
    const eventId=String(e.id);
    const personal=personalScore(cardByEvent.get(eventId),player,pairIdsByEvent.get(eventId)||new Set());
    const team=teamResult(e,player.team);
    const result=personal?.place?{place:personal.place,medal:personal.place===1?'🥇':personal.place===2?'🥈':personal.place===3?'🥉':personal.place===4?'🟤':'',label:`${personal.place}${personal.place===1?'st':personal.place===2?'nd':personal.place===3?'rd':'th'}`}:(team?{place:team.place,medal:team.medal,label:team.label}:null);
    return{
      id:e.notion_page_id||e.id,
      eventKey:e.event_key||null,
      number:e.event_number,
      name:String(e.event||'').trim(),
      format:e.format||null,
      divisions:e.divisions||[],
      scheduledTime:e.scheduled_time||null,
      status:e.status||'Not Started',
      result,
      teamResult:team,
      personal,
    };
  }).sort((a,b)=>{
    const at=a.scheduledTime?new Date(a.scheduledTime).getTime():Infinity;
    const bt=b.scheduledTime?new Date(b.scheduledTime).getTime():Infinity;
    return at-bt||number(a.number)-number(b.number);
  });

  const medalCounts={gold:0,silver:0,bronze:0,copper:0};
  for(const event of events){
    const p=event.result?.place;
    if(p===1)medalCounts.gold++;
    else if(p===2)medalCounts.silver++;
    else if(p===3)medalCounts.bronze++;
    else if(p===4)medalCounts.copper++;
  }
  const completed=events.filter(e=>e.status==='Complete').length;
  const teamPoints=events.reduce((sum,e)=>sum+number(e.teamResult?.points),0);
  const nextEvent=events.find(e=>e.status!=='Complete')||null;
  touchToken(env,player,ctx);

  return json({
    ok:true,
    player:{id:player.notion_page_id,name:player.participant,team:player.team||null,divisions:player.divisions||[]},
    summary:{registered:events.length,completed,podiums:medalCounts.gold+medalCounts.silver+medalCounts.bronze+medalCounts.copper,teamPoints,medals:medalCounts},
    nextEvent,
    events,
    updatedAt:new Date().toISOString(),
  });
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
    return{
      participantId:p.notion_page_id,
      name:p.participant,
      team:p.team||null,
      active:Boolean(row?.active),
      lastUsedAt:row?.last_used_at||null,
      url:row?.token?`${origin}/gameday-hq.html#nfc=${encodeURIComponent(row.token)}`:null,
    };
  });
  return json({ok:true,cards,count:cards.length});
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    try{
      if(path==='/api/admin/nfc-cards')return adminNfc(request,env);
      if(path==='/api/player-hq')return playerHq(request,env,ctx);
      return app.fetch(request,env,ctx);
    }catch(e){
      return json({error:String(e?.message||e)},502);
    }
  }
};
