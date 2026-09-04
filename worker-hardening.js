import app from './worker-nfc.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const base=e=>String(e.SUPABASE_URL||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const num=v=>Number.isFinite(Number(v))?Number(v):0;

async function sb(env,path){
  const url=base(env);
  if(!url||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime secrets are missing.');
  const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'}});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||`Supabase ${r.status}`));
  return data;
}

function matchLegacy(r,cornhole=false){
  const p={
    Match:r.match_code,
    'Match Number':r.match_number,
    Round:cornhole?r.round_number:r.round_name,
    'Team A':r.team_a||'',
    'Team B':r.team_b||'',
    'Score A':r.score_a,
    'Score B':r.score_b,
    Winner:r.winner||'',
    Loser:r.loser||'',
    Status:r.status,
    'Winner To':r.winner_to||'',
    'Loser To':r.loser_to||'',
    'Sort Order':r.sort_order,
  };
  if(cornhole){p.Bracket=r.bracket;p['Team A Players']=r.team_a_players||'';p['Team B Players']=r.team_b_players||''}
  return{id:r.notion_page_id,lastEditedTime:r.updated_at,properties:p};
}

function fourOutcome(row){return row?.status==='Complete'?{winner:row.winner||'',loser:row.loser||''}:{winner:'',loser:''}}
function fourMedals(rows){
  const f=fourOutcome(rows.find(r=>r.match_code==='F'));
  const b=fourOutcome(rows.find(r=>r.match_code==='B'));
  return{done:Boolean(f.winner&&f.loser&&b.winner),gold:f.winner||null,silver:f.loser||null,bronze:b.winner||null,bronze2:b.loser||null};
}

async function readOnlyFour(env,table){
  const rows=await sb(env,`${table}?select=*&order=sort_order.asc`);
  return json({matches:rows.map(r=>matchLegacy(r)),medals:fourMedals(rows),updatedAt:new Date().toISOString(),source:'supabase-readonly'});
}

async function readOnlyCornhole(env){
  const rows=await sb(env,'cornhole_matches?select=*&order=sort_order.asc');
  return json({matches:rows.map(r=>matchLegacy(r,true)),updatedAt:new Date().toISOString(),source:'supabase-readonly'});
}

async function bodyOf(request){try{return await request.clone().json()}catch{return{}}}
function validCode(body,env){return Boolean(env.ADMIN_SCORE_CODE)&&String(body?.code||'')===String(env.ADMIN_SCORE_CODE)}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname;
    try{
      // Public bracket loads are strictly read-only. All bracket reconciliation now happens on writes/seeding.
      if(request.method==='GET'&&path==='/api/adult-soccer')return readOnlyFour(env,'adult_soccer_matches');
      if(request.method==='GET'&&path==='/api/wiffle-ball')return readOnlyFour(env,'wiffle_ball_matches');
      if(request.method==='GET'&&path==='/api/cornhole')return readOnlyCornhole(env);

      // Adult Soccer used to rely on UI-only protection. Enforce the same control code as every other score writer.
      if(request.method==='POST'&&path==='/api/adult-soccer'){
        const body=await bodyOf(request);
        if(!env.ADMIN_SCORE_CODE)return json({error:'ADMIN_SCORE_CODE is missing.'},503);
        if(!validCode(body,env))return json({error:'Incorrect control code.'},401);
        return app.fetch(request,env,ctx);
      }

      // Final Olympic teams are locked. Event-pair setup and tournament seeding remain available.
      if(request.method==='POST'&&path==='/api/admin/teams'){
        const body=await bodyOf(request);
        if(body.action==='save')return json({error:'Olympic team assignments are locked for Game Day.'},423);
      }

      // Registration is closed, while GET remains available to private dashboards/setup tools.
      if(request.method==='POST'&&path==='/api/registration')return json({error:'Registration is closed for Game Day.'},403);

      return app.fetch(request,env,ctx);
    }catch(e){return json({error:String(e?.message||e)},502)}
  }
};
