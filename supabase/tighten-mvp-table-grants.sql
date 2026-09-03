-- Keep MVP data server-only. The Cloudflare Worker uses the service-role secret.
revoke all on table public.mvp_event_rules from service_role;
revoke all on table public.player_event_stats from service_role;

grant select on table public.mvp_event_rules to service_role;
grant select, insert, update on table public.player_event_stats to service_role;
