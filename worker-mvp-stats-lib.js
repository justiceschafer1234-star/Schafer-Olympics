const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const base=e=>String(e.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const enc=v=>encodeURIComponent(String(v));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=n=>Math.round((num(n)+Number.EPSILON)*100)/100;
const arr=v=>Array.isArray(v)?v:[];

async function sb(env,path,init={}){
  const url=base(env);
  if(!url||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime secrets are missing.');
  const r=await fetch(`${url}/rest/v1/${path}`,{
    ...init,
    headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...(init.headers||{})}
  });
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||`Supabase ${r.status}`));
  return data;
}

let cached=null,cachedAt=0;
function invalidate(){cached=null;cachedAt=0}

export async function loadMvpSnapshot(env,{fresh=false}={}){
  if(!fresh&&cached&&Date.now()-cachedAt<3000)return cached;
  const [rules,events,participants,registrations,stats,cards,pairs,eventParticipants,eggResults,cornholeMatches]=await Promise.all([
    sb(env,'mvp_event_rules?select=event_id,event_key,scoring_mode,metrics,kids_multiplier,placement_bonuses,notes'),
    sb(env,'olympic_events?select=id,event,event_key,event_number,status,gold_points,silver_points,bronze_1_points,bronze_2_points,gold_teams,silver_teams,bronze_1_teams,bronze_2_teams&order=event_number.asc'),
    sb(env,'participants?select=id,notion_page_id,participant,team&order=participant.asc'),
    sb(env,'registrations?select=participant_id,event_id'),
    sb(env,'player_event_stats?select=event_id,participant_id,stats,editor_team,updated_at'),
    sb(env,'event_scorecards?select=event_id,format_key,state,updated_at'),
    sb(env,'event_pairs?select=id,event_id,pair_number,olympic_team,participant_1_id,participant_2_id,seed&order=event_id.asc,pair_number.asc'),
    sb(env,'event_participants?select=event_id,participant_id,event_team_number,registered&registered=eq.true&order=event_id.asc,event_team_number.asc'),
    sb(env,'egg_toss_results?select=pair_id,out_order,updated_at'),
    sb(env,'cornhole_matches?select=match_code,bracket,round_number,match_number,team_a,team_b,score_a,score_b,winner,loser,status,sort_order&order=sort_order.asc')
  ]);
  cached={rules,events,participants,registrations,stats,cards,pairs,eventParticipants,eggResults,cornholeMatches};cachedAt=Date.now();return cached;
}

function maps(s){
  const ruleByEvent=new Map(s.rules.map(x=>[String(x.event_id),x]));
  const ruleByKey=new Map(s.rules.map(x=>[String(x.event_key),x]));
  const eventById=new Map(s.events.map(x=>[String(x.id),x]));
  const eventByKey=new Map(s.events.map(x=>[String(x.event_key),x]));
  const personById=new Map(s.participants.map(x=>[String(x.id),x]));
  const cardByEvent=new Map(s.cards.map(x=>[String(x.event_id),x]));
  const statByKey=new Map(s.stats.map(x=>[`${x.event_id}:${x.participant_id}`,x]));
  const registrationsByEvent=new Map();
  for(const r of s.registrations){const k=String(r.event_id);if(!registrationsByEvent.has(k))registrationsByEvent.set(k,new Set());registrationsByEvent.get(k).add(String(r.participant_id))}
  const pairsByEvent=new Map();
  for(const p of s.pairs){const k=String(p.event_id);if(!pairsByEvent.has(k))pairsByEvent.set(k,[]);pairsByEvent.get(k).push(p)}
  const eventParticipantsByEvent=new Map();
  for(const p of s.eventParticipants||[]){const k=String(p.event_id);if(!eventParticipantsByEvent.has(k))eventParticipantsByEvent.set(k,[]);eventParticipantsByEvent.get(k).push(p)}
  const eggByPair=new Map(s.eggResults.map(x=>[String(x.pair_id),x]));
  return{ruleByEvent,ruleByKey,eventById,eventByKey,personById,cardByEvent,statByKey,registrationsByEvent,pairsByEvent,eventParticipantsByEvent,eggByPair};
}

