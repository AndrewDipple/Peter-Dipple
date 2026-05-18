-- Staff notifications for clients inactive for 7+ days.
-- Run in Supabase SQL Editor.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.clients
  add column if not exists last_seen_at timestamptz;

create index if not exists clients_last_seen_at_idx
  on public.clients (last_seen_at desc);

update public.clients c
set last_seen_at = p.last_sign_in_at
from public.profiles p
where c.profile_id = p.id
  and c.last_seen_at is null
  and p.last_sign_in_at is not null;

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

create or replace function public.notify_staff_client_inactivity(
  p_days_threshold integer default 7
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inactive_client record;
  staff_profile record;
  notification_link text;
  notification_message text;
  inserted_count integer := 0;
begin
  if not public.app_is_staff() then
    raise exception 'Only staff can create inactivity notifications';
  end if;

  for inactive_client in
    select
      c.id,
      c.full_name,
      c.created_at,
      c.last_seen_at,
      p.last_sign_in_at,
      coalesce(c.last_seen_at, p.last_sign_in_at, c.created_at) as last_activity_at,
      greatest(
        p_days_threshold,
        floor(
          extract(
            epoch from (
              now() - coalesce(c.last_seen_at, p.last_sign_in_at, c.created_at)
            )
          ) / 86400
        )::integer
      ) as days_inactive
    from public.clients c
    left join public.profiles p on p.id = c.profile_id
    where coalesce(c.last_seen_at, p.last_sign_in_at, c.created_at) <=
      now() - make_interval(days => p_days_threshold)
  loop
    notification_link := '/trainer/clients/' || inactive_client.id::text;
    notification_message :=
      inactive_client.full_name || ' has not opened the app for ' ||
      inactive_client.days_inactive::text || ' days';

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
        'client_inactive',
        'Client inactive',
        notification_message,
        notification_link
      where not exists (
        select 1
        from public.notifications existing
        where existing.user_id = staff_profile.id
          and existing.type = 'client_inactive'
          and existing.link = notification_link
          and existing.created_at >= now() - interval '7 days'
      );

      if found then
        inserted_count := inserted_count + 1;
      end if;
    end loop;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.notify_staff_client_inactivity(integer) from public;
grant execute on function public.notify_staff_client_inactivity(integer) to authenticated;

create or replace function public.touch_client_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
  set last_seen_at = now()
  where profile_id = auth.uid();
end;
$$;

revoke all on function public.touch_client_last_seen() from public;
grant execute on function public.touch_client_last_seen() to authenticated;
