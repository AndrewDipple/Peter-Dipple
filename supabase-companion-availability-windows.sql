-- Optional seasonal availability windows for companions.
-- Run this before seeding companions with available_from / available_until.

alter table public.companion_paths
  add column if not exists available_from date;

alter table public.companion_paths
  add column if not exists available_until date;

alter table public.companion_paths
  drop constraint if exists companion_paths_availability_window_check;

alter table public.companion_paths
  add constraint companion_paths_availability_window_check
  check (
    available_from is null
    or available_until is null
    or available_from <= available_until
  );

-- Example:
-- update public.companion_paths
-- set available_from = '2026-10-01',
--     available_until = '2026-10-31'
-- where slug = 'pumpkin';