function eventPoints(event,place){
  if(place===1)return num(event.gold_points);
  if(place===2)return num(event.silver_points);
  if(place===3)return num(event.bronze_1_points);
  if(place===4)return num(event.bronze_2_points);
  return 0;
}
function teamPlace(event,team){
  if(!team)return null;
  const rows=[[1,event.gold_teams],[2,event.silver_teams],[3,event.bronze_1_teams],[4,event.bronze_2_teams]];
  return rows.find(([,teams])=>arr(teams).includes(team))?.[0]||null;
}
function maxPoints(event,rule){return round(num(event.gold_points)*num(rule.kids_multiplier||1))}
function normalized(raw,maxRaw,max){return maxRaw>0?round((raw/maxRaw)*max):0}
function metricDetails(metrics,stats){return arr(metrics).map(m=>({key:String(m.key||''),label:String(m.label||m.key||''),value:num(stats?.[m.key]),weight:num(m.weight||1)}))}
function manualRaw(metrics,stats){return arr(metrics).reduce((sum,m)=>{let value=Math.max(0,num(stats?.[m.key]));if(Number.isFinite(Number(m.cap)))value=Math.min(value,Number(m.cap));return sum+value*num(m.weight||1)},0)}
function emptyResult(pid){return{participantId:pid,stats:{},details:[],rawScore:0,mvpPoints:0,place:null}}
function pairParticipants(pair){return[String(pair.participant_1_id||''),String(pair.participant_2_id||'')].filter(Boolean)}

function calculateManual(ctx,event,rule,registered){
  const by=new Map();let maxRaw=0;
  for(const pid of registered){
    const stored=ctx.statByKey.get(`${event.id}:${pid}`),stats=stored?.stats&&typeof stored.stats==='object'?stored.stats:{};
    const raw=manualRaw(rule.metrics,stats);maxRaw=Math.max(maxRaw,raw);
    by.set(pid,{participantId:pid,stats,details:metricDetails(rule.metrics,stats),rawScore:round(raw),mvpPoints:0,place:null,updatedAt:stored?.updated_at||null});
  }
  const cap=maxPoints(event,rule);for(const x of by.values())x.mvpPoints=normalized(x.rawScore,maxRaw,cap);return by;
}

function calculatePairScore(ctx,event,rule,registered){
  const by=new Map([...registered].map(pid=>[pid,emptyResult(pid)])),state=ctx.cardByEvent.get(String(event.id))?.state||{},entries=arr(state.entries),entryById=new Map(entries.map(e=>[String(e.id),e]));let maxRaw=0;
  if(String(event.event_key)==='kahoot'){
    const groups=new Map();
    for(const ep of ctx.eventParticipantsByEvent.get(String(event.id))||[]){const n=Number(ep.event_team_number);if(!Number.isFinite(n)||n<=0)continue;if(!groups.has(n))groups.set(n,[]);groups.get(n).push(String(ep.participant_id))}
    for(const [n,pids] of groups){const e=entryById.get(`kahoot-${n}`),score=e&&e.score!==null&&e.score!==''?num(e.score):0;maxRaw=Math.max(maxRaw,score);for(const pid of pids)if(registered.has(pid))by.set(pid,{participantId:pid,stats:{},details:[{key:'kahoot_score',label:'Kahoot Score',value:score,weight:1}],rawScore:score,mvpPoints:0,place:null})}
  }else{
    const pairs=ctx.pairsByEvent.get(String(event.id))||[];
    for(const pair of pairs){const e=entryById.get(String(pair.id)),score=e&&e.score!==null&&e.score!==''?num(e.score):0;maxRaw=Math.max(maxRaw,score);for(const pid of pairParticipants(pair))if(registered.has(pid))by.set(pid,{participantId:pid,stats:{},details:[{key:'pair_score',label:'Pair Score',value:score,weight:1}],rawScore:score,mvpPoints:0,place:null})}
  }
  const cap=maxPoints(event,rule);for(const x of by.values())x.mvpPoints=normalized(x.rawScore,maxRaw,cap);return by;
}

function calculateTwoStage(ctx,event,rule,registered){
  const by=new Map([...registered].map(pid=>[pid,emptyResult(pid)])),state=ctx.cardByEvent.get(String(event.id))?.state||{};let maxRaw=0;
  for(const e of arr(state.entries)){
    const pid=String(e.id||'');if(!registered.has(pid))continue;
    const r1=e.round1??e.score,round1=r1===null||r1===''?0:num(r1),finalScore=e.finalScore===null||e.finalScore===''?0:num(e.finalScore),raw=round1+finalScore;maxRaw=Math.max(maxRaw,raw);
    by.set(pid,{participantId:pid,stats:{},details:[{key:'round1',label:'Round 1 Makes',value:round1,weight:1},{key:'final',label:'Final Round Makes',value:finalScore,weight:1}],rawScore:raw,mvpPoints:0,place:null});
  }
  const cap=maxPoints(event,rule);for(const x of by.values())x.mvpPoints=normalized(x.rawScore,maxRaw,cap);return by;
}

