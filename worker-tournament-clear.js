import app from './worker-fast-wiffle.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');

function legacyCornhole(r){return{id:r.notion_page_id,lastEditedTime:r.updated_at,properties:{Match:r.match_code,'Match Number':r.match_number,Round:r.round_number,'Team A':r.team_a||'','Team B':r.team_b||'','Score A':r.score_a,'Score B':r.score_b,Winner:r.winner||'',Loser:r.loser||'',Status:r.status,'Winner To':r.winner_to||'','Loser To':r.loser_to||'','Sort Order':r.sort_order,Bracket:r.bracket,'Team A Players':r.team_a_players||'','Team B Players':r.team_b_players||''}}}
function legacyWiffle(r){return{id:r.notion_page_id,lastEditedTime:r.updated_at,properties:{Match:r.match_code,'Match Number':r.match_number,Round:r.round_name||r.round_number,'Team A':r.team_a||'','Team B':r.team_b||'','Score A':r.score_a,'Score B':r.score_b,Winner:r.winner||'',Loser:r.loser||'',Status:r.status,'Winner To':r.winner_to||'','Loser To':r.loser_to||'','Sort Order':r.sort_order}}}

async function rpc(env,name,body){
  const base=cleanBase(env.SUPABASE_URL);if(!base||!env.SUPABASE_SECRET_KEY)throw Object.assign(new Error('Supabase runtime settings are missing.'),{status:503});
  const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=await r.text();let d={};try{d=text?JSON.parse(text):{}}catch{d={}}
  if(!r.ok){const e=new Error(d?.message||d?.error||`Supabase ${r.status}`);e.status=r.status;e.data=d;throw e}return d;
}

async function clearTournament(request,env,path){
  if(!env.ADMIN_SCORE_CODE)return json({error:'ADMIN_SCORE_CODE is missing.'},503);
  let b={};try{b=await request.json()}catch{return json({error:'Invalid request.'},400)}
  if(String(b.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);
  const matchId=String(b.matchId||'');if(!matchId)return json({error:'Match is required.'},400);
  const allow=Boolean(b.allowDownstreamReset);
  const isCornhole=path==='/api/cornhole';
  try{
    const d=await rpc(env,isCornhole?'clear_cornhole_score':'clear_wiffle_ball_score',{p_match_notion_id:matchId,p_allow_downstream_reset:allow});
    const raw=Array.isArray(d.matches)?d.matches:[];
    return json({ok:true,cleared:d.cleared||'',resetCount:Number(d.resetCount||0),matches:raw.map(isCornhole?legacyCornhole:legacyWiffle),source:'supabase-fast-clear'});
  }catch(e){
    const message=e.message||String(e),needsResetConfirmation=message.includes('Confirm the reset first');
    return json({error:message,needsResetConfirmation},needsResetConfirmation?409:(e.status||502));
  }
}

export default{async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(request.method==='POST'&&(path==='/api/cornhole'||path==='/api/wiffle-ball')){
    let b={};try{b=await request.clone().json()}catch{}
    if(b?.action==='clear')return clearTournament(request,env,path);
  }
  return app.fetch(request,env,ctx);
}};
