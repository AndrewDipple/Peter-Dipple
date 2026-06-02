alter table public.client_programs
  add column if not exists status text default 'active',
  add column if not exists current_week integer default 1,
  add column if not exists program_start_date date,
  add column if not exists archived_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists superseded_by_program_id uuid references public.client_programs(id) on delete set null;

create index if not exists client_programs_client_status_created_idx
  on public.client_programs(client_id, status, created_at desc);

create index if not exists client_programs_superseded_by_idx
  on public.client_programs(superseded_by_program_id);

create index if not exists client_workout_completions_client_program_idx
  on public.client_workout_completions(client_id, client_program_id, completed_date desc);

create index if not exists client_program_set_logs_client_program_idx
  on public.client_program_set_logs(client_id, client_program_id, created_at desc);

update public.client_programs
set status = 'active'
where status is null
  and archived_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_programs_status_check'
      and conrelid = 'public.client_programs'::regclass
  ) then
    alter table public.client_programs
      add constraint client_programs_status_check
      check (status in ('assigning', 'active', 'superseded', 'completed'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.client_programs
    where status = 'active'
    group by client_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add active programme safety index: at least one client has multiple active programmes. Archive the older active programme(s), then rerun this SQL.';
  end if;
end $$;

create unique index if not exists client_programs_one_active_per_client_idx
  on public.client_programs(client_id)
  where status = 'active';
