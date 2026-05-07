-- Companion collection / unlock metadata.
-- Run this in Supabase SQL Editor before adding locked companion paths.

alter table public.companion_paths
  add column if not exists display_order integer not null default 100;

alter table public.companion_paths
  add column if not exists companion_type text;

alter table public.companion_paths
  add column if not exists unlock_requirement_type text;

alter table public.companion_paths
  add column if not exists unlock_requirement_target integer;

alter table public.companion_paths
  add column if not exists unlock_label text;

alter table public.companion_paths
  drop constraint if exists companion_paths_unlock_requirement_type_check;

alter table public.companion_paths
  add constraint companion_paths_unlock_requirement_type_check
  check (
    unlock_requirement_type is null
    or unlock_requirement_type in (
      'starter',
      'workouts_completed',
      'weekly_check_ins',
      'different_recipes',
      'water_targets',
      'milestone_photo_sets',
      'manual'
    )
  );

alter table public.companion_paths
  drop constraint if exists companion_paths_companion_type_check;

alter table public.companion_paths
  add constraint companion_paths_companion_type_check
  check (
    companion_type is null
    or companion_type in ('power', 'fuel', 'spirit')
  );

-- Existing starter rows should behave as starter companions.
update public.companion_paths
set unlock_requirement_type = coalesce(unlock_requirement_type, 'starter'),
    unlock_requirement_target = null,
    unlock_label = null
where is_starter = true;

-- Starter type examples. These are deliberately tolerant of slug/name changes.
update public.companion_paths
set companion_type = 'power',
    is_starter = true,
    unlock_requirement_type = 'starter',
    display_order = 10
where lower(slug) in ('goblin', 'greg')
   or lower(name) in ('goblin', 'greg', 'greg the goblin')
   or lower(default_name) = 'greg';

update public.companion_paths
set companion_type = 'fuel',
    is_starter = true,
    unlock_requirement_type = 'starter',
    display_order = 20
where lower(slug) in ('plant', 'plant-companion')
   or lower(name) like '%plant%'
   or lower(default_name) like '%plant%';

update public.companion_paths
set companion_type = 'spirit',
    is_starter = true,
    unlock_requirement_type = 'starter',
    display_order = 30
where lower(slug) = 'cat'
   or lower(name) like '%cat%'
   or lower(default_name) like '%cat%';

-- Example locked-companion setup after you add a new companion path/forms:
--
-- update public.companion_paths
-- set is_starter = false,
--     display_order = 20,
--     unlock_requirement_type = 'workouts_completed',
--     unlock_requirement_target = 9,
--     unlock_label = 'Complete 9 workouts'
-- where slug = 'goblin';
--
-- update public.companion_paths
-- set is_starter = false,
--     display_order = 30,
--     unlock_requirement_type = 'different_recipes',
--     unlock_requirement_target = 10,
--     unlock_label = 'Try 10 different recipes'
-- where slug = 'recipe-sprite';
