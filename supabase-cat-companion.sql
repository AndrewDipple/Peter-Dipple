-- Cat starter companion.
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
  'cat',
  'Cat Companion',
  'Smug emotional support. Pretends not to care. Absolutely does.',
  'The Cat',
  true,
  true,
  30,
  'spirit',
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
where path_id = (select id from public.companion_paths where slug = 'cat')
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
  'Sleepy Kitty',
  0,
  '/companions/cat/sleepy-kitty.PNG',
  'Tiny, tired, and already supervising.'
from public.companion_paths
where slug = 'cat';

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
  'Curious Cat',
  1000,
  '/companions/cat/curious-cat.PNG',
  'Investigating your habits for research purposes.'
from public.companion_paths
where slug = 'cat';

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
  'Gym Cat',
  2000,
  '/companions/cat/gym-cat.PNG',
  'Has acquired a sweatband and dangerous confidence.'
from public.companion_paths
where slug = 'cat';
