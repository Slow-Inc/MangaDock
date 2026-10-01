"use client";

import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

type Status = { checkedInToday: boolean; streakDay: number; coinsToday: number };

const STORAGE_KEY = "mangadock_checkin_date";

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="inline-block">
      <circle cx="12" cy="12" r="10" fill="#F59E0B" />
      <circle cx="12" cy="12" r="7.5" fill="#FBBF24" />
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#92400E">C</text>
    </svg>
  );
}

function StreakFlame({ day }: { day: number }) {
  const milestones = [1, 3, 7, 14, 30];
  return (
    <div className="flex items-center justify-center gap-1.5">
      {milestones.map((m) => (
        <div key={m} className={`flex flex-col items-center ${day >= m ? "opacity-100" : "opacity-25"}`}>
          <span className="text-base">{day >= m ? "🔥" : "○"}</span>
          <span className="text-xs text-white/40">{m}</span>
        </div>
      ))}
    </div>
  );
}

export default function DailyCheckinModal() {
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toDateString();
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
    try {
      const token = await getToken();
      const res = await fetch("/api/proxy/checkin", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Status = await res.json();
        setStatus(data);
        setClaimed(true);
        localStorage.setItem(STORAGE_KEY, new Date().toDateString());
      }
    } finally {
      setClaiming(false);
    }
  }

  function handleClose() {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, new Date().toDateString());
  }

  if (!open || !status) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs overflow-hidden rounded-3xl border border-white/10 bg-[#18181b] shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-b from-amber-500/20 to-transparent px-6 pb-4 pt-8 text-center">
          <div className="mb-2 text-5xl">🌅</div>
          <p className="text-lg font-black text-white/90">เช็คอินประจำวัน</p>
          <p className="mt-0.5 text-sm text-white/40">
            {claimed ? `วันที่ ${status.streakDay} ติดต่อกัน! 🎉` : "อย่าลืมเช็คอินทุกวันเพื่อรับรางวัล"}
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
          {/* Streak progress */}
          <div className="mb-5 rounded-2xl border border-white/8 bg-white/3 p-4">
            <p className="mb-3 text-center text-xs text-white/40">Streak ปัจจุบัน</p>
            <StreakFlame day={status.streakDay} />
            <p className="mt-2 text-center text-xs text-amber-400/80">
              {status.streakDay} วันติดต่อกัน
            </p>
          </div>

          {/* Coin reward */}
          <div className={`mb-5 flex items-center justify-center gap-2 rounded-2xl border py-4 ${claimed ? "border-amber-500/40 bg-amber-500/10" : "border-white/8 bg-white/3"}`}>
            <CoinIcon size={28} />
            <div className="text-center">
              <span className="text-3xl font-black text-amber-400">+{status.coinsToday}</span>
              <p className="text-xs text-white/40">เหรียญ{claimed ? " (รับแล้ว)" : ""}</p>
            </div>
          </div>

          {claimed ? (
            <button
              onClick={handleClose}
              className="w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/15"
            >
              ปิด
            </button>
          ) : (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-black text-black transition enabled:hover:bg-amber-400 disabled:opacity-50"
            >
              {claiming ? "กำลังรับ..." : `รับ ${status.coinsToday} เหรียญ!`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
