const NOTION_VERSION='2026-03-11';
const EVENTS_ID='1bffd4df-3de3-4e8e-9c13-cbcb1e30e226';
const PARTICIPANTS_ID='cb8b3ac0-2a7e-42cc-ba24-a6de0121ffd5';
const CORNHOLE_ID='1894a90f-2b0c-440f-90de-7274384e379c';
const SOCCER_ID='54dcc252-293d-40c6-9077-e4d6d7b4c610';
const WIFFLE_ID='2cac86a1-f1ac-4362-af7c-f2be5ae12615';

const plainText=(p=[])=>p.map(x=>x?.plain_text??x?.text?.content??'').join('');
function norm(p){
  if(!p)return null;
  switch(p.type){
    case'title':return plainText(p.title);
    case'rich_text':return plainText(p.rich_text);
    case'number':return p.number;
    case'select':return p.select?.name??null;
    case'status':return p.status?.name??null;
    case'checkbox':return p.checkbox;
    case'date':return p.date?.start??null;
    case'formula':return p.formula?.[p.formula.type]??null;
    case'multi_select':return p.multi_select?.map(x=>x.name)??[];
    case'relation':return p.relation?.map(x=>x.id)??[];
    default:return null;
  }
}
function page(x){
  const properties={};
  for(const[n,p]of Object.entries(x.properties||{}))properties[n]=norm(p);
  return{id:x.id,lastEditedTime:x.last_edited_time,properties,raw:x};
}
const arr=v=>Array.isArray(v)?v:v?[v]:[];
const n=v=>Number.isFinite(Number(v))?Number(v):null;

async function notionQueryAll(env,id){
  const out=[];let cursor;
  do{
    const r=await fetch(`https://api.notion.com/v1/data_sources/${encodeURIComponent(id)}/query`,{
      method:'POST',headers:{Authorization:`Bearer ${env.NOTION_API_TOKEN}`,'Notion-Version':NOTION_VERSION,'Content-Type':'application/json'},
      body:JSON.stringify({page_size:100,...(cursor?{start_cursor:cursor}:{})})
    });
    const d=await r.json();
    if(!r.ok)throw new Error(d.message||`Notion ${r.status}`);
    out.push(...(d.results||[]));cursor=d.has_more?d.next_cursor:null;
  }while(cursor);
  return out.map(page);
}

