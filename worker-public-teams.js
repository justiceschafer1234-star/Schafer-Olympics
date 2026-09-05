import app from './worker-hardening.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const base=e=>String(e.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');

async function sb(env,path){
  const url=base(env);
  if(!url||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime secrets are missing.');
  const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'}});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||`Supabase ${r.status}`));
  return data;
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/api/public-teams'){
      try{
        const rows=await sb(env,'participants?select=participant,team&team=not.is.null&order=participant.asc');
        const participants=(rows||[])
          .filter(p=>['Team Red','Team Blue','Team Green','Team Gold'].includes(p.team))
          .map(p=>({name:p.participant,team:p.team}));
        return json({ok:true,participants,updatedAt:new Date().toISOString()});
      }catch(e){return json({ok:false,error:String(e?.message||e)},502)}
    }
    return app.fetch(request,env,ctx);
  }
};
