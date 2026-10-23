"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { PRIMARY_FILL } from "./ui/Button";
import { Flame } from "lucide-react";
import Coin from "./ui/Coin";
import Mascot from "./mascot/Mascot";
import { checkinErrorMessage, utcDayKey } from "../lib/dailyCheckin";
import { getWalletBalance } from "../lib/studioApi";
import type { CoinBalanceUpdate } from "../lib/coinBalanceEvent";
import { useModalDialog } from "../hooks/useDialogFocus";

type Status = { checkedInToday: boolean; streakDay: number; coinsToday: number };

const STORAGE_KEY = "mangadock_checkin_date";

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function StreakFlame({ day }: { day: number }) {
  const milestones = [1, 3, 7, 14, 30];
  return (
    <div className="flex items-center justify-center gap-1.5">
      {milestones.map((m) => (
        <div key={m} className={`flex flex-col items-center gap-0.5 ${day >= m ? "text-coin" : "text-ink-3 opacity-40"}`}>
          <Flame aria-hidden className="h-4 w-4" strokeWidth={day >= m ? 2 : 1.5} fill={day >= m ? "currentColor" : "none"} />
          <span className="text-xs text-ink-3">{m}</span>
        </div>
      ))}
    </div>
  );
}

export default function DailyCheckinModal() {
  const { user, showLoginPrompt } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const today = utcDayKey(new Date());
    if (localStorage.getItem(STORAGE_KEY) === today) return;

    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const res = await fetch("/api/proxy/checkin/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const data: Status = await res.json();
      if (!data.checkedInToday) {
        setStatus(data);
        setOpen(true);
      } else {
        localStorage.setItem(STORAGE_KEY, today);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function handleClaim() {
    if (claiming) return;
    setClaiming(true);
    setError("");
    try {
      const token = await getToken();
      // Signed out under us: the login prompt, not a dead-end message (CLAUDE.md: always showLoginPrompt()).
      if (!token) { showLoginPrompt(); return; }
      const res = await fetch("/api/proxy/checkin", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Status = await res.json();
        setStatus(data);
        setClaimed(true);
        localStorage.setItem(STORAGE_KEY, utcDayKey(new Date()));
        // Update the navbar coin chip: authoritative total if the refetch works,
        // otherwise the amount the server just credited.
        getWalletBalance(token)
          .then((r): CoinBalanceUpdate => ({ balance: r.balance }))
          .catch((): CoinBalanceUpdate => ({ delta: data.coinsToday }))
          .then((detail) => window.dispatchEvent(new CustomEvent("mb:coin-balance-update", { detail })));
      } else if (res.status === 401) {
        showLoginPrompt();
      } else {
        setError(checkinErrorMessage(res.status));
        // Already claimed today (e.g. in another tab): let the user close the modal.
        if (res.status === 409) {
          setClaimed(true);
          localStorage.setItem(STORAGE_KEY, utcDayKey(new Date()));
        }
      }
    } catch {
      setError(checkinErrorMessage(null));
    } finally {
      setClaiming(false);
    }
  }

  function handleClose() {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, utcDayKey(new Date()));
  }

  // Escape does what the visible close does: before the claim there is no close, only the claim button
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDialog(dialogRef, () => { if (claimed) handleClose(); }, open && !!status);

  if (!open || !status) return null;

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="เช็คอินประจำวัน"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim/70 p-4 outline-none">
      <div className="w-full max-w-xs overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="relative px-6 pb-4 pt-8 text-center">
          <div className="mb-2 flex justify-center">
            <Mascot area="wallet" size={72} />
          </div>
          <p className="text-lg font-black text-ink">เช็คอินประจำวัน</p>
          <p className="mt-0.5 text-sm text-ink-3">
            {claimed ? `วันที่ ${status.streakDay} ติดต่อกัน!` : "อย่าลืมเช็คอินทุกวันเพื่อรับรางวัล"}
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
          {/* Streak progress */}
          <div className="mb-5 rounded-2xl border border-line bg-fill p-4">
            <p className="mb-3 text-center text-xs text-ink-3">Streak ปัจจุบัน</p>
            <StreakFlame day={status.streakDay} />
            <p className="mt-2 text-center text-xs text-accent">
              {status.streakDay} วันติดต่อกัน
            </p>
          </div>

          {/* Coin reward */}
          <div className={`mb-5 flex items-center justify-center gap-2 rounded-2xl border py-4 ${claimed ? "border-coin/40 bg-coin/10" : "border-line bg-fill"}`}>
            <Coin size={28} className="text-coin" />
            <div className="text-center">
              <span className="text-3xl font-black text-coin">+{status.coinsToday}</span>
              <p className="text-xs text-ink-3">เหรียญ{claimed ? " (รับแล้ว)" : ""}</p>
            </div>
          </div>

          <div role="alert">{error && <p className="mb-3 text-center text-xs text-danger">{error}</p>}</div>

          {claimed ? (
            <button
              onClick={handleClose}
              className="w-full rounded-2xl bg-fill py-3 text-sm font-semibold text-ink-2 transition hover:bg-raised"
            >
              ปิด
            </button>
          ) : (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className={`w-full rounded-2xl ${PRIMARY_FILL} py-3 text-sm font-black transition disabled:opacity-50`}
            >
              {claiming ? "กำลังรับ..." : `รับ ${status.coinsToday} เหรียญ!`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
