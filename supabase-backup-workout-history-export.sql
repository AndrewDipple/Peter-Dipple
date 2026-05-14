-- Run this in a restored backup project/snapshot, not in the live project.
-- Replace the client id with the affected public.clients.id from live.
-- Export each result grid as CSV if you want to inspect before importing.

with target_client as (
  select 'PASTE_CLIENT_ID_HERE'::uuid as id
)
select cp.*
from public.client_programs cp
join target_client tc on tc.id = cp.client_id
order by cp.created_at;

with target_client as (
  select 'PASTE_CLIENT_ID_HERE'::uuid as id
)
select cpd.*
from public.client_program_days cpd
join public.client_programs cp on cp.id = cpd.client_program_id
join target_client tc on tc.id = cp.client_id
order by cp.created_at, cpd.sort_order;

with target_client as (
  select 'PASTE_CLIENT_ID_HERE'::uuid as id
)
select cpde.*
from public.client_program_day_exercises cpde
join public.client_program_days cpd on cpd.id = cpde.client_program_day_id
join public.client_programs cp on cp.id = cpd.client_program_id
join target_client tc on tc.id = cp.client_id
order by cp.created_at, cpd.sort_order, cpde.sort_order;

with target_client as (
  select 'PASTE_CLIENT_ID_HERE'::uuid as id
)
select cpsl.*
from public.client_program_set_logs cpsl
join target_client tc on tc.id = cpsl.client_id
order by cpsl.created_at;
