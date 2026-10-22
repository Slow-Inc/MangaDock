"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "../../../components/ui/UserAvatar";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { getProfile, uploadProfileBanner, updateBannerPosition, listPostsByUser } from "../../../lib/communityApi";
import PostCard from "../../../components/PostCard";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import type { UserProfileResponse, ForumPost } from "../../../lib/types";
import { isSocialCdnUrl } from '../../../lib/avatarUpload';
import FollowUserButton from '../../../components/FollowUserButton';
import Loader from "../../../components/ui/Loader";
import { UidMascot } from "../../../components/mascot/Mascot";
import { PRIMARY_FILL } from "../../../components/ui/Button";
import { usePageTitle } from "../../../hooks/pageTitle";
import LoadError from "../../../components/ui/LoadError";
import { isNotFound } from "../../../lib/httpError";

type Tab = "posts" | "comments" | "liked" | "translated" | "following";
type FollowProfile = { uid: string; displayName: string | null; photoUrl: string | null };

const LANG_LABEL: Record<string, string> = {
  th: "ไทย",
  en: "อังกฤษ",
  ja: "ญี่ปุ่น",
  ko: "เกาหลี",
  zh: "จีน",
};

function RoleBadge({ role }: { role: number | null | undefined }) {
  if (role == null || role === 0) return null;
  const map: Record<number, { cls: string; label: string }> = {
    1: { cls: "bg-accent/10 text-accent border-accent/40", label: "Translator" },
    2: { cls: "bg-fill text-ink border-ink-3", label: "Creator" },
    8: { cls: "bg-danger/10 text-danger border-danger/40", label: "Admin" },
    9: { cls: "bg-fill text-ink border-ink-3", label: "Dev" },
  };
  const entry = map[role] ?? { cls: "bg-fill text-ink-2 border-ink-3", label: `Role ${role}` };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-14 text-center">
      <p className="text-ink-3 font-bold text-sm">{text}</p>
    </div>
  );
}

const POSTS_PAGE_SIZE = 20;

