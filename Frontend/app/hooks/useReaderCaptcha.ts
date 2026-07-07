"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "../lib/apiFetch";

const API_BASE = "/api/proxy";

export interface ReaderCaptcha {
  clearanceToken: string | null;
  turnstilePassed: boolean;
  turnstileExiting: boolean;
  setTurnstileExiting: (v: boolean) => void;
  onVerify: (token: string) => void;
  resetCaptcha: () => void;
}

/**
 * Cloudflare Turnstile captcha state for the manga reader. Extracted from
 * MangaReader (#582) — verbatim logic, same class names/animation timing.
 *
 * The clearance token is restored via a lazy initializer (not a mount
 * effect): the component renders null until `mounted`, so there is no
 * SSR/hydration-mismatch window, and a returning reader skips the Turnstile
 * modal flash entirely.
 */
export function useReaderCaptcha(): ReaderCaptcha {
  const [clearanceToken, setClearanceToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("cf_clearance_token"),
  );
  const [turnstilePassed, setTurnstilePassed] = useState(clearanceToken !== null);
  const [turnstileExiting, setTurnstileExiting] = useState(false);

  // Drop the stale HWID-bound clearance token and re-show the Turnstile modal.
  // Shared by the page-fetch 401 path and the translate 401 path (#227) so both
  // recover the same way instead of dead-ending.
  const resetCaptcha = useCallback(() => {
    localStorage.removeItem("cf_clearance_token");
    setClearanceToken(null);
    setTurnstilePassed(false);
  }, []);

  // Persist the clearance token returned by the verify-captcha endpoint, then
  // play the same slide/scale-out exit animation before revealing the reader.
  const onVerify = useCallback((token: string) => {
    apiFetch(`${API_BASE}/books/verify-captcha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then(r => r.json())
      .then(data => {
        if (data.clearanceToken) {
          localStorage.setItem("cf_clearance_token", data.clearanceToken);
          setClearanceToken(data.clearanceToken);
          setTurnstileExiting(true);
          setTimeout(() => {
            setTurnstilePassed(true);
            setTurnstileExiting(false);
          }, 300); // Wait for the slide down animation to finish
        }
      })
      .catch(console.error);
  }, []);

  return {
    clearanceToken,
    turnstilePassed,
    turnstileExiting,
    setTurnstileExiting,
    onVerify,
    resetCaptcha,
  };
}
