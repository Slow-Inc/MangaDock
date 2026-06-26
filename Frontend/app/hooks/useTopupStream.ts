"use client";

import { useState, useEffect, useRef } from "react";
import { subscribeTopupStream, getTopupStatus } from "../lib/studioApi";

export type TopupStreamStatus = "pending" | "paid" | "expired";

export function computeCountdown(expiresAt: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
}

export function useTopupStream(
  paymentId: string,
  expiresAt: Date | null,
  getIdToken: () => Promise<string | null>,
) {
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState<TopupStreamStatus>("pending");
  const [successBalance, setSuccessBalance] = useState<number | null>(null);

  // Stable ref so effects don't re-run when getIdToken identity changes
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;
  const statusRef = useRef(status);
  statusRef.current = status;

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || status !== "pending") return;
    const tick = () => {
      const remaining = computeCountdown(expiresAt);
      setCountdown(remaining);
      if (remaining === 0) setStatus("expired");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, status]);

  // SSE subscription — reconnects if status reverts to pending (e.g. new QR)
  useEffect(() => {
    if (status !== "pending" || !paymentId) return;
    let cleanup: (() => void) | null = null;
    getIdTokenRef.current().then((token) => {
      if (!token || statusRef.current !== "pending") return;
      cleanup = subscribeTopupStream(
        token,
        paymentId,
        (balance) => {
          setSuccessBalance(balance);
          setStatus("paid");
          window.dispatchEvent(
            new CustomEvent("mb:coin-balance-update", { detail: { balance } }),
          );
        },
        () => {
          // silent — countdown handles timeout UX
        },
      );
    });
    return () => cleanup?.();
  }, [paymentId, status]);

  // Visibility change fallback: catches payment confirmed while user was in banking app
  useEffect(() => {
    if (status !== "pending" || !paymentId) return;
    const handler = async () => {
      if (document.visibilityState !== "visible") return;
      if (statusRef.current !== "pending") return;
      try {
        const token = await getIdTokenRef.current();
        if (!token) return;
        const { status: s, balance } = await getTopupStatus(token, paymentId);
        if (s === "paid" && balance !== undefined) {
          setSuccessBalance(balance);
          setStatus("paid");
          window.dispatchEvent(
            new CustomEvent("mb:coin-balance-update", { detail: { balance } }),
          );
        } else if (s === "expired") {
          setStatus("expired");
        }
      } catch {
        // silent — SSE + countdown handle remaining UX
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [paymentId, status]);

  return { countdown, status, successBalance };
}
