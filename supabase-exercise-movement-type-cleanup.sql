-- Normalise exercise movement_type values.
-- Safe to rerun.

update public.exercises
set movement_type = null
where movement_type is not null
  and trim(movement_type) = '';

update public.exercises
set movement_type = case lower(trim(movement_type))
  when 'full body' then 'Full body'
  when 'lower body' then 'Lower body'
  when 'upper body' then 'Upper body'
  when 'upper pull' then 'Upper pull'
  when 'upper push' then 'Upper push'
  else trim(movement_type)
end
where movement_type is not null;

select movement_type, count(*) as exercise_count
from public.exercises
group by movement_type
order by movement_type nulls last;
