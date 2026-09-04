import app from './worker-hardening.js';

const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
const CROSS_TEAM_EVENTS=new Set(['egg-toss','cornhole-tournament']);
const POINT_PROP={
  'Team Red':'🔴 Red Points',
  'Team Blue':'🔵 Blue Points',
  'Team Green':'🟢 Green Points',
  'Team Gold':'🟡 Gold Points'
};
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
  if(!r.ok){const e=new Error(typeof data==='string'?data:(data?.message||`Supabase ${r.status}`));e.status=r.status;e.data=data;throw e}
  return data;
}
async function patch(env,table,query,body){return sb(env,`${table}?${query}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})}
async function bodyOf(request){try{return await request.clone().json()}catch{return{}}}
function requireCode(body,env){
  if(!env.ADMIN_SCORE_CODE)throw Object.assign(new Error('ADMIN_SCORE_CODE is missing.'),{status:503});
  if(String(body?.code||'')!==String(env.ADMIN_SCORE_CODE))throw Object.assign(new Error('Incorrect control code.'),{status:401});
}
function shortTeam(team){return String(team||'').replace(/^Team\s+/,'')}
function teamLabel(teams){const xs=[...new Set((teams||[]).filter(t=>TEAMS.includes(t)))];return xs.map(shortTeam).join(' + ')}
function legacyMatch(r){return{id:r.notion_page_id,lastEditedTime:r.updated_at,properties:{Match:r.match_code,'Match Number':r.match_number,Round:r.round_number,'Team A':r.team_a||'','Team B':r.team_b||'','Score A':r.score_a,'Score B':r.score_b,Winner:r.winner||'',Loser:r.loser||'',Status:r.status,'Winner To':r.winner_to||'','Loser To':r.loser_to||'','Sort Order':r.sort_order,Bracket:r.bracket,'Team A Players':r.team_a_players||'','Team B Players':r.team_b_players||''}}}

async function resolveEvent(env,eventKey){
  const rows=await sb(env,`olympic_events?select=id,notion_page_id,event,event_key,event_number&event_key=eq.${enc(eventKey)}&limit=1`);
  return rows[0]||null;
}
async function eventContext(env,eventKey){
  const event=await resolveEvent(env,eventKey);if(!event)throw new Error('Event not found.');
  const [pairs,people,regs]=await Promise.all([
    sb(env,`event_pairs?select=id,event_id,pair_number,olympic_team,participant_1_id,participant_2_id,seed&event_id=eq.${event.id}&order=pair_number.asc`),
    sb(env,'participants?select=id,participant,participant_key,team&order=participant.asc'),
    sb(env,`registrations?select=participant_id&event_id=eq.${event.id}`)
  ]);
  return{event,pairs,people,registered:new Set(regs.map(r=>r.participant_id))};
}
async function upsertEventParticipants(env,rows){
  if(!rows.length)return;
  await sb(env,'event_participants?on_conflict=event_id,participant_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
}

async function saveCrossTeamPairs(body,env){
  requireCode(body,env);
  const eventKey=String(body.eventKey||'');
  if(!CROSS_TEAM_EVENTS.has(eventKey))return null;
  const incoming=Array.isArray(body.pairs)?body.pairs:[];
  const {event,people,registered}=await eventContext(env,eventKey);
  if(eventKey==='cornhole-tournament'){
    const matches=await sb(env,'cornhole_matches?select=status,score_a,score_b,team_a,team_b');
    if(matches.some(m=>m.status==='Complete'||m.score_a!=null||m.score_b!=null)){
      return json({error:'Cornhole has started. Clear the tournament results before changing pairs.'},409);
    }
  }
  const byKey=new Map(people.filter(p=>p.participant_key).map(p=>[p.participant_key,p]));
  const used=new Set(),pairRows=[],participantRows=[];
  for(let i=0;i<incoming.length;i++){
    const x=incoming[i]||{},a=byKey.get(String(x.member1Key||'')),b=byKey.get(String(x.member2Key||''));
    if(!a||!b)return json({error:`Pair ${i+1} needs two valid participants.`},400);
    if(a.id===b.id)return json({error:`Pair ${i+1} cannot use the same person twice.`},400);
    if(!registered.has(a.id)||!registered.has(b.id))return json({error:`Both people in Pair ${i+1} must be registered for ${event.event}.`},400);
    if(!TEAMS.includes(a.team)||!TEAMS.includes(b.team))return json({error:`Both people in Pair ${i+1} need an Olympic team assignment.`},400);
    if(used.has(a.id)||used.has(b.id))return json({error:`A participant can only appear once in ${event.event}.`},400);
    used.add(a.id);used.add(b.id);
    pairRows.push({event_id:event.id,pair_number:i+1,olympic_team:a.team===b.team?a.team:null,participant_1_id:a.id,participant_2_id:b.id,seed:null});
    participantRows.push(
      {event_id:event.id,participant_id:a.id,olympic_team:a.team,registered:true,event_team_number:i+1,seed:null},
      {event_id:event.id,participant_id:b.id,olympic_team:b.team,registered:true,event_team_number:i+1,seed:null}
    );
  }
  if(eventKey==='cornhole-tournament'&&pairRows.length>14)return json({error:'Cornhole supports exactly 14 tournament pairs.'},400);
  await sb(env,`event_pairs?event_id=eq.${event.id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
  if(pairRows.length)await sb(env,'event_pairs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(pairRows)});
  await patch(env,'event_participants',`event_id=eq.${event.id}`,{event_team_number:null,seed:null});
  await upsertEventParticipants(env,participantRows);
  if(eventKey==='cornhole-tournament')await resetAllCornholeMatches(env);
  if(eventKey==='egg-toss')await sb(env,'rpc/refresh_egg_toss_event_result',{method:'POST',body:'{}'});
  return json({ok:true,saved:pairRows.length,crossTeamPairing:true});
}

const ROUTES14={
  P1:['W1','L3'],P2:['W2','L1'],P3:['W2','L1'],P4:['W3','L5'],P5:['W4','L2'],P6:['W4','L2'],
  W1:['W5','L3'],W2:['W5','L4'],W3:['W6','L5'],W4:['W6','L6'],
  L1:['L4',null],L2:['L6',null],L3:['L7',null],L4:['L7',null],L5:['L8',null],L6:['L8',null],
  L7:['L9',null],L8:['L10',null],W5:['W7','L10'],W6:['W7','L9'],L9:['L11',null],L10:['L11',null],
  W7:['GF1','L12'],L11:['L12',null],L12:['GF1',null],GF1:['GF2 if needed','GF2 if needed'],GF2:[null,null]
};
const OPENINGS14={P1:[8,9],P2:[4,13],P3:[5,12],P4:[7,10],P5:[3,14],P6:[6,11],W1:[1,null],W3:[2,null]};

async function loadCornholeMatches(env){return sb(env,'cornhole_matches?select=*&order=sort_order.asc,match_code.asc')}
async function resetAllCornholeMatches(env){
  await patch(env,'cornhole_matches','match_code=not.is.null',{team_a:null,team_a_players:null,team_b:null,team_b_players:null,score_a:null,score_b:null,winner:null,loser:null,status:'Waiting'});
  await sb(env,'rpc/refresh_cornhole_event_result',{method:'POST',body:'{}'});
}
async function ensureRoutes14(env,matches){
  for(const [code,[winnerTo,loserTo]] of Object.entries(ROUTES14)){
    const m=matches.find(x=>x.match_code===code);if(!m)throw new Error(`Cornhole bracket row ${code} is missing.`);
    if(m.winner_to!==winnerTo||m.loser_to!==loserTo){
      await patch(env,'cornhole_matches',`id=eq.${m.id}`,{winner_to:winnerTo,loser_to:loserTo});
      m.winner_to=winnerTo;m.loser_to=loserTo;
    }
  }
}
async function seededPairMap(env,eventId,pairs,people){
  const byId=new Map(people.map(p=>[p.id,p]));
  const out=new Map();
  for(const p of pairs){
    if(p.seed==null)continue;
    const a=byId.get(p.participant_1_id),b=byId.get(p.participant_2_id);
    out.set(Number(p.seed),{label:`Seed ${p.seed}`,players:`${a?.participant||''} + ${b?.participant||''}`,pair:p});
  }
  return out;
}
async function seedCornhole14(body,env){
  requireCode(body,env);
  const {event,pairs,people}=await eventContext(env,'cornhole-tournament');
  if(pairs.length!==14)return json({error:`Cornhole needs exactly 14 pairs before seeding. There are currently ${pairs.length}.`},400);
  const seeds=Array.isArray(body.seeds)?body.seeds:[];
  if(seeds.length!==14)return json({error:'Every one of the 14 Cornhole pairs must have a seed.'},400);
  const pairById=new Map(pairs.map(p=>[p.id,p])),seedNums=new Set(),pairIds=new Set();
  for(const x of seeds){
    const n=Number(x.seed),id=String(x.pairId||'');
    if(!pairById.has(id)||!Number.isInteger(n)||n<1||n>14||seedNums.has(n)||pairIds.has(id))return json({error:'Seeds must be unique numbers from 1 to 14, with every pair used once.'},400);
    seedNums.add(n);pairIds.add(id);
  }
  let matches=await loadCornholeMatches(env);
  if(!['P5','P6','L11','L12'].every(code=>matches.some(m=>m.match_code===code)))return json({error:'The 14-team Cornhole bracket database update is not installed.'},503);
  const started=matches.some(m=>m.status==='Complete'||m.score_a!=null||m.score_b!=null);
  if(started&&!body.forceReset)return json({ok:false,needsResetConfirmation:true,error:'Cornhole has results. Confirm reset before reseeding.'},409);
  await ensureRoutes14(env,matches);
  await resetAllCornholeMatches(env);
  await patch(env,'event_pairs',`event_id=eq.${event.id}`,{seed:null});
  await patch(env,'event_participants',`event_id=eq.${event.id}`,{seed:null});
  for(const x of seeds){
    const p=pairById.get(String(x.pairId)),n=Number(x.seed);
    p.seed=n;
    await patch(env,'event_pairs',`id=eq.${p.id}`,{seed:n});
    await patch(env,'event_participants',`event_id=eq.${event.id}&event_team_number=eq.${p.pair_number}`,{seed:n});
  }
  const seeded=await seededPairMap(env,event.id,pairs,people);
  matches=await loadCornholeMatches(env);
  for(const [code,[sa,sbSeed]] of Object.entries(OPENINGS14)){
    const m=matches.find(x=>x.match_code===code),a=seeded.get(sa),b=sbSeed?seeded.get(sbSeed):null;
    if(!m||!a)continue;
    await patch(env,'cornhole_matches',`id=eq.${m.id}`,{team_a:a.label,team_a_players:a.players,team_b:b?.label||null,team_b_players:b?.players||null,status:b?'Ready':'Waiting'});
  }
  await sb(env,'rpc/refresh_cornhole_event_result',{method:'POST',body:'{}'});
  return json({ok:true,seeded:14,reset:started,format:'14-team double elimination'});
}

function routeCode(value){const s=String(value||'').trim();if(!s)return null;return /if needed/i.test(s)?s.split(/\s+/)[0]:s}
function downstreamCodes(rows,start){
  const by=new Map(rows.map(r=>[r.match_code,r])),seen=new Set(),queue=[routeCode(start.winner_to),routeCode(start.loser_to)].filter(Boolean);
  while(queue.length){const code=queue.shift();if(!code||seen.has(code))continue;seen.add(code);const m=by.get(code);if(!m)continue;for(const next of [routeCode(m.winner_to),routeCode(m.loser_to)])if(next&&!seen.has(next))queue.push(next)}
  return seen;
}
async function placeIntoMatch(env,target,label,players){
  if(!target||!label)return;
  const body={};
  if(!target.team_a){body.team_a=label;body.team_a_players=players||null}
  else if(!target.team_b&&target.team_a!==label){body.team_b=label;body.team_b_players=players||null}
  else return;
  const a=body.team_a??target.team_a,b=body.team_b??target.team_b;
  body.status=a&&b?'Ready':'Waiting';
  await patch(env,'cornhole_matches',`id=eq.${target.id}`,body);Object.assign(target,body);
}
async function fixedSeedData(env){
  const {event,pairs,people}=await eventContext(env,'cornhole-tournament');
  return seededPairMap(env,event.id,pairs,people);
}
async function restoreFixedSlots14(env,rows,onlyCodes=null){
  const seeded=await fixedSeedData(env),by=new Map(rows.map(r=>[r.match_code,r]));
  for(const [code,[sa,sbSeed]] of Object.entries(OPENINGS14)){
    if(onlyCodes&&!onlyCodes.has(code))continue;
    const target=by.get(code),a=seeded.get(sa),b=sbSeed?seeded.get(sbSeed):null;if(!target||!a)continue;
    const body={team_a:a.label,team_a_players:a.players,team_b:b?.label||null,team_b_players:b?.players||null,status:b?'Ready':'Waiting'};
    await patch(env,'cornhole_matches',`id=eq.${target.id}`,body);Object.assign(target,body);
  }
}
async function replayCompleted(env,rows,onlyCodes){
  const by=new Map(rows.map(r=>[r.match_code,r]));
  const complete=rows.filter(r=>r.status==='Complete'&&!onlyCodes.has(r.match_code)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  for(const m of complete){
    const winnerPlayers=m.winner===m.team_a?m.team_a_players:m.team_b_players;
    const loserPlayers=m.loser===m.team_a?m.team_a_players:m.team_b_players;
    const wt=routeCode(m.winner_to),lt=routeCode(m.loser_to);
    if(wt&&onlyCodes.has(wt)&&!(m.match_code==='GF1'&&wt==='GF2'))await placeIntoMatch(env,by.get(wt),m.winner,winnerPlayers);
    if(lt&&onlyCodes.has(lt)&&!(m.match_code==='GF1'&&lt==='GF2'))await placeIntoMatch(env,by.get(lt),m.loser,loserPlayers);
  }
}
async function syncGrandFinalReset(env,rows){
  const gf1=rows.find(r=>r.match_code==='GF1'),gf2=rows.find(r=>r.match_code==='GF2'),w7=rows.find(r=>r.match_code==='W7');if(!gf1||!gf2)return;
  if(gf1.status==='Complete'&&gf1.winner&&w7?.winner&&gf1.winner!==w7.winner){
    const body={team_a:gf1.team_a,team_a_players:gf1.team_a_players,team_b:gf1.team_b,team_b_players:gf1.team_b_players,score_a:null,score_b:null,winner:null,loser:null,status:'Ready'};
    await patch(env,'cornhole_matches',`id=eq.${gf2.id}`,body);Object.assign(gf2,body);
  }else if(gf2.status!=='Complete'){
    const body={team_a:null,team_a_players:null,team_b:null,team_b_players:null,score_a:null,score_b:null,winner:null,loser:null,status:'Waiting'};
    await patch(env,'cornhole_matches',`id=eq.${gf2.id}`,body);Object.assign(gf2,body);
  }
}
async function rebuildDownstream(env,resetCodes){
  if(!resetCodes.size)return loadCornholeMatches(env);
  let rows=await loadCornholeMatches(env);
  for(const m of rows.filter(r=>resetCodes.has(r.match_code))){
    const body={team_a:null,team_a_players:null,team_b:null,team_b_players:null,score_a:null,score_b:null,winner:null,loser:null,status:'Waiting'};
    await patch(env,'cornhole_matches',`id=eq.${m.id}`,body);Object.assign(m,body);
  }
  await restoreFixedSlots14(env,rows,resetCodes);
  rows=await loadCornholeMatches(env);
  await replayCompleted(env,rows,resetCodes);
  rows=await loadCornholeMatches(env);
  await syncGrandFinalReset(env,rows);
  return loadCornholeMatches(env);
}
async function refreshCornhole(env){await sb(env,'rpc/refresh_cornhole_event_result',{method:'POST',body:'{}'})}

async function saveCornholeScore(body,env){
  requireCode(body,env);
  const matchId=String(body.matchId||''),a=Number(body.scoreA),b=Number(body.scoreB);
  if(!matchId||!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0||a===b)return json({error:'Enter both teams and a non-tied score.'},400);
  let rows=await loadCornholeMatches(env),m=rows.find(x=>x.notion_page_id===matchId);if(!m)return json({error:'Match not found.'},404);
  if(!m.team_a||!m.team_b)return json({error:'Both teams must be set before scoring.'},400);
  const winner=a>b?m.team_a:m.team_b,loser=a>b?m.team_b:m.team_a;
  const winnerChanged=m.status==='Complete'&&m.winner&&m.winner!==winner;
  if(winnerChanged&&!body.allowWinnerChange)return json({error:'Changing this winner will reset downstream Cornhole matches. Confirm the reset first.',needsWinnerChangeConfirmation:true},409);
  const wasComplete=m.status==='Complete';
  await patch(env,'cornhole_matches',`id=eq.${m.id}`,{score_a:a,score_b:b,winner,loser,status:'Complete'});
  Object.assign(m,{score_a:a,score_b:b,winner,loser,status:'Complete'});
  let resetCount=0;
  if(winnerChanged){
    const reset=downstreamCodes(rows,m);resetCount=reset.size;rows=await rebuildDownstream(env,reset);
  }else if(!wasComplete){
    rows=await loadCornholeMatches(env);m=rows.find(x=>x.id===m.id);const by=new Map(rows.map(r=>[r.match_code,r]));
    const wp=winner===m.team_a?m.team_a_players:m.team_b_players,lp=loser===m.team_a?m.team_a_players:m.team_b_players;
    const wt=routeCode(m.winner_to),lt=routeCode(m.loser_to);
    if(wt&&!(m.match_code==='GF1'&&wt==='GF2'))await placeIntoMatch(env,by.get(wt),winner,wp);
    if(lt&&!(m.match_code==='GF1'&&lt==='GF2'))await placeIntoMatch(env,by.get(lt),loser,lp);
    rows=await loadCornholeMatches(env);await syncGrandFinalReset(env,rows);rows=await loadCornholeMatches(env);
  }
  await refreshCornhole(env);
  return json({ok:true,winner,loser,winnerChanged:Boolean(winnerChanged),resetCount,matches:rows.map(legacyMatch),source:'supabase-14'});
}
async function clearCornholeScore(body,env){
  requireCode(body,env);
  const matchId=String(body.matchId||'');if(!matchId)return json({error:'Match is required.'},400);
  let rows=await loadCornholeMatches(env),m=rows.find(x=>x.notion_page_id===matchId);if(!m)return json({error:'Match not found.'},404);
  if(m.status!=='Complete')return json({error:'This match does not have a completed result to clear.'},400);
  const reset=downstreamCodes(rows,m),completedDownstream=rows.filter(r=>reset.has(r.match_code)&&r.status==='Complete').length;
  if(completedDownstream&&!body.allowDownstreamReset)return json({error:'Clearing this result will reset downstream Cornhole matches. Confirm the reset first.',needsResetConfirmation:true},409);
  await patch(env,'cornhole_matches',`id=eq.${m.id}`,{score_a:null,score_b:null,winner:null,loser:null,status:m.team_a&&m.team_b?'Ready':'Waiting'});
  rows=await rebuildDownstream(env,reset);
  await refreshCornhole(env);
  return json({ok:true,cleared:m.match_code,resetCount:completedDownstream,matches:rows.map(legacyMatch),source:'supabase-14-clear'});
}

async function cornholeTeams(env){
  const {event,pairs,people}=await eventContext(env,'cornhole-tournament'),byId=new Map(people.map(p=>[p.id,p]));
  const teams=pairs.map(pair=>{
    const p1=byId.get(pair.participant_1_id)||{},p2=byId.get(pair.participant_2_id)||{},olympicTeams=[...new Set([p1.team,p2.team].filter(t=>TEAMS.includes(t)))];
    const player1=p1.participant||'',player2=p2.participant||'';
    return{id:pair.id,seed:pair.seed==null?null:Number(pair.seed),pairNumber:Number(pair.pair_number),olympicTeam:olympicTeams.length===1?olympicTeams[0]:teamLabel(olympicTeams),olympicTeams,player1,player2,players:[player1,player2].filter(Boolean).join(' + '),participantIds:[pair.participant_1_id,pair.participant_2_id]};
  }).sort((a,b)=>(a.seed??999)-(b.seed??999)||a.pairNumber-b.pairNumber);
  return json({ok:true,event:{id:event.notion_page_id,key:event.event_key,name:event.event},teams,count:teams.length,seededCount:teams.filter(t=>t.seed!=null).length,source:'event_pairs-mixed'});
}
async function augmentEggToss(response,env){
  if(!response.ok)return response;let data;try{data=await response.json()}catch{return response}
  const event=await resolveEvent(env,'egg-toss');if(!event||!Array.isArray(data.pairs))return json(data,response.status);
  const [pairs,people]=await Promise.all([sb(env,`event_pairs?select=id,participant_1_id,participant_2_id&event_id=eq.${event.id}`),sb(env,'participants?select=id,team')]);
  const byId=new Map(people.map(p=>[p.id,p])),teamsByPair=new Map(pairs.map(p=>[p.id,[...new Set([byId.get(p.participant_1_id)?.team,byId.get(p.participant_2_id)?.team].filter(t=>TEAMS.includes(t)))]]));
  data.pairs=data.pairs.map(p=>{const teams=teamsByPair.get(p.id)||[];return{...p,olympicTeams:teams,olympicTeam:teams.length===1?teams[0]:teamLabel(teams)}});
  return json(data,response.status);
}

function hasOverrides(v){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length>0}
async function augmentScores(response,env){
  if(!response.ok)return response;let data;try{data=await response.json()}catch{return response}
  if(!Array.isArray(data.rows))return json(data,response.status);
  const events=await sb(env,'olympic_events?select=notion_page_id,event_key,team_point_overrides');
  const byId=new Map(events.filter(e=>hasOverrides(e.team_point_overrides)).map(e=>[String(e.notion_page_id),e.team_point_overrides]));
  data.rows=data.rows.map(row=>{
    const overrides=byId.get(String(row.id||''));if(!overrides)return row;
    const p={...(row.properties||{})};for(const t of TEAMS)p[POINT_PROP[t]]=Number(overrides[t]||0);return{...row,properties:p};
  });
  const standings=TEAMS.map(team=>({team,points:data.rows.reduce((sum,row)=>sum+Number(row.properties?.[POINT_PROP[team]]||0),0)})).sort((a,b)=>b.points-a.points||TEAMS.indexOf(a.team)-TEAMS.indexOf(b.team));
  data.standings=standings;
  if(data.race){const remaining=Number(data.race.remainingGoldPoints||0);data.race.maximumPossible=standings.map(x=>({team:x.team,currentPoints:x.points,maximumPoints:x.points+remaining}))}
  return json(data,response.status);
}
async function augmentPlayerHq(response,env){
  if(!response.ok)return response;let data;try{data=await response.json()}catch{return response}
  const team=data?.player?.team;if(!TEAMS.includes(team)||!Array.isArray(data.events))return json(data,response.status);
  const events=await sb(env,'olympic_events?select=event_key,team_point_overrides');
  const byKey=new Map(events.filter(e=>hasOverrides(e.team_point_overrides)).map(e=>[String(e.event_key),e.team_point_overrides]));
  data.events=data.events.map(e=>{const o=byKey.get(String(e.eventKey||''));if(!o||!e.teamResult)return e;return{...e,teamResult:{...e.teamResult,points:Number(o[team]||0)}}});
  if(data.nextEvent?.eventKey){const o=byKey.get(String(data.nextEvent.eventKey));if(o&&data.nextEvent.teamResult)data.nextEvent={...data.nextEvent,teamResult:{...data.nextEvent.teamResult,points:Number(o[team]||0)}}}
  if(data.summary)data.summary={...data.summary,teamPoints:data.events.reduce((sum,e)=>sum+Number(e.teamResult?.points||0),0)};
  return json(data,response.status);
}

export default{
  async fetch(request,env,ctx){
    const u=new URL(request.url),path=u.pathname;
    try{
      if(path==='/api/admin/teams'&&request.method==='POST'){
        const body=await bodyOf(request);
        if(body.action==='saveEventPairs'&&CROSS_TEAM_EVENTS.has(String(body.eventKey||'')))return await saveCrossTeamPairs(body,env);
        if(body.action==='seedCornhole')return await seedCornhole14(body,env);
      }
      if(path==='/api/cornhole/teams'&&request.method==='GET')return await cornholeTeams(env);
      if(path==='/api/cornhole'&&request.method==='POST'){
        const body=await bodyOf(request);
        if(body.action==='clear')return await clearCornholeScore(body,env);
        return await saveCornholeScore(body,env);
      }
      if(path==='/api/egg-toss'&&request.method==='GET')return await augmentEggToss(await app.fetch(request,env,ctx),env);
      if(path==='/api/scores'&&request.method==='GET')return await augmentScores(await app.fetch(request,env,ctx),env);
      if(path==='/api/player-hq'&&request.method==='GET')return await augmentPlayerHq(await app.fetch(request,env,ctx),env);
      return await app.fetch(request,env,ctx);
    }catch(e){return json({error:String(e?.message||e)},e?.status&&e.status>=400&&e.status<600?e.status:502)}
  }
};
