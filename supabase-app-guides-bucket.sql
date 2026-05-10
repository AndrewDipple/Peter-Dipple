-- Public Supabase Storage bucket for Peter's app guide videos.
-- Upload these files into the app-guides bucket:
-- welcome.mp4
-- nutrition.mp4
-- workouts.mp4
-- photo-uploads.mp4
-- companions.mp4

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'app-guides',
  'app-guides',
  true,
  524288000,
  array['video/mp4']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view app guides" on storage.objects;

create policy "Public can view app guides"
on storage.objects
for select
to public
using (bucket_id = 'app-guides');

drop policy if exists "Staff can upload app guides" on storage.objects;

create policy "Staff can upload app guides"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'app-guides'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('trainer', 'admin')
  )
);

drop policy if exists "Staff can update app guides" on storage.objects;

create policy "Staff can update app guides"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'app-guides'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('trainer', 'admin')
  )
)
with check (
  bucket_id = 'app-guides'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('trainer', 'admin')
  )
);

drop policy if exists "Staff can delete app guides" on storage.objects;

create policy "Staff can delete app guides"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'app-guides'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('trainer', 'admin')
  )
);
