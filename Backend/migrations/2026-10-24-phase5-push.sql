BEGIN;
CREATE INDEX IF NOT EXISTS phase5_series_followers ON public.series_follows(manga_id, uid);
CREATE TABLE public.push_devices (
  device_id text PRIMARY KEY CHECK(length(device_id) BETWEEN 1 AND 200),
  uid uuid NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  platform text NOT NULL CHECK(platform IN ('android','ios')),
  binding_id uuid NOT NULL DEFAULT gen_random_uuid(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.push_devices(uid);
CREATE TABLE public.push_preferences (
  uid uuid PRIMARY KEY REFERENCES public.profiles(uid) ON DELETE CASCADE,
  new_chapter boolean NOT NULL DEFAULT true,
  new_follower boolean NOT NULL DEFAULT true
);
CREATE TABLE public.push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  uid uuid NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  device_id text NOT NULL,
  binding_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','working','delivered','skipped','dead')),
  phase text NOT NULL DEFAULT 'send' CHECK(phase IN ('send','receipt')),
  attempts int NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease uuid,
  locked_until timestamptz,
  ticket_id text,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, device_id)
);
CREATE INDEX ON public.push_outbox(available_at) WHERE state IN ('ready','working');
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_devices, public.push_preferences, public.push_outbox FROM anon, authenticated;
GRANT ALL ON public.push_devices, public.push_preferences, public.push_outbox TO service_role;

CREATE FUNCTION public.phase5_push_register(p_uid uuid, p_device text, p_token text, p_platform text)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Small registration transaction, serialized across nodes to keep device AND
  -- token unique during simultaneous account swaps. Sending never takes this lock.
  PERFORM pg_advisory_xact_lock(520241024);
  DELETE FROM push_devices WHERE token = p_token AND device_id <> p_device;
  INSERT INTO push_devices(device_id,uid,token,platform) VALUES(p_device,p_uid,p_token,p_platform)
  ON CONFLICT(device_id) DO UPDATE SET uid = EXCLUDED.uid, token = EXCLUDED.token,
    platform = EXCLUDED.platform, last_seen_at = now(),
    binding_id = CASE WHEN push_devices.uid = EXCLUDED.uid AND push_devices.token = EXCLUDED.token
      THEN push_devices.binding_id ELSE gen_random_uuid() END;
  RETURN true;
END $$;

CREATE FUNCTION public.phase5_notification_outbox() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type IN ('new_chapter','new_follower') THEN
    INSERT INTO push_outbox(notification_id,uid,device_id,binding_id)
    SELECT NEW.id, NEW.uid, d.device_id, d.binding_id FROM push_devices d
    LEFT JOIN push_preferences p ON p.uid = d.uid
    WHERE d.uid = NEW.uid AND d.last_seen_at > now() - interval '30 days'
      AND CASE NEW.type WHEN 'new_chapter' THEN COALESCE(p.new_chapter,true) ELSE COALESCE(p.new_follower,true) END
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase5_notification_outbox AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.phase5_notification_outbox();

CREATE FUNCTION public.phase5_follow_notification() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.follower_uid <> NEW.following_uid THEN
    INSERT INTO notifications(uid,type,title,body,link) VALUES(NEW.following_uid,'new_follower','มีผู้ติดตามใหม่','มีความเคลื่อนไหวใหม่','/community/profile/' || NEW.follower_uid::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase5_follow_notification AFTER INSERT ON public.user_follows FOR EACH ROW EXECUTE FUNCTION public.phase5_follow_notification();

-- One announcement per published version, including a moderation transition;
-- editing or republishing the same version does not notify a second time.
CREATE TABLE public.push_chapter_announcements(version_id uuid PRIMARY KEY REFERENCES public.chapter_versions(version_id) ON DELETE CASCADE);
ALTER TABLE public.push_chapter_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_chapter_announcements FROM anon, authenticated;
GRANT ALL ON public.push_chapter_announcements TO service_role;
-- Do not backfill notifications for already published chapters.
INSERT INTO public.push_chapter_announcements SELECT version_id FROM public.chapter_versions WHERE status IN ('published','approved');
CREATE FUNCTION public.phase5_chapter_notification() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('published','approved') THEN
    INSERT INTO push_chapter_announcements VALUES(NEW.version_id) ON CONFLICT DO NOTHING;
    IF FOUND THEN
      INSERT INTO notifications(uid,type,title,body,link)
      SELECT f.uid,'new_chapter','มีตอนใหม่','มีความเคลื่อนไหวใหม่','/book/' || NEW.title_id
      FROM series_follows f WHERE f.manga_id = NEW.title_id AND f.uid <> NEW.translator_uid;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase5_chapter_notification AFTER INSERT OR UPDATE OF status ON public.chapter_versions
FOR EACH ROW EXECUTE FUNCTION public.phase5_chapter_notification();

CREATE FUNCTION public.phase5_push_due() RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) FROM (
    SELECT id FROM push_outbox WHERE (state = 'ready' AND available_at <= now())
      OR (state = 'working' AND locked_until <= now())
    ORDER BY available_at,id LIMIT 100
  ) due;
