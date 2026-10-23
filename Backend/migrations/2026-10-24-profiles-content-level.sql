-- #1101 (PRD #1100): opt-in 18+ content. A user's level decides which MangaDex content ratings the catalog fetches:
-- off = safe + suggestive (default, and every anonymous visitor), erotica = + erotica, all = + pornographic.
-- The Backend gates raising it (ContentLevelService / applyLevelChange): erotica needs adult_confirmed_at,
-- all also needs adult_tos_accepted_at; both are stamped by the server, never sent as values by the client.
-- Additive and idempotent: existing rows become 'off' (what they see today).
-- APPLIED 2026-10-24 to the shared project (mangadock) as migration `profiles_content_level`, at the developer's request.

alter table public.profiles
  add column if not exists content_level text not null default 'off',
  add column if not exists adult_confirmed_at timestamptz,
  add column if not exists adult_tos_accepted_at timestamptz;

do $$ begin
  alter table public.profiles
    add constraint profiles_content_level_check check (content_level in ('off', 'erotica', 'all'));
exception when duplicate_object then null;
end $$;

comment on column public.profiles.content_level is
  '18+ content level (#1101): off | erotica | all — gated server-side by age confirmation / Terms acceptance';
comment on column public.profiles.adult_confirmed_at is 'When the user confirmed being 18+ (#1101)';
comment on column public.profiles.adult_tos_accepted_at is 'When the user accepted the 18+ Terms needed for pornographic (#1101)';
