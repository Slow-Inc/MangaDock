"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useStudioUpload, validateReadyToFinish } from "../../hooks/useStudioUpload";
import { StudioBook, getBookCoverUrl } from "../../lib/studioApi";
import { resolvedThumbnail } from "../../lib/imgUrl";
import { StudioSelect } from "../components/StudioSelect";
import { MangaPickerModal } from "../components/MangaPickerModal";

const API_BASE = "/api/proxy";

const SUPPORTED_LANGUAGES = [
  { code: "th", label: "ภาษาไทย" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "id", label: "Bahasa Indonesia" },
];

type ExistingVersion = {
  versionId: string;
  titleId: string;
  titleName: string;
  titleAltName?: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  description: string | null;
  pages: string[];
  status: string;
  priceCoins: number;
};

import { Suspense } from "react";

function StudioUploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingVersionId = searchParams.get("versionId");
  const prefillTitleId = searchParams.get("titleId") ?? "";
  const prefillTitleName = searchParams.get("titleName") ?? "";

  const { user, loading, getIdToken } = useAuth();
  const { showToast } = useToast();

  // Form state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [titleId, setTitleId] = useState(prefillTitleId);
  const [titleName, setTitleName] = useState(prefillTitleName);
  const [titleAltName, setTitleAltName] = useState("");
  const [titleThumbnail, setTitleThumbnail] = useState(prefillTitleId ? getBookCoverUrl(prefillTitleId) : "");
  const [chapterId, setChapterId] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [language, setLanguage] = useState("th");
  const [description, setDescription] = useState("");
  const [priceCoins, setPriceCoins] = useState<string | number>(0);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [loadingExisting, setLoadingExisting] = useState(!!existingVersionId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const {
    pages,
    setPages,
    versionId,
    saving,
    handleFilesSelected,
    handleDrop,
    deletePage: handleDeletePage,
    saveMetadata: handleSaveMetadata,
  } = useStudioUpload({
    user,
    getIdToken,
    showToast,
    existingVersionId,
    getVersionMetadata: () => ({
      titleId,
      titleName,
      chapterId,
      chapterNumber,
      chapterTitle,
      language,
      description,
      priceCoins,
    }),
  });

  // Always-current ref to getIdToken so effects don't need it in their dep
  // array (it is not wrapped in useCallback in AuthContext).
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;

  // Pick up selected book from mobile search page via sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("mb:studio:selectedBook");
    if (stored) {
      sessionStorage.removeItem("mb:studio:selectedBook");
      try {
        const book: StudioBook = JSON.parse(stored);
        setTitleId(book.id);
        setTitleName(book.title);
        setTitleThumbnail(book.thumbnail ? resolvedThumbnail({ thumbnail: book.thumbnail }) : getBookCoverUrl(book.id));
      } catch {}
    }
  }, []);

  // Load existing version data if editing
  useEffect(() => {
    if (!existingVersionId || !user) return;
    getIdTokenRef.current().then(async (token) => {
      try {
        if (!token) return;
        const res = await fetch(`${API_BASE}/versions/${existingVersionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: ExistingVersion = await res.json();
        setTitleId(data.titleId);
        setTitleName(data.titleName);
        setTitleAltName(data.titleAltName ?? "");
        if (data.titleId) setTitleThumbnail(getBookCoverUrl(data.titleId));
        setChapterId(data.chapterId);
        setChapterNumber(data.chapterNumber);
        setChapterTitle(data.chapterTitle);
        setLanguage(data.language);
        setDescription(data.description ?? "");
        setPriceCoins(data.priceCoins ?? 0);
        setPages(data.pages.map((url) => ({ url })));
      } catch {
        showToast({ message: "ไม่สามารถโหลดข้อมูลได้" });
      } finally {
        setLoadingExisting(false);
      }
    });
  }, [existingVersionId, user, showToast, setPages]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  const handleDone = async () => {
    const validation = validateReadyToFinish({ titleId, chapterNumber, language, pages });
    if (!validation.ok) {
      showToast({ type: validation.level, message: validation.message });
      return;
    }

    // T4-STANDARD: Ensure metadata is saved before finishing (Readiness)
    if (versionId) {
      try {
        await handleSaveMetadata();
      } catch {
        // Continue anyway if save fails, as the user might have already clicked save
      }
    }

    if (titleId) {
      router.push(`/studio/manga/${encodeURIComponent(titleId)}?titleName=${encodeURIComponent(titleName)}`);
    } else {
      router.push("/studio/works");
    }
  };

  if (loading || loadingExisting) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const uploading = pages.some((p) => p.uploading);
  const hasVersion = !!versionId;

  return (
    <div className="pb-20 text-white">
      {/* Header */}
      <div className={`sticky top-0 z-20 transition-all duration-500 ${scrolled ? "border-b border-white/10 shadow-lg" : "border-b border-transparent"}`}>
        {/* Blur + bg overlay */}
        <div className={`pointer-events-none absolute inset-0 -z-10 transition-all duration-500 ${scrolled ? "bg-black/60 backdrop-blur-xl" : "bg-[#141414]"}`} />
        <div className="mx-auto flex max-w-3xl items-center gap-[0.52rem] px-4 py-[0.52rem] md:gap-[0.66rem] md:py-[0.86rem]">
          <button
            onClick={() => titleId ? router.push(`/studio/manga/${encodeURIComponent(titleId)}?titleName=${encodeURIComponent(titleName)}`) : router.push("/studio")}
            className="flex h-[1.8rem] w-[1.8rem] items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white md:h-[2rem] md:w-[2rem]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold leading-tight md:text-base">{hasVersion ? "แก้ไขงานแปล" : "อัปโหลดงานแปลใหม่"}</h1>
            <p className="truncate text-[11px] leading-tight text-white/40 md:text-xs">
              {hasVersion ? `ID: ${versionId}` : "กรอกข้อมูลและอัปโหลดหน้า"}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Metadata form (disabled if version is already created) */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/80">ข้อมูลงานแปล</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Manga selector */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={hasVersion}
                  onClick={() => setIsSearchModalOpen(true)}
                  className={`group relative flex aspect-[2/3] w-full max-w-[200px] flex-col overflow-hidden rounded-xl border bg-white/5 transition ${
                    titleThumbnail
                      ? "border-white/10 hover:border-white/30"
                      : "border-dashed border-white/20 hover:border-indigo-300/50"
                  } disabled:cursor-default disabled:hover:border-white/10`}
                >
                  {titleThumbnail ? (
                    <Image
                      src={titleThumbnail}
                      alt={titleName ? `ปกมังงะ ${titleName}` : "ปกมังงะ"}
                      fill
                      unoptimized
                      className="object-cover transition-all duration-300 group-hover:scale-[1.02] disabled:group-hover:scale-100"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/35">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 text-3xl font-light text-white/75">+</span>
                      <span className="text-xs tracking-wide">เลือกมังงะ</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/15 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
                    <p className="line-clamp-2 text-center text-sm font-semibold leading-snug text-white drop-shadow-md">
                      {titleName || "ยังไม่ได้เลือกมังงะ"}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/50">ตอนที่</label>
              <input
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
                disabled={hasVersion}
                placeholder="เช่น 1, 2, 1.5"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">ชื่อตอน (ถ้ามี)</label>
              <input
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                disabled={hasVersion}
                placeholder="ชื่อตอน"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">ภาษาที่แปล</label>
              <StudioSelect
                value={language}
                onChange={setLanguage}
                disabled={hasVersion}
                options={SUPPORTED_LANGUAGES.map((languageOption) => ({
                  value: languageOption.code,
                  label: languageOption.label,
                }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50">หมายเหตุของนักแปล (ไม่บังคับ)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="บันทึกเพิ่มเติมจากนักแปล..."
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-white/50">ราคา (เหรียญ) — 0 = ฟรี</label>
              <input
                type="number"
                min={0}
                value={priceCoins}
                onChange={(e) => setPriceCoins(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30"
              />
            </div>
            {hasVersion && (
              <button
                onClick={handleSaveMetadata}
                disabled={saving}
                className="mt-5 self-end rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            )}
          </div>
        </div>

        {/* Page upload area */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">
              หน้ามังงะ ({pages.length} หน้า)
            </h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
            >
              {uploading ? "กำลังอัปโหลด..." : "+ เพิ่มหน้า"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {/* Drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => pages.length === 0 && fileInputRef.current?.click()}
            className={`min-h-32 rounded-xl border border-dashed border-white/15 transition ${
              pages.length === 0 ? "flex cursor-pointer items-center justify-center hover:border-indigo-400/50 hover:bg-indigo-950/10" : ""
            }`}
          >
            {pages.length === 0 ? (
              <div className="text-center">
                <p className="text-sm text-white/40">วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</p>
                <p className="mt-1 text-xs text-white/25">รองรับ JPG, PNG, WEBP, GIF (สูงสุด 10 MB ต่อไฟล์)</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 p-1 sm:grid-cols-4 md:grid-cols-5">
                {pages.map((page, idx) => (
                  <div key={`${page.url}-${idx}`} className="group relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
                    <Image
                      src={page.url}
                      alt={`หน้า ${idx + 1}`}
                      fill
                      className={`object-cover transition ${page.uploading ? "opacity-40" : "opacity-100"}`}
                      unoptimized
                    />
                    {page.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      </div>
                    )}
                    {page.error && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-900/60">
                        <p className="px-1 text-center text-[9px] text-red-200">{page.error}</p>
                      </div>
                    )}
                    {/* Page number */}
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-white/70">
                      {idx + 1}
                    </span>
                    {/* Delete button */}
                    {!page.uploading && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePage(page.url); }}
                        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-red-600/80 text-[10px] text-white transition group-hover:flex"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Done button */}
        <button
          onClick={handleDone}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition active:scale-95 ${
            titleId && chapterNumber.trim() && pages.length > 0 && !pages.some((p) => p.uploading)
              ? "bg-green-600 text-white hover:bg-green-500"
              : "border border-white/15 text-white/60 hover:bg-white/5 hover:text-white"
          }`}
        >
          เสร็จสิ้น
        </button>
      </div>

      <MangaPickerModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelect={(book) => {
          setTitleId(book.id);
          setTitleName(book.title);
          setTitleThumbnail(book.thumbnail ? resolvedThumbnail({ thumbnail: book.thumbnail }) : getBookCoverUrl(book.id));
        }}
      />
    </div>
  );
}

export default function StudioUploadPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-white/50">กำลังโหลด...</div>}>
      <StudioUploadContent />
    </Suspense>
  );
}
