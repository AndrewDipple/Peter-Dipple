-- GDPR-oriented Supabase hardening for Peter Dipple fitness tracker.
-- Run in Supabase SQL Editor, then test client uploads, trainer viewing, and invite flow.

-- 1) Store object paths for private progress photos.
alter table public.progress_photos
  add column if not exists storage_path text;

update public.progress_photos
set storage_path = coalesce(
  storage_path,
  nullif(split_part(image_url, '/progress-photos/', 2), ''),
  case when image_url not like 'http%' then image_url else null end
)
where storage_path is null;

-- 2) Make progress photos private. The app now renders short-lived signed URLs.
update storage.buckets
set public = false
where id = 'progress-photos';

drop policy if exists "Allow public read access to progress photos" on storage.objects;
drop policy if exists "Allow authenticated uploads to progress photos" on storage.objects;
drop policy if exists "progress_photos_client_read" on storage.objects;
drop policy if exists "progress_photos_client_insert" on storage.objects;
drop policy if exists "progress_photos_client_update" on storage.objects;
drop policy if exists "progress_photos_client_delete" on storage.objects;
drop policy if exists "progress_photos_staff_read" on storage.objects;
drop policy if exists "progress_photos_staff_manage" on storage.objects;

create policy "progress_photos_client_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1
      from public.clients c
      where c.profile_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
  );

create policy "progress_photos_client_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'progress-photos'
    and exists (
      select 1
      from public.clients c
      where c.profile_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
  );

create policy "progress_photos_client_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1
      from public.clients c
      where c.profile_id = auth.uid()
        and c.id::text = (storage.foldername(name))[1]
    )
  );

create policy "progress_photos_staff_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  );

create policy "progress_photos_staff_manage"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  )
  with check (
    bucket_id = 'progress-photos'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  );

-- 3) Remove public "system can manage everything" policies on streaks/achievements.
drop policy if exists "System can manage streaks" on public.client_streaks;
drop policy if exists "System can manage achievements" on public.client_achievements;

drop policy if exists "Clients can manage own streaks" on public.client_streaks;
create policy "Clients can manage own streaks"
  on public.client_streaks
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = client_streaks.client_id
        and c.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_streaks.client_id
        and c.profile_id = auth.uid()
    )
  );

drop policy if exists "Staff can manage streaks" on public.client_streaks;
create policy "Staff can manage streaks"
  on public.client_streaks
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  );

drop policy if exists "Clients can insert own achievements" on public.client_achievements;
create policy "Clients can insert own achievements"
  on public.client_achievements
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = client_achievements.client_id
        and c.profile_id = auth.uid()
    )
  );

drop policy if exists "Staff can manage achievements" on public.client_achievements;
create policy "Staff can manage achievements"
  on public.client_achievements
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  );

-- 4) Keep only client-owned access to progress photo rows plus staff access.
-- If existing policies are already equivalent, these statements are idempotent.
alter table public.progress_photos enable row level security;

drop policy if exists "Clients can manage own progress photos" on public.progress_photos;
create policy "Clients can manage own progress photos"
  on public.progress_photos
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.clients c
      where c.id = progress_photos.client_id
        and c.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.clients c
      where c.id = progress_photos.client_id
        and c.profile_id = auth.uid()
    )
  );

drop policy if exists "Trainers can manage progress photos" on public.progress_photos;
create policy "Trainers can manage progress photos"
  on public.progress_photos
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'admin')
    )
  );
