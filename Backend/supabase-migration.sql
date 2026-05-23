-- =============================================================================
-- MangaDock — Supabase Schema (single-file, idempotent)
-- Safe to run on fresh DB or existing DB — uses IF NOT EXISTS / CREATE OR REPLACE
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Last updated: 2026-03-17
-- =============================================================================

BEGIN;

-- ─── 1. TABLES ───────────────────────────────────────────────────────────────

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  uid          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  photo_url    TEXT,
  role         TEXT NOT NULL DEFAULT 'user',
  plan         TEXT NOT NULL DEFAULT 'free',
  trust_score  INTEGER NOT NULL DEFAULT 0,
  rating_avg   NUMERIC NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  country      TEXT,
  preferred_language TEXT,
  bio          TEXT,
  translator_languages TEXT[] NOT NULL DEFAULT '{}',
  photo_history        TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_favorites (PK: uid + manga_id)
CREATE TABLE IF NOT EXISTS user_favorites (
  uid            UUID NOT NULL,
  manga_id       TEXT NOT NULL,
  title          TEXT NOT NULL,
  thumbnail      TEXT NOT NULL DEFAULT '',
  authors        TEXT[] NOT NULL DEFAULT '{}',
  description    TEXT NOT NULL DEFAULT '',
  categories     TEXT[] NOT NULL DEFAULT '{}',
  published_date TEXT NOT NULL DEFAULT '',
  average_rating NUMERIC NOT NULL DEFAULT 0,
  ratings_count  INTEGER NOT NULL DEFAULT 0,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, manga_id)
);

-- user_liked (PK: uid + manga_id)
CREATE TABLE IF NOT EXISTS user_liked (
  uid      UUID NOT NULL,
  manga_id TEXT NOT NULL,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, manga_id)
);

-- user_history (PK: uid + manga_id)
CREATE TABLE IF NOT EXISTS user_history (
  uid            UUID NOT NULL,
  manga_id       TEXT NOT NULL,
  title          TEXT NOT NULL DEFAULT '',
  subtitle       TEXT NOT NULL DEFAULT '',
  thumbnail      TEXT NOT NULL DEFAULT '',
  authors        TEXT[] NOT NULL DEFAULT '{}',
  description    TEXT NOT NULL DEFAULT '',
  published_date TEXT NOT NULL DEFAULT '',
  categories     TEXT[] NOT NULL DEFAULT '{}',
  average_rating NUMERIC NOT NULL DEFAULT 0,
  ratings_count  INTEGER NOT NULL DEFAULT 0,
  last_read_at   BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, manga_id)
);

-- chapter_versions
CREATE TABLE IF NOT EXISTS chapter_versions (
  version_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id       TEXT NOT NULL,
  title_name     TEXT NOT NULL DEFAULT '',
  title_alt_name TEXT DEFAULT '',
  chapter_id     TEXT NOT NULL,
  chapter_number TEXT NOT NULL DEFAULT '',
  chapter_title  TEXT NOT NULL DEFAULT '',
  language       TEXT NOT NULL,
  translator_uid UUID NOT NULL,
  translator_name TEXT,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_moderation','published','approved','rejected')),
  pages          TEXT[] NOT NULL DEFAULT '{}',
  price_coins    INTEGER NOT NULL DEFAULT 0,
  quality_score  NUMERIC NOT NULL DEFAULT 0,
  is_default     BOOLEAN NOT NULL DEFAULT false,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- wallets
CREATE TABLE IF NOT EXISTS wallets (
  uid        UUID PRIMARY KEY,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- wallet_transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid           UUID NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('topup','purchase','refund','reward')),
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description   TEXT DEFAULT '',
  reference_id  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- unlocks
CREATE TABLE IF NOT EXISTS unlocks (
  uid        UUID NOT NULL,
  version_id UUID NOT NULL,
  price_paid INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, version_id)
);

-- ─── 2. FOREIGN KEYS (idempotent — skip if already exists) ──────────────────

