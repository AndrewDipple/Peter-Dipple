-- Fill missing programme template workout locations so onboarding can offer
-- the correct day/location combinations.

update public.program_templates
set workout_location = 'gym'
where workout_location is null
  and lower(name) like '%gym%';

update public.program_templates
set workout_location = 'home_weights'
where workout_location is null
  and lower(name) like '%home%';
