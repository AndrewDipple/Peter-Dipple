-- GDPR/admin audit trail.
-- Run this in Supabase to record admin exports, retention changes, and deletion actions.

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_profile_id uuid,
  target_client_id uuid,
  target_profile_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_events enable row level security;

drop policy if exists "Admins can view admin audit events" on public.admin_audit_events;
create policy "Admins can view admin audit events"
  on public.admin_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create index if not exists admin_audit_events_created_at_idx
  on public.admin_audit_events (created_at desc);

create index if not exists admin_audit_events_target_client_id_idx
  on public.admin_audit_events (target_client_id);

create index if not exists admin_audit_events_actor_profile_id_idx
  on public.admin_audit_events (actor_profile_id);
