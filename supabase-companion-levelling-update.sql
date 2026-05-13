-- Companion levelling refresh
-- Run this in Supabase SQL editor before deploying the matching app code.

-- Dialogue lines can now unlock by form number. The app fetches lines where
-- min_form_number <= the client's current companion form, so level 2 keeps
-- level 1 dialogue and adds level 2 dialogue, and so on.
alter table public.companion_lines
  add column if not exists min_form_number integer not null default 1;

alter table public.companion_lines
  drop constraint if exists companion_lines_min_form_number_check;

alter table public.companion_lines
  add constraint companion_lines_min_form_number_check
  check (min_form_number >= 1);

update public.companion_lines
set min_form_number = 1
where min_form_number is null;

-- Make companion progress work on a weekly-friendly scale:
-- form 1 = 0 XP, form 2 = 100 XP, form 3 = 200 XP, etc.
-- A full weekly check-in now awards 100 XP in the app.
update public.companion_forms
set xp_required = greatest((form_number - 1) * 100, 0)
where form_number is not null;

-- Mastery is separate from the final visual form. A companion is mastered
-- one 100 XP step after its highest form unlocks.
update public.client_companions as companion
set
  is_mastered = false,
  mastered_at = null
from (
  select
    path_id,
    max(xp_required) + 100 as mastery_xp_required
  from public.companion_forms
  group by path_id
) as form_thresholds
where companion.path_id = form_thresholds.path_id
  and companion.is_mastered = true
  and companion.xp < form_thresholds.mastery_xp_required;
