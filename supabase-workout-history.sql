-- Run this in Supabase SQL Editor before deploying the workout history code.
-- Programme days remain reusable; completions and set logs are tied to dates.

create table if not exists public.client_workout_completions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_program_id uuid not null references public.client_programs(id) on delete cascade,
  client_program_day_id uuid not null references public.client_program_days(id) on delete cascade,
  completed_date date not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (
    client_id,
    client_program_id,
    client_program_day_id,
    completed_date
  )
);

alter table public.client_program_set_logs
  add column if not exists log_date date;

update public.client_program_set_logs
set log_date = created_at::date
where log_date is null;

insert into public.client_workout_completions (
  client_id,
  client_program_id,
  client_program_day_id,
  completed_date,
  completed_at
)
select
  cp.client_id,
  cpd.client_program_id,
  cpd.id,
  coalesce(max(cpsl.log_date), current_date),
  coalesce(max(cpsl.created_at), now())
from public.client_program_days cpd
join public.client_programs cp
  on cp.id = cpd.client_program_id
left join public.client_program_set_logs cpsl
  on cpsl.client_program_day_id = cpd.id
  and cpsl.client_program_id = cpd.client_program_id
where cpd.completed = true
group by cp.client_id, cpd.client_program_id, cpd.id
on conflict (
  client_id,
  client_program_id,
  client_program_day_id,
  completed_date
) do nothing;

alter table public.client_program_set_logs
  alter column log_date set default current_date;

create index if not exists client_workout_completions_client_program_idx
  on public.client_workout_completions (client_id, client_program_id, completed_date desc);

create index if not exists client_program_set_logs_workout_date_idx
  on public.client_program_set_logs (
    client_id,
    client_program_id,
    client_program_day_id,
    log_date
  );

alter table public.client_workout_completions enable row level security;

drop policy if exists "Clients can read own workout completions"
  on public.client_workout_completions;
create policy "Clients can read own workout completions"
  on public.client_workout_completions
  for select
  using (
    exists (
      select 1
      from public.clients
      where clients.id = client_workout_completions.client_id
        and clients.profile_id = auth.uid()
    )
  );

drop policy if exists "Clients can insert own workout completions"
  on public.client_workout_completions;
create policy "Clients can insert own workout completions"
  on public.client_workout_completions
  for insert
  with check (
    exists (
      select 1
      from public.clients
      where clients.id = client_workout_completions.client_id
        and clients.profile_id = auth.uid()
    )
  );

drop policy if exists "Clients can delete own workout completions"
  on public.client_workout_completions;
create policy "Clients can delete own workout completions"
  on public.client_workout_completions
  for delete
  using (
    exists (
      select 1
      from public.clients
      where clients.id = client_workout_completions.client_id
        and clients.profile_id = auth.uid()
    )
  );

drop policy if exists "Clients can update own workout completions"
  on public.client_workout_completions;
create policy "Clients can update own workout completions"
  on public.client_workout_completions
  for update
  using (
    exists (
      select 1
      from public.clients
      where clients.id = client_workout_completions.client_id
        and clients.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.clients
      where clients.id = client_workout_completions.client_id
        and clients.profile_id = auth.uid()
    )
  );
