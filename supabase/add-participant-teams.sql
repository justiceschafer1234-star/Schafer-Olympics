-- Run this once in the Supabase SQL editor.
-- It is safe to run more than once.

alter table public.participants
  add column if not exists team text;

alter table public.participants
  drop constraint if exists participants_team_check;

alter table public.participants
  add constraint participants_team_check
  check (team is null or team in ('Team Red','Team Blue','Team Green','Team Gold'));

create index if not exists participants_team_idx on public.participants(team);
