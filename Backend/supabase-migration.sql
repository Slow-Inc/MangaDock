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

-- ─── 2.5 FORUM TABLES (Phase 1.5) ──────────────────────────────────────────

-- forum_posts
CREATE TABLE IF NOT EXISTS forum_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_uid    UUID NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general', -- 'general', 'announcement', 'spoiler', 'manga_update'
  target_manga_id TEXT, -- Optional link to a specific manga
  target_manga_title TEXT, -- Cached title for display tags
  target_manga_cover TEXT, -- Cached cover for display tags
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
-- Topup idempotency: a Xendit payment_id may be credited as a topup at most once (V5)
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_topup_ref_uidx
  ON wallet_transactions (reference_id)
  WHERE type = 'topup' AND reference_id IS NOT NULL;
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

-- ─── 7. HOTFIXES / INCREMENTAL UPDATES ────────────────────────────────────────

DO $$
BEGIN
  -- forum_posts: add target_manga_title
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forum_posts' AND column_name='target_manga_title') THEN
    ALTER TABLE forum_posts ADD COLUMN target_manga_title TEXT;
  END IF;

  -- forum_posts: add target_manga_cover
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forum_posts' AND column_name='target_manga_cover') THEN
    ALTER TABLE forum_posts ADD COLUMN target_manga_cover TEXT;
  END IF;

  -- forum_posts: add image_urls for post image attachments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forum_posts' AND column_name='image_urls') THEN
    ALTER TABLE forum_posts ADD COLUMN image_urls TEXT[] DEFAULT '{}';
  END IF;

  -- profiles: add banner_url for custom profile banner image
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='banner_url') THEN
    ALTER TABLE profiles ADD COLUMN banner_url TEXT;
  END IF;

  -- profiles: add banner_position (0-100 Y%) for drag-to-reposition
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='banner_position') THEN
    ALTER TABLE profiles ADD COLUMN banner_position NUMERIC(5,2) DEFAULT 50;
  END IF;

  -- forum_posts: soft delete support
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forum_posts' AND column_name='deleted_at') THEN
    ALTER TABLE forum_posts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- forum_comments: soft delete support
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forum_comments' AND column_name='deleted_at') THEN
    ALTER TABLE forum_comments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Indexes for soft-delete queries (WHERE deleted_at IS NULL is the hot path)
