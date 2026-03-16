-- =============================================================================
-- Supabase PostgreSQL Migration Script
-- Creates tables for MetaBooks/MangaDock backend
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Replaces Firestore `users` collection
CREATE TABLE IF NOT EXISTS profiles (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'translator', 'creator', 'admin')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'pro')),
  trust_score NUMERIC NOT NULL DEFAULT 0,
  rating_avg NUMERIC NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  country TEXT,
  preferred_language TEXT,
  bio TEXT,
  translator_languages TEXT[] DEFAULT '{}',
  photo_history TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ─── favorites ───────────────────────────────────────────────────────────────
-- Replaces Firestore `users/{uid}/favorites` subcollection
CREATE TABLE IF NOT EXISTS favorites (
  uid UUID NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  thumbnail TEXT DEFAULT '',
  authors TEXT[] DEFAULT '{}',
  description TEXT DEFAULT '',
  categories TEXT[] DEFAULT '{}',
  published_date TEXT DEFAULT '',
  average_rating NUMERIC DEFAULT 0,
  ratings_count INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, item_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_uid ON favorites(uid);

-- ─── liked_items ─────────────────────────────────────────────────────────────
-- Replaces Firestore `users/{uid}/liked` subcollection
CREATE TABLE IF NOT EXISTS liked_items (
  uid UUID NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, item_id)
);

CREATE INDEX IF NOT EXISTS idx_liked_items_uid ON liked_items(uid);

-- ─── reading_history ─────────────────────────────────────────────────────────
-- Replaces Firestore `users/{uid}/history` subcollection
CREATE TABLE IF NOT EXISTS reading_history (
  uid UUID NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT DEFAULT '',
  thumbnail TEXT DEFAULT '',
  authors TEXT[] DEFAULT '{}',
  description TEXT DEFAULT '',
  published_date TEXT DEFAULT '',
  categories TEXT[] DEFAULT '{}',
  average_rating NUMERIC DEFAULT 0,
  ratings_count INTEGER DEFAULT 0,
  last_read_at BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, item_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_history_uid ON reading_history(uid);

-- ─── chapter_versions ────────────────────────────────────────────────────────
-- Replaces Firestore `chapterVersions` collection
CREATE TABLE IF NOT EXISTS chapter_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id TEXT NOT NULL,
  title_name TEXT DEFAULT '',
  title_alt_name TEXT DEFAULT '',
  chapter_id TEXT,
  chapter_number TEXT DEFAULT '',
  chapter_title TEXT DEFAULT '',
  language TEXT NOT NULL DEFAULT 'th',
  translator_uid UUID NOT NULL,
  translator_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'approved', 'rejected')),
  pages TEXT[] DEFAULT '{}',
  price_coins INTEGER NOT NULL DEFAULT 0,
  quality_score NUMERIC DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chapter_versions_translator ON chapter_versions(translator_uid);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_title ON chapter_versions(title_id);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_status ON chapter_versions(status);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_title_chapter ON chapter_versions(title_id, chapter_id);

-- ─── RLS Policies (optional — backend uses service_role key so RLS is bypassed) ──
-- If you want to add RLS in the future, enable it on these tables:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE liked_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chapter_versions ENABLE ROW LEVEL SECURITY;