function sbHeaders(env,extra={}){
  return {apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`,'Content-Type':'application/json',...extra};
}
async function sb(env,path,init={}){
  const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
  if(!base||!env.SUPABASE_SECRET_KEY)throw new Error('Supabase secrets are missing.');
  const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers:sbHeaders(env,init.headers||{})});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(`Supabase ${r.status}: ${typeof data==='string'?data:(data?.message||JSON.stringify(data))}`);
  return data;
}
async function upsert(env,table,rows,onConflict){
  if(!rows.length)return [];
  return sb(env,`${table}?on_conflict=${encodeURIComponent(onConflict)}`,{
    method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)
  });
}

function eventRow(x){
  const p=x.properties||{};
  return {
    notion_page_id:x.id,event:p.Event||'',event_number:n(p['Event #']),division:p.Division||null,divisions:arr(p['Division 2']),
    format:p.Format||null,number_of_teams:n(p['Number of teams']),points:n(p.Points),scheduled_time:p['Scheduled Time']||null,status:p.Status||'Not Started',
    notes:p.Notes||null,minutes:p.Mintues||null,gold_points:n(p['🥇 Gold Points'])??0,gold_teams:arr(p['🥇 Team']),
    silver_points:n(p['🥈 Silver Points'])??0,silver_teams:arr(p['🥈 Team']),bronze_1_points:n(p['Bronze 1 Points']??p['🥉 Bronze Points'])??0,
    bronze_1_teams:arr(p['Bronze 1 Team']).length?arr(p['Bronze 1 Team']):arr(p['🥉 Team']).slice(0,1),bronze_2_points:n(p['Bronze 2 Points'])??0,
    bronze_2_teams:arr(p['Bronze 2 Team']),legacy_bronze_points:n(p['🥉 Bronze Points'])??0,legacy_bronze_teams:arr(p['🥉 Team']),
    notion_last_edited_time:x.lastEditedTime||null,notion_raw:x.raw||{}
  };
}
function participantRow(x){const p=x.properties||{};return{notion_page_id:x.id,participant:p.Participant||'',divisions:arr(p.Division),notion_last_edited_time:x.lastEditedTime||null,notion_raw:x.raw||{}}}
function cornholeRow(x){const p=x.properties||{};return{notion_page_id:x.id,match_code:p.Match||'',bracket:p.Bracket||null,round_number:n(p.Round),match_number:n(p['Match Number']),team_a:p['Team A']||null,team_a_players:p['Team A Players']||null,team_b:p['Team B']||null,team_b_players:p['Team B Players']||null,score_a:n(p['Score A']),score_b:n(p['Score B']),winner:p.Winner||null,loser:p.Loser||null,status:p.Status||'Waiting',winner_to:p['Winner To']||null,loser_to:p['Loser To']||null,sort_order:n(p['Sort Order']),notion_last_edited_time:x.lastEditedTime||null,notion_raw:x.raw||{}}}
function fourRow(x){const p=x.properties||{};return{notion_page_id:x.id,match_code:p.Match||'',match_number:n(p['Match Number']),round_name:p.Round||null,team_a:p['Team A']||null,team_b:p['Team B']||null,score_a:n(p['Score A']),score_b:n(p['Score B']),winner:p.Winner||null,loser:p.Loser||null,status:p.Status||'Waiting',winner_to:p['Winner To']||null,loser_to:p['Loser To']||null,sort_order:n(p['Sort Order']),notion_last_edited_time:x.lastEditedTime||null,notion_raw:x.raw||{}}}

export async function migrateNotionToSupabase(env){
  if(!env.NOTION_API_TOKEN)throw new Error('NOTION_API_TOKEN is missing.');
  const [events,participants,cornhole,soccer,wiffle]=await Promise.all([
    notionQueryAll(env,EVENTS_ID),notionQueryAll(env,PARTICIPANTS_ID),notionQueryAll(env,CORNHOLE_ID),notionQueryAll(env,SOCCER_ID),notionQueryAll(env,WIFFLE_ID)
  ]);

  const eventInserted=await upsert(env,'olympic_events',events.map(eventRow),'notion_page_id');
  const participantInserted=await upsert(env,'participants',participants.map(participantRow),'notion_page_id');
  await Promise.all([
    upsert(env,'cornhole_matches',cornhole.map(cornholeRow),'notion_page_id'),
    upsert(env,'adult_soccer_matches',soccer.map(fourRow),'notion_page_id'),
    upsert(env,'wiffle_ball_matches',wiffle.map(fourRow),'notion_page_id')
  ]);

  // Rebuild registrations from Notion relations using the inserted UUIDs.
  const eventMap=new Map((eventInserted||[]).map(r=>[r.notion_page_id,r.id]));
  const participantMap=new Map((participantInserted||[]).map(r=>[r.notion_page_id,r.id]));
  const registrationRows=[];
  for(const p of participants){
    const participant_id=participantMap.get(p.id);if(!participant_id)continue;
    for(const notionEventId of arr(p.properties?.['Registered Events'])){
      const event_id=eventMap.get(notionEventId);if(event_id)registrationRows.push({participant_id,event_id});
    }
  }
  await sb(env,'registrations',{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});
  if(registrationRows.length)await upsert(env,'registrations',registrationRows,'participant_id,event_id');

  return {ok:true,counts:{events:events.length,participants:participants.length,registrations:registrationRows.length,cornhole:cornhole.length,adultSoccer:soccer.length,wiffleBall:wiffle.length}};
}
