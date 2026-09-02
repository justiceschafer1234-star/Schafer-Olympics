import app from './worker-bronze-medals.js';

const EVENTS=new Set(['kids-slip-and-slide-relay','adult-slip-and-slide-relay']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const headers=env=>({apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`,'Content-Type':'application/json'});
async function sb(env,path,init={}){const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers:{...headers(env),...(init.headers||{})}});const text=await r.text();let d=null;try{d=text?JSON.parse(text):null}catch{d=text}if(!r.ok){const e=new Error(typeof d==='string'?d:(d?.message||`Supabase ${r.status}`));e.status=r.status;throw e}return d}
async function rpc(env,name,body){return sb(env,`rpc/${name}`,{method:'POST',body:JSON.stringify(body)})}
function best(e){const xs=[e.attempt_1_seconds,e.attempt_2_seconds,e.attempt_3_seconds].filter(x=>x!=null).map(Number);return xs.length?Math.min(...xs):null}
function rank(entries){return [...entries].map(e=>({...e,best_time_seconds:best(e)})).sort((a,b)=>(a.best_time_seconds??Infinity)-(b.best_time_seconds??Infinity)||a.entry_number-b.entry_number).map((e,i)=>({...e,place:e.best_time_seconds==null?null:i+1}))}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname!=='/api/slip-slide')return app.fetch(request,env,ctx);
    try{
      if(request.method==='GET'){
        const key=String(url.searchParams.get('eventKey')||'');
        if(!EVENTS.has(key))return json({error:'Unknown Slip-and-Slide event.'},400);
        const [entries,events]=await Promise.all([
          sb(env,`slip_slide_entries?event_key=eq.${encodeURIComponent(key)}&select=*&order=entry_number.asc`),
          sb(env,`olympic_events?event_key=eq.${encodeURIComponent(key)}&select=*&limit=1`)
        ]);
        const event=events?.[0]||null;
        return json({ok:true,eventKey:key,eventId:event?.notion_page_id||null,event,entries:rank(entries||[])});
      }
      if(request.method!=='POST')return json({error:'Method not allowed.'},405);
      if(!env.ADMIN_SCORE_CODE)return json({error:'ADMIN_SCORE_CODE is missing.'},503);
      const b=await request.json().catch(()=>null);
      if(!b)return json({error:'Invalid request.'},400);
      if(String(b.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect Control code.'},401);
      const key=String(b.eventKey||'');
      if(!EVENTS.has(key))return json({error:'Unknown Slip-and-Slide event.'},400);
      let d;
      if(b.action==='saveAttempt'){
        d=await rpc(env,'save_slip_slide_attempt',{p_event_key:key,p_entry_number:Number(b.entryNumber),p_attempt_number:Number(b.attemptNumber),p_seconds:Number(b.seconds)});
      }else if(b.action==='clearAttempt'){
        d=await rpc(env,'clear_slip_slide_attempt',{p_event_key:key,p_entry_number:Number(b.entryNumber),p_attempt_number:Number(b.attemptNumber)});
      }else if(b.action==='configureKids'){
        if(key!=='kids-slip-and-slide-relay')return json({error:'Team combinations are only configurable for Kids Slip-and-Slide.'},400);
        try{
          d=await rpc(env,'configure_kids_slip_slide',{p_teams:Array.isArray(b.teams)?b.teams:[],p_force_reset:Boolean(b.forceReset)});
        }catch(e){
          if(String(e.message||'').includes('Confirm the reset first'))return json({error:e.message,needsResetConfirmation:true},409);
          throw e;
        }
      }else return json({error:'Unknown action.'},400);
      return json(d||{ok:true});
    }catch(e){return json({error:e.message||'Slip-and-Slide request failed.'},502)}
  }
};
