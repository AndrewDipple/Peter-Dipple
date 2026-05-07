-- Weekly check-ins table, RLS, and one-per-week enforcement.
-- Run this in Supabase SQL Editor.

create table if not exists public.client_weekly_check_ins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  week_start date not null,
  energy_level integer not null check (energy_level between 1 and 5),
  hunger_level integer not null check (hunger_level between 1 and 5),
  motivation_level integer not null check (motivation_level between 1 and 5),
  soreness_level integer not null check (soreness_level between 1 and 5),
  sleep_quality integer not null check (sleep_quality between 1 and 5),
  notes text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists client_weekly_check_ins_client_week_unique
  on public.client_weekly_check_ins (client_id, week_start);

alter table public.client_weekly_check_ins enable row level security;

drop policy if exists "Clients can view own weekly check-ins" on public.client_weekly_check_ins;
create policy "Clients can view own weekly check-ins"
  on public.client_weekly_check_ins
  for select
  to authenticated
  using (public.app_owns_client(client_id));

drop policy if exists "Clients can submit own weekly check-ins" on public.client_weekly_check_ins;
create policy "Clients can submit own weekly check-ins"
  on public.client_weekly_check_ins
  for insert
  to authenticated
  with check (public.app_owns_client(client_id));

drop policy if exists "Clients can update own weekly check-ins" on public.client_weekly_check_ins;
create policy "Clients can update own weekly check-ins"
  on public.client_weekly_check_ins
  for update
  to authenticated
  using (public.app_owns_client(client_id))
  with check (public.app_owns_client(client_id));

drop policy if exists "Staff can manage weekly check-ins" on public.client_weekly_check_ins;
create policy "Staff can manage weekly check-ins"
  on public.client_weekly_check_ins
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());
