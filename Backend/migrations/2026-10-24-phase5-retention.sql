-- Run after the existing MangaDock schema. Server RPCs are service_role-only;
-- verified caller IDs come from AuthGuard, never the request body.
BEGIN;

CREATE TABLE public.reader_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid uuid NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.reader_collections(owner_uid, updated_at DESC);
CREATE TABLE public.reader_collection_items (
  collection_id uuid NOT NULL REFERENCES public.reader_collections(id) ON DELETE CASCADE,
  manga_id text NOT NULL CHECK (manga_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(collection_id, manga_id)
);
ALTER TABLE public.reader_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reader_collection_items ENABLE ROW LEVEL SECURITY;
-- All access goes through the API; private lists cannot be queried via PostgREST.
REVOKE ALL ON public.reader_collections, public.reader_collection_items FROM anon, authenticated;
GRANT ALL ON public.reader_collections, public.reader_collection_items TO service_role;

CREATE FUNCTION public.phase5_collection_quota() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM profiles WHERE uid = NEW.owner_uid FOR UPDATE;
  IF (SELECT count(*) FROM reader_collections WHERE owner_uid = NEW.owner_uid) >= 100 THEN
    RAISE EXCEPTION 'Collection limit reached' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase5_collection_quota BEFORE INSERT ON public.reader_collections
FOR EACH ROW EXECUTE FUNCTION public.phase5_collection_quota();

CREATE FUNCTION public.phase5_collection(p_id uuid, p_uid uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_jsonb(c) || jsonb_build_object('items', COALESCE((
    SELECT jsonb_agg(to_jsonb(i) - 'collection_id' ORDER BY i.added_at, i.manga_id)
    FROM reader_collection_items i WHERE i.collection_id = c.id
  ), '[]'::jsonb)) FROM reader_collections c
  WHERE c.id = p_id AND (c.visibility = 'public' OR c.owner_uid = p_uid);
$$;

CREATE FUNCTION public.phase5_collection_item(p_uid uuid, p_id uuid, p_manga_id text, p_title text, p_remove boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM reader_collections WHERE id = p_id AND owner_uid = p_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_remove THEN
    DELETE FROM reader_collection_items WHERE collection_id = p_id AND manga_id = p_manga_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM reader_collection_items WHERE collection_id = p_id AND manga_id = p_manga_id)
      AND (SELECT count(*) FROM reader_collection_items WHERE collection_id = p_id) >= 200 THEN
      RAISE EXCEPTION 'Collection item limit reached' USING ERRCODE = '23514';
    END IF;
    INSERT INTO reader_collection_items(collection_id, manga_id, title) VALUES(p_id, p_manga_id, p_title)
    ON CONFLICT(collection_id, manga_id) DO UPDATE SET title = EXCLUDED.title;
  END IF;
  UPDATE reader_collections SET updated_at = now() WHERE id = p_id;
  RETURN true;
END $$;

-- Ranking happens in PostgreSQL before paging, across all live candidate posts.
-- Interest is an explicit saved/read manga signal; no ML, private collection data
-- is used only for its owner's feed. Stable IDs break score/time ties.
CREATE INDEX IF NOT EXISTS phase5_posts_author_time ON public.forum_posts(author_uid, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS phase5_posts_time ON public.forum_posts(created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE FUNCTION public.phase5_feed(p_uid uuid, p_mode text DEFAULT 'following', p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  WITH interests AS (
    SELECT manga_id FROM user_favorites WHERE uid = p_uid
    UNION SELECT manga_id FROM series_follows WHERE uid = p_uid
    UNION SELECT manga_id FROM user_history WHERE uid = p_uid
    UNION SELECT i.manga_id FROM reader_collection_items i JOIN reader_collections c ON c.id = i.collection_id WHERE c.owner_uid = p_uid
  ), candidates AS (
    SELECT p.*, EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_uid = p_uid AND f.following_uid = p.author_uid) AS followed,
      EXISTS(SELECT 1 FROM interests i WHERE i.manga_id = p.target_manga_id) AS interested
    FROM forum_posts p WHERE p.deleted_at IS NULL AND p_mode IN ('following','personalized')
      AND (p_mode = 'personalized' OR EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_uid = p_uid AND f.following_uid = p.author_uid))
  ), ranked AS (
    SELECT c.*, CASE WHEN p_mode = 'following' THEN 0 ELSE
      (CASE WHEN followed THEN 4 ELSE 0 END + CASE WHEN interested THEN 6 ELSE 0 END
      + ln(1 + greatest(0, upvotes - downvotes))) /
      power(1 + greatest(0, extract(epoch FROM (now() - created_at)) / 3600) / 24, 0.8)
      END AS score FROM candidates c
  ), page AS (
    SELECT * FROM ranked ORDER BY score DESC, created_at DESC, id DESC
    LIMIT greatest(1, least(p_limit, 50)) OFFSET greatest(0, least(p_offset, 10000))
  ) SELECT jsonb_build_object('total', (SELECT count(*) FROM candidates), 'items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'authorUid', p.author_uid, 'authorName', a.display_name, 'authorPhotoUrl', a.photo_url,
      'authorRole', a.role, 'title', p.title, 'content', p.content, 'category', p.category,
      'targetMangaId', p.target_manga_id, 'targetMangaTitle', p.target_manga_title, 'targetMangaCover', p.target_manga_cover,
      'imageUrls', COALESCE(to_jsonb(p.image_urls), '[]'::jsonb), 'upvotes', p.upvotes, 'downvotes', p.downvotes,
      'userVote', COALESCE((SELECT v.vote_value FROM forum_votes v WHERE v.uid = p_uid AND v.target_type = 'post' AND v.target_id = p.id), 0),
      'commentCount', (SELECT count(*) FROM forum_comments co WHERE co.post_id = p.id AND co.deleted_at IS NULL),
      'createdAt', p.created_at, 'updatedAt', p.updated_at
    ) ORDER BY p.score DESC, p.created_at DESC, p.id DESC) FROM page p JOIN profiles a ON a.uid = p.author_uid
  ), '[]'::jsonb));
$$;

REVOKE ALL ON FUNCTION public.phase5_collection(uuid,uuid), public.phase5_collection_item(uuid,uuid,text,text,boolean), public.phase5_feed(uuid,text,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_collection(uuid,uuid), public.phase5_collection_item(uuid,uuid,text,text,boolean), public.phase5_feed(uuid,text,int,int) TO service_role;
COMMIT;
