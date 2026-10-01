"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SearchBar from "./SearchBar";
import LoginModal from "./LoginModal";
import { useAuth } from "../contexts/AuthContext";
import TopupModal from "./TopupModal";
import { getWalletBalance } from "../lib/studioApi";
import NotificationBell from "./NotificationBell";

export default function NavbarActions() {
  const router = useRouter();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, loading, signOut, getIdToken } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch coin balance when user logs in / out
  useEffect(() => {
    if (!user) { setCoinBalance(null); return; }
    getIdToken().then((token) => {
      if (!token) return;
      getWalletBalance(token).then((r) => setCoinBalance(r.balance)).catch(() => {});
    });
  }, [user, getIdToken]);

  // Listen for balance updates dispatched by TopupModal on success
  useEffect(() => {
    const handler = (e: Event) => {
      setCoinBalance((e as CustomEvent<{ balance: number }>).detail.balance);
    };
    window.addEventListener("mb:coin-balance-update", handler);
    return () => window.removeEventListener("mb:coin-balance-update", handler);
  }, []);

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <SearchBar />

        {loading ? (
  /* ── Skeleton while auth session restores ── */
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
            <div className="h-6.5 w-6.5 animate-pulse rounded-full bg-white/15" />
            <div className="hidden h-3 w-16 animate-pulse rounded bg-white/10 md:block" />
          </div>
        ) : user ? (
          /* ── Coin chip + User avatar + dropdown ── */
          <>
          <NotificationBell />
          {coinBalance !== null && (
            <button
              onClick={() => setTopupOpen(true)}
              className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-300 smooth-hover-fast hover:bg-amber-400/20"
              title="เติมเหรียญ"
            >
              🪙 {coinBalance.toLocaleString()}
            </button>
          )}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-white/80 backdrop-blur-xl smooth-hover-fast hover:bg-white/20 hover:text-white md:text-sm"
            >
              {user.photoURL ? (
                <div className="relative h-6.5 w-6.5 shrink-0 overflow-hidden rounded-full">
                  <Image
                    src={user.photoURL}
                    alt={user.displayName ?? "User"}
                    fill
                    sizes="26px"
                    className="object-cover"
                    // GIFs cannot be optimized; graph.facebook.com URLs are redirects
                    unoptimized={user.photoURL.toLowerCase().endsWith('.gif') || user.photoURL.includes('graph.facebook.com')}
                  />
                </div>
              ) : (
                <span className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold uppercase">
                  {(user.displayName ?? user.email ?? "U")[0]}
                </span>
              )}
              <span className="hidden max-w-25 truncate md:block">
                {user.displayName ?? user.email}
              </span>
            </button>

            <div className={`absolute right-0 top-11 z-50 min-w-40 overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-xl backdrop-blur-2xl transition-all duration-200 origin-top-right ${
              menuOpen
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
            }`}>
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="truncate text-xs font-semibold text-white">
                    {user.displayName}
                  </p>
                  <p className="truncate text-xs text-white/40">{user.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); router.push(`/community/profile/${user.uid}`); }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  โปรไฟล์ของฉัน
                </button>
                <button
                  onClick={() => { setMenuOpen(false); router.push("/studio"); }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
                  </svg>
                  Studio
                </button>
                <button
                  onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  จัดการบัญชี
                </button>
                {user.role != null && user.role >= 8 && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-400/80 transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await new Promise(r => setTimeout(r, 200));
                    await signOut();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                  </svg>
                  ออกจากระบบ
                </button>
            </div>
          </div>
          </>
        ) : (
          /* ── Sign-in button ── */
          <button
            onClick={() => setIsLoginOpen(true)}
            className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/80 backdrop-blur-xl smooth-hover-fast hover:bg-white/20 hover:text-white sm:px-4 md:text-sm"
          >
            เข้าสู่ระบบ
          </button>
        )}
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <TopupModal isOpen={topupOpen} onClose={() => setTopupOpen(false)} />
    </>
  );
}
