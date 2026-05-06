-- Run this in Supabase SQL Editor before using weekly client check-ins.

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
  created_at timestamptz not null default now(),
  unique (client_id, week_start)
);

create index if not exists client_weekly_check_ins_client_week_idx
  on public.client_weekly_check_ins (client_id, week_start desc);

alter table public.client_weekly_check_ins enable row level security;

drop policy if exists "Clients can read own weekly check-ins"
  on public.client_weekly_check_ins;
create policy "Clients can read own weekly check-ins"
  on public.client_weekly_check_ins
  for select
  using (
    exists (
      select 1
      from public.clients
      where clients.id = client_weekly_check_ins.client_id
        and clients.profile_id = auth.uid()
    )
  );

drop policy if exists "Clients can submit own weekly check-ins"
  on public.client_weekly_check_ins;
create policy "Clients can submit own weekly check-ins"
  on public.client_weekly_check_ins
  for insert
  with check (
    exists (
      select 1
      from public.clients
      where clients.id = client_weekly_check_ins.client_id
        and clients.profile_id = auth.uid()
    )
  );

drop policy if exists "Clients can update own weekly check-ins"
  on public.client_weekly_check_ins;
create policy "Clients can update own weekly check-ins"
  on public.client_weekly_check_ins
  for update
  using (
    exists (
      select 1
      from public.clients
      where clients.id = client_weekly_check_ins.client_id
        and clients.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.clients
      where clients.id = client_weekly_check_ins.client_id
        and clients.profile_id = auth.uid()
    )
  );

drop policy if exists "Staff can read weekly check-ins"
  on public.client_weekly_check_ins;
create policy "Staff can read weekly check-ins"
  on public.client_weekly_check_ins
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'admin')
    )
  );
