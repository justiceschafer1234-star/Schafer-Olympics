-- Keep one result-refresh trigger per tournament table.
-- The retained trg_sync_* triggers already call the same refresh functions.

drop trigger if exists cornhole_sync_event_result on public.cornhole_matches;
drop trigger if exists wiffle_sync_event_result on public.wiffle_ball_matches;
