import app from './worker-supabase.js';

const TEAMS=['Team Red','Team Blue','Team Green','Team Gold'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');

function headers(env,extra={}){
  return {apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...extra};
}

async function sb(env,path,init={}){
  const base=cleanBase(env.SUPABASE_URL);
  if(!base)return Promise.reject(new Error('SUPABASE_URL is missing from the Worker runtime.'));
  if(!env.SUPABASE_SECRET_KEY)return Promise.reject(new Error('SUPABASE_SECRET_KEY is missing from the Worker runtime.'));
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

async function teamEditor(request,env){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!env.ADMIN_SCORE_CODE)return json({error:'ADMIN_SCORE_CODE is missing.'},503);
  let body={};
  try{body=await request.json()}catch{return json({error:'Invalid request.'},400)}
  if(String(body.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);

  try{
    if(body.action==='list'){
      const rows=await sb(env,'participants?select=id,notion_page_id,participant,divisions,team&order=participant.asc');
      return json({ok:true,participants:rows.map(p=>({id:p.notion_page_id,name:p.participant,divisions:p.divisions||[],team:p.team||''})),teams:TEAMS});
    }

    if(body.action==='save'){
      const assignments=Array.isArray(body.assignments)?body.assignments:[];
      if(!assignments.length)return json({error:'No team assignments were provided.'},400);
      const seen=new Set();
      for(const a of assignments){
        const id=String(a.participantId||'');
        const team=String(a.team||'');
        if(!id||seen.has(id))return json({error:'Invalid or duplicate participant assignment.'},400);
        if(team&&!TEAMS.includes(team))return json({error:`Invalid team: ${team}`},400);
        seen.add(id);
      }
      await Promise.all(assignments.map(a=>sb(env,`participants?notion_page_id=eq.${encodeURIComponent(String(a.participantId))}`,{
        method:'PATCH',
        headers:{Prefer:'return=minimal'},
        body:JSON.stringify({team:String(a.team||'')||null})
      })));
      return json({ok:true,saved:assignments.length});
    }

    return json({error:'Unknown team editor action.'},400);
  }catch(err){
    const message=String(err?.message||err);
    if(message.includes('column participants.team does not exist')||message.includes('Could not find the')&&message.includes('team')){
      return json({error:'Team editor database update has not been installed yet. Run supabase/add-participant-teams.sql in Supabase.'},503);
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
