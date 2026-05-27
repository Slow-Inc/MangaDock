"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { getProfile, uploadProfileBanner, updateBannerPosition } from "../../../lib/communityApi";
import PostCard from "../../../components/PostCard";
import { useAuth } from "../../../contexts/AuthContext";
import type { UserProfileResponse } from "../../../lib/types";

type Tab = "posts" | "comments" | "liked" | "translated";

const LANG_LABEL: Record<string, string> = {
  th: "ไทย",
  en: "อังกฤษ",
  ja: "ญี่ปุ่น",
  ko: "เกาหลี",
  zh: "จีน",
};

function RoleBadge({ role }: { role: string }) {
  if (role === "user") return null;
  const map: Record<string, { cls: string; label: string }> = {
    translator: { cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", label: "Translator" },
    creator:    { cls: "bg-orange-500/15 text-orange-400 border-orange-500/30", label: "Creator" },
    admin:      { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Admin" },
    moderator:  { cls: "bg-purple-500/15 text-purple-400 border-purple-500/30", label: "Moderator" },
  };
  const { cls, label } = map[role] ?? { cls: "bg-white/10 text-white/60 border-white/20", label: role };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-14 text-center">
      <p className="text-white/20 font-bold text-sm">{text}</p>
    </div>
  );
}

export default function PublicProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();

  const [data, setData] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("posts");

  // Banner upload
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Banner reposition
  const [repositioning, setRepositioning] = useState(false);
  const [repoAnim, setRepoAnim] = useState<"entering" | "exiting" | null>(null);
  const [bannerYPos, setBannerYPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [savingPos, setSavingPos] = useState(false);
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);

  const openReposition = () => { setRepositioning(true);  setRepoAnim("entering"); };
  const closeReposition = () => { setRepositioning(false); setRepoAnim("exiting"); };

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    getProfile(uid)
      .then((d) => {
        setData(d);
        setBannerYPos(d.profile.bannerPosition ?? 50);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-52 rounded-2xl bg-white/5" />
        <div className="h-10 rounded-xl bg-white/5" />
        <div className="h-72 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-white/40">ไม่พบโปรไฟล์</div>;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const { bannerUrl } = await uploadProfileBanner(file);
      setData((prev) =>
        prev ? { ...prev, profile: { ...prev.profile, bannerUrl } } : prev
      );
      // Enter reposition mode automatically after upload
      openReposition();
    } catch (err) {
      console.error("Failed to upload banner", err);
    } finally {
      setUploadingBanner(false);
      e.target.value = "";
    }
  };

  const handleBannerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!repositioning || !bannerContainerRef.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    const containerH = bannerContainerRef.current.clientHeight;
    dragRef.current = { startY: e.clientY, startPos: bannerYPos };

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      if (!dragRef.current) return;
      const deltaY = ev.clientY - dragRef.current.startY;
      setBannerYPos(Math.max(0, Math.min(100,
        dragRef.current.startPos - (deltaY / containerH) * 100
      )));
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
  };

  const handleSavePosition = async () => {
    setSavingPos(true);
    try {
      await updateBannerPosition(bannerYPos);
      setData((prev) =>
        prev ? { ...prev, profile: { ...prev.profile, bannerPosition: bannerYPos } } : prev
      );
      closeReposition();
    } catch (err) {
      console.error("Failed to save banner position", err);
    } finally {
      setSavingPos(false);
    }
  };

  const handleCancelPosition = () => {
    setBannerYPos(data?.profile?.bannerPosition ?? 50);
    closeReposition();
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const { profile, posts, comments, likedPosts, translatedTitles, earnings } = data;
  const isCreator = profile.role === "translator" || profile.role === "creator";
  const isOwnProfile = user?.uid === profile.uid;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "posts",      label: "โพสต์",         count: posts.length },
    { id: "comments",   label: "ความคิดเห็น",   count: comments.length },
    { id: "liked",      label: "ถูกใจ",          count: likedPosts.length },
    ...(isCreator ? [{ id: "translated" as Tab, label: "มังงะที่แปล", count: translatedTitles.length }] : []),
  ];

  const gradientClass =
    profile.role === "translator"
      ? "bg-gradient-to-br from-indigo-950/80 via-indigo-900/30 to-[#141414]"
      : profile.role === "creator"
      ? "bg-gradient-to-br from-orange-950/70 via-orange-900/25 to-[#141414]"
      : "bg-gradient-to-br from-white/[0.06] to-[#141414]";

  return (
    <div className="space-y-5">
      {/* ── Profile Header Card ── */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl">

        {/* Banner */}
        <div
          ref={bannerContainerRef}
          className="relative h-28 sm:h-40 overflow-hidden bg-[#141414] rounded-t-2xl"
        >
          {profile.bannerUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.bannerUrl}
              alt="banner"
              draggable={false}
              className="w-full h-full object-cover select-none"
              style={{ objectPosition: `center ${bannerYPos}%` }}
            />
          ) : (
            <div className={`w-full h-full ${gradientClass}`} />
          )}

          {/* Scrim */}
          {profile.bannerUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          )}

          {/* Own-profile overlays */}
          {isOwnProfile && (
            <>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleBannerChange}
              />

              {repositioning ? (
                /* ── Reposition drag surface ── */
                <div
                  className={`absolute inset-0 flex items-center justify-center select-none ${
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  style={{ touchAction: "none" }}
                  onPointerDown={handleBannerPointerDown}
                >
                  <div className="pointer-events-none flex flex-col items-center gap-2">
                    <svg className="w-6 h-6 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <span className="text-white text-xs font-semibold bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                      ลากเพื่อปรับตำแหน่ง
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Mobile: persistent icon buttons at bottom-right (touch has no hover) ── */}
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 sm:hidden z-10">
                    {uploadingBanner ? (
                      <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => bannerInputRef.current?.click()}
                          className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
                          aria-label="อัปโหลด Banner"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        {profile.bannerUrl && (
                          <button
                            onClick={openReposition}
                            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
                            aria-label="ปรับตำแหน่ง Banner"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Desktop: hover overlay (sm+, hover exists) ── */}
                  <div className="hidden sm:flex absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors items-center justify-center group">
                    {uploadingBanner ? (
                      <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-5">
                        <button
                          onClick={() => bannerInputRef.current?.click()}
                          className="flex flex-col items-center gap-1.5"
                          aria-label="อัปโหลด Banner"
                        >
                          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className="text-white text-[11px] font-semibold drop-shadow-lg">อัปโหลด</span>
                        </button>
                        {profile.bannerUrl && (
                          <button
                            onClick={openReposition}
                            className="flex flex-col items-center gap-1.5"
                            aria-label="ปรับตำแหน่ง Banner"
                          >
                            <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </div>
                            <span className="text-white text-[11px] font-semibold drop-shadow-lg">ปรับตำแหน่ง</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Animated action bar — always in DOM, slides in/out via max-height */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            repositioning ? "max-h-16 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="relative z-10 flex items-center justify-end gap-3 px-4 py-2.5 bg-[#111] border-b border-white/10">
            <span className="text-white/40 text-xs mr-auto hidden sm:block">ลากที่ banner เพื่อเลือกตำแหน่ง</span>
            <button
              onClick={handleCancelPosition}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:text-white transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSavePosition}
              disabled={savingPos}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5"
            >
              {savingPos && (
                <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              )}
              บันทึก
            </button>
          </div>
        </div>

        <div
          className={`px-4 sm:px-8 pb-5 sm:pb-7 ${
            repoAnim === "entering" ? "profile-content-entering" :
            repoAnim === "exiting"  ? "profile-content-exiting"  : ""
          }`}
          onAnimationEnd={() => setRepoAnim(null)}
        >
          {/* Avatar + Name */}
          <div className="flex items-end gap-3 sm:gap-4 -mt-12 sm:-mt-14 mb-3 sm:mb-4">
            <div className="relative z-30 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 overflow-hidden border-4 border-[#1a1a1a] shrink-0 shadow-xl">
              {profile.photoUrl ? (
                <Image
                  src={profile.photoUrl}
                  alt={profile.displayName ?? "user"}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl font-black text-white/30">
                  {(profile.displayName ?? "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="pb-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h1 className="text-lg sm:text-2xl font-black text-white truncate">
                  {profile.displayName ?? "ผู้ใช้ไม่ระบุชื่อ"}
                </h1>
                <RoleBadge role={profile.role} />
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-white/55 text-sm leading-relaxed mb-3 sm:mb-4 max-w-2xl">
              {profile.bio}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/35 mb-4 sm:mb-5">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              เข้าร่วม {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true, locale: th })}
            </span>
            {profile.country && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {profile.country}
              </span>
            )}
            {profile.translatorLanguages.length > 0 && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                {profile.translatorLanguages.map((l) => LANG_LABEL[l] ?? l).join(", ")}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-1 sm:flex sm:gap-10 pt-3 sm:pt-4 border-t border-white/5">
            {[
              { label: "โพสต์",         value: posts.length },
              { label: "คอมเมนต์",      value: comments.length },
              { label: "ถูกใจ",         value: likedPosts.length },
              ...(isCreator ? [{ label: "แปลแล้ว", value: translatedTitles.length }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="text-center sm:text-left">
                <div className="text-xl sm:text-2xl font-black text-white">{value}</div>
                <div className="text-[10px] sm:text-[11px] text-white/35 font-medium mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Creator Earnings (own profile only) ── */}
      {isOwnProfile && isCreator && earnings && (
        <div className="bg-gradient-to-br from-indigo-950/40 to-[#181818] border border-indigo-500/20 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">รายได้ของคุณ</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "ยอดขาย",      value: earnings.totalSales.toLocaleString(),   unit: "ครั้ง" },
              { label: "รายได้",       value: earnings.totalEarned.toLocaleString(),  unit: "เหรียญ" },
              { label: "เรื่องที่ขาย", value: earnings.titlesSold.toLocaleString(),  unit: "เรื่อง" },
              { label: "ผู้ซื้อ",      value: earnings.uniqueBuyers.toLocaleString(), unit: "คน" },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-xl bg-white/3 border border-white/5">
                <div className="text-2xl font-black text-white">{item.value}</div>
                <div className="text-[10px] text-indigo-400/70 font-semibold">{item.unit}</div>
                <div className="text-[10px] text-white/30 font-medium mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex border-b border-white/5 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors shrink-0 ${
                tab === t.id
                  ? "text-white border-b-2 border-indigo-500 -mb-px bg-indigo-500/5"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  tab === t.id ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-white/30"
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-6">
          <div key={tab} className="tab-fade-in">
            {/* Posts */}
            {tab === "posts" && (
              posts.length > 0 ? (
                <div className="space-y-3">
                  {posts.map((p) => (
                    <PostCard key={p.id} post={p} viewMode="compact" />
                  ))}
                </div>
              ) : <EmptyState text="ยังไม่มีโพสต์" />
            )}

            {/* Comments */}
            {tab === "comments" && (
              comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <Link
                      key={c.id}
                      href={`/community/p/${c.postId}`}
                      className="block bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-colors group"
                    >
                      <p className="flex items-center gap-1.5 text-[11px] text-white/30 font-semibold mb-2">
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span className="truncate group-hover:text-indigo-400 transition-colors">
                          {c.postTitle}
                        </span>
                      </p>
                      <p className="text-white/80 text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap">
                        {c.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2.5 text-[11px] text-white/25">
                        <span>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: th })}</span>
                        <span className="flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 4l2.5 5.5 6 .7-4.5 4.2 1.2 5.8L12 17l-5.2 3.2 1.2-5.8L3.5 10.2l6-.7z" />
                          </svg>
                          {c.upvotes}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState text="ยังไม่มีความคิดเห็น" />
            )}

            {/* Liked */}
            {tab === "liked" && (
              likedPosts.length > 0 ? (
                <div className="space-y-3">
                  {likedPosts.map((p) => (
                    <PostCard key={p.id} post={p} viewMode="compact" />
                  ))}
                </div>
              ) : <EmptyState text="ยังไม่มีโพสต์ที่ถูกใจ" />
            )}

            {/* Translated */}
            {tab === "translated" && isCreator && (
              translatedTitles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {translatedTitles.map((t) => (
                    <Link
                      key={t.titleId}
                      href={`/community/manga/${t.titleId}`}
                      className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-colors group"
                    >
                      <div className="w-10 h-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate mb-1.5 group-hover:text-indigo-300 transition-colors">
                          {t.titleName}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20">
                            {LANG_LABEL[t.language] ?? t.language}
                          </span>
                          <span className="text-[11px] text-white/30 font-medium">
                            {t.chapterCount} ตอน
                          </span>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState text="ยังไม่มีมังงะที่แปล" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
