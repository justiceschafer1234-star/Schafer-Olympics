import app from './worker-supabase.js';

const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');

function headers(env,extra={}){
  return {apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...extra};
}

async function sb(env,path,init={}){
  const base=cleanBase(env.SUPABASE_URL);
  if(!base)throw new Error('SUPABASE_URL is missing from the Worker runtime.');
  if(!env.SUPABASE_SECRET_KEY)throw new Error('SUPABASE_SECRET_KEY is missing from the Worker runtime.');
  const response=await fetch(`${base}/rest/v1/${path}`,{...init,headers:headers(env,init.headers||{})});
  const text=await response.text();
  let data=null;
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok)throw new Error(`Supabase ${response.status}: ${typeof data==='string'?data:(data?.message||JSON.stringify(data))}`);
  return data;
}

async function verifyAdmin(request,env){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!env.ADMIN_SCORE_CODE)return json({error:'ADMIN_SCORE_CODE is missing.'},503);
  let body={};
  try{body=await request.json()}catch{return json({error:'Invalid request.'},400)}
  if(String(body.code||'')!==String(env.ADMIN_SCORE_CODE))return json({ok:false,error:'Incorrect control code.'},401);
  return json({ok:true});
}

function migrationError(message){
  const m=String(message||'');
  return m.includes('participant_key')||m.includes('event_key')||m.includes('event_pairs')||m.includes('participants.team')||m.includes("Could not find the 'team'");
}

async function loadEditorData(env){
  const [participants,events,registrations]=await Promise.all([
    sb(env,'participants?select=id,notion_page_id,participant,participant_key,divisions,team&order=participant.asc'),
    sb(env,'olympic_events?select=id,notion_page_id,event,event_key,event_number,format,divisions&order=event_number.asc'),
    sb(env,'registrations?select=participant_id,event_id')
  ]);
  const eventIdsByParticipant=new Map();
  for(const r of registrations){
    if(!eventIdsByParticipant.has(r.participant_id))eventIdsByParticipant.set(r.participant_id,[]);
    eventIdsByParticipant.get(r.participant_id).push(r.event_id);
  }
  return {
    participants:participants.map(p=>({
      id:p.notion_page_id,
      key:p.participant_key,
      name:p.participant,
      divisions:p.divisions||[],
      team:p.team||'',
      registeredEventUuids:eventIdsByParticipant.get(p.id)||[]
    })),
    events:events.map(e=>({
      id:e.notion_page_id,
      key:e.event_key,
      name:e.event,
      number:e.event_number,
      format:e.format||'',
      divisions:e.divisions||[],
      uuid:e.id
    })),
    teams:TEAMS
  };
}

