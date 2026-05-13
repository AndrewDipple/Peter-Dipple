-- Frog unlockable companion.
-- Run after supabase-companion-unlocks.sql and supabase-companion-levelling-update.sql.
-- Spirit unlock: submit 4 weekly check-ins.

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
  'frog',
  'Frog Companion',
  'Calm, strange, quietly wise support from the pond.',
  'Frog',
  false,
  true,
  40,
  'spirit',
  'weekly_check_ins',
  4,
  'Submit 4 weekly check-ins'
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
where path_id = (select id from public.companion_paths where slug = 'frog');

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
  'Tadpole',
  0,
  '/companions/frog/tadpole.png',
  'Small, floaty, and somehow already giving excellent emotional support.'
from public.companion_paths
where slug = 'frog';

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
  'Damp Little Guy',
  100,
  '/companions/frog/damp-little-guy.png',
  'Has grown legs, discovered land, and decided everything is a bit much.'
from public.companion_paths
where slug = 'frog';

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
  'Bench Frog',
  200,
  '/companions/frog/bench-frog.png',
  'Calm, supportive, and surprisingly good at reminding people to pause properly.'
from public.companion_paths
where slug = 'frog';

delete from public.companion_lines
where companion_slug = 'frog';

insert into public.companion_lines (
  companion_slug,
  category,
  text,
  min_form_number,
  is_active
)
values
  ('frog', 'general', 'Small swim. Still progress.', 1, true),
  ('frog', 'general', 'Tadpole is here. Tadpole believes gently.', 1, true),
  ('frog', 'general', 'No legs yet. Still moving.', 1, true),
  ('frog', 'general', 'Tiny ripple. Big meaning.', 1, true),
  ('frog', 'general', 'The pond has noticed your return.', 1, true),
  ('frog', 'general', 'Progress can begin very small.', 1, true),
  ('frog', 'general', 'Frog is here. Low-pressure support activated.', 1, true),
  ('frog', 'general', 'No rush. The lily pad remains.', 1, true),

  ('frog', 'general', 'Small hop. Still progress.', 2, true),
  ('frog', 'general', 'Frog noticed. Frog is pleased.', 2, true),
  ('frog', 'general', 'The swamp respects tiny effort.', 2, true),
  ('frog', 'general', 'One hop is still movement.', 2, true),
  ('frog', 'general', 'Frog has reviewed the vibes. Acceptable pond energy.', 2, true),
  ('frog', 'general', 'Frog believes in gentle returns.', 2, true),

  ('frog', 'general', 'Bench Frog says sit. Bench Frog is wise.', 3, true),
  ('frog', 'general', 'Pause with purpose. Very amphibian.', 3, true),
  ('frog', 'general', 'Stillness can be useful. Frog knows this.', 3, true),
  ('frog', 'general', 'Bench Frog respects recovery and tiny wins.', 3, true),
  ('frog', 'general', 'You may proceed at frog pace.', 3, true),
  ('frog', 'general', 'The lily pad recognises your effort.', 3, true),

  ('frog', 'rest_timer', 'Rest. The swamp understands recovery.', 1, true),
  ('frog', 'rest_timer', 'Breathe. The lily pad is stable.', 1, true),
  ('frog', 'rest_timer', 'Do not rush. Frog has nowhere urgent to be.', 1, true),
  ('frog', 'rest_timer', 'Small pause. Strong return.', 1, true),
  ('frog', 'rest_timer', 'The next set waits politely.', 1, true),
  ('frog', 'rest_timer', 'Recovery is pond strategy.', 2, true),
  ('frog', 'rest_timer', 'Resting is not quitting. It is amphibian wisdom.', 2, true),
  ('frog', 'rest_timer', 'Frog is timing this quietly.', 2, true),
  ('frog', 'rest_timer', 'Let the muscles un-ripple.', 2, true),
  ('frog', 'rest_timer', 'The swamp says: take the full rest.', 3, true),

  ('frog', 'weekly_check_in', 'You returned. Frog noticed. Frog is pleased.', 1, true),
  ('frog', 'weekly_check_in', 'Check-in complete. The pond is informed.', 1, true),
  ('frog', 'weekly_check_in', 'A truthful update has entered the swamp.', 1, true),
  ('frog', 'weekly_check_in', 'Frog respects honest communication.', 1, true),
  ('frog', 'weekly_check_in', 'Even a strange week can be useful data.', 1, true),
  ('frog', 'weekly_check_in', 'The swamp appreciates context.', 2, true),
  ('frog', 'weekly_check_in', 'You did not vanish. Frog values this.', 2, true),
  ('frog', 'weekly_check_in', 'A messy update is still an update. Very valid.', 2, true),
  ('frog', 'weekly_check_in', 'Bench Frog recognises your honesty.', 3, true),

  ('frog', 'nutrition', 'Meal admin entered the pond.', 1, true),
  ('frog', 'nutrition', 'A roughly logged meal still makes ripples.', 1, true),
  ('frog', 'nutrition', 'No judgement. Only pond data.', 1, true),
  ('frog', 'nutrition', 'Frog respects snacks with structure.', 1, true),
  ('frog', 'nutrition', 'Hydration pleases the amphibian.', 2, true),
  ('frog', 'nutrition', 'The swamp understands imperfect logging.', 2, true),
  ('frog', 'nutrition', 'Tiny meal notes. Tiny ripples. Useful patterns.', 3, true),

  ('frog', 'level_up', 'Tadpole transformed into Damp Little Guy. Legs acquired. Confidence pending.', 2, true),
  ('frog', 'level_up', 'Damp Little Guy transformed into Bench Frog. It has found a bench and developed opinions about rest.', 3, true),
  ('frog', 'mastery', 'Frog has reached final dampness. It will now live forever in your collection, probably sitting very still.', 3, true),

  ('frog', 'bird_reaction', 'Frog respects efficient mouth storage.', 1, true),
  ('frog', 'bird_reaction', 'Frog finds this impressive and slightly worrying.', 1, true),
  ('frog', 'bird_reaction', 'Frog respects group dampness management.', 1, true),

  ('frog', 'dad_joke_reaction', 'Frog does not understand. Frog supports anyway.', 1, true),
  ('frog', 'dad_joke_reaction', 'That joke has entered the pond. Consequences unknown.', 1, true),
  ('frog', 'dad_joke_reaction', 'Frog blinked slowly. This may be laughter.', 1, true),
  ('frog', 'dad_joke_reaction', 'Terrible joke. Excellent ripple.', 1, true),

  ('frog', 'word_reaction', 'Frog calls this remaining on the lily pad.', 1, true),
  ('frog', 'word_reaction', 'Frog calls this one hop becoming two.', 1, true),
  ('frog', 'word_reaction', 'Frog has been sitting still for this exact moment.', 1, true);
