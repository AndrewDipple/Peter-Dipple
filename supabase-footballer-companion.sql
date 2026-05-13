-- Footballer unlockable companion.
-- Run after supabase-companion-unlocks.sql and supabase-companion-levelling-update.sql.
-- Power unlock: complete 9 workouts.

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
  'footballer',
  'Footballer Companion',
  'Upbeat team-talk energy with proper recovery advice.',
  'Captain',
  false,
  true,
  60,
  'power',
  'workouts_completed',
  9,
  'Complete 9 workouts'
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
where path_id = (select id from public.companion_paths where slug = 'footballer');

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
  'New Signing',
  0,
  '/companions/footballer/new-signing.png',
  'Fresh kit, fresh boots, big potential, and slightly nervous first day at the club energy.'
from public.companion_paths
where slug = 'footballer';

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
  'First-Team Regular',
  100,
  '/companions/footballer/academy-ace.png',
  'Trusted, consistent, and showing up with steady confidence.'
from public.companion_paths
where slug = 'footballer';

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
  'Big Game Player',
  200,
  '/companions/footballer/first-team-star.png',
  'Turns up when it matters: calm under pressure and serious about proper recovery.'
from public.companion_paths
where slug = 'footballer';

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
  4,
  'mega',
  'World Class',
  300,
  '/companions/footballer/big-game-player.png',
  'Polished, composed, and elite without ever needing to be arrogant.'
from public.companion_paths
where slug = 'footballer';

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
  5,
  'ultra',
  'GOAT',
  400,
  '/companions/footballer/world-class.png',
  'Iconic, composed, quietly legendary, and unmistakably different level.'
from public.companion_paths
where slug = 'footballer';

delete from public.companion_lines
where companion_slug = 'footballer';

