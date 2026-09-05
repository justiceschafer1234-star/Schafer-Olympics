import app from './worker-egg-toss.js';

const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
const RULES={
  kahoot:{mode:'pairs',title:'Kahoot',places:4},
  'kids-soccer':{mode:'game',title:'Kids Soccer',combined:true,places:2},
  'junior-basketball':{mode:'game',title:'Junior Basketball',combined:true,places:2},
  'women-s-three-point-contest':{mode:'two-stage',title:'Women’s Three-Point Contest',finalists:4,places:3},
  'men-s-three-point-contest':{mode:'two-stage',title:'Men’s Three-Point Contest',finalists:4,places:3},
  'speed-grab':{mode:'bracket',title:'Speed Grab',places:3},
  'nuke-em':{mode:'game',title:'Nuke ’Em',combined:true,places:2},
  'speed-volleyball-volleyball':{mode:'round-total',title:'Speed Volleyball',minRounds:2,maxRounds:4,places:4},
  'water-tasting':{mode:'individual',title:'Water Tasting',places:3},
  'fill-the-water-bottle':{mode:'game',title:'Fill the Water Bottle',combined:true,places:2},
  'protect-the-balloon-baby':{mode:'game',title:'Protect the Balloon Baby',combined:true,places:2,noPoints:true},
  'kids-dodgeball':{mode:'series',title:'Kids Dodgeball',combined:true,bestOf:3,places:2},
  'women-s-dodgeball':{mode:'series',title:'Women’s Dodgeball',combined:true,bestOf:3,places:2},
  'men-s-dodgeball':{mode:'series',title:'Men’s Dodgeball',combined:true,bestOf:3,places:2}
};
const THREE_POINT_KEYS=new Set(['women-s-three-point-contest','men-s-three-point-contest']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const headers=(env,extra={})=>({apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...extra});
async function sb(env,path,init={}){const base=cleanBase(env.SUPABASE_URL);if(!base||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime settings are missing.');const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers:headers(env,init.headers||{})});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||`Supabase ${r.status}`));return d}
const enc=v=>encodeURIComponent(String(v));
const uniq=a=>[...new Set((a||[]).filter(x=>TEAMS.includes(x)))];
function hasScore(v){return v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))}
function ranked(entries,value){return [...entries].filter(x=>hasScore(value(x))).sort((a,b)=>Number(value(b))-Number(value(a))||String(a.label||'').localeCompare(String(b.label||'')))}
function podiumFromEntries(entries,value,places=4){const out={gold:[],silver:[],bronze1:[],bronze2:[]},keys=['gold','silver','bronze1','bronze2'],sorted=ranked(entries,value);let place=0,last=null;sorted.forEach((e,i)=>{const score=Number(value(e));if(last===null||score!==last)place=i+1;last=score;if(place<=places&&keys[place-1])out[keys[place-1]].push(...uniq(e.teams))});for(const k of keys)out[k]=uniq(out[k]);return out}
function normalizeThreePointState(key,state){if(!THREE_POINT_KEYS.has(key)||!Array.isArray(state?.entries)||!state.entries.length)return state;const entries=state.entries;if(!entries.every(e=>hasScore(e.score)))return state;const rankedRound=entries.map((e,index)=>({index,score:Number(e.score)})).sort((a,b)=>b.score-a.score||a.index-b.index);const leaderScore=rankedRound[0]?.score,leaders=rankedRound.filter(x=>x.score===leaderScore),secondScore=rankedRound.find(x=>x.score<leaderScore)?.score,seconds=secondScore==null?[]:rankedRound.filter(x=>x.score===secondScore);const selected=leaders.length===1&&seconds.length===3?[leaders[0],...seconds]:rankedRound.slice(0,4),chosen=new Set(selected.map(x=>x.index));return{...state,entries:entries.map((e,index)=>({...e,advanced:chosen.has(index)}))}}
function outcome(rule,state){let p={gold:[],silver:[],bronze1:[],bronze2:[]},complete=false;
  if(rule.mode==='game'||rule.mode==='series'){const sides=state.sides||[],games=state.games||[],wins=[0,0];games.forEach(x=>{if(x===0||x===1)wins[x]++});let winner=state.winnerSide;if(rule.mode==='series'){const need=2;winner=wins[0]>=need?0:wins[1]>=need?1:null}else if(winner!==0&&winner!==1)winner=null;if(winner===0||winner===1){complete=true;if(!rule.noPoints){p.gold=uniq(sides[winner]);p.silver=uniq(sides[winner===0?1:0])}}}
  else if(rule.mode==='round-total'){const rounds=Math.min(rule.maxRounds,Math.max(rule.minRounds,Number(state.roundCount)||3)),entries=(state.entries||[]).map(e=>({...e,total:(e.scores||[]).slice(0,rounds).reduce((a,x)=>a+(Number(x)||0),0)}));p=podiumFromEntries(entries,e=>e.total,rule.places);complete=Boolean(state.complete)&&entries.length===4&&entries.every(e=>(e.scores||[]).slice(0,rounds).length===rounds&&(e.scores||[]).slice(0,rounds).every(hasScore))}
  else if(rule.mode==='pairs'||rule.mode==='individual'){const entries=state.entries||[];p=podiumFromEntries(entries,e=>e.score,rule.places);complete=Boolean(state.complete)&&entries.length>0&&entries.every(e=>hasScore(e.score))}
  else if(rule.mode==='two-stage'){const entries=(state.entries||[]).filter(e=>e.advanced);p=podiumFromEntries(entries,e=>e.finalScore,rule.places);complete=Boolean(state.complete)&&entries.length===rule.finalists&&entries.every(e=>hasScore(e.finalScore))}
  else if(rule.mode==='bracket'){const byId=new Map((state.entries||[]).map(e=>[e.id,e])),ids=state.placements||[];if(ids[0]&&ids[1]){p.gold=uniq(byId.get(ids[0])?.teams);p.silver=uniq(byId.get(ids[1])?.teams);p.bronze1=uniq(ids.slice(2).flatMap(id=>byId.get(id)?.teams||[]));complete=Boolean(state.complete)}}
  return{podium:p,complete};
}
async function load(env,key){const rule=RULES[key];if(!rule)throw new Error('This event does not have a scorecard yet.');const es=await sb(env,`olympic_events?select=*&event_key=eq.${enc(key)}&limit=1`),event=es[0];if(!event)throw new Error('Event not found.');const [card,people,regs,pairs,eventParticipants]=await Promise.all([
    sb(env,`event_scorecards?select=format_key,state,updated_at&event_id=eq.${event.id}&limit=1`),
    sb(env,'participants?select=id,participant,participant_key,team&order=participant.asc'),
    sb(env,`registrations?select=participant_id&event_id=eq.${event.id}`),
    sb(env,`event_pairs?select=id,pair_number,olympic_team,participant_1_id,participant_2_id&event_id=eq.${event.id}&order=pair_number.asc`),
    key==='kahoot'?sb(env,`event_participants?select=id,participant_id,olympic_team,event_team_number,registered&event_id=eq.${event.id}&registered=eq.true&order=event_team_number.asc,participant_id.asc`):Promise.resolve([])
  ]),registered=new Set(regs.map(x=>x.participant_id)),byId=new Map(people.map(x=>[x.id,x]));
  let scorePairs=pairs.map(x=>({id:x.id,pairNumber:x.pair_number,teams:uniq([x.olympic_team]),team:x.olympic_team,player1:byId.get(x.participant_1_id)?.participant||'',player2:byId.get(x.participant_2_id)?.participant||''}));
  if(key==='kahoot'){
    const groups=new Map();
    for(const ep of eventParticipants){
      const n=Number(ep.event_team_number);
      if(!Number.isFinite(n)||n<=0)continue;
      if(!groups.has(n))groups.set(n,[]);
      groups.get(n).push(ep);
    }
    scorePairs=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([pairNumber,members])=>{
      const sorted=[...members].sort((a,b)=>String(byId.get(a.participant_id)?.participant||'').localeCompare(String(byId.get(b.participant_id)?.participant||'')));
      const p1=sorted[0],p2=sorted[1];
      const memberTeams=uniq(sorted.map(x=>x.olympic_team||byId.get(x.participant_id)?.team||''));
      return{id:`kahoot-${pairNumber}`,pairNumber,teams:memberTeams,team:memberTeams.length===1?memberTeams[0]:'',player1:p1?byId.get(p1.participant_id)?.participant||'':'',player2:p2?byId.get(p2.participant_id)?.participant||'':''};
    });
  }
  return{ok:true,rule,event:{id:event.id,rosterId:event.notion_page_id,key:event.event_key,name:event.event,number:event.event_number,status:event.status,goldPoints:Number(event.gold_points),silverPoints:Number(event.silver_points),bronze1Points:Number(event.bronze_1_points),bronze2Points:Number(event.bronze_2_points)},participants:people.filter(x=>registered.has(x.id)).map(x=>({id:x.id,key:x.participant_key,name:x.participant,team:x.team||''})),pairs:scorePairs,state:card[0]?.state||{},updatedAt:card[0]?.updated_at||null};
}
async function save(env,key,state){const d=await load(env,key);state=normalizeThreePointState(key,state);if(['game','series'].includes(d.rule.mode)){const sides=state.sides||[],size=d.rule.combined?2:1,all=sides.flat();if(sides.length!==2||sides.some(x=>!Array.isArray(x)||x.length!==size)||all.some(x=>!TEAMS.includes(x))||new Set(all).size!==all.length)return Promise.reject(new Error(`Choose exactly ${size} different Olympic team${size===1?'':'s'} for each side.`))}const {podium,complete}=outcome(d.rule,state),status=complete?'Complete':Object.keys(state||{}).length?'In Progress':'Not Started';await sb(env,'event_scorecards?on_conflict=event_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({event_id:d.event.id,format_key:d.rule.mode,state})});await sb(env,`olympic_events?id=eq.${d.event.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({gold_teams:podium.gold,silver_teams:podium.silver,bronze_1_teams:podium.bronze1,bronze_2_teams:podium.bronze2,legacy_bronze_teams:[],status})});return load(env,key)}
async function reset(env,key){const d=await load(env,key);await sb(env,'event_scorecards?on_conflict=event_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({event_id:d.event.id,format_key:d.rule.mode,state:{}})});await sb(env,`olympic_events?id=eq.${d.event.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({gold_teams:[],silver_teams:[],bronze_1_teams:[],bronze_2_teams:[],legacy_bronze_teams:[],status:'Not Started'})});return load(env,key)}
export default{async fetch(request,env,ctx){const u=new URL(request.url);if(u.pathname!=='/api/event-scorecard')return app.fetch(request,env,ctx);const key=String(u.searchParams.get('eventKey')||'');try{if(request.method==='GET')return json(await load(env,key));if(request.method!=='POST')return json({error:'Method not allowed'},405);let b={};try{b=await request.json()}catch{return json({error:'Invalid request.'},400)}if(!env.ADMIN_SCORE_CODE||String(b.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);if(b.action==='reset')return json(await reset(env,key));if(b.action!=='save'||!b.state||typeof b.state!=='object'||Array.isArray(b.state))return json({error:'Invalid scorecard state.'},400);return json(await save(env,key,b.state))}catch(e){return json({error:String(e?.message||e)},502)}}};