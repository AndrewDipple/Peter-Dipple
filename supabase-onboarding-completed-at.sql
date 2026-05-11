-- Store when a client completed onboarding so weekly photo cadence can be
-- calculated per client instead of from a global date.

alter table public.clients
  add column if not exists onboarding_completed_at timestamptz;

-- Backfill existing completed clients from their initial onboarding data where
-- possible, falling back to the client row creation time.
update public.clients c
set onboarding_completed_at = coalesce(
  (
    select min(p.log_date)::timestamptz
    from public.progress_photos p
    where p.client_id = c.id
      and p.note = 'Initial progress photos (onboarding)'
  ),
  (
    select min(w.log_date)::timestamptz
    from public.client_weight_logs w
    where w.client_id = c.id
      and w.note = 'Initial weight (onboarding)'
  ),
  c.created_at
)
where c.onboarding_complete = true
  and c.onboarding_completed_at is null;