function calculateIndividualScore(ctx,event,rule,registered){
  const by=new Map([...registered].map(pid=>[pid,emptyResult(pid)])),state=ctx.cardByEvent.get(String(event.id))?.state||{};let maxRaw=0;
  for(const e of arr(state.entries)){
    const pid=String(e.id||'');if(!registered.has(pid))continue;const score=e.score===null||e.score===''?0:num(e.score);maxRaw=Math.max(maxRaw,score);
    by.set(pid,{participantId:pid,stats:{},details:[{key:'correct',label:'Correct Answers',value:score,weight:1}],rawScore:score,mvpPoints:0,place:null});
  }
  const cap=maxPoints(event,rule);for(const x of by.values())x.mvpPoints=normalized(x.rawScore,maxRaw,cap);return by;
}

function calculateSpeedGrab(ctx,event,rule,registered){
  const by=new Map([...registered].map(pid=>[pid,emptyResult(pid)])),state=ctx.cardByEvent.get(String(event.id))?.state||{},wins=new Map([...registered].map(pid=>[pid,0]));
  for(const roundRows of arr(state.bracketRounds))for(const m of arr(roundRows))if(m?.a&&m?.b&&m?.winner){const pid=String(m.winner);wins.set(pid,(wins.get(pid)||0)+1)}
  const placement=new Map(arr(state.placements).map((id,i)=>[String(id),i+1])),bonuses=rule.placement_bonuses||{};let maxRaw=0;
  for(const pid of registered){const w=wins.get(pid)||0,place=placement.get(pid)||null,bonus=place?num(bonuses[String(place)]):0,raw=w*2+bonus;maxRaw=Math.max(maxRaw,raw);by.set(pid,{participantId:pid,stats:{},details:[{key:'match_wins',label:'Match Wins',value:w,weight:2},...(place?[{key:'finish',label:'Finish',value:place,weight:0}]:[])],rawScore:raw,mvpPoints:0,place})}
  const cap=maxPoints(event,rule);for(const x of by.values())x.mvpPoints=normalized(x.rawScore,maxRaw,cap);return by;
}

function calculateTeamFinish(ctx,event,rule,registered){
  const by=new Map(),mult=num(rule.kids_multiplier||1);
  for(const pid of registered){const person=ctx.personById.get(pid),place=teamPlace(event,person?.team),points=place?round(eventPoints(event,place)*mult):0;by.set(pid,{participantId:pid,stats:{},details:place?[{key:'team_finish',label:'Team Finish',value:place,weight:0}]:[],rawScore:points,mvpPoints:points,place})}
  return by;
}

function eggPlace(pair,pairs,eggByPair){
  const row=eggByPair.get(String(pair.id)),order=row?.out_order;
  const scored=pairs.filter(p=>eggByPair.get(String(p.id))?.out_order!=null),survivors=pairs.filter(p=>eggByPair.get(String(p.id))?.out_order==null);
  if(order==null)return survivors.length===1&&scored.length>0?1:null;
  const ahead=pairs.filter(p=>{const o=eggByPair.get(String(p.id))?.out_order;return o==null||num(o)>num(order)}).length;return ahead+1;
}
function calculatePairFinish(ctx,event,rule,registered){
  const by=new Map([...registered].map(pid=>[pid,emptyResult(pid)])),pairs=ctx.pairsByEvent.get(String(event.id))||[],mult=num(rule.kids_multiplier||1);
  for(const pair of pairs){const place=eggPlace(pair,pairs,ctx.eggByPair),points=place?round(eventPoints(event,place)*mult):0;for(const pid of pairParticipants(pair))if(registered.has(pid))by.set(pid,{participantId:pid,stats:{},details:place?[{key:'finish',label:'Pair Finish',value:place,weight:0}]:[],rawScore:points,mvpPoints:points,place})}
  return by;
}