export default function PublicProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [data, setData] = useState<UserProfileResponse | null>(null);
  usePageTitle(data ? `${data.profile.displayName ?? "ผู้ใช้ไม่ระบุชื่อ"} · คอมมูนิตี้` : null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  // The photo URL that failed to load (Google's avatar CDN can refuse); keyed by URL so another profile starts clean.
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("posts");
  const [extraPosts, setExtraPosts] = useState<ForumPost[]>([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<FollowProfile[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

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

  // Fetched per profile (not on tab click) so the "following" tab badge shows the real count.
  // The tab is hidden on your own profile, so skip the request there.
  // Keyed on the boolean, not the viewer uid: the uid going undefined → set as auth resolves would refetch.
  const viewingOwn = user?.uid === uid;
  useEffect(() => {
    setFollowingUsers([]);
    if (!uid || viewingOwn) { setLoadingFollowing(false); return; }
    let cancelled = false;
    setLoadingFollowing(true);
    fetch(`/api/proxy/user-follows/${encodeURIComponent(uid)}/following`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: FollowProfile[]) => { if (!cancelled) setFollowingUsers(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingFollowing(false); });
    return () => { cancelled = true; };
  }, [uid, viewingOwn]);

  const openReposition = () => { setRepositioning(true);  setRepoAnim("entering"); };
  const closeReposition = () => { setRepositioning(false); setRepoAnim("exiting"); };

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    setLoadFailed(false);
    setData(null); // a failed load must not leave the previous profile under the new URL (#913)
    setTab("posts");
    setExtraPosts([]);
    setHasMorePosts(true);
    setLoadingMorePosts(false);
    getProfile(uid)
      .then((d) => {
        setData(d);
        setBannerYPos(d.profile.bannerPosition ?? 50);
        if (d.posts.length < POSTS_PAGE_SIZE) setHasMorePosts(false);
      })
      .catch((err) => {
        console.error(err);
        if (!isNotFound(err)) setLoadFailed(true); // "ไม่พบโปรไฟล์" only for a confirmed 404 (#913)
      })
      .finally(() => setLoading(false));
  }, [uid, retry]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-52 rounded-2xl bg-fill" />
        <div className="h-10 rounded-xl bg-fill" />
        <div className="h-72 rounded-2xl bg-fill" />
      </div>
    );
  }

  if (!data) {
    return loadFailed ? (
      <div className="py-12">
        <h1 className="sr-only">โหลดโปรไฟล์ไม่สำเร็จ</h1>
        <LoadError what="โปรไฟล์" area="community" onRetry={() => setRetry((n) => n + 1)} />
      </div>
    ) : (
      <h1 className="py-20 text-center text-ink-3">ไม่พบโปรไฟล์</h1>
    );
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
    } catch {
      showToast({ type: "error", message: "อัปโหลดภาพปกไม่สำเร็จ ลองใหม่อีกครั้ง", duration: 3500 }); // was console-only (#995)
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
    } catch {
      // still in reposition mode, so the user can save again (#995)
      showToast({ type: "error", message: "บันทึกตำแหน่งภาพปกไม่สำเร็จ ลองใหม่อีกครั้ง", duration: 3500 });
    } finally {
      setSavingPos(false);
    }
  };

  const handleCancelPosition = () => {
    setBannerYPos(data?.profile?.bannerPosition ?? 50);
    closeReposition();
  };

  const handleLoadMorePosts = async () => {
    if (!uid || loadingMorePosts) return;
    setLoadingMorePosts(true);
    try {
      const loaded = posts.length + extraPosts.length;
      const result = await listPostsByUser(uid, loaded, POSTS_PAGE_SIZE);
      setExtraPosts((prev) => [...prev, ...result.items]);
      if (result.items.length < POSTS_PAGE_SIZE) setHasMorePosts(false);
    } catch {
      // silent — user can retry by clicking again
    } finally {
      setLoadingMorePosts(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const { profile, posts, comments, likedPosts, translatedTitles, earnings } = data;
  const isCreator = profile.role >= 1;
  const isOwnProfile = user?.uid === profile.uid;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "posts",      label: "โพสต์",         count: posts.length + extraPosts.length },
    { id: "comments",   label: "ความคิดเห็น",   count: comments.length },
    { id: "liked",      label: "ถูกใจ",          count: likedPosts.length },
    ...(isCreator ? [{ id: "translated" as Tab, label: "มังงะที่แปล", count: translatedTitles.length }] : []),
    ...(!isOwnProfile ? [{ id: "following" as Tab, label: "ติดตาม", count: followingUsers.length }] : []),
  ];

  const gradientClass =
    profile.role === 1
      ? "bg-fill border-t-2 border-accent/70"
      : profile.role === 2
      ? "bg-fill border-t-2 border-ink-3"
      : "bg-fill";

  return (
    <div className="space-y-5">
      {/* ── Profile Header Card ── */}
      <div className="bg-surface border border-line rounded-2xl shadow-xl">

        {/* Banner */}
        <div
          ref={bannerContainerRef}
          className="relative h-28 sm:h-40 overflow-hidden bg-surface rounded-t-2xl"
        >
          {profile.bannerUrl ? (
            <Image
              src={profile.bannerUrl}
              alt="banner"
              draggable={false}
              fill
              className="object-cover select-none"
              style={{ objectPosition: `center ${bannerYPos}%` }}
              unoptimized
            />
          ) : (
            <div className={`w-full h-full ${gradientClass}`} />
          )}

          {/* Scrim */}
          {profile.bannerUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-bg/50 to-transparent pointer-events-none" />
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
                    <svg className="w-6 h-6 text-ink drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <span className="text-ink text-xs font-semibold bg-bg/50 backdrop-blur-sm px-3 py-1 rounded-full">
                      ลากเพื่อปรับตำแหน่ง
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Mobile: persistent icon buttons at bottom-right (touch has no hover) ── */}
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 sm:hidden z-10">
                    {uploadingBanner ? (
                      <div className="w-8 h-8 rounded-full bg-bg/60 backdrop-blur-sm border border-ink-3 flex items-center justify-center">
                        <Loader context="inline" />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => bannerInputRef.current?.click()}
                          className="w-8 h-8 rounded-full bg-bg/60 backdrop-blur-sm border border-ink-3 flex items-center justify-center active:scale-90 transition-transform"
                          aria-label="อัปโหลด Banner"
                        >
                          <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        {profile.bannerUrl && (
                          <button
                            onClick={openReposition}
                            className="w-8 h-8 rounded-full bg-bg/60 backdrop-blur-sm border border-ink-3 flex items-center justify-center active:scale-90 transition-transform"
                            aria-label="ปรับตำแหน่ง Banner"
                          >
                            <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Desktop: hover overlay (sm+, hover exists) ── */}
                  <div className="hidden sm:flex absolute inset-0 bg-scrim/0 hover:bg-scrim/40 transition-colors items-center justify-center group">
                    {uploadingBanner ? (
                      <Loader context="section" />
                    ) : (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-5">
                        <button
                          onClick={() => bannerInputRef.current?.click()}
                          className="flex flex-col items-center gap-1.5"
                          aria-label="อัปโหลด Banner"
                        >
                          <div className="w-10 h-10 rounded-full bg-bg/50 backdrop-blur-sm border border-ink-3 flex items-center justify-center hover:bg-bg/70 transition-colors">
                            <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className="text-ink text-xs font-semibold drop-shadow-lg">อัปโหลด</span>
                        </button>
                        {profile.bannerUrl && (
                          <button
                            onClick={openReposition}
                            className="flex flex-col items-center gap-1.5"
                            aria-label="ปรับตำแหน่ง Banner"
                          >
                            <div className="w-10 h-10 rounded-full bg-bg/50 backdrop-blur-sm border border-ink-3 flex items-center justify-center hover:bg-bg/70 transition-colors">
                              <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </div>
                            <span className="text-ink text-xs font-semibold drop-shadow-lg">ปรับตำแหน่ง</span>
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
          <div className="relative z-10 flex items-center justify-end gap-3 px-4 py-2.5 bg-surface border-b border-line">
            <span className="text-ink-3 text-xs mr-auto hidden sm:block">ลากที่ banner เพื่อเลือกตำแหน่ง</span>
            <button
              onClick={handleCancelPosition}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-2 hover:text-ink transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSavePosition}
              disabled={savingPos}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${PRIMARY_FILL} disabled:opacity-50 transition-colors flex items-center gap-1.5`}
            >
              {savingPos && (
                <Loader context="inline" />
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
          {/* The avatar rides up over the banner; the name starts right below it (the banner is positioned,
              so anything non-positioned pulled up under it is painted over). */}
          <div className="flex items-start gap-3 sm:gap-4 -mt-12 sm:-mt-14 mb-3 sm:mb-4">
            <div className="relative z-30 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-fill overflow-hidden border-4 border-surface shrink-0 shadow-xl">
              {profile.photoUrl && brokenPhoto !== profile.photoUrl ? (
                <Image
                  src={profile.photoUrl}
                  alt={profile.displayName ?? "user"}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                  unoptimized={isSocialCdnUrl(profile.photoUrl)}
                  onError={() => setBrokenPhoto(profile.photoUrl)}
                />
              ) : (
                <UidMascot uid={profile.uid} size={56} liveOnHover className="w-full h-full flex items-center justify-center" />
              )}
            </div>
            <div className="pt-14 sm:pt-16 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h1 className="text-lg sm:text-2xl font-black text-ink truncate">
                  {profile.displayName ?? "ผู้ใช้ไม่ระบุชื่อ"}
                </h1>
                <RoleBadge role={profile.role} />
              </div>
              {!isOwnProfile && (
                <div className="mt-2">
                  <FollowUserButton targetUid={profile.uid} />
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-ink-2 text-sm leading-relaxed mb-3 sm:mb-4 max-w-2xl">
              {profile.bio}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-3 mb-4 sm:mb-5">
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
          <div className="grid grid-cols-4 gap-1 sm:flex sm:gap-10 pt-3 sm:pt-4 border-t border-line">
            {[
              { label: "โพสต์",         value: posts.length + extraPosts.length },
              { label: "คอมเมนต์",      value: comments.length },
              { label: "ถูกใจ",         value: likedPosts.length },
              ...(isCreator ? [{ label: "แปลแล้ว", value: translatedTitles.length }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="text-center sm:text-left">
                <div className="text-xl sm:text-2xl font-black text-ink">{value}</div>
                <div className="text-xs sm:text-xs text-ink-3 font-medium mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Creator Earnings (own profile only) ── */}
      {isOwnProfile && isCreator && earnings && (
        <div className="bg-surface border border-coin/20 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <svg className="w-4 h-4 text-coin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xs font-bold text-coin uppercase">รายได้ของคุณ</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "ยอดขาย",      value: earnings.totalSales.toLocaleString(),   unit: "ครั้ง" },
              { label: "รายได้",       value: earnings.totalEarned.toLocaleString(),  unit: "เหรียญ" },
              { label: "เรื่องที่ขาย", value: earnings.titlesSold.toLocaleString(),  unit: "เรื่อง" },
              { label: "ผู้ซื้อ",      value: earnings.uniqueBuyers.toLocaleString(), unit: "คน" },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-xl bg-fill border border-line">
                <div className="text-2xl font-black text-ink">{item.value}</div>
                <div className="text-xs text-coin/70 font-semibold">{item.unit}</div>
                <div className="text-xs text-ink-3 font-medium mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="flex border-b border-line overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors shrink-0 ${
                tab === t.id
                  ? "text-ink border-b-2 border-accent -mb-px bg-fill"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs font-black ${
                  tab === t.id ? "bg-fill text-accent" : "bg-fill text-ink-3"
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
              posts.length > 0 || extraPosts.length > 0 ? (
                <div className="space-y-3">
                  {[...posts, ...extraPosts].map((p) => (
                    <PostCard key={p.id} post={p} viewMode="compact" />
                  ))}
                  {hasMorePosts && (
                    <button
                      onClick={handleLoadMorePosts}
                      disabled={loadingMorePosts}
                      className="w-full py-3 rounded-xl border border-line text-sm text-ink-2 hover:text-ink hover:bg-fill transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {loadingMorePosts ? (
                        <>
                          <Loader context="inline" />
                          กำลังโหลด...
                        </>
                      ) : (
                        'โหลดโพสต์เพิ่ม'
                      )}
                    </button>
                  )}
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
                      className="block bg-fill hover:bg-raised border border-line hover:border-ink-3 rounded-xl p-4 transition-colors group"
                    >
                      <p className="flex items-center gap-1.5 text-xs text-ink-3 font-semibold mb-2">
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span className="truncate group-hover:text-accent transition-colors">
                          {c.postTitle}
                        </span>
                      </p>
                      <p className="text-ink text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap">
                        {c.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2.5 text-xs text-ink-3">
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
                      className="flex items-center gap-3 bg-fill hover:bg-raised border border-line hover:border-ink-3 rounded-xl p-4 transition-colors group"
                    >
                      <div className="w-10 h-14 rounded-lg bg-fill border border-line flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-ink text-sm truncate mb-1.5 group-hover:text-accent transition-colors">
                          {t.titleName}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-full bg-fill text-accent text-xs font-bold border border-accent/20">
                            {LANG_LABEL[t.language] ?? t.language}
                          </span>
                          <span className="text-xs text-ink-3 font-medium">
                            {t.chapterCount} ตอน
                          </span>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-ink-3 group-hover:text-ink-2 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState text="ยังไม่มีมังงะที่แปล" />
            )}

            {/* Following */}
            {tab === "following" && !isOwnProfile && (
              loadingFollowing ? (
                <div className="flex justify-center py-10"><Loader context="section" label="กำลังโหลด" className="text-ink-3" /></div>
              ) : followingUsers.length === 0 ? (
                <EmptyState text="ยังไม่ได้ติดตามใคร" />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {followingUsers.map((u) => (
                    <Link
                      key={u.uid}
                      href={`/community/profile/${u.uid}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-fill p-3 transition hover:bg-raised"
                    >
                      <UserAvatar uid={u.uid} photoUrl={u.photoUrl} size={36} />
                      <span className="truncate text-sm font-medium text-ink">
                        {u.displayName ?? "ผู้ใช้ไม่ระบุชื่อ"}
                      </span>
                    </Link>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
