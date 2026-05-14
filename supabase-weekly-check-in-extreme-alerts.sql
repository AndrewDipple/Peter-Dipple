-- Staff alerts for concerning weekly check-in values.
-- Run after supabase-weekly-check-in-notifications.sql.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'program_assigned',
      'milestone_due',
      'milestone_completed',
      'client_inactive',
      'streak_reminder',
      'client_message',
      'weekly_check_in_submitted',
      'weekly_check_in_alert'
    )
  );

create or replace function public.notify_staff_weekly_check_in_alerts(
  p_client_id uuid,
  p_week_start date,
  p_energy_level integer,
  p_hunger_level integer,
  p_motivation_level integer,
  p_soreness_level integer,
  p_sleep_quality integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  client_name text;
  notification_link text;
  alert_items text[] := array[]::text[];
  notification_message text;
  staff_profile record;
begin
  if not (public.app_owns_client(p_client_id) or public.app_is_staff()) then
    raise exception 'Not allowed to notify staff for this client';
  end if;

  select full_name
  into client_name
  from public.clients
  where id = p_client_id;

  if client_name is null then
    raise exception 'Client not found';
  end if;

  if p_energy_level <= 1 then
    alert_items := alert_items || 'energy very low';
  end if;

  if p_motivation_level <= 1 then
    alert_items := alert_items || 'motivation very low';
  end if;

  if p_sleep_quality <= 1 then
    alert_items := alert_items || 'sleep very poor';
  end if;

  if p_soreness_level >= 5 then
    alert_items := alert_items || 'soreness very high';
  end if;

  if p_hunger_level >= 5 then
    alert_items := alert_items || 'hunger very high';
  end if;

  if array_length(alert_items, 1) is null then
    return;
  end if;

  notification_link := '/trainer/clients/' || p_client_id::text;
  notification_message :=
    client_name || ' submitted concerning weekly check-in values for week starting ' ||
    to_char(p_week_start, 'DD Mon YYYY') || ': ' ||
    array_to_string(alert_items, ', ');

  for staff_profile in
    select id
    from public.profiles
    where role in ('trainer', 'admin')
  loop
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    select
      staff_profile.id,
      'weekly_check_in_alert',
      'Check-in needs attention',
      notification_message,
      notification_link
    where not exists (
      select 1
      from public.notifications existing
      where existing.user_id = staff_profile.id
        and existing.type = 'weekly_check_in_alert'
        and existing.message = notification_message
        and existing.link = notification_link
    );
  end loop;
end;
$$;

revoke all on function public.notify_staff_weekly_check_in_alerts(
  uuid,
  date,
  integer,
  integer,
  integer,
  integer,
  integer
) from public;

grant execute on function public.notify_staff_weekly_check_in_alerts(
  uuid,
  date,
  integer,
  integer,
  integer,
  integer,
  integer
) to authenticated;
