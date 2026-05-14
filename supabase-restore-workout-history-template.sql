-- Template for importing recovered workout history into live.
-- Best route: restore/clone the backup to a temporary Supabase project, export
-- the four result sets from supabase-backup-workout-history-export.sql, then
-- import them into temporary tables in live and run the inserts below.
--
-- Create temp tables with the same shape as the live tables:
-- create temporary table recovered_client_programs
--   (like public.client_programs including defaults);
-- create temporary table recovered_client_program_days
--   (like public.client_program_days including defaults);
-- create temporary table recovered_client_program_day_exercises
--   (like public.client_program_day_exercises including defaults);
-- create temporary table recovered_client_program_set_logs
--   (like public.client_program_set_logs including defaults);
--
-- Then use Supabase table editor/SQL tools to load the exported CSVs into
-- those temporary tables before running:

begin;

insert into public.client_programs
select *
from recovered_client_programs
on conflict (id) do nothing;

insert into public.client_program_days
select *
from recovered_client_program_days
on conflict (id) do nothing;

insert into public.client_program_day_exercises
select *
from recovered_client_program_day_exercises
on conflict (id) do nothing;

insert into public.client_program_set_logs
select *
from recovered_client_program_set_logs
on conflict (id) do nothing;

commit;
