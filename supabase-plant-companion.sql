-- Plant starter companion.
-- Run after supabase-companion-unlocks.sql.
-- Uses the current app thresholds: 0, 1000, 2000 XP.

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
  'plant',
  'Plant Companion',
  'Calm growth support. Gentle, cosy, and never pushy.',
  'Sprout',
  true,
  true,
  20,
  'fuel',
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
where path_id = (select id from public.companion_paths where slug = 'plant')
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
  'Tiny Seed',
  0,
  '/companions/plant/seed.png',
  'Small, hopeful, and mostly just vibing in the soil.'
from public.companion_paths
where slug = 'plant';

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
  'Little Sprout',
  1000,
  '/companions/plant/sprout.png',
  'Curious, hopeful, and very proud of having one leaf.'
from public.companion_paths
where slug = 'plant';

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
  'Happy Houseplant',
  2000,
  '/companions/plant/houseplant.png',
  'Cosy, settled, and thriving in its little pot.'
from public.companion_paths
where slug = 'plant';
