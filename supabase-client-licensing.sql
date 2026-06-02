-- Client licensing groundwork. This does not gate app access yet.
create table if not exists public.license_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  includes_workouts boolean not null default false,
  includes_nutrition boolean not null default false,
  includes_bespoke boolean not null default false,
  includes_pt boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint license_types_code_check
    check (code in ('workout_app', 'nutrition_app', 'workout_nutrition', 'bespoke', 'hands_on_pt'))
);

alter table public.clients
  add column if not exists license_type_id uuid references public.license_types(id),
  add column if not exists license_status text not null default 'active',
  add column if not exists license_starts_on date,
  add column if not exists license_expires_on date,
  add column if not exists license_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_license_status_check'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_license_status_check
      check (license_status in ('trial', 'active', 'paused', 'expired', 'cancelled'));
  end if;
end $$;

alter table public.license_types enable row level security;

drop policy if exists "Authenticated users can view license types" on public.license_types;
create policy "Authenticated users can view license types"
on public.license_types
for select
to authenticated
using (is_active = true or public.app_is_staff());

drop policy if exists "Staff can manage license types" on public.license_types;
create policy "Staff can manage license types"
on public.license_types
for all
to authenticated
using (public.app_is_staff())
with check (public.app_is_staff());

insert into public.license_types (
  code,
  name,
  description,
  includes_workouts,
  includes_nutrition,
  includes_bespoke,
  includes_pt,
  sort_order
)
values
  (
    'workout_app',
    'Foundations: Workout only',
    'Foundations access for workout plans and app tracking.',
    true,
    false,
    false,
    false,
    10
  ),
  (
    'nutrition_app',
    'Foundations: Nutrition only',
    'Foundations access for nutrition plans and app tracking.',
    false,
    true,
    false,
    false,
    20
  ),
  (
    'workout_nutrition',
    'Foundations: Workout and Nutrition',
    'Foundations access for combined workout and nutrition plans.',
    true,
    true,
    false,
    false,
    30
  ),
  (
    'bespoke',
    'Build: Workout and Nutrition',
    'Build package for workout and nutrition coaching with app support.',
    true,
    true,
    true,
    false,
    40
  ),
  (
    'hands_on_pt',
    'Fully Bespoke',
    'Fully bespoke coaching using the app as the tracking and support vehicle.',
    true,
    true,
    true,
    true,
    50
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  includes_workouts = excluded.includes_workouts,
  includes_nutrition = excluded.includes_nutrition,
  includes_bespoke = excluded.includes_bespoke,
  includes_pt = excluded.includes_pt,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

create index if not exists clients_license_status_idx
  on public.clients (license_status, license_expires_on);

create index if not exists clients_license_type_idx
  on public.clients (license_type_id);
