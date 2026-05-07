-- Adds lightweight admin workflow fields for bug reports and feature requests.
alter table public.feedback
  add column if not exists status text not null default 'new',
  add column if not exists priority text not null default 'normal',
  add column if not exists admin_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_status_check'
      and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_status_check
      check (status in ('new', 'reviewing', 'planned', 'done', 'closed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_priority_check'
      and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_priority_check
      check (priority in ('low', 'normal', 'high'));
  end if;
end $$;

create index if not exists feedback_status_created_at_idx
  on public.feedback (status, created_at desc);

create index if not exists feedback_type_created_at_idx
  on public.feedback (type, created_at desc);
