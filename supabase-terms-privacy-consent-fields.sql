-- Terms, privacy, and health-data consent tracking.
-- Run in Supabase before enabling the first-login acceptance screen.

alter table public.clients
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists health_data_consent_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_version text;

comment on column public.clients.terms_accepted_at is
  'When the client accepted the app terms and conditions.';

comment on column public.clients.privacy_accepted_at is
  'When the client confirmed they had read the privacy notice.';

comment on column public.clients.health_data_consent_at is
  'When the client gave explicit consent for processing health, fitness, measurement, and progress-photo data.';

comment on column public.clients.terms_version is
  'Terms version accepted by the client.';

comment on column public.clients.privacy_version is
  'Privacy notice version accepted by the client.';
