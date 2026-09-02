-- Reusable scorecard state for Schafer Olympics events.
-- The Cloudflare Worker is the only client; browser roles receive no access.

create table if not exists public.event_scorecards (
  event_id uuid primary key references public.olympic_events(id) on delete cascade,
  format_key text not null,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.event_scorecards enable row level security;
revoke all on table public.event_scorecards from anon, authenticated;
grant select, insert, update, delete on table public.event_scorecards to service_role;

drop trigger if exists set_event_scorecards_updated_at on public.event_scorecards;
create trigger set_event_scorecards_updated_at
before update on public.event_scorecards
for each row execute function public.set_updated_at();


