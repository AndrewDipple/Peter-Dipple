-- Optional marketing consent tracking.
-- Run in Supabase before enabling the optional marketing checkbox.

alter table public.clients
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_version text;

comment on column public.clients.marketing_consent_at is
  'When the client optionally consented to anonymised marketing use cases such as progress photos/testimonials.';

comment on column public.clients.marketing_consent_version is
  'Marketing consent wording version accepted by the client.';
