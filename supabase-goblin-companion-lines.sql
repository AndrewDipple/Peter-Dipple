-- Goblin companion line bank.
-- Path name: Goblin. Default name: Greg.
-- Run after supabase-greg-goblin-companion.sql.

delete from public.companion_lines
where companion_slug = 'goblin';

insert into public.companion_lines (
  companion_slug,
  category,
  text,
  is_active
)
values
  ('goblin', 'general', 'Greg has arrived. Nobody panic. Probably.', true),
  ('goblin', 'general', 'Tiny fist raised. Situation improved.', true),
  ('goblin', 'general', 'Greg has located the shaker. This feels important.', true),
  ('goblin', 'general', 'Small goblin. Big emotional support.', true),
  ('goblin', 'general', 'Greg is supervising from floor level.', true),
  ('goblin', 'general', 'This is Greg''s first day being powerful. Be patient.', true),
  ('goblin', 'general', 'Greg believes in you with unnecessary intensity.', true),
  ('goblin', 'general', 'Tiny chaos has entered the chat.', true),
  ('goblin', 'general', 'Greg is here. The vibes are managed.', true),
  ('goblin', 'general', 'Tiny wins count. Greg has a calculator.', true),
  ('goblin', 'general', 'One small step. One dramatic goblin reaction.', true),

  ('goblin', 'rest_timer', 'Rest time. Do not negotiate with the dumbbells.', true),
  ('goblin', 'rest_timer', 'Breathe. The weights are not escaping.', true),
  ('goblin', 'rest_timer', 'Greg is timing this. Very official.', true),
  ('goblin', 'rest_timer', 'Sit down with purpose.', true),
  ('goblin', 'rest_timer', 'Rest properly. Greg has concerns.', true),
  ('goblin', 'rest_timer', 'This pause is part of the plan. Greg checked.', true),
  ('goblin', 'rest_timer', 'Do not rush. Greg is watching the clock dramatically.', true),
  ('goblin', 'rest_timer', 'Recover now. Chaos later.', true),
  ('goblin', 'rest_timer', 'The next set can wait. Greg has spoken.', true),
  ('goblin', 'rest_timer', 'Rest is training wearing a tiny disguise.', true),
  ('goblin', 'rest_timer', 'Hydrate. Greg will stare until you do.', true),
  ('goblin', 'rest_timer', 'The muscles are buffering.', true),

  ('goblin', 'weekly_check_in', 'Feedback submitted. Greg respects communication.', true),
  ('goblin', 'weekly_check_in', 'Reflection complete. Emotionally significant.', true),
  ('goblin', 'weekly_check_in', 'You shared useful information. Greg is nodding like he understands forms.', true),
  ('goblin', 'weekly_check_in', 'Tiny admin completed. Greg respects the paperwork.', true),
  ('goblin', 'weekly_check_in', 'You checked in. The goblin bond grows stronger.', true),
  ('goblin', 'weekly_check_in', 'Honest update received. Greg approves.', true),
  ('goblin', 'weekly_check_in', 'A messy week still deserves a check-in. Greg knows this.', true),
  ('goblin', 'weekly_check_in', 'Information shared. Coaching magic may now occur.', true),
  ('goblin', 'weekly_check_in', 'Greg has filed this under: useful human data.', true),

  ('goblin', 'milestone', 'Photos uploaded. Greg salutes the documentation.', true),
  ('goblin', 'milestone', 'A tiny win has been detected. The kingdom celebrates.', true),
  ('goblin', 'milestone', 'The Overlord has reviewed your tiny wins. Approved.', true),
  ('goblin', 'milestone', 'Overlord Greg respects the process.', true),

  ('goblin', 'nutrition', 'A roughly logged meal is better than a mysteriously vanished one.', true),
  ('goblin', 'nutrition', 'Meal admin detected. Greg respects the effort.', true),
  ('goblin', 'nutrition', 'Food information entered. Very grown-up. Very suspicious.', true),
  ('goblin', 'nutrition', 'Greg respects the meal prep.', true),
  ('goblin', 'nutrition', 'No judgement. Only data and possibly snacks.', true),
  ('goblin', 'nutrition', 'Greg has reviewed the meal. It appears powerful.', true),
  ('goblin', 'nutrition', 'Logged is better than perfect. Greg approves.', true),
  ('goblin', 'nutrition', 'Snack Greg would like everyone to know snacks are serious.', true),

  ('goblin', 'level_up', 'Pocket Greg became Snack Greg. He has acquired a snack, a clipboard, and dangerous organisational confidence.', true),
  ('goblin', 'level_up', 'Snack Greg became Gym Greg. He has joined the gym properly and immediately developed opinions.', true),
  ('goblin', 'level_up', 'Gym Greg became Swole Greg. The biceps have arrived. The sleeves are nervous.', true),
  ('goblin', 'level_up', 'Swole Greg became Goblin Overlord Greg. He has promoted himself to manager of rest timers and tiny wins.', true),
  ('goblin', 'mastery', 'Greg has reached peak chaos. He will now live forever in your collection, probably holding a clipboard.', true),

  ('goblin', 'bird_reaction', 'Greg respects the meal prep.', true),
  ('goblin', 'bird_reaction', 'Greg respects a bird with records.', true),
  ('goblin', 'bird_reaction', 'Greg respects group rest strategy.', true),

  ('goblin', 'dad_joke_reaction', 'Greg does not understand the joke, but Greg supports the structure.', true),
  ('goblin', 'dad_joke_reaction', 'That joke was terrible. Greg respects the commitment.', true),
  ('goblin', 'dad_joke_reaction', 'Greg laughed. Nobody can prove otherwise.', true),
  ('goblin', 'dad_joke_reaction', 'Dad joke detected. Morale somehow increased.', true),

  ('goblin', 'word_reaction', 'Greg calls this refusing to vanish.', true),
  ('goblin', 'word_reaction', 'Greg calls this tiny wins rolling downhill.', true),
  ('goblin', 'word_reaction', 'Greg is still learning this one.', true);
