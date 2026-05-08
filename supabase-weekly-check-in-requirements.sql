-- Weekly check-in requirements.
-- Adds lightweight metadata so weekly check-ins can record the required weight
-- and whether the required weekly photo set was submitted.

alter table public.client_weekly_check_ins
  add column if not exists weight_kg numeric;

alter table public.client_weekly_check_ins
  add column if not exists photos_uploaded boolean not null default false;