function cornholePlaces(matches,pairCount){
  const by=new Map(matches.map(m=>[String(m.match_code||''),m])),gf1=by.get('GF1'),gf2=by.get('GF2'),w7=by.get('W7');let champion='',runner='';
  if(gf2?.status==='Complete'&&gf2.winner){champion=gf2.winner;runner=gf2.loser}
  else if(gf1?.status==='Complete'&&gf1.winner&&w7?.winner&&gf1.winner===w7.winner){champion=gf1.winner;runner=gf1.loser}
  const third=pairCount>=14?by.get('L12')?.loser:pairCount===12?by.get('L10')?.loser:by.get('L8')?.loser;
  return new Map([[champion,1],[runner,2],[third,3]].filter(([x])=>x));
}
function calculateCornhole(ctx,event,rule,registered,snapshot){
  const by=new Map([...registered].map(pid=>[pid,emptyResult(pid)])),pairs=ctx.pairsByEvent.get(String(event.id))||[],matches=snapshot.cornholeMatches||[],places=cornholePlaces(matches,pairs.length),bonuses=rule.placement_bonuses||{};let maxRaw=0;
  for(const pair of pairs){
    const label=pair.seed?`Seed ${pair.seed}`:'',wins=label?matches.filter(m=>m.status==='Complete'&&m.winner===label).length:0,countedWins=Math.min(4,wins),place=places.get(label)||null,bonus=place?num(bonuses[String(place)]):0,raw=countedWins*2+bonus;maxRaw=Math.max(maxRaw,raw);
    for(const pid of pairParticipants(pair))if(registered.has(pid))by.set(pid,{participantId:pid,stats:{},details:[{key:'match_wins',label:'Match Wins',value:wins,weight:2},...(place?[{key:'finish',label:'Finish',value:place,weight:0}]:[])],rawScore:raw,mvpPoints:0,place});
  }
  const cap=maxPoints(event,rule);for(const x of by.values())x.mvpPoints=normalized(x.rawScore,maxRaw,cap);return by;
}

export function calculateMvpEvent(snapshot,eventKey){
  const ctx=maps(snapshot),event=ctx.eventByKey.get(String(eventKey)),rule=ctx.ruleByKey.get(String(eventKey));if(!event||!rule)return null;
  const registered=ctx.registrationsByEvent.get(String(event.id))||new Set();let results;
  if(rule.scoring_mode==='manual')results=calculateManual(ctx,event,rule,registered);
  else if(rule.scoring_mode==='pair_score')results=calculatePairScore(ctx,event,rule,registered);
  else if(rule.scoring_mode==='two_stage_makes')results=calculateTwoStage(ctx,event,rule,registered);
  else if(rule.scoring_mode==='individual_score')results=calculateIndividualScore(ctx,event,rule,registered);
  else if(rule.scoring_mode==='speed_grab')results=calculateSpeedGrab(ctx,event,rule,registered);
  else if(rule.scoring_mode==='team_finish')results=calculateTeamFinish(ctx,event,rule,registered);
  else if(rule.scoring_mode==='pair_finish')results=calculatePairFinish(ctx,event,rule,registered);
  else if(rule.scoring_mode==='cornhole')results=calculateCornhole(ctx,event,rule,registered,snapshot);
  else results=new Map();
  return{event,rule,registered,results,maxPoints:maxPoints(event,rule)};
}

function modeLabel(mode){return({manual:'Manual stats',pair_score:'Automatic · Kahoot score',two_stage_makes:'Automatic · shooting results',speed_grab:'Automatic · bracket',individual_score:'Automatic · event score',team_finish:'Automatic · team finish',pair_finish:'Automatic · pair finish',cornhole:'Automatic · tournament'}[mode]||'Automatic')}
function eventList(snapshot,team){
  const ctx=maps(snapshot);return snapshot.events.map(event=>{const rule=ctx.ruleByEvent.get(String(event.id));if(!rule)return null;const registered=ctx.registrationsByEvent.get(String(event.id))||new Set(),count=[...registered].filter(pid=>ctx.personById.get(pid)?.team===team).length;return{id:event.id,key:event.event_key,number:event.event_number,name:event.event,status:event.status,mode:rule.scoring_mode,modeLabel:modeLabel(rule.scoring_mode),manual:rule.scoring_mode==='manual',metrics:rule.metrics||[],goldPoints:num(event.gold_points),kidsMultiplier:num(rule.kids_multiplier||1),maxPoints:maxPoints(event,rule),registeredCount:count}}).filter(Boolean).sort((a,b)=>num(a.number)-num(b.number));
}
function eventDto(snapshot,team,eventKey){
  const calc=calculateMvpEvent(snapshot,eventKey);if(!calc)return null;const ctx=maps(snapshot),players=[];
  for(const pid of calc.registered){const p=ctx.personById.get(pid);if(!p||p.team!==team)continue;const r=calc.results.get(pid)||emptyResult(pid);players.push({id:p.id,name:p.participant,team:p.team,stats:r.stats||{},details:r.details||[],rawScore:round(r.rawScore),mvpPoints:round(r.mvpPoints),place:r.place||null,updatedAt:r.updatedAt||null})}
  players.sort((a,b)=>a.name.localeCompare(b.name));return{event:{id:calc.event.id,key:calc.event.event_key,number:calc.event.event_number,name:calc.event.event,status:calc.event.status,mode:calc.rule.scoring_mode,modeLabel:modeLabel(calc.rule.scoring_mode),manual:calc.rule.scoring_mode==='manual',metrics:calc.rule.metrics||[],goldPoints:num(calc.event.gold_points),kidsMultiplier:num(calc.rule.kids_multiplier||1),maxPoints:calc.maxPoints},players};
}

