-- Staff notifications for submitted weekly check-ins.
-- Run in Supabase SQL Editor.

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
      'weekly_check_in_submitted'
    )
  );

create or replace function public.notify_staff_weekly_check_in(
  p_client_id uuid,
  p_week_start date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  client_name text;
  notification_link text;
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

  notification_link := '/trainer/clients/' || p_client_id::text;
  notification_message :=
    client_name || ' submitted their weekly check-in for week starting ' ||
    to_char(p_week_start, 'DD Mon YYYY');

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
      'weekly_check_in_submitted',
      'Weekly check-in submitted',
      notification_message,
      notification_link
    where not exists (
      select 1
      from public.notifications existing
      where existing.user_id = staff_profile.id
        and existing.type = 'weekly_check_in_submitted'
        and existing.message = notification_message
        and existing.link = notification_link
    );
  end loop;
end;
$$;

revoke all on function public.notify_staff_weekly_check_in(uuid, date) from public;
grant execute on function public.notify_staff_weekly_check_in(uuid, date) to authenticated;
