-- Store how a workout weight was logged so stats can handle dumbbell edge cases.

alter table public.client_program_set_logs
  add column if not exists weight_logging_mode text;

alter table public.client_program_set_logs
  drop constraint if exists client_program_set_logs_weight_logging_mode_check;

alter table public.client_program_set_logs
  add constraint client_program_set_logs_weight_logging_mode_check
  check (
    weight_logging_mode is null
    or weight_logging_mode in ('per_dumbbell', 'total')
  );
