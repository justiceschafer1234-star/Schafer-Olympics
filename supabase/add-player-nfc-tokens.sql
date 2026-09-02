-- NFC player-card credentials used by the Cloudflare Worker only.
-- The physical NFC card stores a site URL containing the random token in the URL fragment.
-- Supabase credentials are never written to the card or exposed to browser JavaScript.

create table if not exists public.player_nfc_tokens (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  token text not null unique check (char_length(token) >= 32),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.player_nfc_tokens enable row level security;
revoke all on table public.player_nfc_tokens from public;
revoke all on table public.player_nfc_tokens from anon, authenticated;
grant select, insert, update, delete on table public.player_nfc_tokens to service_role;

insert into public.player_nfc_tokens (participant_id, token)
select
  p.id,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
from public.participants p
on conflict (participant_id) do nothing;
