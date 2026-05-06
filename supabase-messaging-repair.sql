-- Repair client/trainer messaging after core RLS hardening.
-- Run in Supabase SQL Editor.

-- Clients need a safe way to mark trainer replies as read without broad
-- message update access.
create or replace function public.mark_client_trainer_replies_read(message_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.client_messages
  set read_by_client_at = now()
  where id = any(message_ids)
    and sender_role = 'trainer'
    and exists (
      select 1
      from public.clients c
      where c.id = client_messages.client_id
        and c.profile_id = auth.uid()
    );
end;
$$;

revoke all on function public.mark_client_trainer_replies_read(uuid[]) from public;
grant execute on function public.mark_client_trainer_replies_read(uuid[]) to authenticated;

-- Direct update fallback for read timestamps only. Column privileges prevent
-- authenticated users from updating message body/sender/client fields.
revoke update on public.client_messages from authenticated;
grant update (read_by_client_at, read_by_trainer_at) on public.client_messages to authenticated;

drop policy if exists "Clients can mark trainer replies read" on public.client_messages;
create policy "Clients can mark trainer replies read"
  on public.client_messages
  for update
  to authenticated
  using (
    sender_role = 'trainer'
    and public.app_owns_client(client_id)
  )
  with check (
    sender_role = 'trainer'
    and public.app_owns_client(client_id)
  );

drop policy if exists "Staff can update message read state" on public.client_messages;
create policy "Staff can update message read state"
  on public.client_messages
  for update
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

-- Notifications are created by client-side helper code in several flows.
-- Keep reads/updates owner-only, but allow authenticated users to create
-- notifications for app workflows.
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
      'client_message'
    )
  );

drop policy if exists "Authenticated users can create notifications" on public.notifications;
create policy "Authenticated users can create notifications"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() is not null);

-- The client-message trigger writes staff notifications. Make the function
-- owned by the table owner/security definer path and explicitly keep search
-- path pinned.
create or replace function public.notify_staff_of_client_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_name text;
  staff_profile record;
begin
  if new.sender_role <> 'client' then
    return new;
  end if;

  select full_name into client_name
  from public.clients
  where id = new.client_id;

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
    ) values (
      staff_profile.id,
      'client_message',
      'New client message',
      coalesce(client_name, 'A client') || ': ' || left(new.body, 120),
      '/trainer/clients/' || new.client_id::text
    );
  end loop;

  return new;
end;
$$;
