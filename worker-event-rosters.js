import app from './worker-team-editor.js';

const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const headers=(env,extra={})=>({apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...extra});
async function sb(env,path,init={}){const base=cleanBase(env.SUPABASE_URL);if(!base||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime settings are missing.');const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers:headers(env,init.headers||{})});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw new Error(`Supabase ${r.status}: ${typeof data==='string'?data:(data?.message||JSON.stringify(data))}`);return data}

async function findEvent(env,{eventId='',eventKey='',nameLike=''}){
  if(eventId){const rows=await sb(env,`olympic_events?select=id,notion_page_id,event,event_key,event_number,format&notion_page_id=eq.${encodeURIComponent(eventId)}&limit=1`);if(rows[0])return rows[0]}
  if(eventKey){const rows=await sb(env,`olympic_events?select=id,notion_page_id,event,event_key,event_number,format&event_key=eq.${encodeURIComponent(eventKey)}&limit=1`);if(rows[0])return rows[0]}
  if(nameLike){const rows=await sb(env,`olympic_events?select=id,notion_page_id,event,event_key,event_number,format&event=ilike.*${encodeURIComponent(nameLike)}*&order=event_number.asc&limit=1`);if(rows[0])return rows[0]}
  return null;
}

async function participantDetails(env,eventId){
  const [eps,people]=await Promise.all([
    sb(env,`event_participants?select=id,participant_id,olympic_team,registered,event_team_number,seed,role,notes&event_id=eq.${eventId}&registered=eq.true&order=olympic_team.asc,event_team_number.asc,seed.asc`),
    sb(env,'participants?select=id,participant,participant_key,team&order=participant.asc')
  ]);
  const byId=new Map(people.map(p=>[p.id,p]));
  return eps.map(ep=>({
    id:ep.id,
    participantId:ep.participant_id,
    name:byId.get(ep.participant_id)?.participant||'',
    participantKey:byId.get(ep.participant_id)?.participant_key||'',
    olympicTeam:ep.olympic_team||byId.get(ep.participant_id)?.team||'',
    eventTeamNumber:ep.event_team_number==null?null:Number(ep.event_team_number),
    seed:ep.seed==null?null:Number(ep.seed),
    role:ep.role||'',
    notes:ep.notes||''
  }));
}

async function eventRosters(request,env){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{
    const u=new URL(request.url),eventId=String(u.searchParams.get('eventId')||''),eventKey=String(u.searchParams.get('eventKey')||'');
    if(!eventId&&!eventKey)return json({error:'Event is required.'},400);
    const event=await findEvent(env,{eventId,eventKey});
    if(!event)return json({error:'Event not found.'},404);
    const rows=await participantDetails(env,event.id);
    const rosters=TEAMS.map(team=>({team,participants:rows.filter(x=>x.olympicTeam===team).map(x=>x.name).filter(Boolean)}));
    const unassigned=rows.filter(x=>!TEAMS.includes(x.olympicTeam)).map(x=>x.name).filter(Boolean);
    return json({ok:true,event:{id:event.notion_page_id,key:event.event_key,name:event.event,number:event.event_number,format:event.format||''},registeredCount:rows.length,rosters,unassigned,participants:rows,source:'event_participants'});
  }catch(e){const m=String(e?.message||e);if(m.includes('event_participants'))return json({error:'The event_participants table is not installed yet. Run the event participant SQL in Supabase.'},503);return json({error:m},502)}
}

async function cornholeTeams(request,env){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{
    const event=await findEvent(env,{eventKey:'cornhole',nameLike:'cornhole'});
    if(!event)return json({error:'Cornhole event not found in Olympic Events.'},404);
    const rows=await participantDetails(env,event.id);
    const seeded=rows.filter(x=>x.seed!=null&&x.eventTeamNumber!=null);
    const grouped=new Map();
    for(const row of seeded){
      const key=`${row.eventTeamNumber}:${row.seed}`;
      if(!grouped.has(key))grouped.set(key,{seed:row.seed,pairNumber:row.eventTeamNumber,olympicTeam:row.olympicTeam,players:[]});
      grouped.get(key).players.push(row);
    }
    const teams=[...grouped.values()].map(g=>({
      seed:Number(g.seed),
      pairNumber:Number(g.pairNumber),
      olympicTeam:g.olympicTeam||'',
      player1:g.players[0]?.name||'',
      player2:g.players[1]?.name||'',
      players:g.players.map(x=>x.name).filter(Boolean).join(' + '),
      participantIds:g.players.map(x=>x.participantId)
    })).sort((a,b)=>a.seed-b.seed);
    return json({ok:true,event:{id:event.notion_page_id,key:event.event_key,name:event.event},teams,count:teams.length,source:'event_participants'});
  }catch(e){const m=String(e?.message||e);if(m.includes('event_participants'))return json({error:'The event_participants table is not installed yet. Run the event participant SQL in Supabase.'},503);return json({error:m},502)}
}

export default{async fetch(request,env,ctx){const path=new URL(request.url).pathname;if(path==='/api/event-rosters')return eventRosters(request,env);if(path==='/api/cornhole/teams')return cornholeTeams(request,env);return app.fetch(request,env,ctx)}};
