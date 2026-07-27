"use client";
import { useCallback, useRef, useState } from "react";
import ReauthModal from "../components/ReauthModal";

const REAUTH_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useReauth(actionLabel?: string) {
  const [showModal, setShowModal] = useState(false);
  const [reauthTs, setReauthTs] = useState(0);
  const pendingRef = useRef<(() => Promise<void>) | null>(null);

  const withReauth = useCallback(
    (fn: () => Promise<void>) =>
      async () => {
        if (Date.now() - reauthTs < REAUTH_TTL_MS) {
          await fn();
          return;
        }
        pendingRef.current = fn;
        setShowModal(true);
      },
    [reauthTs],
  );

  const handleSuccess = useCallback(async () => {
    setReauthTs(Date.now());
    setShowModal(false);
    const fn = pendingRef.current;
    pendingRef.current = null;
    if (fn) await fn();
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
    pendingRef.current = null;
  }, []);

  const ReauthModalNode = (
    <ReauthModal
      isOpen={showModal}
      onClose={handleClose}
      onSuccess={handleSuccess}
      actionLabel={actionLabel}
    />
  );

  return { withReauth, ReauthModalNode };
}
