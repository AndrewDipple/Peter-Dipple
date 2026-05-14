-- Companion progression nudge lines.
-- Run after the companion line-bank SQL files.
-- Only refreshes category = progression_nudge.

alter table public.companion_lines
  add column if not exists min_form_number integer not null default 1;

delete from public.companion_lines
where category = 'progression_nudge'
  and companion_slug in ('goblin', 'footballer', 'plant', 'bread', 'cat', 'frog');

insert into public.companion_lines (
  companion_slug,
  category,
  text,
  min_form_number,
  is_active
)
values
  ('goblin', 'progression_nudge', '{name} noticed {weight}kg {mode} for {sessions} sessions. Dangerous confidence detected. Tiny upgrade to {suggestedWeight}kg?', 1, true),
  ('goblin', 'progression_nudge', '{name} has reviewed the numbers. Same {weight}kg {mode}, {sessions} times. The clipboard suggests {suggestedWeight}kg, if bravery is available.', 1, true),
  ('goblin', 'progression_nudge', '{name} respects repeated effort. {weight}kg {mode} has been handled several times. Maybe {suggestedWeight}kg gets a tiny investigation?', 1, true),
  ('goblin', 'progression_nudge', '{name} is not saying you must. {name} is saying {suggestedWeight}kg is looking suspiciously possible.', 1, true),
  ('goblin', 'progression_nudge', '{sessions} solid sessions at {weight}kg {mode}. {name} points dramatically at {suggestedWeight}kg.', 1, true),

  ('footballer', 'progression_nudge', 'You have had {sessions} solid outings at {weight}kg {mode}. Fresh legs, same control: maybe {suggestedWeight}kg gets a run?', 1, true),
  ('footballer', 'progression_nudge', '{weight}kg has been reliable for {sessions} sessions. Big game players know when to step it up. Fancy trying {suggestedWeight}kg?', 1, true),
  ('footballer', 'progression_nudge', 'Good shift at {weight}kg, again and again. If it feels right today, {suggestedWeight}kg could be the next move.', 1, true),
  ('footballer', 'progression_nudge', 'The form book says {weight}kg has been handled. Next fixture: maybe {suggestedWeight}kg.', 1, true),
  ('footballer', 'progression_nudge', '{sessions} steady performances at {weight}kg. No pressure, but {suggestedWeight}kg is warming up on the touchline.', 1, true),

  ('plant', 'progression_nudge', 'You have grown comfortable with {weight}kg {mode}. If today feels steady, {suggestedWeight}kg might be the next small leaf.', 1, true),
  ('plant', 'progression_nudge', '{sessions} sessions at {weight}kg shows steady roots. A gentle move to {suggestedWeight}kg could be worth exploring.', 1, true),
  ('plant', 'progression_nudge', 'The Plant has noticed consistency at {weight}kg. No rush, but {suggestedWeight}kg may be ready to sprout.', 1, true),
  ('plant', 'progression_nudge', 'Strong roots, calm progress. After {sessions} sessions at {weight}kg, {suggestedWeight}kg could be a sensible next step.', 1, true),
  ('plant', 'progression_nudge', '{weight}kg has been watered patiently. If conditions feel good, try letting it grow to {suggestedWeight}kg.', 1, true),

  ('bread', 'progression_nudge', '{weight}kg has been nicely toasted for {sessions} sessions. Maybe it is time to rise to {suggestedWeight}kg?', 1, true),
  ('bread', 'progression_nudge', 'Same weight, steady effort, excellent crumb structure. {suggestedWeight}kg could be the next bake.', 1, true),
  ('bread', 'progression_nudge', '{weight}kg is looking well handled. If today feels good, pop {suggestedWeight}kg in the oven.', 1, true),
  ('bread', 'progression_nudge', '{sessions} sessions at {weight}kg. The loaf has risen. Tiny jump to {suggestedWeight}kg?', 1, true),
  ('bread', 'progression_nudge', 'You have been baking consistency at {weight}kg. No pressure, but {suggestedWeight}kg smells like progress.', 1, true),

  ('cat', 'progression_nudge', '{weight}kg for {sessions} sessions. I have inspected the evidence. {suggestedWeight}kg may be acceptable.', 1, true),
  ('cat', 'progression_nudge', 'You appear to have become comfortable with {weight}kg. I suppose {suggestedWeight}kg deserves consideration.', 1, true),
  ('cat', 'progression_nudge', '{sessions} repeated efforts at {weight}kg. Interesting. I am not impressed, obviously. Try {suggestedWeight}kg if appropriate.', 1, true),
  ('cat', 'progression_nudge', '{weight}kg has been handled with suspicious consistency. I will permit an attempt at {suggestedWeight}kg.', 1, true),
  ('cat', 'progression_nudge', 'The numbers suggest {suggestedWeight}kg. I did not say this emotionally. I simply observed it.', 1, true),

  ('frog', 'progression_nudge', '{weight}kg has been steady for {sessions} sessions. Small hop to {suggestedWeight}kg, if the pond feels calm?', 1, true),
  ('frog', 'progression_nudge', 'Frog has seen the pattern. {weight}kg is familiar now. Maybe {suggestedWeight}kg is the next lily pad.', 1, true),
  ('frog', 'progression_nudge', 'You do not need a big leap. Just a careful hop from {weight}kg to {suggestedWeight}kg.', 1, true),
  ('frog', 'progression_nudge', '{sessions} steady sessions at {weight}kg. The swamp whispers: {suggestedWeight}kg might be next.', 1, true),
  ('frog', 'progression_nudge', 'Calm body, careful form, tiny hop. If {weight}kg feels ready, try {suggestedWeight}kg.', 1, true);
