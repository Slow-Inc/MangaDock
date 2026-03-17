"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  ChapterVersion,
  getBookCoverUrl,
  getMyVersions,
  VersionStatus,
} from "../../lib/studioApi";
import { getCached, setCache } from "../../lib/studioCache";
import StudioNav from "../components/StudioNav";

type MangaGroup = {
  titleId: string;
  titleName: string;
  coverUrl: string;
  versions: ChapterVersion[];
};

type ViewMode = "list" | "card";

const STATUS_OPTIONS: { value: "" | VersionStatus; label: string }[] = [
  { value: "", label: "ทั้งหมด" },
  { value: "published", label: "เผยแพร่" },
  { value: "draft", label: "ฉบับร่าง" },
];

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/15 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-3xl">📚</div>
      <div className="text-center">
        <p className="text-sm font-semibold text-white">ยังไม่มีงานแปล</p>
        <p className="mt-1 text-xs text-white/40">เริ่มต้นด้วยการอัปโหลดงานแปลชิ้นแรกของคุณ</p>
      </div>
      <Link href="/studio/upload" className="mt-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95">
        อัปโหลดงานแปลใหม่
      </Link>
    </div>
  );
}

function StatusDots({ versions }: { versions: ChapterVersion[] }) {
  const counts = versions.reduce((acc, v) => { acc[v.status] = (acc[v.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  return (
    <div className="flex flex-wrap gap-1.5">
      {counts.published > 0 && <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-300">เผยแพร่ {counts.published}</span>}
      {counts.draft > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/40">ร่าง {counts.draft}</span>}
    </div>
  );
}

function CoverImage({ src, alt, className, fallbackClass, fallbackSize }: { src: string; alt: string; className: string; fallbackClass: string; fallbackSize: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => { if (img.naturalWidth === 0) setFailed(true); };
    img.onerror = () => setFailed(true);
    img.src = src;
  }, [src]);
  if (failed) return <div className={`flex items-center justify-center ${fallbackClass}`}><span className={fallbackSize}>📖</span></div>;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function MangaListCard({ group }: { group: MangaGroup }) {
  return (
    <Link
      href={`/studio/manga/${encodeURIComponent(group.titleId)}?titleName=${encodeURIComponent(group.titleName)}`}
      className="group flex gap-4 rounded-2xl border border-white/10 bg-white/3 p-4 transition hover:border-white/20 hover:bg-white/5 active:scale-[0.99]"
    >
      <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-white/8">
        <CoverImage src={group.coverUrl} alt={group.titleName} className="absolute inset-0 h-full w-full object-cover" fallbackClass="h-full w-full" fallbackSize="text-2xl" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-indigo-300">{group.titleName || "ไม่ระบุชื่อเรื่อง"}</p>
        <p className="mt-0.5 text-xs text-white/40">{group.versions.length} ตอน</p>
        <div className="mt-2"><StatusDots versions={group.versions} /></div>
      </div>
      <div className="flex shrink-0 items-center text-white/20 transition-colors group-hover:text-white/50">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </div>
    </Link>
  );
}

function MangaThumbnailCard({ group }: { group: MangaGroup }) {
  return (
    <Link href={`/studio/manga/${encodeURIComponent(group.titleId)}?titleName=${encodeURIComponent(group.titleName)}`} className="group cursor-pointer">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all duration-300 group-hover:scale-[1.03] group-hover:border-white/25 group-hover:shadow-xl group-hover:shadow-black/50">
        <CoverImage src={group.coverUrl} alt={group.titleName} className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" fallbackClass="h-full w-full" fallbackSize="text-4xl" />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <StatusDots versions={group.versions} />
        </div>
      </div>
      <div className="mt-2 space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-xs font-semibold leading-snug text-white/90 transition-colors duration-200 group-hover:text-white">{group.titleName || "ไม่ระบุชื่อเรื่อง"}</p>
        <p className="text-[11px] text-white/40">{group.versions.length} ตอน</p>
      </div>
    </Link>
  );
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
      <button onClick={() => onChange("list")} className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${mode === "list" ? "bg-white/15 text-white" : "text-white/30 hover:text-white/60"}`} title="แสดงแบบรายการ">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <button onClick={() => onChange("card")} className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${mode === "card" ? "bg-white/15 text-white" : "text-white/30 hover:text-white/60"}`} title="แสดงแบบ Card">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
      </button>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function WorksPage() {
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();
  const { showToast } = useToast();

  const [versions, setVersions] = useState<ChapterVersion[]>(() => getCached<ChapterVersion[]>("works:versions") ?? []);
  const [loadingVersions, setLoadingVersions] = useState(() => getCached("works:versions") === null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | VersionStatus>("");
  const [langFilter, setLangFilter] = useState("");
  const hasFetched = useRef(false);

  useEffect(() => {
    const savedMode = localStorage.getItem("mb:studio:viewMode") as ViewMode | null;
    if (savedMode === "list" || savedMode === "card") setViewMode(savedMode);
  }, []);

  const handleSetViewMode = (mode: ViewMode) => { setViewMode(mode); localStorage.setItem("mb:studio:viewMode", mode); };

  useEffect(() => { if (!loading && !user) router.replace("/"); }, [loading, user, router]);

  const fetchVersions = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      const data = await getMyVersions(token);
      setVersions(data);
      setCache("works:versions", data);
    } catch { showToast({ type: "error", message: "ไม่สามารถโหลดรายการเวอร์ชันได้", duration: 3000 }); }
    finally { setLoadingVersions(false); }
  }, [user, getIdToken, showToast]);

  useEffect(() => { if (user && !hasFetched.current) { hasFetched.current = true; fetchVersions(); } }, [user, fetchVersions]);

  // Compute available languages from data
  const availableLanguages = useMemo(() => {
    const langs = new Set(versions.map((v) => v.language));
    return Array.from(langs).sort();
  }, [versions]);

  const LANG_LABELS: Record<string, string> = { th: "ไทย", en: "English", ja: "日本語", ko: "한국어", zh: "中文", vi: "Tiếng Việt", id: "Indonesia", ms: "Melayu", fr: "Français", de: "Deutsch", es: "Español", pt: "Português", ru: "Русский" };

  // Filter versions then group
  const mangaGroups = useMemo<MangaGroup[]>(() => {
    let filtered = versions;
    if (statusFilter) filtered = filtered.filter((v) => v.status === statusFilter);
    if (langFilter) filtered = filtered.filter((v) => v.language === langFilter);

    const map = new Map<string, MangaGroup>();
    for (const v of filtered) {
      if (!map.has(v.titleId)) map.set(v.titleId, { titleId: v.titleId, titleName: v.titleName, coverUrl: getBookCoverUrl(v.titleId), versions: [] });
      map.get(v.titleId)!.versions.push(v);
    }
    let groups = Array.from(map.values());
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      groups = groups.filter((g) => g.titleName.toLowerCase().includes(q));
    }
    return groups;
  }, [versions, statusFilter, langFilter, searchQuery]);

  const hasFilters = searchQuery || statusFilter || langFilter;

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-[#141414]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>;

  return (
    <div className="pb-[calc(var(--mobile-nav-height)+1.5rem)] text-white md:pb-0">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-6 pt-[calc(5.5rem+env(safe-area-inset-top))] md:pt-28">
        <div className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold">สตูดิโอของฉัน</h1>
              <p className="text-sm text-white/40">อัปโหลดและจัดการงานแปลของคุณ</p>
            </div>
            <div className="flex items-center gap-2">
              <ViewToggle mode={viewMode} onChange={handleSetViewMode} />
              <Link href="/studio/upload" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95">
                + อัปโหลดใหม่
              </Link>
            </div>
          </div>
        </div>

        <StudioNav />

        {/* ── ค้นหาผลงาน (Search & Filters) ── */}
        <div className="space-y-3 pt-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white/70">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            ค้นหาผลงาน
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Title search */}
            <input
              type="text"
              placeholder="ชื่อเรื่อง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-500"
            />
            {/* Status filter */}
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "" | VersionStatus)}
                className="custom-scrollbar rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1e1e24] text-white">{opt.label}</option>
                ))}
              </select>
              {/* Language filter */}
              <select
                value={langFilter}
                onChange={(e) => setLangFilter(e.target.value)}
                className="custom-scrollbar rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500"
              >
                <option value="" className="bg-[#1e1e24] text-white">ทุกภาษา</option>
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang} className="bg-[#1e1e24] text-white">{LANG_LABELS[lang] ?? lang}</option>
                ))}
              </select>
              {/* Clear filters */}
              {hasFilters && (
                <button
                  onClick={() => { setSearchQuery(""); setStatusFilter(""); setLangFilter(""); }}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  ล้างค่า
                </button>
              )}
            </div>
          </div>

          {/* Result count */}
          <p className="text-xs text-white/30">แสดง {mangaGroups.length} เรื่อง</p>
        </div>

        {/* ── Works list ── */}
        <div className="pt-4">
          {loadingVersions && mangaGroups.length === 0 ? (
            <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>
          ) : !loadingVersions && mangaGroups.length === 0 && !hasFilters ? (
            <EmptyState />
          ) : mangaGroups.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-white/40">ไม่พบผลงานที่ตรงกับตัวกรอง</p>
              <button onClick={() => { setSearchQuery(""); setStatusFilter(""); setLangFilter(""); }} className="mt-2 text-xs text-indigo-400 transition hover:text-indigo-300">ล้างตัวกรอง</button>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-3">
              {mangaGroups.map((group) => <MangaListCard key={group.titleId} group={group} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4">
              {mangaGroups.map((group) => <MangaThumbnailCard key={group.titleId} group={group} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
