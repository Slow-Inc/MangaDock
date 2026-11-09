-- #1105: `suggestive` becomes its own content level; `off` now means safe only.
-- Widens the check constraint from 2026-10-24-profiles-content-level.sql. Idempotent.
-- APPLIED 2026-10-24 to the shared project (mangadock) as migration `content_level_suggestive`, at the developer's request.

alter table public.profiles drop constraint if exists profiles_content_level_check;
alter table public.profiles
  add constraint profiles_content_level_check
  check (content_level in ('off', 'suggestive', 'erotica', 'all'));

comment on column public.profiles.content_level is
  'Content level (#1101, #1105): off (safe) | suggestive | erotica | all — erotica/all gated server-side by age confirmation / Terms acceptance';
