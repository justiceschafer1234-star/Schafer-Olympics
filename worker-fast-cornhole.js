import app from './worker-event-rosters.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cleanBase=url=>String(url||'').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
const rt=s=>({rich_text:s?[{type:'text',text:{content:String(s)}}]:[]});

function legacyMatch(r){
  return {
    id:r.notion_page_id,
    lastEditedTime:r.updated_at,
    properties:{
      Match:r.match_code,
      'Match Number':r.match_number,
      Round:r.round_number,
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
      Bracket:r.bracket,
      'Team A Players':r.team_a_players||'',
      'Team B Players':r.team_b_players||''
    }
  };
}

async function notionPatchMatch(row,env){
  if(!env.NOTION_API_TOKEN||!row?.notion_page_id||String(row.notion_page_id).startsWith('supabase-'))return;
  const properties={
    'Team A':rt(row.team_a||''),
    'Team B':rt(row.team_b||''),
    'Team A Players':rt(row.team_a_players||''),
    'Team B Players':rt(row.team_b_players||''),
    'Score A':{number:row.score_a==null?null:Number(row.score_a)},
    'Score B':{number:row.score_b==null?null:Number(row.score_b)},
    Winner:rt(row.winner||''),
    Loser:rt(row.loser||''),
    Status:{select:{name:row.status}}
  };
  const r=await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(row.notion_page_id)}`,{
    method:'PATCH',
    headers:{Authorization:`Bearer ${env.NOTION_API_TOKEN}`,'Notion-Version':'2026-03-11','Content-Type':'application/json'},
    body:JSON.stringify({properties})
  });
  if(!r.ok)throw new Error(`Notion backup ${r.status}`);
}

async function fastCornholeScore(request,env,ctx){
  if(!env.ADMIN_SCORE_CODE)return json({error:'ADMIN_SCORE_CODE is missing.'},503);
  let b={};try{b=await request.json()}catch{return json({error:'Invalid request.'},400)}
  if(String(b.code||'')!==String(env.ADMIN_SCORE_CODE))return json({error:'Incorrect control code.'},401);
  const matchId=String(b.matchId||'');
  const scoreA=Number(b.scoreA),scoreB=Number(b.scoreB);
  const allowWinnerChange=Boolean(b.allowWinnerChange);
  if(!matchId||!Number.isFinite(scoreA)||!Number.isFinite(scoreB)||scoreA<0||scoreB<0||scoreA===scoreB)return json({error:'Enter both teams and a non-tied score.'},400);
  try{
    const base=cleanBase(env.SUPABASE_URL);
    const r=await fetch(`${base}/rest/v1/rpc/save_cornhole_score`,{
      method:'POST',
      headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_match_notion_id:matchId,p_score_a:scoreA,p_score_b:scoreB,p_allow_winner_change:allowWinnerChange})
    });
    const text=await r.text();let d={};try{d=text?JSON.parse(text):{}}catch{d={}}
    if(!r.ok)return json({error:d?.message||d?.error||`Supabase ${r.status}`,needsWinnerChangeConfirmation:String(d?.message||'').includes('Confirm the reset first')},r.status>=400&&r.status<500?r.status:502);
    const raw=Array.isArray(d.matches)?d.matches:[];
    if(ctx?.waitUntil&&env.NOTION_API_TOKEN){
      const scored=raw.find(x=>x.notion_page_id===matchId);
      let changed;
      if(d.winnerChanged){
        changed=raw;
      }else{
        const codes=new Set([scored?.match_code,scored?.winner_to,scored?.loser_to,'GF2']);
        changed=raw.filter(x=>codes.has(x.match_code));
      }
      ctx.waitUntil(Promise.allSettled(changed.map(x=>notionPatchMatch(x,env))));
    }
    return json({ok:true,winner:d.winner||'',loser:d.loser||'',winnerChanged:Boolean(d.winnerChanged),resetCount:Number(d.resetCount||0),matches:raw.map(legacyMatch),source:'supabase-fast'});
  }catch(e){return json({error:String(e?.message||e)},502)}
}

export default{async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(path==='/api/cornhole'&&request.method==='POST')return fastCornholeScore(request,env,ctx);
  return app.fetch(request,env,ctx);
}};
