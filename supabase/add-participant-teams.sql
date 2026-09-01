-- Run this in the Supabase SQL editor.
-- Safe to run more than once.
-- Adds Olympic team assignments, readable keys, event-specific pairs, manual seeds,
-- and the extra matches/routing needed for a 10-team Cornhole double-elimination bracket.

alter table public.participants add column if not exists team text;
alter table public.participants add column if not exists participant_key text;
alter table public.olympic_events add column if not exists event_key text;

alter table public.participants drop constraint if exists participants_team_check;
alter table public.participants add constraint participants_team_check
  check (team is null or team in ('Team Red','Team Blue','Team Green','Team Gold'));

with bases as (
  select id, coalesce(nullif(trim(both '-' from regexp_replace(lower(participant), '[^a-z0-9]+', '-', 'g')), ''), 'participant-' || left(id::text, 8)) as base_key
  from public.participants where participant_key is null or participant_key = ''
), numbered as (
  select id, base_key, row_number() over (partition by base_key order by id) as rn from bases
)
update public.participants p
set participant_key = n.base_key || case when n.rn = 1 then '' else '-' || n.rn::text end
from numbered n where p.id = n.id;

with bases as (
  select id, event_number, coalesce(nullif(trim(both '-' from regexp_replace(lower(event), '[^a-z0-9]+', '-', 'g')), ''), 'event-' || left(id::text, 8)) as base_key
  from public.olympic_events where event_key is null or event_key = ''
), numbered as (
  select id, event_number, base_key, row_number() over (partition by base_key order by event_number nulls last, id) as rn from bases
)
update public.olympic_events e
set event_key = n.base_key || case when n.rn = 1 then '' else '-' || coalesce(n.event_number::text, n.rn::text) end
from numbered n where e.id = n.id;

create unique index if not exists participants_key_idx on public.participants(participant_key) where participant_key is not null;
create unique index if not exists olympic_events_key_idx on public.olympic_events(event_key) where event_key is not null;
create index if not exists participants_team_idx on public.participants(team);

create table if not exists public.event_pairs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.olympic_events(id) on delete cascade,
  pair_number integer not null,
  olympic_team text not null,
  participant_1_id uuid not null references public.participants(id) on delete cascade,
  participant_2_id uuid not null references public.participants(id) on delete cascade,
  seed integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_pairs_pair_number_check check (pair_number > 0),
  constraint event_pairs_team_check check (olympic_team in ('Team Red','Team Blue','Team Green','Team Gold')),
  constraint event_pairs_distinct_people_check check (participant_1_id <> participant_2_id),
  unique (event_id, pair_number)
);

alter table public.event_pairs add column if not exists seed integer;
alter table public.event_pairs drop constraint if exists event_pairs_seed_check;
alter table public.event_pairs add constraint event_pairs_seed_check check (seed is null or seed between 1 and 10);
create unique index if not exists event_pairs_event_seed_idx on public.event_pairs(event_id, seed) where seed is not null;
create index if not exists event_pairs_event_idx on public.event_pairs(event_id);
create index if not exists event_pairs_team_idx on public.event_pairs(event_id, olympic_team);

alter table public.event_pairs enable row level security;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    execute 'drop trigger if exists set_event_pairs_updated_at on public.event_pairs';
    execute 'create trigger set_event_pairs_updated_at before update on public.event_pairs for each row execute function public.set_updated_at()';
  end if;
end $$;

-- 10-team Cornhole bracket.
-- P1/P2 are the opening play-in matches. L7/L8 extend the elimination side so
-- every one of the ten teams still receives two-loss double-elimination protection.
insert into public.cornhole_matches
  (notion_page_id,match_code,bracket,round_number,match_number,status,winner_to,loser_to,sort_order,notion_raw)
values
  ('supabase-cornhole-p1','P1','Winners',1,1,'Waiting','W1','L1',5,'{}'::jsonb),
  ('supabase-cornhole-p2','P2','Winners',1,2,'Waiting','W3','L2',6,'{}'::jsonb),
  ('supabase-cornhole-l7','L7','Losers',4,7,'Waiting','L8',null,75,'{}'::jsonb),
  ('supabase-cornhole-l8','L8','Losers',5,8,'Waiting','GF1',null,85,'{}'::jsonb)
on conflict (match_code) do nothing;

-- Winners side: 8/9 and 7/10 play in; top six seeds enter the eight-team main draw.
update public.cornhole_matches set bracket='Winners',round_number=2,winner_to='W5',loser_to='L3',sort_order=10 where match_code='W1';
update public.cornhole_matches set bracket='Winners',round_number=2,winner_to='W5',loser_to='L1',sort_order=11 where match_code='W2';
update public.cornhole_matches set bracket='Winners',round_number=2,winner_to='W6',loser_to='L4',sort_order=12 where match_code='W3';
update public.cornhole_matches set bracket='Winners',round_number=2,winner_to='W6',loser_to='L2',sort_order=13 where match_code='W4';
update public.cornhole_matches set bracket='Winners',round_number=3,winner_to='W7',loser_to='L6',sort_order=30 where match_code='W5';
update public.cornhole_matches set bracket='Winners',round_number=3,winner_to='W7',loser_to='L5',sort_order=31 where match_code='W6';
update public.cornhole_matches set bracket='Winners',round_number=4,winner_to='GF1',loser_to='L8',sort_order=60 where match_code='W7';

-- Losers side for ten teams.
update public.cornhole_matches set bracket='Losers',round_number=1,winner_to='L3',loser_to=null,sort_order=20 where match_code='L1';
update public.cornhole_matches set bracket='Losers',round_number=1,winner_to='L4',loser_to=null,sort_order=21 where match_code='L2';
update public.cornhole_matches set bracket='Losers',round_number=2,winner_to='L5',loser_to=null,sort_order=40 where match_code='L3';
update public.cornhole_matches set bracket='Losers',round_number=2,winner_to='L6',loser_to=null,sort_order=41 where match_code='L4';
update public.cornhole_matches set bracket='Losers',round_number=3,winner_to='L7',loser_to=null,sort_order=50 where match_code='L5';
update public.cornhole_matches set bracket='Losers',round_number=3,winner_to='L7',loser_to=null,sort_order=51 where match_code='L6';
update public.cornhole_matches set bracket='Losers',round_number=4,winner_to='L8',loser_to=null,sort_order=75 where match_code='L7';
update public.cornhole_matches set bracket='Losers',round_number=5,winner_to='GF1',loser_to=null,sort_order=85 where match_code='L8';
update public.cornhole_matches set bracket='Finals',round_number=1,sort_order=90 where match_code='GF1';
update public.cornhole_matches set bracket='Finals',round_number=2,sort_order=100 where match_code='GF2';
