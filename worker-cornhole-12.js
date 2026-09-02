import app from './worker-event-scorecards.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const base=e=>String(e.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
async function sb(env,path,init={}){
  const r=await fetch(`${base(env)}/rest/v1/${path}`,{...init,headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...(init.headers||{})}});
  const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}
  if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||`Supabase ${r.status}`));
  return d;
}
async function resolveCornhole(env){
  const rows=await sb(env,'olympic_events?select=id,event,event_key&event_key=eq.cornhole-tournament&limit=1');
  if(!rows[0])throw new Error('Cornhole event not found.');
  return rows[0];
}
async function patchMatch(env,id,body){
  await sb(env,`cornhole_matches?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});
}
async function setRoutes(env,matches,count){
  const byCode=new Map(matches.map(m=>[m.match_code,m]));
  const routes10={
    P1:['W1','L1'],P2:['W3','L2'],P3:[null,null],P4:[null,null],
    W1:['W5','L3'],W2:['W5','L1'],W3:['W6','L4'],W4:['W6','L2'],
    L1:['L3',null],L2:['L4',null],W5:['W7','L6'],W6:['W7','L5'],
    L3:['L5',null],L4:['L6',null],W7:['GF1','L8'],L5:['L7',null],L6:['L7',null],
    L7:['L8',null],L8:['GF1',null],L9:[null,null],L10:[null,null],GF1:['GF2 if needed','GF2 if needed'],GF2:[null,null]
  };
  const routes12={
    P1:['W2','L1'],P2:['W4','L2'],P3:['W3','L3'],P4:['W1','L4'],
    W1:['W5','L1'],W2:['W5','L2'],W3:['W6','L3'],W4:['W6','L4'],
    L1:['L5',null],L2:['L5',null],L3:['L6',null],L4:['L6',null],
    W5:['W7','L8'],W6:['W7','L7'],L5:['L7',null],L6:['L8',null],
    L7:['L9',null],L8:['L9',null],W7:['GF1','L10'],L9:['L10',null],L10:['GF1',null],
    GF1:['GF2 if needed','GF2 if needed'],GF2:[null,null]
  };
  const routes=count===12?routes12:routes10;
  for(const [code,[winner_to,loser_to]] of Object.entries(routes)){
    const m=byCode.get(code);if(m)await patchMatch(env,m.id,{winner_to,loser_to});
  }
}
async function seedCornhole(body,env){
  if(!env.ADMIN_SCORE_CODE||String(body.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);
  const event=await resolveCornhole(env);
  const [pairs,people,matches]=await Promise.all([
    sb(env,`event_pairs?select=id,pair_number,participant_1_id,participant_2_id&event_id=eq.${event.id}&order=pair_number.asc`),
    sb(env,'participants?select=id,participant'),
    sb(env,'cornhole_matches?select=id,match_code,status,score_a,score_b&order=sort_order.asc')
  ]);
  if(!pairs.length)return json({error:'Create and save Cornhole pairs first.'},400);
  if(pairs.length>12)return json({error:'Cornhole supports a maximum of 12 pairs.'},400);
  if(pairs.length===11)return json({error:'The Cornhole bracket supports up to 10 pairs or exactly 12 pairs. Add the 12th pair before seeding.'},400);
  const seeds=Array.isArray(body.seeds)?body.seeds:[];
  if(seeds.length!==pairs.length)return json({error:'Every Cornhole pair must have a seed.'},400);
  const pairById=new Map(pairs.map(p=>[p.id,p])),seedNums=new Set(),pairIds=new Set();
  for(const x of seeds){
    const n=Number(x.seed),id=String(x.pairId||'');
    if(!pairById.has(id)||!Number.isInteger(n)||n<1||n>pairs.length||seedNums.has(n)||pairIds.has(id))return json({error:`Seeds must be unique numbers from 1 to ${pairs.length}, with each pair used once.`},400);
    seedNums.add(n);pairIds.add(id);
  }
  if(pairs.length===12&&!['P3','P4','L9','L10'].every(code=>matches.some(m=>m.match_code===code)))return json({error:'The 12-team Cornhole bracket database update is not installed.'},503);
  const started=matches.some(m=>m.status==='Complete'||m.score_a!=null||m.score_b!=null);
  if(started&&!body.forceReset)return json({ok:false,needsResetConfirmation:true,error:'Cornhole has results. Confirm reset before reseeding.'},409);

  await setRoutes(env,matches,pairs.length);
  await sb(env,'cornhole_matches?match_code=not.is.null',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({team_a:null,team_b:null,team_a_players:null,team_b_players:null,score_a:null,score_b:null,winner:null,loser:null,status:'Waiting'})});
  await sb(env,`event_pairs?event_id=eq.${event.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({seed:null})});
  await sb(env,`event_participants?event_id=eq.${event.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({seed:null})});

  const byPerson=new Map(people.map(p=>[p.id,p.participant||''])),seeded=new Map();
  for(const x of seeds){
    const p=pairById.get(String(x.pairId)),n=Number(x.seed),players=`${byPerson.get(p.participant_1_id)||''} + ${byPerson.get(p.participant_2_id)||''}`;
    seeded.set(n,{label:`Seed ${n}`,players});
    await sb(env,`event_pairs?id=eq.${p.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({seed:n})});
    await sb(env,`event_participants?event_id=eq.${event.id}&event_team_number=eq.${p.pair_number}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({seed:n})});
  }

  const openings=pairs.length===12
    ? [['P1',5,12],['P2',6,11],['P3',7,10],['P4',8,9],['W1',1,null],['W2',4,null],['W3',2,null],['W4',3,null]]
    : pairs.length<=8
      ? [['W1',1,8],['W2',4,5],['W3',2,7],['W4',3,6]]
      : [['P1',8,9],['P2',7,10],['W1',1,null],['W2',4,5],['W3',2,null],['W4',3,6]];
  const byCode=new Map(matches.map(m=>[m.match_code,m]));
  for(const [code,sa,sbSeed] of openings){
    const m=byCode.get(code);if(!m)continue;
    const a=seeded.get(sa),b=sbSeed?seeded.get(sbSeed):null;
    await patchMatch(env,m.id,{team_a:a?.label||null,team_a_players:a?.players||null,team_b:b?.label||null,team_b_players:b?.players||null,status:a&&b?'Ready':'Waiting'});
  }
  return json({ok:true,seeded:seeds.length,reset:started,format:pairs.length===12?'12-team double elimination':'standard double elimination'});
}

export default{async fetch(request,env,ctx){
  const u=new URL(request.url);
  if(u.pathname==='/api/admin/teams'&&request.method==='POST'){
    let body={};try{body=await request.clone().json()}catch{}
    if(body.action==='seedCornhole'){
      try{return await seedCornhole(body,env)}catch(e){return json({error:String(e?.message||e)},502)}
    }
  }
  return app.fetch(request,env,ctx);
}};
