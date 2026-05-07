-- Plant Companion line bank.
-- Run after supabase-plant-companion.sql.

delete from public.companion_lines
where companion_slug = 'plant';

insert into public.companion_lines (
  companion_slug,
  category,
  text,
  is_active
)
values
  ('plant', 'general', 'Tiny Seed is resting. Growth begins quietly.', true),
  ('plant', 'general', 'Small start. Big potential.', true),
  ('plant', 'general', 'The soil feels promising today.', true),
  ('plant', 'general', 'Tiny Seed believes in gentle beginnings.', true),
  ('plant', 'general', 'Nothing dramatic. Just roots thinking about it.', true),
  ('plant', 'general', 'A small thing has started. That counts.', true),
  ('plant', 'general', 'Tiny Seed is not rushing. Wise behaviour.', true),
  ('plant', 'general', 'Growth has entered the chat, very softly.', true),
  ('plant', 'general', 'The Plant is here, quietly rooting for you.', true),
  ('plant', 'general', 'Small growth still counts.', true),
  ('plant', 'general', 'No rush. Just roots.', true),
  ('plant', 'general', 'The Plant believes today can be gentle and useful.', true),
  ('plant', 'general', 'Tiny wins make strong stems.', true),
  ('plant', 'general', 'The leaves have detected potential.', true),
  ('plant', 'general', 'You can begin softly.', true),
  ('plant', 'general', 'The Plant is calm. The Plant is ready.', true),

  ('plant', 'rest_timer', 'Rest now. Roots need time too.', true),
  ('plant', 'rest_timer', 'Breathe in. Grow slowly. Continue shortly.', true),
  ('plant', 'rest_timer', 'The next set can wait. The Plant says so gently.', true),
  ('plant', 'rest_timer', 'Rest is not wasted time. It is quiet preparation.', true),
  ('plant', 'rest_timer', 'Strong things grow between efforts.', true),
  ('plant', 'rest_timer', 'Tiny pause. Better next attempt.', true),
  ('plant', 'rest_timer', 'The Plant recommends hydration and calm breathing.', true),
  ('plant', 'rest_timer', 'Recovery is part of the routine.', true),
  ('plant', 'rest_timer', 'Do not rush the roots.', true),
  ('plant', 'rest_timer', 'A short rest. A small reset. Very sensible.', true),
  ('plant', 'rest_timer', 'The timer is watering your patience.', true),
  ('plant', 'rest_timer', 'Rest softly. Return steadily.', true),

  ('plant', 'weekly_check_in', 'Check-in complete. The roots appreciate honesty.', true),
  ('plant', 'weekly_check_in', 'Feedback submitted. Growth data received.', true),
  ('plant', 'weekly_check_in', 'A thoughtful update has been planted.', true),
  ('plant', 'weekly_check_in', 'You shared how things are going. That matters.', true),
  ('plant', 'weekly_check_in', 'The Plant respects reflection.', true),
  ('plant', 'weekly_check_in', 'A messy week can still grow something useful.', true),
  ('plant', 'weekly_check_in', 'The Plant has absorbed the update.', true),
  ('plant', 'weekly_check_in', 'Tiny honesty. Strong roots.', true),
  ('plant', 'weekly_check_in', 'You stayed connected. The leaves approve.', true),

  ('plant', 'milestone', 'Photos uploaded. Progress has been documented gently.', true),
  ('plant', 'milestone', 'The tiny seed became a mighty thing.', true),
  ('plant', 'milestone', 'Growth complete. Support continues.', true),
  ('plant', 'milestone', 'Mighty Oak stands proudly in your collection.', true),

  ('plant', 'nutrition', 'Hydration is basically plant friendship.', true),
  ('plant', 'nutrition', 'A planned meal is a little act of care.', true),
  ('plant', 'nutrition', 'No judgement. Just useful information.', true),
  ('plant', 'nutrition', 'Food admin completed. The Plant respects preparation.', true),
  ('plant', 'nutrition', 'A roughly logged meal still helps the garden.', true),
  ('plant', 'nutrition', 'Tiny meal notes can grow into useful patterns.', true),
  ('plant', 'nutrition', 'The Plant believes snacks deserve structure too.', true),
  ('plant', 'nutrition', 'Gentle planning. Stronger roots.', true),

  ('plant', 'level_up', 'Tiny Seed became Little Sprout. A tiny leaf has appeared. Emotionally significant.', true),
  ('plant', 'level_up', 'Little Sprout became Happy Houseplant. It has found a pot, a window, and some quiet confidence.', true),
  ('plant', 'level_up', 'Happy Houseplant became Strong Vine. The roots are steady. The leaves are ambitious.', true),
  ('plant', 'level_up', 'Strong Vine became Mighty Oak. Small beginnings have become something strong.', true),
  ('plant', 'mastery', 'The Plant has reached full growth. It will now live forever in your collection, calmly judging your hydration.', true),

  ('plant', 'bird_reaction', 'The Plant respects practical preparation.', true),
  ('plant', 'bird_reaction', 'The Plant respects long-term memory.', true),
  ('plant', 'bird_reaction', 'The Plant respects community warmth.', true),

  ('plant', 'dad_joke_reaction', 'The Plant enjoyed that quietly.', true),
  ('plant', 'dad_joke_reaction', 'A terrible joke. Still compostable.', true),
  ('plant', 'dad_joke_reaction', 'The Plant has chosen to grow past this.', true),
  ('plant', 'dad_joke_reaction', 'That joke was dry. Please water it.', true),

  ('plant', 'word_reaction', 'The Plant calls this roots staying put.', true),
  ('plant', 'word_reaction', 'The Plant calls this one leaf becoming two.', true),
  ('plant', 'word_reaction', 'The Plant has been training for this one.', true);
