-- Replace this with the affected client's public.clients.id.
-- You can find it from the trainer client URL or the clients table.
with target_client as (
  select 'PASTE_CLIENT_ID_HERE'::uuid as id
),
programs as (
  select cp.*
  from public.client_programs cp
  join target_client tc on tc.id = cp.client_id
),
days as (
  select cpd.*
  from public.client_program_days cpd
  join programs cp on cp.id = cpd.client_program_id
),
exercises as (
  select cpde.*
  from public.client_program_day_exercises cpde
  join days d on d.id = cpde.client_program_day_id
),
logs as (
  select cpsl.*
  from public.client_program_set_logs cpsl
  join target_client tc on tc.id = cpsl.client_id
)
select 'client_programs' as section, count(*) as row_count from programs
union all
select 'client_program_days', count(*) from days
union all
select 'client_program_day_exercises', count(*) from exercises
union all
select 'client_program_set_logs', count(*) from logs
union all
select 'archived_client_program_day_exercises', count(*)
from exercises
where coalesce(is_archived, false) = true;

-- Recent set logs. If this returns rows, the history still exists.
with target_client as (
  select 'PASTE_CLIENT_ID_HERE'::uuid as id
)
select
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
from public.client_program_set_logs cpsl
left join public.client_program_day_exercises cpde
  on cpde.id = cpsl.client_program_day_exercise_id
join target_client tc
  on tc.id = cpsl.client_id
order by cpsl.created_at desc
limit 50;
