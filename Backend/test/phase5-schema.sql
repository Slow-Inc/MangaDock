-- Isolated PostgreSQL fixture: existing columns used by Phase 5. No live keys.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE profiles(uid uuid PRIMARY KEY, display_name text, photo_url text, role int DEFAULT 0);
CREATE TABLE user_favorites(uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, manga_id text, PRIMARY KEY(uid,manga_id));
CREATE TABLE user_history(uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, manga_id text, PRIMARY KEY(uid,manga_id));
CREATE TABLE series_follows(uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, manga_id text, PRIMARY KEY(uid,manga_id));
CREATE TABLE user_follows(follower_uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, following_uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, created_at timestamptz DEFAULT now(), PRIMARY KEY(follower_uid,following_uid));
CREATE TABLE forum_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, title text, content text DEFAULT '', category text DEFAULT 'general', target_manga_id text, target_manga_title text, target_manga_cover text, image_urls text[], upvotes int DEFAULT 0, downvotes int DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), deleted_at timestamptz);
CREATE TABLE forum_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid REFERENCES forum_posts(id) ON DELETE CASCADE, deleted_at timestamptz);
CREATE TABLE forum_votes(uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, target_type text, target_id uuid, vote_value int, PRIMARY KEY(uid,target_type,target_id));
CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, type text NOT NULL, title text NOT NULL, body text DEFAULT '', link text DEFAULT '', read boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE chapter_versions(version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title_id text NOT NULL, translator_uid uuid REFERENCES profiles(uid) ON DELETE CASCADE, status text NOT NULL DEFAULT 'draft');
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
