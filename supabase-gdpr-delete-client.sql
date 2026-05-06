-- GDPR client deletion helper.
-- Run this in Supabase before using the one-click delete button.

create or replace function public.admin_delete_client_data(target_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
begin
  select profile_id
    into target_profile_id
  from public.clients
  where id = target_client_id;

  if target_profile_id is null then
    raise exception 'Client % not found or has no profile_id', target_client_id;
  end if;

  -- Tables with direct client_id links.
  if to_regclass('public.client_program_set_logs') is not null then
    delete from public.client_program_set_logs where client_id = target_client_id;
  end if;

  if to_regclass('public.workout_set_logs') is not null then
    delete from public.workout_set_logs where client_id = target_client_id;
  end if;

  if to_regclass('public.client_workout_completions') is not null then
    delete from public.client_workout_completions where client_id = target_client_id;
  end if;

  if to_regclass('public.workout_progress') is not null then
    delete from public.workout_progress where client_id = target_client_id;
  end if;

  if to_regclass('public.client_workout_day_progress') is not null then
    delete from public.client_workout_day_progress where client_id = target_client_id;
  end if;

  if to_regclass('public.meal_logs') is not null then
    delete from public.meal_logs where client_id = target_client_id;
  end if;

  if to_regclass('public.custom_meal_logs') is not null then
    delete from public.custom_meal_logs where client_id = target_client_id;
  end if;

  if to_regclass('public.meal_plans') is not null then
    delete from public.meal_plans where client_id = target_client_id;
  end if;

  if to_regclass('public.daily_tracking') is not null then
    delete from public.daily_tracking where client_id = target_client_id;
  end if;

  if to_regclass('public.client_weight_logs') is not null then
    delete from public.client_weight_logs where client_id = target_client_id;
  end if;

  if to_regclass('public.client_measurement_logs') is not null then
    delete from public.client_measurement_logs where client_id = target_client_id;
  end if;

  if to_regclass('public.progress_photos') is not null then
    delete from public.progress_photos where client_id = target_client_id;
  end if;

  if to_regclass('public.client_messages') is not null then
    delete from public.client_messages where client_id = target_client_id;
  end if;

  if to_regclass('public.client_milestones') is not null then
    delete from public.client_milestones where client_id = target_client_id;
  end if;

  if to_regclass('public.client_achievements') is not null then
    delete from public.client_achievements where client_id = target_client_id;
  end if;

  if to_regclass('public.client_streaks') is not null then
    delete from public.client_streaks where client_id = target_client_id;
  end if;

  if to_regclass('public.client_weekly_check_ins') is not null then
    execute 'delete from public.client_weekly_check_ins where client_id = $1'
    using target_client_id;
  end if;

  if to_regclass('public.weekly_check_ins') is not null then
    execute 'delete from public.weekly_check_ins where client_id = $1'
    using target_client_id;
  end if;

  if to_regclass('public.companion_events') is not null then
    delete from public.companion_events where client_id = target_client_id;
  end if;

  if to_regclass('public.client_companions') is not null then
    delete from public.client_companions where client_id = target_client_id;
  end if;

  -- Program children link through client_programs.
  if to_regclass('public.client_program_day_exercises') is not null then
    delete from public.client_program_day_exercises
    where client_program_day_id in (
      select cpd.id
      from public.client_program_days cpd
      join public.client_programs cp on cp.id = cpd.client_program_id
      where cp.client_id = target_client_id
    );
  end if;

  if to_regclass('public.client_program_days') is not null then
    delete from public.client_program_days
    where client_program_id in (
      select id from public.client_programs where client_id = target_client_id
    );
  end if;

  if to_regclass('public.client_programs') is not null then
    delete from public.client_programs where client_id = target_client_id;
  end if;

  -- Profile-owned app records.
  if to_regclass('public.notifications') is not null then
    delete from public.notifications where user_id = target_profile_id;
  end if;

  if to_regclass('public.feedback') is not null then
    delete from public.feedback where user_id = target_profile_id;
  end if;

  delete from public.clients where id = target_client_id;
  delete from public.profiles where id = target_profile_id;
end;
$$;

revoke all on function public.admin_delete_client_data(uuid) from public;
grant execute on function public.admin_delete_client_data(uuid) to authenticated;
