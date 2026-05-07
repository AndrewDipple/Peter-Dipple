-- Online PT booking requests.
create table if not exists public.pt_session_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  preferred_start_at timestamptz not null,
  client_note text,
  status text not null default 'requested',
  trainer_response text,
  proposed_start_at timestamptz,
  confirmed_start_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint pt_session_requests_status_check
    check (status in ('requested', 'confirmed', 'alternative_suggested', 'cancelled', 'declined'))
);

alter table public.pt_session_requests enable row level security;

drop policy if exists "Clients can view own PT requests" on public.pt_session_requests;
create policy "Clients can view own PT requests"
on public.pt_session_requests
for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = pt_session_requests.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Clients can create own PT requests" on public.pt_session_requests;
create policy "Clients can create own PT requests"
on public.pt_session_requests
for insert
to authenticated
with check (
  exists (
    select 1 from public.clients c
    where c.id = pt_session_requests.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Clients can cancel own PT requests" on public.pt_session_requests;

drop policy if exists "Staff can manage PT requests" on public.pt_session_requests;
create policy "Staff can manage PT requests"
on public.pt_session_requests
for all
to authenticated
using (public.app_is_staff())
with check (public.app_is_staff());

create index if not exists pt_session_requests_client_created_at_idx
  on public.pt_session_requests (client_id, created_at desc);

create index if not exists pt_session_requests_status_preferred_start_at_idx
  on public.pt_session_requests (status, preferred_start_at);
