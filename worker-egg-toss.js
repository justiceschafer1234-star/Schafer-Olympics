import app from './worker-slip-slide.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const headers=(env,extra={})=>({apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...extra});
async function sb(env,path,init={}){const base=cleanBase(env.SUPABASE_URL);if(!base||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime settings are missing.');const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers:headers(env,init.headers||{})});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||`Supabase ${r.status}`));return data}
async function rpc(env,name,body){return sb(env,`rpc/${name}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)})}

async function load(env){
  const events=await sb(env,'olympic_events?select=id,notion_page_id,event,event_key,event_number,status,gold_teams,silver_teams,bronze_1_teams&event_key=eq.egg-toss&limit=1');
  const event=events[0]; if(!event)throw new Error('Egg Toss event not found.');
  const [pairs,people,results]=await Promise.all([
    sb(env,`event_pairs?select=id,pair_number,olympic_team,participant_1_id,participant_2_id&event_id=eq.${event.id}&order=pair_number.asc`),
    sb(env,'participants?select=id,participant'),
    sb(env,'egg_toss_results?select=pair_id,out_order,updated_at')
  ]);
  const byPerson=new Map(people.map(p=>[p.id,p.participant||''])),byResult=new Map(results.map(r=>[r.pair_id,r]));
  const items=pairs.map(p=>({id:p.id,pairNumber:Number(p.pair_number),olympicTeam:p.olympic_team||'',player1:byPerson.get(p.participant_1_id)||'',player2:byPerson.get(p.participant_2_id)||'',outOrder:byResult.get(p.id)?.out_order==null?null:Number(byResult.get(p.id).out_order)}));
  return {ok:true,event:{id:event.notion_page_id,name:event.event,key:event.event_key,number:event.event_number,status:event.status||'Not Started',goldTeams:event.gold_teams||[],silverTeams:event.silver_teams||[],bronzeTeams:event.bronze_1_teams||[]},pairs:items};
}

export default{async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname!=='/api/egg-toss')return app.fetch(request,env,ctx);
  try{
    if(request.method==='GET')return json(await load(env));
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    let body={};try{body=await request.json()}catch{return json({error:'Invalid request.'},400)}
    if(!env.ADMIN_SCORE_CODE)return json({error:'ADMIN_SCORE_CODE is missing.'},503);
    if(String(body.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);
    const pairId=String(body.pairId||''); if(!pairId)return json({error:'Choose an Egg Toss pair.'},400);
    if(body.action==='save'){
      const n=Number(body.outOrder);if(!Number.isInteger(n)||n<1)return json({error:'Out order must be a whole number of 1 or greater.'},400);
      await rpc(env,'save_egg_toss_result',{p_pair_id:pairId,p_out_order:n});
      return json(await load(env));
    }
    if(body.action==='clear'){
      await rpc(env,'clear_egg_toss_result',{p_pair_id:pairId});
      return json(await load(env));
    }
    return json({error:'Unknown action.'},400);
  }catch(e){return json({error:String(e?.message||e)},502)}
}};
