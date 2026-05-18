-- Preserve historical workout data when assigning follow-up programmes.
-- Old client programmes are superseded instead of deleted.

alter table public.client_programs
  add column if not exists status text not null default 'active';

alter table public.client_programs
  add column if not exists archived_at timestamptz;

alter table public.client_programs
  add column if not exists superseded_by_program_id uuid references public.client_programs(id);

alter table public.client_programs
  add column if not exists completed_at timestamptz;

update public.client_programs
set status = 'active'
where status is null;

with ranked_programmes as (
  select
    id,
    client_id,
    first_value(id) over (
      partition by client_id
      order by created_at desc
    ) as latest_program_id,
    row_number() over (
      partition by client_id
      order by created_at desc
    ) as programme_rank
  from public.client_programs
  where status = 'active'
)
update public.client_programs cp
set
  status = 'superseded',
  archived_at = coalesce(cp.archived_at, now()),
  superseded_by_program_id = ranked_programmes.latest_program_id
from ranked_programmes
where cp.id = ranked_programmes.id
  and ranked_programmes.programme_rank > 1;

create index if not exists idx_client_programs_active_client
  on public.client_programs (client_id, status, created_at desc);
