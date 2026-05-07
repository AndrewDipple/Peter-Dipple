-- Goblin starter companion. Default name: Greg.
-- Run after supabase-companion-unlocks.sql.
-- Uses the current app thresholds: 0, 1000, 2000 XP.

update public.companion_paths
set slug = 'goblin'
where slug = 'greg'
  and not exists (
    select 1
    from public.companion_paths
    where slug = 'goblin'
  );

insert into public.companion_paths (
  slug,
  name,
  description,
  default_name,
  is_starter,
  is_active,
  display_order,
  companion_type,
  unlock_requirement_type,
  unlock_requirement_target,
  unlock_label
)
values (
  'goblin',
  'Goblin',
  'Chaotic encouragement with a tiny clipboard.',
  'Greg',
  true,
  true,
  10,
  'power',
  'starter',
  null,
  null
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    default_name = excluded.default_name,
    is_starter = excluded.is_starter,
    is_active = excluded.is_active,
    display_order = excluded.display_order,
    companion_type = excluded.companion_type,
    unlock_requirement_type = excluded.unlock_requirement_type,
    unlock_requirement_target = excluded.unlock_requirement_target,
    unlock_label = excluded.unlock_label;

delete from public.companion_forms
where path_id = (select id from public.companion_paths where slug = 'goblin')
  and form_number in (1, 2, 3);

insert into public.companion_forms (
  path_id,
  form_number,
  tier_label,
  name,
  xp_required,
  image_url,
  description
)
select
  id,
  1,
  'starter',
  'Pocket Goblin',
  0,
  '/companions/goblin/pocket-goblin.png',
  'Tiny, excitable, and absolutely convinced he is helping.'
from public.companion_paths
where slug = 'goblin';

insert into public.companion_forms (
  path_id,
  form_number,
  tier_label,
  name,
  xp_required,
  image_url,
  description
)
select
  id,
  2,
  'growth',
  'Snack Goblin',
  1000,
  '/companions/goblin/snack-goblin.png',
  'Has acquired a snack, a clipboard, and dangerous organisational confidence.'
from public.companion_paths
where slug = 'goblin';

insert into public.companion_forms (
  path_id,
  form_number,
  tier_label,
  name,
  xp_required,
  image_url,
  description
)
select
  id,
  3,
  'final',
  'Gym Goblin',
  2000,
  '/companions/goblin/gym-goblin.png',
  'Hoodie, shaker, dumbbell, and dangerous confidence.'
from public.companion_paths
where slug = 'goblin';
