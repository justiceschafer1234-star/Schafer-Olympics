-- Schafer Olympics Supabase schema
-- Supabase is the primary live database; Notion remains the backup/mirror.

create extension if not exists pgcrypto;

create table if not exists public.olympic_events (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  event text not null,
  event_number integer,
  division text,
  divisions text[] not null default '{}',
  format text,
  number_of_teams integer,
  points numeric,
  scheduled_time timestamptz,
  status text not null default 'Not Started',
  notes text,
  minutes text,
  gold_points numeric not null default 0,
  gold_teams text[] not null default '{}',
  silver_points numeric not null default 0,
  silver_teams text[] not null default '{}',
  bronze_1_points numeric not null default 0,
  bronze_1_teams text[] not null default '{}',
  bronze_2_points numeric not null default 0,
  bronze_2_teams text[] not null default '{}',
  legacy_bronze_points numeric not null default 0,
  legacy_bronze_teams text[] not null default '{}',
  notion_last_edited_time timestamptz,
  notion_raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint olympic_events_status_check check (status in ('Not Started','In Progress','Delayed','Complete'))
);

create unique index if not exists olympic_events_event_number_idx on public.olympic_events(event_number) where event_number is not null;
create index if not exists olympic_events_status_idx on public.olympic_events(status);
create index if not exists olympic_events_scheduled_time_idx on public.olympic_events(scheduled_time);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  participant text not null,
  divisions text[] not null default '{}',
  notion_last_edited_time timestamptz,
  notion_raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_name_idx on public.participants(participant);

create table if not exists public.registrations (
  participant_id uuid not null references public.participants(id) on delete cascade,
  event_id uuid not null references public.olympic_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (participant_id, event_id)
);

create table if not exists public.cornhole_matches (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  match_code text not null unique,
  bracket text,
  round_number integer,
  match_number integer,
  team_a text,
  team_a_players text,
  team_b text,
  team_b_players text,
  score_a numeric,
  score_b numeric,
  winner text,
  loser text,
  status text not null default 'Waiting',
  winner_to text,
  loser_to text,
  sort_order integer,
  notion_last_edited_time timestamptz,
  notion_raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cornhole_status_check check (status in ('Waiting','Ready','Complete'))
);

create index if not exists cornhole_sort_idx on public.cornhole_matches(sort_order);

create table if not exists public.adult_soccer_matches (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  match_code text not null unique,
  match_number integer,
  round_name text,
  team_a text,
  team_b text,
  score_a numeric,
  score_b numeric,
  winner text,
  loser text,
  status text not null default 'Waiting',
  winner_to text,
  loser_to text,
  sort_order integer,
  notion_last_edited_time timestamptz,
  notion_raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adult_soccer_status_check check (status in ('Waiting','Ready','Complete'))
);

create index if not exists adult_soccer_sort_idx on public.adult_soccer_matches(sort_order);

create table if not exists public.wiffle_ball_matches (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  match_code text not null unique,
  match_number integer,
  round_name text,
  team_a text,
  team_b text,
  score_a numeric,
  score_b numeric,
  winner text,
  loser text,
  status text not null default 'Waiting',
  winner_to text,
  loser_to text,
  sort_order integer,
  notion_last_edited_time timestamptz,
  notion_raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiffle_ball_status_check check (status in ('Waiting','Ready','Complete'))
);

create index if not exists wiffle_ball_sort_idx on public.wiffle_ball_matches(sort_order);

-- Small audit table so a failed Notion backup never blocks the primary score save.
create table if not exists public.notion_backup_queue (
  id bigint generated by default as identity primary key,
  entity_type text not null,
  entity_id text not null,
  operation text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint notion_backup_queue_status_check check (status in ('pending','processing','complete','failed'))
);

create index if not exists notion_backup_queue_pending_idx on public.notion_backup_queue(status, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_olympic_events_updated_at on public.olympic_events;
create trigger set_olympic_events_updated_at before update on public.olympic_events for each row execute function public.set_updated_at();
drop trigger if exists set_participants_updated_at on public.participants;
create trigger set_participants_updated_at before update on public.participants for each row execute function public.set_updated_at();
drop trigger if exists set_cornhole_matches_updated_at on public.cornhole_matches;
create trigger set_cornhole_matches_updated_at before update on public.cornhole_matches for each row execute function public.set_updated_at();
drop trigger if exists set_adult_soccer_matches_updated_at on public.adult_soccer_matches;
create trigger set_adult_soccer_matches_updated_at before update on public.adult_soccer_matches for each row execute function public.set_updated_at();
drop trigger if exists set_wiffle_ball_matches_updated_at on public.wiffle_ball_matches;
create trigger set_wiffle_ball_matches_updated_at before update on public.wiffle_ball_matches for each row execute function public.set_updated_at();

-- Keep all tables backend-only. The Cloudflare Worker uses SUPABASE_SECRET_KEY.
alter table public.olympic_events enable row level security;
alter table public.participants enable row level security;
alter table public.registrations enable row level security;
alter table public.cornhole_matches enable row level security;
alter table public.adult_soccer_matches enable row level security;
alter table public.wiffle_ball_matches enable row level security;
alter table public.notion_backup_queue enable row level security;

-- Live standings calculated inside Postgres, so the site does not have to download
-- every event just to total the scoreboard.
create or replace view public.team_standings as
with teams(team) as (
  values ('Team Red'), ('Team Blue'), ('Team Green'), ('Team Gold')
), points as (
  select unnest(gold_teams) as team, gold_points as points from public.olympic_events
  union all
  select unnest(silver_teams), silver_points from public.olympic_events
  union all
  select unnest(bronze_1_teams), bronze_1_points from public.olympic_events
  union all
  select unnest(bronze_2_teams), bronze_2_points from public.olympic_events
)
select t.team, coalesce(sum(p.points),0)::numeric as points
from teams t
left join points p on p.team = t.team
group by t.team;

create or replace view public.medal_counts as
with teams(team) as (
  values ('Team Red'), ('Team Blue'), ('Team Green'), ('Team Gold')
)
select
  t.team,
  (select count(*) from public.olympic_events e where t.team = any(e.gold_teams))::integer as gold,
  (select count(*) from public.olympic_events e where t.team = any(e.silver_teams))::integer as silver,
  ((select count(*) from public.olympic_events e where t.team = any(e.bronze_1_teams)) +
   (select count(*) from public.olympic_events e where t.team = any(e.bronze_2_teams)))::integer as bronze
from teams t;