async function teamEditor(request,env){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!env.ADMIN_SCORE_CODE)return json({error:'ADMIN_SCORE_CODE is missing.'},503);
  let body={};
  try{body=await request.json()}catch{return json({error:'Invalid request.'},400)}
  if(String(body.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);

  try{
    if(body.action==='list'){
      const data=await loadEditorData(env);
      return json({ok:true,...data});
    }

    if(body.action==='save'){
      const assignments=Array.isArray(body.assignments)?body.assignments:[];
      if(!assignments.length)return json({error:'No team assignments were provided.'},400);
      const rows=await sb(env,'participants?select=id,notion_page_id,participant_key,participant,team');
      const byKey=new Map(rows.filter(p=>p.participant_key).map(p=>[p.participant_key,p]));
      const byLegacy=new Map(rows.map(p=>[p.notion_page_id,p]));
      const seen=new Set();
      const resolved=[];
      for(const a of assignments){
        const key=String(a.participantKey||'');
        const legacy=String(a.participantId||'');
        const person=(key&&byKey.get(key))||(legacy&&byLegacy.get(legacy));
        const team=String(a.team||'');
        if(!person||seen.has(person.id))return json({error:'Invalid or duplicate participant assignment.'},400);
        if(team&&!TEAMS.includes(team))return json({error:`Invalid team: ${team}`},400);
        seen.add(person.id);
        resolved.push({person,team});
      }
      await Promise.all(resolved.map(({person,team})=>sb(env,`participants?id=eq.${encodeURIComponent(person.id)}`,{
        method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({team:team||null})
      })));
      return json({ok:true,saved:resolved.length});
    }

    if(body.action==='eventPairs'){
      const eventKey=String(body.eventKey||'');
      if(!eventKey)return json({error:'Choose an event.'},400);
      const events=await sb(env,`olympic_events?select=id,event,event_key,event_number&event_key=eq.${encodeURIComponent(eventKey)}&limit=1`);
      const event=events[0];
      if(!event)return json({error:'Event not found.'},404);
      const [pairs,participants,registrations]=await Promise.all([
        sb(env,`event_pairs?select=id,pair_number,olympic_team,participant_1_id,participant_2_id&event_id=eq.${encodeURIComponent(event.id)}&order=pair_number.asc`),
        sb(env,'participants?select=id,participant,participant_key,team&order=participant.asc'),
        sb(env,`registrations?select=participant_id&event_id=eq.${encodeURIComponent(event.id)}`)
      ]);
      const registered=new Set(registrations.map(r=>r.participant_id));
      const byId=new Map(participants.map(p=>[p.id,p]));
      const eligible=participants.filter(p=>registered.has(p.id)&&TEAMS.includes(p.team)).map(p=>({key:p.participant_key,name:p.participant,team:p.team}));
      return json({
        ok:true,
        event:{key:event.event_key,name:event.event,number:event.event_number},
        eligible,
        pairs:pairs.map(p=>({
          pairNumber:p.pair_number,
          team:p.olympic_team,
          member1Key:byId.get(p.participant_1_id)?.participant_key||'',
          member1Name:byId.get(p.participant_1_id)?.participant||'',
          member2Key:byId.get(p.participant_2_id)?.participant_key||'',
          member2Name:byId.get(p.participant_2_id)?.participant||''
        }))
      });
    }

    if(body.action==='saveEventPairs'){
      const eventKey=String(body.eventKey||'');
      const incoming=Array.isArray(body.pairs)?body.pairs:[];
      if(!eventKey)return json({error:'Choose an event.'},400);
      const events=await sb(env,`olympic_events?select=id,event,event_key&event_key=eq.${encodeURIComponent(eventKey)}&limit=1`);
      const event=events[0];
      if(!event)return json({error:'Event not found.'},404);
      const [participants,registrations]=await Promise.all([
        sb(env,'participants?select=id,participant,participant_key,team'),
        sb(env,`registrations?select=participant_id&event_id=eq.${encodeURIComponent(event.id)}`)
      ]);
      const byKey=new Map(participants.filter(p=>p.participant_key).map(p=>[p.participant_key,p]));
      const registered=new Set(registrations.map(r=>r.participant_id));
      const used=new Set();
      const rows=[];
      for(let i=0;i<incoming.length;i++){
        const item=incoming[i]||{};
        const a=byKey.get(String(item.member1Key||''));
        const b=byKey.get(String(item.member2Key||''));
        if(!a||!b)return json({error:`Pair ${i+1} needs two valid participants.`},400);
        if(a.id===b.id)return json({error:`Pair ${i+1} cannot use the same person twice.`},400);
        if(!registered.has(a.id)||!registered.has(b.id))return json({error:`Both people in Pair ${i+1} must be registered for ${event.event}.`},400);
        if(!a.team||!b.team||a.team!==b.team||!TEAMS.includes(a.team))return json({error:`Pair ${i+1} must contain two people from the same Olympic team.`},400);
        if(used.has(a.id)||used.has(b.id))return json({error:`A participant can only appear once in ${event.event}.`},400);
        used.add(a.id);used.add(b.id);
        rows.push({event_id:event.id,pair_number:i+1,olympic_team:a.team,participant_1_id:a.id,participant_2_id:b.id});
      }
      await sb(env,`event_pairs?event_id=eq.${encodeURIComponent(event.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
      if(rows.length)await sb(env,'event_pairs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(rows)});
      return json({ok:true,saved:rows.length});
    }

    return json({error:'Unknown team editor action.'},400);
  }catch(err){
    const message=String(err?.message||err);
    if(migrationError(message)){
      return json({error:'Team/Event Team database update is not installed yet. Run supabase/add-participant-teams.sql in Supabase.'},503);
    }
    return json({error:message},502);
  }
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    if(path==='/api/admin/verify')return verifyAdmin(request,env);
    if(path==='/api/admin/teams')return teamEditor(request,env);
    return app.fetch(request,env,ctx);
  }
};
