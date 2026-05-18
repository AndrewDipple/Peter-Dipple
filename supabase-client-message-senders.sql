alter table public.client_messages
  add column if not exists sender_profile_id uuid references public.profiles(id) on delete set null;

alter table public.client_messages
  add column if not exists sender_display_name text;

create index if not exists client_messages_sender_profile_id_idx
  on public.client_messages(sender_profile_id);

update public.client_messages cm
set
  sender_profile_id = c.profile_id,
  sender_display_name = coalesce(cm.sender_display_name, c.full_name)
from public.clients c
where cm.client_id = c.id
  and cm.sender_role = 'client'
  and cm.sender_profile_id is null;
