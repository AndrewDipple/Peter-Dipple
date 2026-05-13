-- Bread unlockable companion.
-- Run after supabase-companion-unlocks.sql and supabase-companion-levelling-update.sql.
-- Fuel unlock: try 10 different recipes.

alter table public.companion_lines
  add column if not exists min_form_number integer not null default 1;

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
  'bread',
  'Bread Companion',
  'Warm, dramatic, comfort-food chaos with crumbs.',
  'Loaf',
  false,
  true,
  50,
  'fuel',
  'different_recipes',
  10,
  'Try 10 different recipes'
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
where path_id = (select id from public.companion_paths where slug = 'bread');

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
  'Dough',
  0,
  '/companions/bread/dough.png',
  'Soft, unformed, and full of potential. Quietly rising. Slightly sticky.'
from public.companion_paths
where slug = 'bread';

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
  'Bread',
  100,
  '/companions/bread/bread.png',
  'Warm, reliable, slightly dramatic, and starting to develop structure.'
from public.companion_paths
where slug = 'bread';

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
  'Absolute Loaf',
  200,
  '/companions/bread/absolute-loaf.png',
  'No longer a snack. A warm, proud, wildly overconfident presence.'
from public.companion_paths
where slug = 'bread';

delete from public.companion_lines
where companion_slug = 'bread';

insert into public.companion_lines (
  companion_slug,
  category,
  text,
  min_form_number,
  is_active
)
values
  ('bread', 'general', 'Dough has potential. Dough is simply waiting to rise.', 1, true),
  ('bread', 'general', 'Soft start. Strong future.', 1, true),
  ('bread', 'general', 'Tiny progress. Big crumb energy.', 1, true),
  ('bread', 'general', 'Dough is not ready yet. Dough is still valid.', 1, true),
  ('bread', 'general', 'The rise begins quietly.', 1, true),
  ('bread', 'general', 'Dough believes in warm beginnings.', 1, true),
  ('bread', 'general', 'Small movement. Future loaf behaviour.', 1, true),
  ('bread', 'general', 'Dough has entered the basket.', 1, true),

  ('bread', 'general', 'Bread has arrived. Warm. Reliable. Slightly dramatic.', 2, true),
  ('bread', 'general', 'The loaf is becoming real.', 2, true),
  ('bread', 'general', 'Warmth acquired. Structure improving.', 2, true),
  ('bread', 'general', 'Bread approves this tiny win.', 2, true),
  ('bread', 'general', 'A little structure can go a long way.', 2, true),
  ('bread', 'general', 'The basket is beginning to believe.', 2, true),
  ('bread', 'general', 'Bread has reviewed the plan. Toast possible.', 2, true),
  ('bread', 'general', 'Small wins make good texture.', 2, true),

  ('bread', 'general', 'Absolute Loaf has risen.', 3, true),
  ('bread', 'general', 'The loaf is no longer theoretical.', 3, true),
  ('bread', 'general', 'Big crumb energy detected.', 3, true),
  ('bread', 'general', 'This is not just bread. This is momentum.', 3, true),
  ('bread', 'general', 'Absolute Loaf approves the admin.', 3, true),
  ('bread', 'general', 'Warmth. Structure. Mild drama.', 3, true),
  ('bread', 'general', 'The basket has never been stronger.', 3, true),
  ('bread', 'general', 'You may proceed. The loaf permits it.', 3, true),

  ('bread', 'rest_timer', 'Rest. The dough must rise.', 1, true),
  ('bread', 'rest_timer', 'Do not rush. Bread understands waiting.', 1, true),
  ('bread', 'rest_timer', 'Tiny pause. Better texture.', 1, true),
  ('bread', 'rest_timer', 'Recovery is just proving time.', 1, true),
  ('bread', 'rest_timer', 'The next set can wait. The loaf is cooling.', 2, true),
  ('bread', 'rest_timer', 'Breathe. Rise slowly.', 2, true),
  ('bread', 'rest_timer', 'Rest has been baked into the plan.', 2, true),
  ('bread', 'rest_timer', 'The loaf recommends hydration.', 2, true),
  ('bread', 'rest_timer', 'Stillness can be structurally important.', 3, true),
  ('bread', 'rest_timer', 'A good rest is part of the bake.', 3, true),
  ('bread', 'rest_timer', 'Pause now. Become golden later.', 3, true),
  ('bread', 'rest_timer', 'The timer is preheating your comeback.', 3, true),

  ('bread', 'weekly_check_in', 'Check-in completed. The basket is informed.', 1, true),
  ('bread', 'weekly_check_in', 'Feedback submitted. The loaf approves.', 1, true),
  ('bread', 'weekly_check_in', 'A thoughtful update has been buttered into the record.', 1, true),
  ('bread', 'weekly_check_in', 'You shared useful information. Big crumb energy.', 1, true),
  ('bread', 'weekly_check_in', 'The loaf respects honesty.', 2, true),
  ('bread', 'weekly_check_in', 'A messy week can still rise.', 2, true),
  ('bread', 'weekly_check_in', 'Progress photos uploaded. The crumb trail continues.', 2, true),
  ('bread', 'weekly_check_in', 'Meal admin, check-ins, tiny updates: all part of the bake.', 3, true),
  ('bread', 'weekly_check_in', 'You stayed connected. The basket noticed.', 3, true),
  ('bread', 'weekly_check_in', 'The loaf has absorbed the update.', 3, true),

  ('bread', 'nutrition', 'Meal admin completed. The loaf approves.', 1, true),
  ('bread', 'nutrition', 'A roughly logged meal still counts as useful crumbs.', 1, true),
  ('bread', 'nutrition', 'No judgement. Only data and maybe toast.', 1, true),
  ('bread', 'nutrition', 'Food notes added. The basket is organised.', 1, true),
  ('bread', 'nutrition', 'A planned meal is a tiny act of structure.', 2, true),
  ('bread', 'nutrition', 'The loaf respects preparation.', 2, true),
  ('bread', 'nutrition', 'Nutrition does not need to be perfect to be useful.', 3, true),
  ('bread', 'nutrition', 'Tiny meal notes. Big crumb energy.', 3, true),

  ('bread', 'level_up', 'Dough transformed into Bread. The rise has begun. Structure has entered the chat.', 2, true),
  ('bread', 'level_up', 'Bread transformed into Absolute Loaf. The loaf is no longer theoretical.', 3, true),
  ('bread', 'mastery', 'Bread has reached peak carb authority. It will now live forever in your collection, probably leaving crumbs.', 3, true),

  ('bread', 'bird_reaction', 'Bread respects excellent sandwich logistics.', 1, true),
  ('bread', 'bird_reaction', 'Bread respects a bird that remembers who drops crumbs.', 1, true),
  ('bread', 'bird_reaction', 'Bread respects communal toasting.', 1, true),

  ('bread', 'dad_joke_reaction', 'That joke was stale. Bread approves anyway.', 1, true),
  ('bread', 'dad_joke_reaction', 'A terrible joke. Excellent crust.', 1, true),
  ('bread', 'dad_joke_reaction', 'Bread laughed. It was mostly crumbs.', 1, true),
  ('bread', 'dad_joke_reaction', 'The loaf respects the commitment to nonsense.', 1, true),

  ('bread', 'word_reaction', 'Bread calls this continuing to rise.', 1, true),
  ('bread', 'word_reaction', 'Bread calls this one crumb becoming a loaf.', 1, true),
  ('bread', 'word_reaction', 'Bread has been proving this whole time.', 1, true);