$$;
CREATE FUNCTION public.phase5_push_claim(p_id uuid, p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE job push_outbox; result jsonb;
BEGIN
  SELECT * INTO job FROM push_outbox WHERE id = p_id AND
    ((state = 'ready' AND available_at <= now()) OR (state = 'working' AND locked_until <= now()))
    FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF job.created_at < now() - interval '24 hours' OR job.attempts >= 5 THEN
    UPDATE push_outbox SET state = 'dead', outcome = 'expired_or_exhausted', lease = NULL WHERE id = p_id;
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object('id',job.id,'uid',job.uid,'token',d.token,'link',n.link,
    'notification_id',job.notification_id,'phase',job.phase,'ticket_id',job.ticket_id)
  INTO result FROM push_devices d JOIN notifications n ON n.id = job.notification_id
    LEFT JOIN push_preferences p ON p.uid = job.uid
  WHERE d.device_id = job.device_id AND d.uid = job.uid AND n.uid = job.uid AND d.binding_id = job.binding_id
    AND d.last_seen_at > now() - interval '30 days'
    AND CASE n.type WHEN 'new_chapter' THEN COALESCE(p.new_chapter,true) WHEN 'new_follower' THEN COALESCE(p.new_follower,true) ELSE false END;
  IF result IS NULL THEN
    UPDATE push_outbox SET state = 'skipped', outcome = 'binding_or_preference_changed', lease = NULL WHERE id = p_id;
    RETURN NULL;
  END IF;
  UPDATE push_outbox SET state = 'working', lease = p_lease, locked_until = now() + interval '2 minutes', attempts = attempts + 1 WHERE id = p_id;
  RETURN result;
END $$;

CREATE FUNCTION public.phase5_push_finish(p_id uuid, p_lease uuid, p_outcome text, p_ticket text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE job push_outbox; next_state text;
BEGIN
  SELECT * INTO job FROM push_outbox WHERE id = p_id AND state = 'working' AND lease = p_lease FOR UPDATE;
  IF NOT FOUND THEN RETURN 'stale'; END IF;
  IF p_outcome = 'invalid' THEN
    DELETE FROM push_devices WHERE device_id = job.device_id AND uid = job.uid AND binding_id = job.binding_id;
  END IF;
  next_state := CASE WHEN p_outcome = 'ticket' AND p_ticket IS NOT NULL THEN 'ready'
    WHEN p_outcome = 'delivered' THEN 'delivered'
    WHEN p_outcome IN ('invalid','dead') OR job.attempts >= 5 THEN 'dead' ELSE 'ready' END;
  UPDATE push_outbox SET state = next_state, outcome = p_outcome, lease = NULL, locked_until = NULL,
    phase = CASE WHEN p_outcome = 'ticket' THEN 'receipt' ELSE phase END,
    ticket_id = COALESCE(p_ticket,ticket_id),
    attempts = CASE WHEN p_outcome = 'ticket' THEN 0 ELSE attempts END,
    available_at = now() + CASE WHEN p_outcome = 'ticket' OR phase = 'receipt' THEN interval '15 minutes' ELSE interval '30 seconds' * power(2, attempts - 1) END
  WHERE id = p_id;
  RETURN next_state;
END $$;

REVOKE ALL ON FUNCTION public.phase5_push_register(uuid,text,text,text), public.phase5_push_due(), public.phase5_push_claim(uuid,uuid), public.phase5_push_finish(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_push_register(uuid,text,text,text), public.phase5_push_due(), public.phase5_push_claim(uuid,uuid), public.phase5_push_finish(uuid,uuid,text,text) TO service_role;
COMMIT;
