create table if not exists public.mvp_event_rules (
  event_id uuid primary key references public.olympic_events(id) on delete cascade,
  event_key text not null unique,
  scoring_mode text not null check (scoring_mode in ('pair_score','manual','two_stage_makes','speed_grab','individual_score','team_finish','pair_finish','cornhole')),
  metrics jsonb not null default '[]'::jsonb check (jsonb_typeof(metrics) = 'array'),
  kids_multiplier numeric(5,2) not null default 1 check (kids_multiplier > 0 and kids_multiplier <= 1),
  placement_bonuses jsonb not null default '{}'::jsonb check (jsonb_typeof(placement_bonuses) = 'object'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_event_stats (
  event_id uuid not null references public.olympic_events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object'),
  editor_team text check (editor_team is null or editor_team in ('Team Red','Team Blue','Team Green','Team Gold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, participant_id)
);

create index if not exists player_event_stats_participant_idx on public.player_event_stats(participant_id);
create index if not exists player_event_stats_event_idx on public.player_event_stats(event_id);

alter table public.mvp_event_rules enable row level security;
alter table public.player_event_stats enable row level security;

revoke all on table public.mvp_event_rules from public, anon, authenticated;
revoke all on table public.player_event_stats from public, anon, authenticated;
grant select, insert, update, delete on table public.mvp_event_rules to service_role;
grant select, insert, update, delete on table public.player_event_stats to service_role;

insert into public.mvp_event_rules (event_id,event_key,scoring_mode,metrics,kids_multiplier,placement_bonuses,notes)
select id,event_key,
  case event_key
    when 'kahoot' then 'pair_score'
    when 'kids-soccer' then 'manual'
    when 'adult-soccer' then 'manual'
    when 'junior-basketball' then 'manual'
    when 'women-s-three-point-contest' then 'two_stage_makes'
    when 'men-s-three-point-contest' then 'two_stage_makes'
    when 'speed-grab' then 'speed_grab'
    when 'nuke-em' then 'manual'
    when 'speed-volleyball-volleyball' then 'manual'
    when 'water-tasting' then 'individual_score'
    when 'fill-the-water-bottle' then 'team_finish'
    when 'protect-the-balloon-baby' then 'manual'
    when 'kids-dodgeball' then 'manual'
    when 'women-s-dodgeball' then 'manual'
    when 'men-s-dodgeball' then 'manual'
    when 'egg-toss' then 'pair_finish'
    when 'kids-slip-and-slide-relay' then 'team_finish'
    when 'adult-slip-and-slide-relay' then 'team_finish'
    when 'wiffle-ball' then 'manual'
    when 'cornhole-tournament' then 'cornhole'
  end,
  case event_key
    when 'kids-soccer' then '[{"key":"goals","label":"Goals","weight":3},{"key":"assists","label":"Assists","weight":2},{"key":"saves","label":"Saves","weight":2}]'::jsonb
    when 'adult-soccer' then '[{"key":"goals","label":"Goals","weight":3},{"key":"assists","label":"Assists","weight":2},{"key":"saves","label":"Saves","weight":2}]'::jsonb
    when 'junior-basketball' then '[{"key":"points","label":"Points","weight":1},{"key":"rebounds","label":"Rebounds","weight":1},{"key":"assists","label":"Assists","weight":2}]'::jsonb
    when 'nuke-em' then '[{"key":"eliminations","label":"Eliminations","weight":2},{"key":"catches","label":"Catches","weight":2}]'::jsonb
    when 'speed-volleyball-volleyball' then '[{"key":"kills","label":"Kills","weight":2},{"key":"aces","label":"Aces","weight":2},{"key":"blocks","label":"Blocks","weight":2}]'::jsonb
    when 'protect-the-balloon-baby' then '[{"key":"balloon_breaks","label":"Balloon Breaks","weight":2}]'::jsonb
    when 'kids-dodgeball' then '[{"key":"eliminations","label":"Eliminations","weight":2},{"key":"catches","label":"Catches","weight":2}]'::jsonb
    when 'women-s-dodgeball' then '[{"key":"eliminations","label":"Eliminations","weight":2},{"key":"catches","label":"Catches","weight":2}]'::jsonb
    when 'men-s-dodgeball' then '[{"key":"eliminations","label":"Eliminations","weight":2},{"key":"catches","label":"Catches","weight":2}]'::jsonb
    when 'wiffle-ball' then '[{"key":"hits","label":"Hits","weight":1},{"key":"rbis","label":"RBIs","weight":2},{"key":"home_runs","label":"Home Runs","weight":3}]'::jsonb
    when 'speed-grab' then '[{"key":"match_wins","label":"Match Wins","weight":2}]'::jsonb
    when 'cornhole-tournament' then '[{"key":"match_wins","label":"Match Wins","weight":2,"cap":4}]'::jsonb
    else '[]'::jsonb
  end,
  case when event_key in ('kids-soccer','junior-basketball','kids-dodgeball','kids-slip-and-slide-relay') then 0.5 else 1 end,
  case event_key
    when 'speed-grab' then '{"1":4,"2":3,"3":2}'::jsonb
    when 'cornhole-tournament' then '{"1":4,"2":3,"3":2}'::jsonb
    else '{}'::jsonb
  end,
  case event_key
    when 'kahoot' then 'Pair Kahoot raw score; both partners share the relative MVP result.'
    when 'fill-the-water-bottle' then 'Automatic team finish scoring.'
    when 'egg-toss' then 'Automatic pair finish scoring.'
    when 'kids-slip-and-slide-relay' then 'Automatic team finish scoring; kids MVP multiplier applies.'
    when 'adult-slip-and-slide-relay' then 'Automatic team finish scoring.'
    else null
  end
from public.olympic_events
where event_key in ('kahoot','kids-soccer','adult-soccer','junior-basketball','women-s-three-point-contest','men-s-three-point-contest','speed-grab','nuke-em','speed-volleyball-volleyball','water-tasting','fill-the-water-bottle','protect-the-balloon-baby','kids-dodgeball','women-s-dodgeball','men-s-dodgeball','egg-toss','kids-slip-and-slide-relay','adult-slip-and-slide-relay','wiffle-ball','cornhole-tournament')
on conflict (event_id) do update set
  event_key=excluded.event_key,
  scoring_mode=excluded.scoring_mode,
  metrics=excluded.metrics,
  kids_multiplier=excluded.kids_multiplier,
  placement_bonuses=excluded.placement_bonuses,
  notes=excluded.notes,
  updated_at=now();
