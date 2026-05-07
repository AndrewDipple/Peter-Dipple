-- Cat Companion line bank.
-- Run after supabase-cat-companion.sql.

delete from public.companion_lines
where companion_slug = 'cat';

insert into public.companion_lines (
  companion_slug,
  category,
  text,
  is_active
)
values
  ('cat', 'general', 'I have inspected your app usage. Acceptable.', true),
  ('cat', 'general', 'You may proceed. I am watching, for reasons unrelated to concern.', true),
  ('cat', 'general', 'A small amount of progress has occurred. I noticed nothing. Obviously.', true),
  ('cat', 'general', 'I was not waiting for you. I was merely positioned here.', true),
  ('cat', 'general', 'Your presence has been acknowledged.', true),
  ('cat', 'general', 'Fine. I am pleased. Briefly.', true),
  ('cat', 'general', 'This app has been improved by my supervision.', true),
  ('cat', 'general', 'I have reviewed the situation and will permit optimism.', true),
  ('cat', 'general', 'Unexpectedly competent behaviour detected.', true),
  ('cat', 'general', 'Continue, human. You have my mild approval.', true),

  ('cat', 'rest_timer', 'Rest now. Even superior creatures pause.', true),
  ('cat', 'rest_timer', 'Do not rush. That would be very dog of you.', true),
  ('cat', 'rest_timer', 'Breathe. Compose yourself. Look mysterious.', true),
  ('cat', 'rest_timer', 'The next set can wait. I require ambience.', true),
  ('cat', 'rest_timer', 'Resting is strategic. I invented it.', true),
  ('cat', 'rest_timer', 'You have ninety seconds to become more dramatic.', true),
  ('cat', 'rest_timer', 'Do not skip rest. I am comfortable here.', true),
  ('cat', 'rest_timer', 'The weights are not leaving. I checked.', true),
  ('cat', 'rest_timer', 'Recover properly. I dislike sloppy sequels.', true),
  ('cat', 'rest_timer', 'A pause is not defeat. It is a cat-approved tactic.', true),

  ('cat', 'weekly_check_in', 'An update has been submitted. I shall pretend not to be proud.', true),
  ('cat', 'weekly_check_in', 'Reflection complete. Very mature. Slightly suspicious.', true),
  ('cat', 'weekly_check_in', 'You shared useful information. Excellent human behaviour.', true),
  ('cat', 'weekly_check_in', 'I have filed this under: progress, probably.', true),
  ('cat', 'weekly_check_in', 'A thoughtful update. I may sit near you later.', true),
  ('cat', 'weekly_check_in', 'You communicated instead of vanishing. Bold. Correct.', true),
  ('cat', 'weekly_check_in', 'Your honesty has been noted and quietly respected.', true),
  ('cat', 'weekly_check_in', 'Even messy weeks deserve a check-in. I approve.', true),
  ('cat', 'weekly_check_in', 'Information shared. Coaching magic may now occur.', true),
  ('cat', 'weekly_check_in', 'You have done the admin. I am forced to respect it.', true),

  ('cat', 'feedback', 'You replied. Communication has occurred. Civilisation continues.', true),
  ('cat', 'feedback', 'Trainer feedback viewed. I watched you become responsible.', true),
  ('cat', 'feedback', 'A response was sent. I am almost impressed.', true),
  ('cat', 'feedback', 'You asked for help. Excellent. Even cats require doors opened.', true),
  ('cat', 'feedback', 'Update read. The tiny council is pleased.', true),
  ('cat', 'feedback', 'You have engaged with the process. Fine work.', true),
  ('cat', 'feedback', 'I respect a well-timed message.', true),
  ('cat', 'feedback', 'You did not simply disappear. This pleases the cat.', true),

  ('cat', 'nutrition', 'Meal admin detected. I respect organised snacking.', true),
  ('cat', 'nutrition', 'A roughly logged meal is still useful. I permit imperfection.', true),
  ('cat', 'nutrition', 'Food information entered. The tiny clipboard is satisfied.', true),
  ('cat', 'nutrition', 'Nutrition does not require drama. Unless I am hungry.', true),
  ('cat', 'nutrition', 'You logged something. Useful. Not glamorous, but useful.', true),
  ('cat', 'nutrition', 'I have inspected the meal. It appears edible.', true),
  ('cat', 'nutrition', 'Planning food ahead is suspiciously clever.', true),
  ('cat', 'nutrition', 'The recipe has been observed. I may steal a corner.', true),
  ('cat', 'nutrition', 'Hydration is wise. Also, bowls are underrated.', true),
  ('cat', 'nutrition', 'No judgement. Only data. And possibly crumbs.', true),

  ('cat', 'level_up', 'Sleepy Kitten became Curious Cat. It has opened one eye. This is serious.', true),
  ('cat', 'level_up', 'Curious Cat became Gym Cat. It has acquired a sweatband and dangerous confidence.', true),
  ('cat', 'level_up', 'Gym Cat became Panther Mode. The room lighting has become unnecessarily dramatic.', true),
  ('cat', 'level_up', 'Panther Mode became King of the Jungle. Bowing is optional, but noticed.', true),
  ('cat', 'mastery', 'The Cat has reached its final glory. It was proud of you the whole time, allegedly.', true),

  ('cat', 'bird_reaction', 'Efficient. Mildly impressive.', true),
  ('cat', 'bird_reaction', 'Good. Surveillance matters.', true),
  ('cat', 'bird_reaction', 'Group loafing. Advanced technique.', true),
  ('cat', 'bird_reaction', 'Useful for judging people behind you.', true),
  ('cat', 'bird_reaction', 'Too much effort. Respectfully.', true),

  ('cat', 'dad_joke_reaction', 'I heard the joke. I will be contacting management.', true),
  ('cat', 'dad_joke_reaction', 'That joke was beneath me. I laughed once.', true),
  ('cat', 'dad_joke_reaction', 'Unacceptable. Again.', true),
  ('cat', 'dad_joke_reaction', 'I have left the room emotionally.', true),
  ('cat', 'dad_joke_reaction', 'A terrible joke. Continue.', true),

  ('cat', 'word_reaction', 'Stubbornness, but with better branding.', true),
  ('cat', 'word_reaction', 'Like knocking one thing off a shelf, then many.', true),
  ('cat', 'word_reaction', 'I practise this while waiting for food.', true);
