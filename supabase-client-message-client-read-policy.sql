-- Run this in Supabase SQL Editor so clients can clear trainer reply banners.
-- This avoids granting clients broad update access to client_messages.

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
      from public.clients
      where clients.id = client_messages.client_id
        and clients.profile_id = auth.uid()
    );
end;
$$;

revoke all on function public.mark_client_trainer_replies_read(uuid[]) from public;
grant execute on function public.mark_client_trainer_replies_read(uuid[]) to authenticated;
