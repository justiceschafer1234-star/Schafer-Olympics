-- Run this once in the Supabase SQL editor.
-- Safe to run more than once.
-- Adds Olympic team assignments, readable keys, and event-specific pairs.

alter table public.participants
  add column if not exists team text;

alter table public.participants
  add column if not exists participant_key text;

alter table public.olympic_events
  add column if not exists event_key text;

alter table public.participants
  drop constraint if exists participants_team_check;

alter table public.participants
  add constraint participants_team_check
  check (team is null or team in ('Team Red','Team Blue','Team Green','Team Gold'));

-- Fill readable participant keys such as justice-schafer.
-- Duplicate names get -2, -3, etc. so keys stay unique.
with bases as (
  select
    id,
    coalesce(nullif(trim(both '-' from regexp_replace(lower(participant), '[^a-z0-9]+', '-', 'g')), ''), 'participant-' || left(id::text, 8)) as base_key
  from public.participants
  where participant_key is null or participant_key = ''
), numbered as (
  select id, base_key, row_number() over (partition by base_key order by id) as rn
  from bases
)
update public.participants p
set participant_key = n.base_key || case when n.rn = 1 then '' else '-' || n.rn::text end
from numbered n
where p.id = n.id;

-- Fill readable event keys such as cornhole or egg-toss.
-- Duplicate event names use the event number when available.
with bases as (
  select
    id,
    event_number,
    coalesce(nullif(trim(both '-' from regexp_replace(lower(event), '[^a-z0-9]+', '-', 'g')), ''), 'event-' || left(id::text, 8)) as base_key
  from public.olympic_events
  where event_key is null or event_key = ''
), numbered as (
  select id, event_number, base_key, row_number() over (partition by base_key order by event_number nulls last, id) as rn
  from bases
)
update public.olympic_events e
set event_key = n.base_key || case when n.rn = 1 then '' else '-' || coalesce(n.event_number::text, n.rn::text) end
from numbered n
where e.id = n.id;

create unique index if not exists participants_key_idx
  on public.participants(participant_key)
  where participant_key is not null;

create unique index if not exists olympic_events_key_idx
  on public.olympic_events(event_key)
  where event_key is not null;

create index if not exists participants_team_idx
  on public.participants(team);

create table if not exists public.event_pairs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.olympic_events(id) on delete cascade,
  pair_number integer not null,
  olympic_team text not null,
  participant_1_id uuid not null references public.participants(id) on delete cascade,
  participant_2_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_pairs_pair_number_check check (pair_number > 0),
  constraint event_pairs_team_check check (olympic_team in ('Team Red','Team Blue','Team Green','Team Gold')),
  constraint event_pairs_distinct_people_check check (participant_1_id <> participant_2_id),
  unique (event_id, pair_number)
);

create index if not exists event_pairs_event_idx on public.event_pairs(event_id);
create index if not exists event_pairs_team_idx on public.event_pairs(event_id, olympic_team);

-- Keep event pair data backend-only, like the other Supabase tables.
alter table public.event_pairs enable row level security;

-- Use the existing updated_at helper from schema.sql when available.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    execute 'drop trigger if exists set_event_pairs_updated_at on public.event_pairs';
    execute 'create trigger set_event_pairs_updated_at before update on public.event_pairs for each row execute function public.set_updated_at()';
  end if;
end $$;
