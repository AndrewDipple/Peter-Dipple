-- Use the affected client's public.clients.profile_id here.
-- This checks whether workout logs exist under another client row for the same auth profile.
with target_profile as (
  select 'PASTE_PROFILE_ID_HERE'::uuid as id
),
matching_clients as (
  select c.id, c.profile_id, c.full_name, c.created_at
  from public.clients c
  join target_profile tp on tp.id = c.profile_id
)
select
  c.id as client_id,
  c.profile_id,
  c.full_name,
  c.created_at as client_created_at,
  count(distinct cp.id) as programme_count,
  count(distinct cpd.id) as programme_day_count,
  count(distinct cpde.id) as programme_exercise_count,
  count(distinct cpsl.id) as set_log_count,
  max(cpsl.created_at) as latest_set_log_created_at
from matching_clients c
left join public.client_programs cp
  on cp.client_id = c.id
left join public.client_program_days cpd
  on cpd.client_program_id = cp.id
left join public.client_program_day_exercises cpde
  on cpde.client_program_day_id = cpd.id
left join public.client_program_set_logs cpsl
  on cpsl.client_id = c.id
group by c.id, c.profile_id, c.full_name, c.created_at
order by latest_set_log_created_at desc nulls last, c.created_at desc;

-- Recent logs across every client row for that profile.
with target_profile as (
  select 'PASTE_PROFILE_ID_HERE'::uuid as id
),
matching_clients as (
  select c.id, c.profile_id, c.full_name
  from public.clients c
  join target_profile tp on tp.id = c.profile_id
)
select
  c.id as client_id,
  c.full_name,
  cpsl.created_at,
  cpsl.log_date,
  cpsl.client_program_id,
  cpsl.client_program_day_id,
  cpsl.client_program_day_exercise_id,
  cpde.exercise_name,
  coalesce(cpde.is_archived, false) as exercise_is_archived,
  cpsl.set_number,
  cpsl.actual_weight_kg,
  cpsl.actual_reps,
  cpsl.completed
from matching_clients c
join public.client_program_set_logs cpsl
  on cpsl.client_id = c.id
left join public.client_program_day_exercises cpde
  on cpde.id = cpsl.client_program_day_exercise_id
order by cpsl.created_at desc
limit 100;
