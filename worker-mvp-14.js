import {adminMvpStats as baseAdminMvpStats,getPlayerMvp as baseGetPlayerMvp,loadMvpSnapshot} from './worker-mvp-stats-lib.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=n=>Math.round((num(n)+Number.EPSILON)*100)/100;

function cornholeCalc(snapshot){
  const event=snapshot.events.find(e=>String(e.event_key)==='cornhole-tournament');
  const rule=snapshot.rules.find(r=>String(r.event_key)==='cornhole-tournament');
  if(!event||!rule)return null;
  const pairs=snapshot.pairs.filter(p=>String(p.event_id)===String(event.id));
  if(pairs.length!==14)return null;
  const matches=snapshot.cornholeMatches||[],byCode=new Map(matches.map(m=>[String(m.match_code||''),m]));
  const gf1=byCode.get('GF1'),gf2=byCode.get('GF2'),w7=byCode.get('W7');let champion='',runner='';
  if(gf2?.status==='Complete'&&gf2.winner){champion=gf2.winner;runner=gf2.loser}
  else if(gf1?.status==='Complete'&&gf1.winner&&w7?.winner&&gf1.winner===w7.winner){champion=gf1.winner;runner=gf1.loser}
  const third=byCode.get('L12')?.status==='Complete'?byCode.get('L12')?.loser||'':'';
  const placeByLabel=new Map([[champion,1],[runner,2],[third,3]].filter(([label])=>label));
  const bonuses=rule.placement_bonuses||{},rows=new Map();let maxRaw=0;
  for(const pair of pairs){
    const label=pair.seed?`Seed ${pair.seed}`:'',wins=label?matches.filter(m=>m.status==='Complete'&&m.winner===label).length:0,countedWins=Math.min(4,wins),place=placeByLabel.get(label)||null,bonus=place?num(bonuses[String(place)]):0,raw=countedWins*2+bonus;
    maxRaw=Math.max(maxRaw,raw);
    const row={pair,label,wins,place,raw};rows.set(String(pair.id),row);
  }
  const maxPoints=round(num(event.gold_points)*num(rule.kids_multiplier||1));
  for(const row of rows.values())row.points=maxRaw>0?round((row.raw/maxRaw)*maxPoints):0;
  return{event,rule,pairs,rows,maxPoints};
}
function participantRow(calc,pid){
  const pair=calc?.pairs.find(p=>String(p.participant_1_id)===String(pid)||String(p.participant_2_id)===String(pid));if(!pair)return null;
  const x=calc.rows.get(String(pair.id));if(!x)return null;
  return{rawScore:round(x.raw),points:round(x.points),maxPoints:calc.maxPoints,place:x.place||null,details:[{key:'match_wins',label:'Match Wins',value:x.wins,weight:2},...(x.place?[{key:'finish',label:'Finish',value:x.place,weight:0}]:[])],stats:{}};
}

export async function adminMvpStats(request,env){
  const clone=request.clone();let body={};try{body=await clone.json()}catch{}
  const response=await baseAdminMvpStats(request,env);if(!response.ok||String(body.eventKey||'')!=='cornhole-tournament'||body.action!=='event')return response;
  let data;try{data=await response.json()}catch{return response}
  const snapshot=await loadMvpSnapshot(env,{fresh:true}),calc=cornholeCalc(snapshot);if(!calc||!Array.isArray(data.players))return json(data,response.status);
  data.players=data.players.map(p=>{const r=participantRow(calc,p.id);return r?{...p,rawScore:r.rawScore,mvpPoints:r.points,place:r.place,details:r.details,stats:r.stats}:p});
  return json(data,response.status);
}

export async function getPlayerMvp(env,participantId){
  const base=await baseGetPlayerMvp(env,participantId),snapshot=await loadMvpSnapshot(env,{fresh:true}),calc=cornholeCalc(snapshot),replacement=participantRow(calc,participantId);if(!calc||!replacement)return base;
  const idx=(base.events||[]).findIndex(e=>String(e.eventKey)==='cornhole-tournament');if(idx<0)return base;
  const old=base.events[idx],next={...old,...replacement};base.events[idx]=next;base.byEvent={...(base.byEvent||{}),[String(calc.event.id)]:next};base.totalPoints=round(num(base.totalPoints)-num(old.points)+num(next.points));return base;
}

export {loadMvpSnapshot};
