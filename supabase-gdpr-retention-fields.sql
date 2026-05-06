-- GDPR retention tracking fields.
-- Run this in Supabase before using retention actions in the admin GDPR panel.

alter table public.clients
  add column if not exists archived_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists delete_after timestamptz;

comment on column public.clients.archived_at is
  'When the client was marked inactive/archived for retention tracking.';

comment on column public.clients.deletion_requested_at is
  'When the client requested erasure or closure handling.';

comment on column public.clients.delete_after is
  'Retention review/deletion date for GDPR lifecycle handling.';
