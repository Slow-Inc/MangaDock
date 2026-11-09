"use client";

/** Keeps the client's 18+ level (lib/contentLevel) in step with the session (#1102): off when signed out. */
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { setContentLevel } from "../lib/contentLevel";
import { getContentSettings } from "../lib/contentSettingsApi";

export default function ContentLevelSync() {
  const { user, getIdToken } = useAuth();
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) {
      setContentLevel("off");
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await getIdToken();
      if (!token || cancelled) return;
      try {
        const s = await getContentSettings(token);
        if (!cancelled) setContentLevel(s.level);
      } catch {
        // unreadable settings: stay off (the server fails closed too)
      }
    })();
    return () => { cancelled = true; };
  }, [uid, getIdToken]);
  return null;
}