export async function adminMvpStats(request,env){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  let body={};try{body=await request.json()}catch{return json({error:'Invalid request.'},400)}
  if(!env.ADMIN_SCORE_CODE||String(body.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);
  const team=String(body.team||'');if(!TEAMS.includes(team))return json({error:'Choose a valid team stats view.'},400);
  try{
    let snapshot=await loadMvpSnapshot(env,{fresh:body.action==='setStat'});
    if(body.action==='load')return json({ok:true,team,teams:TEAMS,events:eventList(snapshot,team)});
    const eventKey=String(body.eventKey||'');if(!eventKey)return json({error:'Choose an event.'},400);
    if(body.action==='event'){const view=eventDto(snapshot,team,eventKey);return view?json({ok:true,team,...view}):json({error:'MVP event rule not found.'},404)}
    if(body.action==='setStat'){
      const ctx=maps(snapshot),event=ctx.eventByKey.get(eventKey),rule=ctx.ruleByKey.get(eventKey);if(!event||!rule)return json({error:'MVP event rule not found.'},404);if(rule.scoring_mode!=='manual')return json({error:'This event is calculated automatically.'},400);
      const pid=String(body.participantId||''),person=ctx.personById.get(pid);if(!person||person.team!==team)return json({error:'That player is not in this team view.'},403);const registered=ctx.registrationsByEvent.get(String(event.id))||new Set();if(!registered.has(pid))return json({error:'That player is not registered for this event.'},400);
      const statKey=String(body.statKey||''),metric=arr(rule.metrics).find(m=>String(m.key)===statKey);if(!metric)return json({error:'That stat is not allowed for this event.'},400);const value=Number(body.value);if(!Number.isInteger(value)||value<0||value>9999)return json({error:'Stat values must be whole numbers from 0 to 9999.'},400);
      const current=ctx.statByKey.get(`${event.id}:${pid}`),next={...(current?.stats&&typeof current.stats==='object'?current.stats:{}),[statKey]:value},now=new Date().toISOString();
      await sb(env,'player_event_stats?on_conflict=event_id,participant_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({event_id:event.id,participant_id:pid,stats:next,editor_team:team,updated_at:now})});
      invalidate();snapshot=await loadMvpSnapshot(env,{fresh:true});const view=eventDto(snapshot,team,eventKey);return json({ok:true,team,...view});
    }
    return json({error:'Unknown MVP stats action.'},400);
  }catch(e){return json({error:String(e?.message||e)},502)}
}

export async function getPlayerMvp(env,participantId){
  const snapshot=await loadMvpSnapshot(env),ctx=maps(snapshot),pid=String(participantId),registeredEventIds=new Set(snapshot.registrations.filter(r=>String(r.participant_id)===pid).map(r=>String(r.event_id))),byEvent={},eventRows=[];let total=0;
  for(const event of snapshot.events){if(!registeredEventIds.has(String(event.id)))continue;const calc=calculateMvpEvent(snapshot,event.event_key);if(!calc)continue;const r=calc.results.get(pid)||emptyResult(pid),row={eventId:event.id,eventKey:event.event_key,rawScore:round(r.rawScore),points:round(r.mvpPoints),maxPoints:calc.maxPoints,place:r.place||null,details:r.details||[],stats:r.stats||{}};byEvent[String(event.id)]=row;eventRows.push(row);total+=row.points}
  return{totalPoints:round(total),byEvent,events:eventRows};
}
