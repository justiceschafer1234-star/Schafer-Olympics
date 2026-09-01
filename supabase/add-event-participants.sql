-- Shared event participation model.
-- Safe to run more than once.

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.olympic_events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  olympic_team text,
  registered boolean not null default true,
  event_team_number integer,
  seed integer,
  role text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_participants_team_check check (olympic_team is null or olympic_team in ('Team Red','Team Blue','Team Green','Team Gold')),
  constraint event_participants_team_number_check check (event_team_number is null or event_team_number > 0),
  constraint event_participants_seed_check check (seed is null or seed > 0),
  unique (event_id, participant_id)
);

create index if not exists event_participants_event_idx on public.event_participants(event_id);
create index if not exists event_participants_participant_idx on public.event_participants(participant_id);
create index if not exists event_participants_event_team_idx on public.event_participants(event_id, olympic_team);
create index if not exists event_participants_event_team_number_idx on public.event_participants(event_id, event_team_number);
create index if not exists event_participants_event_seed_idx on public.event_participants(event_id, seed) where seed is not null;

alter table public.event_participants enable row level security;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='set_updated_at'
  ) then
    execute 'drop trigger if exists set_event_participants_updated_at on public.event_participants';
    execute 'create trigger set_event_participants_updated_at before update on public.event_participants for each row execute function public.set_updated_at()';
  end if;
end $$;

-- Backfill all current registrations.
insert into public.event_participants(event_id,participant_id,olympic_team,registered)
select r.event_id,r.participant_id,p.team,true
from public.registrations r
join public.participants p on p.id=r.participant_id
on conflict (event_id,participant_id) do update set
  registered=true,
  olympic_team=excluded.olympic_team,
  updated_at=now();

-- Backfill event team/pair membership for participant 1.
insert into public.event_participants(event_id,participant_id,olympic_team,registered,event_team_number,seed)
select ep.event_id,ep.participant_1_id,ep.olympic_team,true,ep.pair_number,ep.seed
from public.event_pairs ep
on conflict (event_id,participant_id) do update set
  olympic_team=excluded.olympic_team,
  registered=true,
  event_team_number=excluded.event_team_number,
  seed=excluded.seed,
  updated_at=now();

-- Backfill event team/pair membership for participant 2.
insert into public.event_participants(event_id,participant_id,olympic_team,registered,event_team_number,seed)
select ep.event_id,ep.participant_2_id,ep.olympic_team,true,ep.pair_number,ep.seed
from public.event_pairs ep
on conflict (event_id,participant_id) do update set
  olympic_team=excluded.olympic_team,
  registered=true,
  event_team_number=excluded.event_team_number,
  seed=excluded.seed,
  updated_at=now();

create or replace view public.event_participant_details as
select
  ep.id,ep.event_id,e.event,e.event_key,e.event_number,
  ep.participant_id,p.participant,p.participant_key,
  ep.olympic_team,ep.registered,ep.event_team_number,ep.seed,ep.role,ep.notes,
  ep.created_at,ep.updated_at
from public.event_participants ep
join public.olympic_events e on e.id=ep.event_id
join public.participants p on p.id=ep.participant_id;
