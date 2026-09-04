import app from './worker-pair-events.js';

const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const base=env=>String(env.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const enc=v=>encodeURIComponent(String(v));

async function sb(env,path,init={}){
  const url=base(env);
  if(!url||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime secrets are missing.');
  const r=await fetch(`${url}/rest/v1/${path}`,{
    ...init,
    headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...(init.headers||{})}
  });
  const text=await r.text();let data=null;
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok){const e=new Error(typeof data==='string'?data:(data?.message||`Supabase ${r.status}`));e.status=r.status;throw e}
  return data;
}

async function bodyOf(request){try{return await request.clone().json()}catch{return{}}}
function requireCode(body,env){
  if(!env.ADMIN_SCORE_CODE)throw Object.assign(new Error('ADMIN_SCORE_CODE is missing.'),{status:503});
  if(String(body?.code||'')!==String(env.ADMIN_SCORE_CODE))throw Object.assign(new Error('Incorrect control code.'),{status:401});
}

async function kahootContext(env){
  const events=await sb(env,'olympic_events?select=id,notion_page_id,event,event_key,status&event_key=eq.kahoot&limit=1');
  const event=events[0];if(!event)throw Object.assign(new Error('Kahoot event not found.'),{status:404});
  const [people,regs,cards]=await Promise.all([
    sb(env,'participants?select=id,participant,participant_key,team&order=participant.asc'),
    sb(env,`registrations?select=participant_id&event_id=eq.${event.id}`),
    sb(env,`event_scorecards?select=state&event_id=eq.${event.id}&limit=1`)
  ]);
  return{event,people,registered:new Set(regs.map(r=>r.participant_id)),state:cards[0]?.state||{}};
}

async function saveKahootPairs(body,env){
  requireCode(body,env);
  const incoming=Array.isArray(body.pairs)?body.pairs:[];
  const {event,people,registered,state}=await kahootContext(env);
  if(state&&typeof state==='object'&&!Array.isArray(state)&&Object.keys(state).length){
    return json({error:'Kahoot has scorecard data. Reset the Kahoot scorecard before changing pairs.'},409);
  }
  const byKey=new Map(people.filter(p=>p.participant_key).map(p=>[p.participant_key,p]));
  const used=new Set(),pairRows=[],participantRows=[];
  for(let i=0;i<incoming.length;i++){
    const x=incoming[i]||{},a=byKey.get(String(x.member1Key||'')),b=byKey.get(String(x.member2Key||''));
    if(!a||!b)return json({error:`Pair ${i+1} needs two valid participants.`},400);
    if(a.id===b.id)return json({error:`Pair ${i+1} cannot use the same person twice.`},400);
    if(!registered.has(a.id)||!registered.has(b.id))return json({error:`Both people in Pair ${i+1} must be registered for Kahoot.`},400);
    if(!TEAMS.includes(a.team)||!TEAMS.includes(b.team))return json({error:`Both people in Pair ${i+1} need an Olympic team assignment.`},400);
    if(used.has(a.id)||used.has(b.id))return json({error:'A participant can only appear in one Kahoot pair.'},400);
    used.add(a.id);used.add(b.id);
    pairRows.push({event_id:event.id,pair_number:i+1,olympic_team:a.team===b.team?a.team:null,participant_1_id:a.id,participant_2_id:b.id,seed:null});
    participantRows.push(
      {event_id:event.id,participant_id:a.id,olympic_team:a.team,registered:true,event_team_number:i+1,seed:null},
      {event_id:event.id,participant_id:b.id,olympic_team:b.team,registered:true,event_team_number:i+1,seed:null}
    );
  }

  await sb(env,`event_pairs?event_id=eq.${event.id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
  if(pairRows.length)await sb(env,'event_pairs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(pairRows)});
  await sb(env,`event_participants?event_id=eq.${event.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({event_team_number:null,seed:null})});
  if(participantRows.length){
    await sb(env,'event_participants?on_conflict=event_id,participant_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(participantRows)});
  }
  await sb(env,`olympic_events?id=eq.${event.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({gold_teams:[],silver_teams:[],bronze_1_teams:[],bronze_2_teams:[],legacy_bronze_teams:[],team_point_overrides:{},status:'Not Started'})});
  return json({ok:true,saved:pairRows.length,crossTeamPairing:true,eventKey:'kahoot'});
}

function actualTeams(pair,byId){
  return [...new Set([byId.get(pair.participant_1_id)?.team,byId.get(pair.participant_2_id)?.team].filter(t=>TEAMS.includes(t)))];
}

async function augmentKahootScorecard(response,env){
  if(!response.ok)return response;
  let data;try{data=await response.json()}catch{return response}
  if(data?.event?.key!=='kahoot'||!data?.event?.id)return json(data,response.status);
  const [pairs,people]=await Promise.all([
    sb(env,`event_pairs?select=id,pair_number,participant_1_id,participant_2_id&event_id=eq.${enc(data.event.id)}&order=pair_number.asc`),
    sb(env,'participants?select=id,participant,team')
  ]);
  const byId=new Map(people.map(p=>[p.id,p])),teamsByPair=new Map();
  data.pairs=pairs.map(pair=>{
    const teams=actualTeams(pair,byId);teamsByPair.set(String(pair.id),teams);
    return{
      id:pair.id,
      pairNumber:Number(pair.pair_number),
      teams,
      team:teams.length===1?teams[0]:null,
      player1:byId.get(pair.participant_1_id)?.participant||'',
      player2:byId.get(pair.participant_2_id)?.participant||''
    };
  });
  if(data.state&&Array.isArray(data.state.entries)){
    data.state={...data.state,entries:data.state.entries.map(entry=>({...entry,teams:teamsByPair.get(String(entry.id))||entry.teams||[]}))};
  }
  return json(data,response.status);
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    try{
      if(url.pathname==='/api/admin/teams'&&request.method==='POST'){
        const body=await bodyOf(request);
        if(body.action==='saveEventPairs'&&String(body.eventKey||'')==='kahoot')return saveKahootPairs(body,env);
      }
      if(url.pathname==='/api/event-scorecard'&&String(url.searchParams.get('eventKey')||'')==='kahoot'){
        return augmentKahootScorecard(await app.fetch(request,env,ctx),env);
      }
      return app.fetch(request,env,ctx);
    }catch(e){return json({error:String(e?.message||e)},e?.status||502)}
  }
};
