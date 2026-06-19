"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { useProtectedPage } from "../../hooks/useProtectedPage";
import { useToast } from "../../contexts/ToastContext";
import {
  getBookCoverUrl,
  getMyVersions,
} from "../../lib/studioApi";
import type { ChapterVersion, VersionStatus } from "../../lib/types";
import { getCached, setCache } from "../../lib/studioCache";
import StudioNav from "../components/StudioNav";
import { StudioWorksSkeleton } from "../components/StudioSkeleton";
import { MetricCard, StudioAnnouncement, StudioSection } from "../components/StudioDashboardWidgets";
import {
  StudioMobileHeader,
  StudioMobileHero,
  StudioMobileSection,
} from "../components/StudioMobileShell";
import { StudioSelect } from "../components/StudioSelect";
import { formatCurrency, getOverviewStats } from "../lib/dashboardAnalytics";
import { useIsMobile } from "../../hooks/useIsMobile";

type MangaGroup = {
  titleId: string;
  titleName: string;
  coverUrl: string;
  versions: ChapterVersion[];
};

type ViewMode = "list" | "card";
type WorksMobileView = "browse" | "filters";

const STATUS_OPTIONS: { value: "" | VersionStatus; label: string }[] = [
  { value: "", label: "ทั้งหมด" },
  { value: "published", label: "เผยแพร่แล้ว" },
  { value: "draft", label: "แบบร่าง" },
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
      {counts.published > 0 && <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-300">เผยแพร่แล้ว {counts.published}</span>}
      {counts.draft > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/40">แบบร่าง {counts.draft}</span>}
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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
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
  const { user, loading, getIdToken } = useProtectedPage();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const [versions, setVersions] = useState<ChapterVersion[]>(() => getCached<ChapterVersion[]>("works:versions") ?? []);
  const [loadingVersions, setLoadingVersions] = useState(() => getCached("works:versions") === null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | VersionStatus>("");
  const [langFilter, setLangFilter] = useState("");
  const [mobileView, setMobileView] = useState<WorksMobileView>("browse");
  const hasFetched = useRef(false);

  useEffect(() => {
    const savedMode = localStorage.getItem("mb:studio:viewMode") as ViewMode | null;
    if (savedMode === "list" || savedMode === "card") setViewMode(savedMode);
  }, []);

  const handleSetViewMode = (mode: ViewMode) => { setViewMode(mode); localStorage.setItem("mb:studio:viewMode", mode); };

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
  const overviewStats = useMemo(
    () => getOverviewStats(versions, [], 0),
    [versions],
  );

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-[#141414]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>;

  if (isMobile) {
    const renderMobileResults = () => {
      if (loadingVersions && mangaGroups.length === 0) {
        return <StudioWorksSkeleton viewMode={viewMode} />;
      }
      if (!loadingVersions && mangaGroups.length === 0 && !hasFilters) return <EmptyState />;
      if (mangaGroups.length === 0) {
        return (
          <div className="py-12 text-center">
            <p className="text-sm text-white/40">ไม่พบผลงานที่ตรงกับตัวกรอง</p>
            <button onClick={() => { setSearchQuery(""); setStatusFilter(""); setLangFilter(""); }} className="mt-2 text-xs text-indigo-400">ล้างตัวกรอง</button>
          </div>
        );
      }
      if (viewMode === "list") {
        return <div className="space-y-3">{mangaGroups.map((group) => <MangaListCard key={group.titleId} group={group} />)}</div>;
      }
      return (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
          {mangaGroups.map((group) => <MangaThumbnailCard key={group.titleId} group={group} />)}
        </div>
      );
    };

    return (
      <div className="pb-[calc(var(--mobile-nav-height)+1.75rem+env(safe-area-inset-bottom))] text-white">
        <Navbar />
        <div className="pt-[calc(4.9rem+env(safe-area-inset-top))]">
          {mobileView === "filters" ? (
            <div className="space-y-4 px-4 py-4">
              <StudioMobileHeader
                title="ตัวกรองผลงาน"
                subtitle="แยกส่วนจัดการตัวกรองออกจากรายการหลักบนมือถือ"
                onBack={() => setMobileView("browse")}
              />
              <StudioMobileSection title="ค้นหาและกรอง">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="ชื่อเรื่อง..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
                  />
                  <StudioSelect
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value as "" | VersionStatus)}
                    options={STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                  />
                  <StudioSelect
                    value={langFilter}
                    onChange={setLangFilter}
                    options={[
                      { value: "", label: "ทุกภาษา" },
                      ...availableLanguages.map((lang) => ({ value: lang, label: LANG_LABELS[lang] ?? lang })),
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`rounded-2xl border px-3 py-3 text-sm ${viewMode === "list" ? "border-indigo-500 bg-indigo-600/20 text-indigo-300" : "border-white/10 bg-white/5 text-white/60"}`}
                    >
                      แบบรายการ
                    </button>
                    <button
                      onClick={() => setViewMode("card")}
                      className={`rounded-2xl border px-3 py-3 text-sm ${viewMode === "card" ? "border-indigo-500 bg-indigo-600/20 text-indigo-300" : "border-white/10 bg-white/5 text-white/60"}`}
                    >
                      แบบการ์ด
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setSearchQuery(""); setStatusFilter(""); setLangFilter(""); }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/60"
                    >
                      ล้างค่า
                    </button>
                    <button
                      onClick={() => setMobileView("browse")}
                      className="rounded-2xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white"
                    >
                      ดูผลลัพธ์
                    </button>
                  </div>
                </div>
              </StudioMobileSection>
            </div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <StudioAnnouncement />
              <StudioMobileHero
                eyebrow="Works Manager"
                title="ผลงานของฉัน"
                description="มือถือจะโฟกัสที่รายการงานก่อน ส่วนตัวกรองและมุมมองจะถูกแยกเป็นหน้าจอย่อย"
              />
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="จำนวนเรื่อง" value={overviewStats.totalWorks} hint="title ที่มีเวอร์ชัน" tone="indigo" />
                <MetricCard label="จำนวนตอน" value={overviewStats.totalChapters} hint={`${overviewStats.totalPages} หน้า`} tone="violet" />
                <MetricCard label="เผยแพร่แล้ว" value={overviewStats.published} hint={`ร่าง ${overviewStats.draft}`} tone="emerald" />
                <MetricCard label="ตอนมีราคา" value={overviewStats.paidChapters} hint={`เฉลี่ย ${formatCurrency(overviewStats.avgPrice)}`} tone="amber" />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ค้นหาชื่อเรื่อง..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setMobileView("filters")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                >
                  กรอง
                </button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/35">แสดง {mangaGroups.length} เรื่อง</p>
                <Link href="/studio/upload" className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
                  + อัปโหลด
                </Link>
              </div>
              {renderMobileResults()}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-[calc(var(--mobile-nav-height)+1.5rem)] text-white md:pb-0">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-6 pt-[calc(5.5rem+env(safe-area-inset-top))] md:pt-28">
        <div className="space-y-5">
          <StudioAnnouncement />

          <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-white/35">Works Manager</p>
                <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">ผลงานของฉัน</h1>
                <p className="mt-2 text-sm text-white/45">จัดการ chapter/version ทั้งหมด พร้อมตัวกรองและภาพรวมแบบใกล้ dashboard นักเขียน</p>
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

          <StudioSection title="ภาพรวมผลงาน" subtitle="สรุปจำนวนเรื่อง ตอน ภาษา และสถานะหลักก่อนลงไปจัดการรายละเอียด">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="จำนวนเรื่อง" value={overviewStats.totalWorks} hint="นับจาก title ที่มีเวอร์ชัน" tone="indigo" />
              <MetricCard label="จำนวนตอน" value={overviewStats.totalChapters} hint={`รวม ${overviewStats.totalPages} หน้า`} tone="violet" />
              <MetricCard label="เผยแพร่แล้ว" value={overviewStats.published} hint={`ร่าง ${overviewStats.draft} | รอตรวจ ${overviewStats.pending}`} tone="emerald" />
              <MetricCard label="ตอนมีราคา" value={overviewStats.paidChapters} hint={`ราคาเฉลี่ย ${formatCurrency(overviewStats.avgPrice)} เหรียญ`} tone="amber" />
            </div>
          </StudioSection>

          {/* ── ค้นหาผลงาน (Search & Filters) ── */}
          <StudioSection title="ค้นหาผลงาน" subtitle="ใช้ค้นหาชื่อเรื่อง กรองสถานะ และเลือกภาษาในมุมเดียวกับ dashboard จัดการนิยาย/การ์ตูน">
            <div className="space-y-3">
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
                  <div className="min-w-[10rem]">
                    <StudioSelect
                      value={statusFilter}
                      onChange={(value) => setStatusFilter(value as "" | VersionStatus)}
                      options={STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                    />
                  </div>
                  <div className="min-w-[10rem]">
                    <StudioSelect
                      value={langFilter}
                      onChange={setLangFilter}
                      options={[
                        { value: "", label: "ทุกภาษา" },
                        ...availableLanguages.map((lang) => ({ value: lang, label: LANG_LABELS[lang] ?? lang })),
                      ]}
                    />
                  </div>
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

              <p className="text-xs text-white/30">แสดง {mangaGroups.length} เรื่อง</p>
            </div>
          </StudioSection>

          {/* ── Works list ── */}
          <div>
            {loadingVersions && mangaGroups.length === 0 ? (
              <StudioWorksSkeleton viewMode={viewMode} />
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
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4 xl:grid-cols-5">
                {mangaGroups.map((group) => <MangaThumbnailCard key={group.titleId} group={group} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
