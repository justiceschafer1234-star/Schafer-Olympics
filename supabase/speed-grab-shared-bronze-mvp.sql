-- Speed Grab awards two bronze finishes when both semifinal losers share bronze.
-- The scoring engine stores them as placement indexes 3 and 4, so both receive the agreed +2 raw placement bonus.
update public.mvp_event_rules
set placement_bonuses='{"1":4,"2":3,"3":2,"4":2}'::jsonb,
    notes='Match wins are worth 2 raw points; both semifinal bronze finishers receive the 3rd-place +2 raw bonus.',
    updated_at=now()
where event_key='speed-grab';
