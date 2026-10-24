-- Epic D (#784): a user's mascot config (bot-avatars), shown as their profile picture.
-- The Backend validates every field (MascotDto, allow-listed) before writing; the still image of the
-- mascot goes through the existing avatar upload into photo_url, so nothing that joins photo_url changes.
-- Idempotent and additive: nullable column, no default, no backfill.
-- APPLIED 2026-10-24 to the shared project (mangadock) as migration `profiles_mascot`, at the developer's request (#784).

alter table public.profiles
  add column if not exists mascot jsonb;

comment on column public.profiles.mascot is
  'bot-avatars mascot config {type, face, hat, glasses, headphones, bowTie, color?, accessoryColor?}; validated by MascotDto';
