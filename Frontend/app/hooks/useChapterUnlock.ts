"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getWalletBalance,
  getUnlocksForTitle,
  purchaseUnlock,
  type PurchaseResult,
} from "../lib/studioApi";
import { errMessage } from "../../lib/errMessage";
import type { MangaChapter } from "../lib/types";

export interface PerformUnlockDeps {
  getIdToken: () => Promise<string | null>;
  purchaseUnlock: (token: string, versionId: string) => Promise<PurchaseResult>;
  setPurchasingId: (id: string | null) => void;
  onSuccess: (result: PurchaseResult) => void; // caller: add versionId to set, balance+event, auto-open
  onInsufficient: () => void; // caller: open topup
  onError: (msg: string) => void; // caller: alert
}

/**
 * Payment-sensitive purchase flow, dependency-injected so it is unit-testable without React.
 * Ordering (must preserve): set purchasing BEFORE the await; token-null -> early return; the single
 * atomic purchaseUnlock is the debit+unlock; onSuccess fires ONLY when result.unlocked||alreadyUnlocked;
 * Insufficient/ไม่พอ -> onInsufficient else onError; purchasingId cleared in finally on EVERY path.
 */
export async function performChapterUnlock(deps: PerformUnlockDeps, versionId: string): Promise<void> {
  deps.setPurchasingId(versionId);
  try {
    const token = await deps.getIdToken();
    if (!token) return;
    const result = await deps.purchaseUnlock(token, versionId);
    if (result.unlocked || result.alreadyUnlocked) deps.onSuccess(result);
  } catch (err: unknown) {
    const msg = errMessage(err);
    if (msg.includes("Insufficient") || msg.includes("ไม่พอ")) deps.onInsufficient();
    else deps.onError(msg || "ไม่สามารถปลดล็อคได้");
  } finally {
    deps.setPurchasingId(null);
  }
}

export interface UseChapterUnlockArgs {
  titleId: string;
  user: unknown | null;
  getIdToken: () => Promise<string | null>;
  onUnlocked: (ch: MangaChapter, result: PurchaseResult) => void; // component: addToHistory + setActiveChapter
}

export function useChapterUnlock({ titleId, user, getIdToken, onUnlocked }: UseChapterUnlockArgs) {
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [unlockedVersions, setUnlockedVersions] = useState<Set<string>>(new Set());
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);

  // Fetch wallet balance and unlock status for user-uploaded chapters
  useEffect(() => {
    if (!user) return;
    const fetchWalletAndUnlocks = async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const [walletData, unlockData] = await Promise.all([
          getWalletBalance(token),
          getUnlocksForTitle(token, titleId),
        ]);
        setCoinBalance(walletData.balance);
        setUnlockedVersions(new Set(unlockData));
      } catch {
        // Wallet/unlock not available yet
      }
    };
    fetchWalletAndUnlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, titleId]);

  const purchase = useCallback(
    async (ch: MangaChapter) => {
      if (!user || !ch.versionId) return;
      const versionId = ch.versionId;
      await performChapterUnlock(
        {
          getIdToken,
          purchaseUnlock,
          setPurchasingId,
          onSuccess: (result) => {
            setUnlockedVersions((prev) => new Set([...prev, versionId]));
            if (result.balance !== undefined) {
              setCoinBalance(result.balance);
              window.dispatchEvent(
                new CustomEvent("mb:coin-balance-update", { detail: { balance: result.balance } }),
              );
            }
            onUnlocked(ch, result);
          },
          onInsufficient: () => setTopupOpen(true),
          onError: (msg) => alert(msg || "ไม่สามารถปลดล็อคได้"),
        },
        versionId,
      );
    },
    [user, getIdToken, onUnlocked],
  );

  return { coinBalance, unlockedVersions, purchasingId, topupOpen, setTopupOpen, purchase };
}
