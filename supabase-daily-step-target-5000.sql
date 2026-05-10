-- Set the default daily step target to 5,000 for new clients.
alter table public.clients
  alter column daily_step_target set default 5000;

-- Move existing clients on the old default to the new default.
-- Custom targets are left alone.
update public.clients
set daily_step_target = 5000
where daily_step_target is null
   or daily_step_target = 10000;
