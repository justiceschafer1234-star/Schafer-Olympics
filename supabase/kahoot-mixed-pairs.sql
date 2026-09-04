-- Kahoot mixed-team pair scoring.
-- Same-team pairs receive the full placement value for their Olympic team.
-- Cross-team pairs split each placement value 50/50 between the two Olympic teams.

create or replace function public.refresh_kahoot_event_result()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event public.olympic_events%rowtype;
  v_state jsonb := '{}'::jsonb;
  v_total integer := 0;
  v_scored integer := 0;
  v_complete boolean := false;
  v_status text := 'Not Started';
  v_gold text[] := array[]::text[];
  v_silver text[] := array[]::text[];
  v_bronze text[] := array[]::text[];
  v_copper text[] := array[]::text[];
  v_points jsonb := '{}'::jsonb;
begin
  select * into v_event
  from public.olympic_events
  where event_key='kahoot'
  limit 1;

  if v_event.id is null then
    return jsonb_build_object('ok',false,'error','Kahoot event not found.');
  end if;

  select coalesce(c.state,'{}'::jsonb)
  into v_state
  from public.event_scorecards c
  where c.event_id=v_event.id
  limit 1;
  v_state := coalesce(v_state,'{}'::jsonb);

  select count(*) into v_total
  from jsonb_array_elements(coalesce(v_state->'entries','[]'::jsonb)) e;

  select count(*) into v_scored
  from jsonb_array_elements(coalesce(v_state->'entries','[]'::jsonb)) e
  where coalesce(e->>'score','') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$';

  v_complete := coalesce((v_state->>'complete')::boolean,false)
                and v_total>0
                and v_scored=v_total;

  if v_complete then
    v_status := 'Complete';

    with scored as (
      select (e->>'id')::uuid as pair_id,
             (e->>'score')::numeric as score
      from jsonb_array_elements(coalesce(v_state->'entries','[]'::jsonb)) e
      where coalesce(e->>'id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and coalesce(e->>'score','') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$'
    ), ranked as (
      select pair_id,score,rank() over(order by score desc)::integer as place
      from scored
    )
    select
      coalesce(array_agg(distinct t.team order by t.team) filter (where ranked.place=1),array[]::text[]),
      coalesce(array_agg(distinct t.team order by t.team) filter (where ranked.place=2),array[]::text[]),
      coalesce(array_agg(distinct t.team order by t.team) filter (where ranked.place=3),array[]::text[]),
      coalesce(array_agg(distinct t.team order by t.team) filter (where ranked.place=4),array[]::text[])
    into v_gold,v_silver,v_bronze,v_copper
    from ranked
    cross join lateral unnest(public.event_pair_teams(ranked.pair_id)) t(team);

    with scored as (
      select (e->>'id')::uuid as pair_id,
             (e->>'score')::numeric as score
      from jsonb_array_elements(coalesce(v_state->'entries','[]'::jsonb)) e
      where coalesce(e->>'id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and coalesce(e->>'score','') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$'
    ), ranked as (
      select pair_id,score,rank() over(order by score desc)::integer as place
      from scored
    ), placed as (
      select pair_id,
             case place
               when 1 then v_event.gold_points
               when 2 then v_event.silver_points
               when 3 then v_event.bronze_1_points
               when 4 then v_event.bronze_2_points
             end::numeric as pts
      from ranked
      where place between 1 and 4
    ), contrib as (
      select j.key as team,j.value::numeric as pts
      from placed p
      cross join lateral jsonb_each_text(public.event_pair_team_points(p.pair_id,p.pts)) j
    ), totals as (
      select team,sum(pts) as pts
      from contrib
      group by team
    )
    select coalesce(jsonb_object_agg(team,pts),'{}'::jsonb)
    into v_points
    from totals;
  elsif v_total>0 then
    v_status := 'In Progress';
  else
    v_status := 'Not Started';
  end if;

  update public.olympic_events
  set gold_teams=case when v_complete then v_gold else array[]::text[] end,
      silver_teams=case when v_complete then v_silver else array[]::text[] end,
      bronze_1_teams=case when v_complete then v_bronze else array[]::text[] end,
      bronze_2_teams=case when v_complete then v_copper else array[]::text[] end,
      legacy_bronze_teams=array[]::text[],
      team_point_overrides=case when v_complete then v_points else '{}'::jsonb end,
      status=v_status
  where id=v_event.id;

  return jsonb_build_object(
    'ok',true,
    'status',v_status,
    'complete',v_complete,
    'pairCount',v_total,
    'scoredPairs',v_scored,
    'goldTeams',v_gold,
    'silverTeams',v_silver,
    'bronzeTeams',v_bronze,
    'copperTeams',v_copper,
    'teamPointOverrides',v_points
  );
end;
$function$;

create or replace function public.sync_kahoot_scorecard_result()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event_id uuid := coalesce(new.event_id,old.event_id);
begin
  if exists(select 1 from public.olympic_events where id=v_event_id and event_key='kahoot') then
    perform public.refresh_kahoot_event_result();
  end if;
  return coalesce(new,old);
end;
$function$;

drop trigger if exists trg_sync_kahoot_scorecard_result on public.event_scorecards;
create trigger trg_sync_kahoot_scorecard_result
after insert or update or delete on public.event_scorecards
for each row execute function public.sync_kahoot_scorecard_result();

revoke all on function public.refresh_kahoot_event_result() from public,anon,authenticated;
revoke all on function public.sync_kahoot_scorecard_result() from public,anon,authenticated;
