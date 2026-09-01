import app from './worker-fast-cornhole.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');

function legacyMatch(r){return{id:r.notion_page_id,lastEditedTime:r.updated_at,properties:{Match:r.match_code,'Match Number':r.match_number,Round:r.round_name||r.round_number,'Team A':r.team_a||'','Team B':r.team_b||'','Score A':r.score_a,'Score B':r.score_b,Winner:r.winner||'',Loser:r.loser||'',Status:r.status,'Winner To':r.winner_to||'','Loser To':r.loser_to||'','Sort Order':r.sort_order}}}

async function rpc(env,name,body={}){
  const base=cleanBase(env.SUPABASE_URL);if(!base||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase runtime settings are missing.');
  const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=await r.text();let d={};try{d=text?JSON.parse(text):{}}catch{d={}}
  if(!r.ok){const e=new Error(d?.message||d?.error||`Supabase ${r.status}`);e.status=r.status;e.data=d;throw e}return d;
}

async function requireCode(request,env){if(!env.ADMIN_SCORE_CODE)throw Object.assign(new Error('ADMIN_SCORE_CODE is missing.'),{status:503});let b={};try{b=await request.json()}catch{throw Object.assign(new Error('Invalid request.'),{status:400})}if(String(b.code||'')!==String(env.ADMIN_SCORE_CODE))throw Object.assign(new Error('Incorrect control code.'),{status:401});return b}

async function saveScore(request,env){
  try{
    const b=await requireCode(request,env),matchId=String(b.matchId||''),a=Number(b.scoreA),bb=Number(b.scoreB),allowWinnerChange=Boolean(b.allowWinnerChange);
    if(!matchId||!Number.isFinite(a)||!Number.isFinite(bb)||a<0||bb<0||a===bb)return json({error:'Enter both teams and a non-tied score.'},400);
    const d=await rpc(env,'save_wiffle_ball_score',{p_match_notion_id:matchId,p_score_a:a,p_score_b:bb,p_allow_winner_change:allowWinnerChange});
    return json({ok:true,winner:d.winner||'',loser:d.loser||'',winnerChanged:Boolean(d.winnerChanged),resetCount:Number(d.resetCount||0),matches:(d.matches||[]).map(legacyMatch),source:'supabase-fast'});
  }catch(e){
    const message=e.message||String(e),needsWinnerChangeConfirmation=message.includes('Confirm the reset first');
    return json({error:message,needsWinnerChangeConfirmation},needsWinnerChangeConfirmation?409:(e.status||502));
  }
}

async function seed(request,env){
  try{
    const b=await requireCode(request,env),base=cleanBase(env.SUPABASE_URL);
    const check=await fetch(`${base}/rest/v1/wiffle_ball_matches?select=match_code,status&status=eq.Complete`,{headers:{apikey:env.SUPABASE_SECRET_KEY}}),completed=check.ok?await check.json():[];
    if(completed.length&&!b.forceReset)return json({error:'Wiffle Ball already has completed games. Random seeding will reset the bracket.',needsResetConfirmation:true},409);
    const d=await rpc(env,'seed_wiffle_ball',{});
    return json({ok:true,seeds:d.seeds||[],matches:(d.matches||[]).map(legacyMatch),source:'supabase-fast'});
  }catch(e){return json({error:e.message||String(e)},e.status||502)}
}

export default{async fetch(request,env,ctx){const path=new URL(request.url).pathname;if(path==='/api/wiffle-ball'&&request.method==='POST')return saveScore(request,env);if(path==='/api/wiffle-ball/seed'&&request.method==='POST')return seed(request,env);return app.fetch(request,env,ctx)}};