CREATE INDEX IF NOT EXISTS idx_forum_posts_deleted_at    ON forum_posts    (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_forum_comments_deleted_at ON forum_comments (deleted_at) WHERE deleted_at IS NULL;

-- Indexes for common filter + sort patterns
CREATE INDEX IF NOT EXISTS idx_forum_posts_category_created_at ON forum_posts (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_manga_created_at    ON forum_posts (target_manga_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post_created_at  ON forum_comments (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_parent_id        ON forum_comments (parent_id);

-- ─── 8. ATOMIC RPC FUNCTIONS ─────────────────────────────────────────────────
-- NOTE (V5): the dead numeric overloads add_coins_atomic(uuid,numeric,text,text)
-- and spend_coins_atomic(uuid,numeric,text,text) were dropped via migration
-- wallet_idempotency_and_cleanup — they omitted the NOT-NULL balance_after column.
-- Only the integer overloads below are live.

-- Atomic add coins: increments balance and inserts transaction in one operation
CREATE OR REPLACE FUNCTION add_coins_atomic(
  p_uid        uuid,
  p_amount     integer,
  p_type       text,
  p_description text DEFAULT NULL
)
RETURNS TABLE(balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  INSERT INTO wallets (uid, balance)
  VALUES (p_uid, 0)
  ON CONFLICT (uid) DO NOTHING;

  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE uid = p_uid
  RETURNING wallets.balance INTO v_balance;

  INSERT INTO wallet_transactions (uid, amount, type, balance_after, description)
  VALUES (p_uid, p_amount, p_type, v_balance, p_description);

  RETURN QUERY SELECT v_balance;
END;
$$;

-- Atomic spend coins: decrements balance only if sufficient, raises INSUFFICIENT_FUNDS otherwise
CREATE OR REPLACE FUNCTION spend_coins_atomic(
  p_uid          uuid,
  p_amount       integer,
  p_type         text,
  p_description  text DEFAULT NULL,
  p_reference_id text DEFAULT NULL
)
RETURNS TABLE(balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  INSERT INTO wallets (uid, balance)
  VALUES (p_uid, 0)
  ON CONFLICT (uid) DO NOTHING;

  UPDATE wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE uid = p_uid
    AND balance >= p_amount
  RETURNING wallets.balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  INSERT INTO wallet_transactions (uid, amount, type, balance_after, description, reference_id)
  VALUES (p_uid, -p_amount, p_type, v_balance, p_description, p_reference_id);

  RETURN QUERY SELECT v_balance;
END;
$$;

-- Atomic recalculate votes: counts forum_votes and writes totals to post/comment row
CREATE OR REPLACE FUNCTION recalculate_votes_atomic(
  p_target_type text,
  p_target_id   uuid
)
RETURNS TABLE(upvotes bigint, downvotes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_upvotes   bigint;
  v_downvotes bigint;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE vote_value = 1),
    COUNT(*) FILTER (WHERE vote_value = -1)
  INTO v_upvotes, v_downvotes
  FROM forum_votes
  WHERE target_id = p_target_id
    AND target_type = p_target_type;

  IF p_target_type = 'post' THEN
    UPDATE forum_posts
    SET upvotes = v_upvotes, downvotes = v_downvotes
    WHERE id = p_target_id;
  ELSE
    UPDATE forum_comments
    SET upvotes = v_upvotes, downvotes = v_downvotes
    WHERE id = p_target_id;
  END IF;

  RETURN QUERY SELECT v_upvotes, v_downvotes;
END;
$$;

-- Atomic purchase unlock: inserts unlock row, debits buyer, credits creator — single transaction
-- Supersedes the old insert-then-split flow in unlock.service.ts (V6/V7)
CREATE OR REPLACE FUNCTION purchase_unlock_atomic(
  p_uid          uuid,
  p_version_id   uuid,
  p_price        integer,
  p_creator_uid  uuid,
  p_platform_pct numeric,
  p_description  text
)
RETURNS TABLE(balance integer, already_unlocked boolean, creator_share integer, platform_share integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows            integer;
  v_balance         integer;
  v_creator_balance integer;
  v_platform_share  integer := 0;
  v_creator_share   integer := 0;
BEGIN
  INSERT INTO unlocks (uid, version_id, price_paid)
  VALUES (p_uid, p_version_id, p_price)
  ON CONFLICT (uid, version_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT w.balance INTO v_balance FROM wallets w WHERE w.uid = p_uid;
    RETURN QUERY SELECT COALESCE(v_balance, 0), true, 0, 0;
    RETURN;
  END IF;

  IF p_price <= 0 THEN
    SELECT w.balance INTO v_balance FROM wallets w WHERE w.uid = p_uid;
    RETURN QUERY SELECT COALESCE(v_balance, 0), false, 0, 0;
    RETURN;
  END IF;

  INSERT INTO wallets (uid, balance) VALUES (p_uid, 0) ON CONFLICT (uid) DO NOTHING;
  UPDATE wallets
     SET balance = wallets.balance - p_price, updated_at = now()
   WHERE uid = p_uid AND wallets.balance >= p_price
   RETURNING wallets.balance INTO v_balance;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  INSERT INTO wallet_transactions (uid, amount, type, balance_after, description, reference_id)
  VALUES (p_uid, -p_price, 'purchase', v_balance, p_description, p_version_id::text);

  v_platform_share := floor(p_price * p_platform_pct);
  v_creator_share  := p_price - v_platform_share;
  IF v_creator_share > 0 AND p_creator_uid IS NOT NULL THEN
    INSERT INTO wallets (uid, balance) VALUES (p_creator_uid, 0) ON CONFLICT (uid) DO NOTHING;
    UPDATE wallets
       SET balance = wallets.balance + v_creator_share, updated_at = now()
     WHERE uid = p_creator_uid
     RETURNING wallets.balance INTO v_creator_balance;
    INSERT INTO wallet_transactions (uid, amount, type, balance_after, description)
    VALUES (p_creator_uid, v_creator_share, 'reward', v_creator_balance, 'ส่วนแบ่งรายได้: ' || p_description);
  END IF;

  RETURN QUERY SELECT v_balance, false, v_creator_share, v_platform_share;
END;
$$;

COMMIT;
