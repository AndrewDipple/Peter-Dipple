-- Supports replacing an exercise in a client's active programme without
-- relabelling historical set logs attached to the original row.

alter table public.client_program_day_exercises
  add column if not exists is_archived boolean not null default false;

alter table public.client_program_day_exercises
  add column if not exists archived_at timestamptz;

alter table public.client_program_day_exercises
  add column if not exists replaced_by_exercise_id uuid references public.exercises(id);

alter table public.client_program_day_exercises
  add column if not exists replacement_client_program_day_exercise_id uuid references public.client_program_day_exercises(id);

create index if not exists idx_client_program_day_exercises_active_day
  on public.client_program_day_exercises (client_program_day_id, is_archived, sort_order);
