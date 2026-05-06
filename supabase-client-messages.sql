-- Run this in Supabase SQL Editor before using client/trainer messaging.

create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'trainer')),
  body text not null check (char_length(trim(body)) > 0),
  context_type text not null default 'general'
    check (context_type in ('general', 'workout_day', 'nutrition')),
  context_id text,
  context_label text,
  parent_message_id uuid references public.client_messages(id) on delete set null,
  read_by_trainer_at timestamptz,
  read_by_client_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_messages_client_created_idx
  on public.client_messages (client_id, created_at desc);

create index if not exists client_messages_context_idx
  on public.client_messages (client_id, context_type, context_id, created_at desc);

alter table public.client_messages enable row level security;

drop policy if exists "Clients can read own messages"
  on public.client_messages;
create policy "Clients can read own messages"
  on public.client_messages
  for select
  using (
    exists (
      select 1
      from public.clients
      where clients.id = client_messages.client_id
        and clients.profile_id = auth.uid()
    )
  );

drop policy if exists "Clients can send own messages"
  on public.client_messages;
create policy "Clients can send own messages"
  on public.client_messages
  for insert
  with check (
    sender_role = 'client'
    and exists (
      select 1
      from public.clients
      where clients.id = client_messages.client_id
        and clients.profile_id = auth.uid()
    )
  );

drop policy if exists "Staff can read client messages"
  on public.client_messages;
create policy "Staff can read client messages"
  on public.client_messages
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'admin')
    )
  );

drop policy if exists "Staff can reply to client messages"
  on public.client_messages;
create policy "Staff can reply to client messages"
  on public.client_messages
  for insert
  with check (
    sender_role = 'trainer'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'admin')
    )
  );

drop policy if exists "Staff can update message read state"
  on public.client_messages;
create policy "Staff can update message read state"
  on public.client_messages
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'admin')
    )
  );


-- Create trainer/admin notifications when clients send messages.
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

drop trigger if exists client_message_notify_staff on public.client_messages;
create trigger client_message_notify_staff
after insert on public.client_messages
for each row
execute function public.notify_staff_of_client_message();