insert into public.companion_lines (
  companion_slug,
  category,
  text,
  min_form_number,
  is_active
)
values
  ('footballer', 'general', 'Good start. Boots on. Vibes ready.', 1, true),
  ('footballer', 'general', 'One touch at a time.', 1, true),
  ('footballer', 'general', 'Small effort. Big match-day energy.', 1, true),
  ('footballer', 'general', 'The warm-up has emotional importance.', 1, true),
  ('footballer', 'general', 'No pressure. Just get the ball rolling.', 1, true),
  ('footballer', 'general', 'Tiny touch. Still progress.', 1, true),
  ('footballer', 'general', 'New signing energy has entered the pitch.', 1, true),
  ('footballer', 'general', 'Showing up counts.', 1, true),

  ('footballer', 'general', 'Plan reviewed. Looking sharp.', 2, true),
  ('footballer', 'general', 'Good habits. Good touch. Good shift.', 2, true),
  ('footballer', 'general', 'Training ground energy today.', 2, true),
  ('footballer', 'general', 'Build from the basics.', 2, true),
  ('footballer', 'general', 'The little details matter.', 2, true),
  ('footballer', 'general', 'Smart work beats panic work.', 2, true),
  ('footballer', 'general', 'Reset, breathe, go again.', 2, true),
  ('footballer', 'general', 'The next play starts calm.', 2, true),

  ('footballer', 'general', 'Good shift.', 3, true),
  ('footballer', 'general', 'You are in the squad. We go again.', 3, true),
  ('footballer', 'general', 'Steady work. Strong attitude.', 3, true),
  ('footballer', 'general', 'Game plan: breathe, reset, continue.', 3, true),
  ('footballer', 'general', 'Proper team-talk behaviour.', 3, true),
  ('footballer', 'general', 'Composure wins moments.', 3, true),
  ('footballer', 'general', 'Keep it calm. Keep it moving.', 3, true),
  ('footballer', 'general', 'Good work does not need a dramatic soundtrack. But it helps.', 3, true),
  ('footballer', 'general', 'Big moment. Calm head.', 4, true),
  ('footballer', 'general', 'This is where composure matters.', 4, true),
  ('footballer', 'general', 'Pressure off. Process on.', 4, true),
  ('footballer', 'general', 'World Class behaviour. Calm, steady, ready.', 5, true),
  ('footballer', 'general', 'Elite reset. Big energy.', 5, true),
  ('footballer', 'general', 'You do not need perfect. You need the next good touch.', 5, true),
  ('footballer', 'general', 'Different level. Same calm reset.', 5, true),

  ('footballer', 'rest_timer', 'Good shift. Breathe, reset, recover properly.', 1, true),
  ('footballer', 'rest_timer', 'Take the full rest. That is professional behaviour.', 1, true),
  ('footballer', 'rest_timer', 'The next set starts after the reset.', 1, true),
  ('footballer', 'rest_timer', 'Breathe. Shoulders down. We go again.', 1, true),
  ('footballer', 'rest_timer', 'Rest is part of the game plan.', 1, true),
  ('footballer', 'rest_timer', 'No rush. Composure first.', 2, true),
  ('footballer', 'rest_timer', 'The bench has wisdom.', 2, true),
  ('footballer', 'rest_timer', 'Use the pause. Big moments need calm heads.', 2, true),
  ('footballer', 'rest_timer', 'Hydrate. Even captains need fluids.', 2, true),
  ('footballer', 'rest_timer', 'Reset now. Stronger next play.', 3, true),
  ('footballer', 'rest_timer', 'The whistle has not gone yet. Rest properly.', 3, true),
  ('footballer', 'rest_timer', 'Good teams recover between efforts.', 3, true),
  ('footballer', 'rest_timer', 'The next effort starts with a good reset.', 4, true),
  ('footballer', 'rest_timer', 'Pressure off. Process on.', 4, true),
  ('footballer', 'rest_timer', 'Clutch behaviour begins with breathing.', 4, true),
  ('footballer', 'rest_timer', 'The best players recover properly.', 5, true),
  ('footballer', 'rest_timer', 'Composure is part of the performance.', 5, true),
  ('footballer', 'rest_timer', 'Strong teams are built one calm reset at a time.', 5, true),

  ('footballer', 'weekly_check_in', 'Check-in submitted. Coach has the update.', 1, true),
  ('footballer', 'weekly_check_in', 'Good communication. Proper team behaviour.', 1, true),
  ('footballer', 'weekly_check_in', 'Feedback sent. Dressing room appreciates it.', 1, true),
  ('footballer', 'weekly_check_in', 'You stayed connected. That matters.', 1, true),
  ('footballer', 'weekly_check_in', 'Honest update received. Strong leadership.', 2, true),
  ('footballer', 'weekly_check_in', 'A messy week still deserves a post-match report.', 2, true),
  ('footballer', 'weekly_check_in', 'Photos uploaded. Progress documented.', 2, true),
  ('footballer', 'weekly_check_in', 'Trainer update viewed. Game plan acknowledged.', 3, true),
  ('footballer', 'weekly_check_in', 'You asked for support. That is smart play.', 3, true),
  ('footballer', 'weekly_check_in', 'The coaching staff appreciates context.', 3, true),

  ('footballer', 'nutrition', 'Meal admin completed. Good team logistics.', 1, true),
  ('footballer', 'nutrition', 'Fuel notes added. Game plan updated.', 1, true),
  ('footballer', 'nutrition', 'A rough log still helps the coach.', 1, true),
  ('footballer', 'nutrition', 'No judgement. Just useful match data.', 1, true),
  ('footballer', 'nutrition', 'Hydration check. Captain approves.', 2, true),
  ('footballer', 'nutrition', 'Planning ahead is proper squad behaviour.', 2, true),
  ('footballer', 'nutrition', 'Food notes are part of the preparation.', 3, true),
  ('footballer', 'nutrition', 'Good preparation makes match day easier.', 3, true),

  ('footballer', 'level_up', 'New Signing transformed into First-Team Regular. The boots are broken in. The confidence is settling.', 2, true),
  ('footballer', 'level_up', 'First-Team Regular transformed into Big Game Player. Big moments detected. Calm head activated.', 3, true),
  ('footballer', 'level_up', 'Big Game Player transformed into World Class. The touch is clean. The confidence is elite.', 4, true),
  ('footballer', 'level_up', 'World Class transformed into GOAT. Different level. Same calm reset.', 5, true),
  ('footballer', 'mastery', 'Your Footballer has reached GOAT status. From first signing to all-time great behaviour.', 5, true),

  ('footballer', 'bird_reaction', 'Elite ball-carrying ability.', 1, true),
  ('footballer', 'bird_reaction', 'Strong scouting reports.', 1, true),
  ('footballer', 'bird_reaction', 'Excellent team shape.', 1, true),

  ('footballer', 'dad_joke_reaction', 'That joke has been reviewed by VAR. Still terrible.', 1, true),
  ('footballer', 'dad_joke_reaction', 'Poor delivery. Excellent commitment.', 1, true),
  ('footballer', 'dad_joke_reaction', 'The dressing room laughed. Quietly.', 1, true),
  ('footballer', 'dad_joke_reaction', 'That joke was offside, but the attempt stands.', 1, true),

  ('footballer', 'word_reaction', 'Playing to the final whistle.', 1, true),
  ('footballer', 'word_reaction', 'One good touch becoming the next.', 1, true),
  ('footballer', 'word_reaction', 'Not forcing the pass.', 1, true);