DO $$ BEGIN
  -- user_favorites → profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_favorites_uid_fkey') THEN
    ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_uid_fkey FOREIGN KEY (uid) REFERENCES profiles(uid) ON DELETE CASCADE;
  END IF;
  -- user_liked → profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_liked_uid_fkey') THEN
    ALTER TABLE user_liked ADD CONSTRAINT user_liked_uid_fkey FOREIGN KEY (uid) REFERENCES profiles(uid) ON DELETE CASCADE;
  END IF;
  -- user_history → profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_history_uid_fkey') THEN
    ALTER TABLE user_history ADD CONSTRAINT user_history_uid_fkey FOREIGN KEY (uid) REFERENCES profiles(uid) ON DELETE CASCADE;
  END IF;
  -- wallets → profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_uid_fkey') THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_uid_fkey FOREIGN KEY (uid) REFERENCES profiles(uid) ON DELETE CASCADE;
  END IF;
  -- wallet_transactions → profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_uid_fkey') THEN
    ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_uid_fkey FOREIGN KEY (uid) REFERENCES profiles(uid) ON DELETE CASCADE;
  END IF;
  -- unlocks → profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unlocks_uid_fkey') THEN
    ALTER TABLE unlocks ADD CONSTRAINT unlocks_uid_fkey FOREIGN KEY (uid) REFERENCES profiles(uid) ON DELETE CASCADE;
  END IF;
  -- unlocks → chapter_versions
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unlocks_version_id_fkey') THEN
    ALTER TABLE unlocks ADD CONSTRAINT unlocks_version_id_fkey FOREIGN KEY (version_id) REFERENCES chapter_versions(version_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 2.5 FORUM TABLES (Phase 2) ───────────────────────────────────────────

-- forum_posts
CREATE TABLE IF NOT EXISTS forum_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_uid    UUID NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general', -- 'general', 'announcement', 'spoiler', 'manga_update'
  target_manga_id TEXT, -- Optional link to a specific manga
  upvotes       INTEGER NOT NULL DEFAULT 0,
  downvotes     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- forum_comments (Nested support)
CREATE TABLE IF NOT EXISTS forum_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES forum_comments(id) ON DELETE CASCADE,
  author_uid    UUID NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  upvotes       INTEGER NOT NULL DEFAULT 0,
  downvotes     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- forum_votes (Idempotent voting)
CREATE TABLE IF NOT EXISTS forum_votes (
  uid           UUID NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id     UUID NOT NULL,
  vote_value    INTEGER NOT NULL CHECK (vote_value IN (1, -1)),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, target_type, target_id)
);

-- ─── 3. CHECK CONSTRAINTS ────────────────────────────────────────────────────

DO $$ BEGIN
  -- Drop old constraint if it has wrong values, then re-create
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chapter_versions_status_check') THEN
    ALTER TABLE chapter_versions DROP CONSTRAINT chapter_versions_status_check;
  END IF;
  ALTER TABLE chapter_versions ADD CONSTRAINT chapter_versions_status_check
    CHECK (status IN ('draft','pending_moderation','published','approved','rejected'));
END $$;

-- Migrate any leftover rows with old 'pending' value (before rename to pending_moderation)
UPDATE chapter_versions SET status = 'pending_moderation' WHERE status = 'pending';

-- ─── 4. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_email               ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role                 ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_favorites_uid            ON user_favorites(uid);
CREATE INDEX IF NOT EXISTS idx_user_liked_uid                ON user_liked(uid);
CREATE INDEX IF NOT EXISTS idx_user_history_uid              ON user_history(uid);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_translator   ON chapter_versions(translator_uid);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_title        ON chapter_versions(title_id);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_status       ON chapter_versions(status);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_title_chapter ON chapter_versions(title_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_language     ON chapter_versions(language);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_uid       ON wallet_transactions(uid);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_uid_created ON wallet_transactions(uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type      ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_unlocks_uid                   ON unlocks(uid);
CREATE INDEX IF NOT EXISTS idx_unlocks_version               ON unlocks(version_id);

-- ─── 5. VIEW — translator earnings ──────────────────────────────────────────

CREATE OR REPLACE VIEW translator_earnings AS
SELECT
  cv.translator_uid,
  COUNT(u.*)::INTEGER              AS total_sales,
  COALESCE(SUM(u.price_paid), 0)::INTEGER AS total_earned,
  COUNT(DISTINCT cv.title_id)::INTEGER     AS titles_sold,
  COUNT(DISTINCT u.uid)::INTEGER           AS unique_buyers
FROM unlocks u
JOIN chapter_versions cv ON cv.version_id = u.version_id
GROUP BY cv.translator_uid;

-- ─── 6. TRIGGER — auto-update updated_at ────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at') THEN
    CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chapter_versions_updated_at') THEN
    CREATE TRIGGER trg_chapter_versions_updated_at BEFORE UPDATE ON chapter_versions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wallets_updated_at') THEN
    CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─── 7. CLEANUP — drop unused legacy tables ─────────────────────────────────
-- These old tables (item_id based) are superseded by user_* tables (manga_id based).
-- Backend no longer references them. Safe to drop.

DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS liked_items;
DROP TABLE IF EXISTS reading_history;

COMMIT;
