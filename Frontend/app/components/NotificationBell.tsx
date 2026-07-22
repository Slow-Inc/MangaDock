"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import type { NotificationItem } from "../lib/notificationTypes";

const POLL_INTERVAL = 60_000;

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T | null> {
  const token = await getToken();
  if (!token) return null;
  const res = await fetch(path, {
    ...opts,
    headers: { ...(opts?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    const data = await apiFetch<{ count: number }>("/api/proxy/notifications/unread-count");
    if (data) setUnread(data.count);
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch<NotificationItem[]>("/api/proxy/notifications");
    if (data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchCount]);

  useEffect(() => {
    if (!open) return;
    fetchList();
  }, [open, fetchList]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleMarkRead(id: string) {
    await apiFetch(`/api/proxy/notifications/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    await apiFetch("/api/proxy/notifications/read-all", { method: "PATCH" });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "เมื่อกี้";
    if (m < 60) return `${m} นาทีที่แล้ว`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ชม.ที่แล้ว`;
    return `${Math.floor(h / 24)} วันที่แล้ว`;
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white/90"
        aria-label="การแจ้งเตือน"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4.5 w-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-xs font-bold text-white leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Notification panel */}
      <div className={`absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-black/85 shadow-2xl backdrop-blur-2xl transition-all duration-200 origin-top-right ${
        open ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
      }`}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-semibold text-white/90">การแจ้งเตือน</p>
          {unread > 0 && (
            <button onClick={handleMarkAllRead} className="text-xs text-indigo-400 transition hover:text-indigo-300">
              อ่านทั้งหมด
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-white/30">กำลังโหลด...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-white/30">ไม่มีการแจ้งเตือน</div>
          ) : (
            items.map((n) => {
              const inner = (
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition hover:bg-white/5 ${!n.read ? "bg-indigo-500/5" : ""}`}
                  onClick={() => { if (!n.read) handleMarkRead(n.id); setOpen(false); }}
                >
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-indigo-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.read ? "text-white/50" : "text-white/85"}`}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-white/35 line-clamp-2">{n.body}</p>}
                    <p className="mt-1 text-xs text-white/25">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link}>{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
