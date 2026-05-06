-- Final RLS cleanup from fresh export.
-- Run after supabase-rls-core-hardening.sql and supabase-messaging-repair.sql.

-- Notification insert policy was accidentally created as ALL in one run.
drop policy if exists "Authenticated users can create notifications" on public.notifications;
create policy "Authenticated users can create notifications"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() is not null);

-- Milestones: authenticated only, client-owned plus staff.
drop policy if exists "Clients can insert own milestones" on public.client_milestones;
drop policy if exists "Clients can update own milestones" on public.client_milestones;
drop policy if exists "Clients can view own milestones" on public.client_milestones;
drop policy if exists "Clients can manage own milestones" on public.client_milestones;
drop policy if exists "Staff can manage milestones" on public.client_milestones;

create policy "Clients can manage own milestones"
  on public.client_milestones
  for all
  to authenticated
  using (public.app_owns_client(client_id))
  with check (public.app_owns_client(client_id));

create policy "Staff can manage milestones"
  on public.client_milestones
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

-- Remove redundant public read policies now covered by authenticated manage
-- policies from the earlier GDPR hardening script.
drop policy if exists "Users can view own achievements" on public.client_achievements;
drop policy if exists "Users can view own streaks" on public.client_streaks;

-- Legacy workout day progress: authenticated only, client-owned plus staff.
drop policy if exists "Clients can insert own workout day progress" on public.client_workout_day_progress;
drop policy if exists "Clients can update own workout day progress" on public.client_workout_day_progress;
drop policy if exists "Clients can view own workout day progress" on public.client_workout_day_progress;
drop policy if exists "Trainers can view all workout day progress" on public.client_workout_day_progress;
drop policy if exists "Clients can manage own workout day progress" on public.client_workout_day_progress;
drop policy if exists "Staff can manage workout day progress" on public.client_workout_day_progress;

create policy "Clients can manage own workout day progress"
  on public.client_workout_day_progress
  for all
  to authenticated
  using (public.app_owns_client(client_id))
  with check (public.app_owns_client(client_id));

create policy "Staff can manage workout day progress"
  on public.client_workout_day_progress
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

-- Reference workout library: authenticated read, staff write.
drop policy if exists "Anyone authenticated can view exercises" on public.exercises;
drop policy if exists "Trainers can manage exercises" on public.exercises;
drop policy if exists "Authenticated users can view exercises" on public.exercises;
drop policy if exists "Staff can manage exercises" on public.exercises;

create policy "Authenticated users can view exercises"
  on public.exercises
  for select
  to authenticated
  using (true);

create policy "Staff can manage exercises"
  on public.exercises
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

drop policy if exists "Clients can view workout days" on public.workout_days;
drop policy if exists "Trainers can manage workout days" on public.workout_days;
drop policy if exists "Authenticated users can view workout days" on public.workout_days;
drop policy if exists "Staff can manage workout days" on public.workout_days;

create policy "Authenticated users can view workout days"
  on public.workout_days
  for select
  to authenticated
  using (true);

create policy "Staff can manage workout days"
  on public.workout_days
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

drop policy if exists "Clients can view workout exercises" on public.workout_exercises;
drop policy if exists "Trainers can manage workout exercises" on public.workout_exercises;
drop policy if exists "Authenticated users can view workout exercises" on public.workout_exercises;
drop policy if exists "Staff can manage workout exercises" on public.workout_exercises;

create policy "Authenticated users can view workout exercises"
  on public.workout_exercises
  for select
  to authenticated
  using (true);

create policy "Staff can manage workout exercises"
  on public.workout_exercises
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

drop policy if exists "Clients can view workout plans" on public.workout_plans;
drop policy if exists "Trainers can manage workout plans" on public.workout_plans;
drop policy if exists "Authenticated users can view workout plans" on public.workout_plans;
drop policy if exists "Staff can manage workout plans" on public.workout_plans;

create policy "Authenticated users can view workout plans"
  on public.workout_plans
  for select
  to authenticated
  using (true);

create policy "Staff can manage workout plans"
  on public.workout_plans
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

-- Recipes and templates: remove duplicate trainer-only policies and use staff.
drop policy if exists "Anyone can read recipes" on public.recipes;
drop policy if exists "Only trainers can delete recipes" on public.recipes;
drop policy if exists "Only trainers can manage recipes" on public.recipes;
drop policy if exists "Only trainers can modify recipes" on public.recipes;
drop policy if exists "Only trainers can update recipes" on public.recipes;
drop policy if exists "Staff can manage recipes" on public.recipes;

create policy "Staff can manage recipes"
  on public.recipes
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

drop policy if exists "Anyone can read ingredients" on public.recipe_ingredients;
drop policy if exists "Only trainers can delete recipe ingredients" on public.recipe_ingredients;
drop policy if exists "Only trainers can manage recipe ingredients" on public.recipe_ingredients;
drop policy if exists "Only trainers can modify ingredients" on public.recipe_ingredients;
drop policy if exists "Only trainers can update recipe ingredients" on public.recipe_ingredients;
drop policy if exists "Staff can manage recipe ingredients" on public.recipe_ingredients;

create policy "Staff can manage recipe ingredients"
  on public.recipe_ingredients
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

drop policy if exists "Only trainers can manage program templates" on public.program_templates;
drop policy if exists "Staff can manage program templates" on public.program_templates;
create policy "Staff can manage program templates"
  on public.program_templates
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

drop policy if exists "Only trainers can manage program template days" on public.program_template_days;
drop policy if exists "Staff can manage program template days" on public.program_template_days;
create policy "Staff can manage program template days"
  on public.program_template_days
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

drop policy if exists "Only trainers can manage program template exercises" on public.program_template_exercises;
drop policy if exists "Staff can manage program template exercises" on public.program_template_exercises;
create policy "Staff can manage program template exercises"
  on public.program_template_exercises
  for all
  to authenticated
  using (public.app_is_staff())
  with check (public.app_is_staff());

-- Avatars are currently public. That may be acceptable if avatars are not
-- sensitive; tighten write/update to per-user folder ownership.
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;
drop policy if exists "Users can upload own avatars" on storage.objects;
drop policy if exists "Users can update own avatars" on storage.objects;

create policy "Users can upload own avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own avatars"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
