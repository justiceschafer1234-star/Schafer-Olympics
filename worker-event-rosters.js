import app from './worker-team-editor.js';

const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const headers=(env,extra={})=>({apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...extra});
async function sb(env,path,init={}){const base=cleanBase(env.SUPABASE_URL);if(!base||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime settings are missing.');const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers:headers(env,init.headers||{})});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw new Error(`Supabase ${r.status}: ${typeof data==='string'?data:(data?.message||JSON.stringify(data))}`);return data}

async function eventRosters(request,env){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{
    const u=new URL(request.url),eventId=String(u.searchParams.get('eventId')||''),eventKey=String(u.searchParams.get('eventKey')||'');
    if(!eventId&&!eventKey)return json({error:'Event is required.'},400);
    const query=eventId?`notion_page_id=eq.${encodeURIComponent(eventId)}`:`event_key=eq.${encodeURIComponent(eventKey)}`;
    const events=await sb(env,`olympic_events?select=id,notion_page_id,event,event_key,event_number,format&${query}&limit=1`),event=events[0];
    if(!event)return json({error:'Event not found.'},404);
    const [regs,people]=await Promise.all([
      sb(env,`registrations?select=participant_id&event_id=eq.${event.id}`),
      sb(env,'participants?select=id,participant,team&order=participant.asc')
    ]);
    const registered=new Set(regs.map(r=>r.participant_id));
    const rosters=TEAMS.map(team=>({team,participants:people.filter(p=>registered.has(p.id)&&p.team===team).map(p=>p.participant)}));
    const unassigned=people.filter(p=>registered.has(p.id)&&!TEAMS.includes(p.team)).map(p=>p.participant);
    return json({ok:true,event:{id:event.notion_page_id,key:event.event_key,name:event.event,number:event.event_number,format:event.format||''},registeredCount:regs.length,rosters,unassigned});
  }catch(e){return json({error:String(e?.message||e)},502)}
}

async function cornholeTeams(request,env){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{
    const events=await sb(env,'olympic_events?select=id,event,event_key&event_key=eq.cornhole&limit=1'),event=events[0];
    if(!event)return json({error:'Cornhole event not found.'},404);
    const [pairs,people]=await Promise.all([
      sb(env,`event_pairs?select=id,pair_number,olympic_team,participant_1_id,participant_2_id,seed&event_id=eq.${event.id}&seed=not.is.null&order=seed.asc`),
      sb(env,'participants?select=id,participant,team')
    ]);
    const byId=new Map(people.map(p=>[p.id,p]));
    const teams=pairs.map(p=>{
      const a=byId.get(p.participant_1_id),b=byId.get(p.participant_2_id);
      return{id:p.id,seed:Number(p.seed),pairNumber:p.pair_number,olympicTeam:p.olympic_team,player1:a?.participant||'',player2:b?.participant||'',players:[a?.participant,b?.participant].filter(Boolean).join(' + ')};
    }).sort((a,b)=>a.seed-b.seed);
    return json({ok:true,event:{key:event.event_key,name:event.event},teams,count:teams.length,source:'event_pairs'});
  }catch(e){return json({error:String(e?.message||e)},502)}
}

export default{async fetch(request,env,ctx){const path=new URL(request.url).pathname;if(path==='/api/event-rosters')return eventRosters(request,env);if(path==='/api/cornhole/teams')return cornholeTeams(request,env);return app.fetch(request,env,ctx)}};
