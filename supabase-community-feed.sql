-- Opt-in client community feed.
create table if not exists public.client_community_settings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  display_name text not null,
  opted_in boolean not null default false,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_community_settings_client_unique unique (client_id),
  constraint client_community_settings_display_name_check
    check (char_length(trim(display_name)) between 2 and 40)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  display_name text not null,
  category text not null default 'general',
  body text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hidden_at timestamptz,
  constraint community_posts_category_check
    check (category in ('general', 'win', 'meal', 'question', 'companion')),
  constraint community_posts_status_check
    check (status in ('published', 'hidden', 'deleted')),
  constraint community_posts_body_check
    check (char_length(trim(body)) between 2 and 600),
  constraint community_posts_display_name_check
    check (char_length(trim(display_name)) between 2 and 40)
);

create table if not exists public.community_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  staff_user_id uuid references public.profiles(id) on delete cascade,
  display_name text not null,
  body text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hidden_at timestamptz,
  constraint community_post_replies_author_check
    check (
      (client_id is not null and staff_user_id is null)
      or (client_id is null and staff_user_id is not null)
    ),
  constraint community_post_replies_status_check
    check (status in ('published', 'hidden', 'deleted')),
  constraint community_post_replies_body_check
    check (char_length(trim(body)) between 2 and 400),
  constraint community_post_replies_display_name_check
    check (char_length(trim(display_name)) between 2 and 40)
);

create table if not exists public.community_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  staff_user_id uuid references public.profiles(id) on delete cascade,
  reaction text not null default 'support',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_post_reactions_author_check
    check (
      (client_id is not null and staff_user_id is null)
      or (client_id is null and staff_user_id is not null)
    ),
  constraint community_post_reactions_reaction_check
    check (reaction in ('support')),
  constraint community_post_reactions_client_unique unique (post_id, client_id),
  constraint community_post_reactions_staff_unique unique (post_id, staff_user_id)
);

alter table public.client_community_settings enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_post_replies enable row level security;
alter table public.community_post_reactions enable row level security;

drop policy if exists "Clients can view own community settings" on public.client_community_settings;
create policy "Clients can view own community settings"
on public.client_community_settings
for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = client_community_settings.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Clients can create own community settings" on public.client_community_settings;
create policy "Clients can create own community settings"
on public.client_community_settings
for insert
to authenticated
with check (
  exists (
    select 1 from public.clients c
    where c.id = client_community_settings.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Clients can update own community settings" on public.client_community_settings;
create policy "Clients can update own community settings"
on public.client_community_settings
for update
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = client_community_settings.client_id
      and c.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.clients c
    where c.id = client_community_settings.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Staff can manage community settings" on public.client_community_settings;
create policy "Staff can manage community settings"
on public.client_community_settings
for all
to authenticated
using (public.app_is_staff())
with check (public.app_is_staff());

drop policy if exists "Opted in clients can view published community posts" on public.community_posts;
create policy "Opted in clients can view published community posts"
on public.community_posts
for select
to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.client_community_settings settings
    join public.clients c on c.id = settings.client_id
    where c.profile_id = auth.uid()
      and settings.opted_in = true
  )
);

drop policy if exists "Clients can create own community posts when opted in" on public.community_posts;
create policy "Clients can create own community posts when opted in"
on public.community_posts
for insert
to authenticated
with check (
  status = 'published'
  and exists (
    select 1
    from public.clients c
    join public.client_community_settings settings on settings.client_id = c.id
    where c.id = community_posts.client_id
      and c.profile_id = auth.uid()
      and settings.opted_in = true
  )
);

drop policy if exists "Clients can update own community posts" on public.community_posts;
create policy "Clients can update own community posts"
on public.community_posts
for update
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = community_posts.client_id
      and c.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.clients c
    where c.id = community_posts.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Clients can delete own community posts" on public.community_posts;
create policy "Clients can delete own community posts"
on public.community_posts
for delete
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = community_posts.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Staff can manage community posts" on public.community_posts;
create policy "Staff can manage community posts"
on public.community_posts
for all
to authenticated
using (public.app_is_staff())
with check (public.app_is_staff());

drop policy if exists "Opted in clients can view published community replies" on public.community_post_replies;
create policy "Opted in clients can view published community replies"
on public.community_post_replies
for select
to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.client_community_settings settings
    join public.clients c on c.id = settings.client_id
    where c.profile_id = auth.uid()
      and settings.opted_in = true
  )
);

drop policy if exists "Clients can create own community replies when opted in" on public.community_post_replies;
create policy "Clients can create own community replies when opted in"
on public.community_post_replies
for insert
to authenticated
with check (
  status = 'published'
  and staff_user_id is null
  and exists (
    select 1
    from public.clients c
    join public.client_community_settings settings on settings.client_id = c.id
    where c.id = community_post_replies.client_id
      and c.profile_id = auth.uid()
      and settings.opted_in = true
  )
);

drop policy if exists "Clients can update own community replies" on public.community_post_replies;
create policy "Clients can update own community replies"
on public.community_post_replies
for update
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = community_post_replies.client_id
      and c.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.clients c
    where c.id = community_post_replies.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Clients can delete own community replies" on public.community_post_replies;
create policy "Clients can delete own community replies"
on public.community_post_replies
for delete
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = community_post_replies.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Staff can manage community replies" on public.community_post_replies;
create policy "Staff can manage community replies"
on public.community_post_replies
for all
to authenticated
using (public.app_is_staff())
with check (public.app_is_staff());

drop policy if exists "Opted in clients can view community reactions" on public.community_post_reactions;
create policy "Opted in clients can view community reactions"
on public.community_post_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.client_community_settings settings
    join public.clients c on c.id = settings.client_id
    where c.profile_id = auth.uid()
      and settings.opted_in = true
  )
);

drop policy if exists "Clients can manage own community reactions when opted in" on public.community_post_reactions;
create policy "Clients can manage own community reactions when opted in"
on public.community_post_reactions
for all
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = community_post_reactions.client_id
      and c.profile_id = auth.uid()
  )
)
with check (
  staff_user_id is null
  and reaction = 'support'
  and exists (
    select 1
    from public.clients c
    join public.client_community_settings settings on settings.client_id = c.id
    where c.id = community_post_reactions.client_id
      and c.profile_id = auth.uid()
      and settings.opted_in = true
  )
);

drop policy if exists "Staff can manage community reactions" on public.community_post_reactions;
create policy "Staff can manage community reactions"
on public.community_post_reactions
for all
to authenticated
using (public.app_is_staff())
with check (public.app_is_staff());

create index if not exists client_community_settings_client_id_idx
  on public.client_community_settings (client_id);

create index if not exists community_posts_status_created_at_idx
  on public.community_posts (status, created_at desc);

create index if not exists community_posts_client_created_at_idx
  on public.community_posts (client_id, created_at desc);

create index if not exists community_post_replies_post_created_at_idx
  on public.community_post_replies (post_id, created_at);

create index if not exists community_post_reactions_post_idx
  on public.community_post_reactions (post_id);
