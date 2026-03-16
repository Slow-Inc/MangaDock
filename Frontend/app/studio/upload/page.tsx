"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  CreateVersionInput,
  StudioBook,
  StudioChapter,
  createVersion,
  deletePage,
  getBookChapters,
  getVersion,
  reorderPages,
  searchBooks,
  toStudioImageUrl,
  updateVersionMetadata,
  uploadPage,
} from "../../lib/studioApi";
import { proxyImageUrl } from "../../lib/imgUrl";

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

type PageItem = {
  url: string;
  uploading?: boolean;
  error?: string;
};

function StudioUploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingVersionId = searchParams.get("versionId");
  const { user, loading, getIdToken } = useAuth();
  const { showToast } = useToast();

  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StudioBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<StudioBook | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chapters, setChapters] = useState<StudioChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [isManualChapter, setIsManualChapter] = useState(false);

  const [titleId, setTitleId] = useState("");
  const [titleName, setTitleName] = useState("");
  const [titleAltName, setTitleAltName] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [language, setLanguage] = useState("th");
  const [description, setDescription] = useState("");
  const [priceCoins, setPriceCoins] = useState(0);

  const [versionId, setVersionId] = useState<string | null>(existingVersionId);
  const [versionStatus, setVersionStatus] = useState<string | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!existingVersionId);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [syncingOrder, setSyncingOrder] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ensureVersionPromiseRef = useRef<Promise<string> | null>(null);
  const pagesRef = useRef<PageItem[]>(pages);
  pagesRef.current = pages;

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId],
  );

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!pickerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!existingVersionId || !user) return;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error("ไม่พบ token");
        const data = await getVersion(token, existingVersionId);
        setVersionId(data.versionId);
        setVersionStatus(data.status);
        setTitleId(data.titleId);
        setTitleName(data.titleName);
        setTitleAltName(data.titleAltName ?? "");
        setChapterId(data.chapterId);
        setChapterNumber(data.chapterNumber);
        setChapterTitle(data.chapterTitle);
        setLanguage(data.language);
        setDescription(data.description ?? "");
        setPriceCoins(data.priceCoins ?? 0);
        setPages((data.pages ?? []).map((url) => ({ url })));

        // Force manual mode to show chapter details in inputs
        // (since we don't fetch the full chapter list on load)
        setIsManualChapter(true);
      } catch (err: unknown) {
        showToast({
          type: "error",
          message: err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลเวอร์ชันได้",
          duration: 3000,
        });
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [existingVersionId, user, getIdToken, showToast]);

  useEffect(() => {
    return () => {
      pagesRef.current.forEach((p) => {
        if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
    };
  }, []);

  useEffect(() => {
    if (!selectedBook) return;
    setTitleId(selectedBook.id);
    setTitleName(selectedBook.title);
    setTitleAltName(selectedBook.subtitle || "");
  }, [selectedBook]);

  useEffect(() => {
    if (isManualChapter) return;
    if (!selectedChapter) return;
    setChapterId(selectedChapter.id);
    setChapterNumber(selectedChapter.chapterNumber ?? "");
    setChapterTitle(selectedChapter.title ?? "");
  }, [selectedChapter, isManualChapter]);

  const isDraft = !versionStatus || versionStatus === "draft";
  const hasVersion = !!versionId;
  const uploading = uploadingCount > 0;

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      const res = await searchBooks(searchText.trim());
      setSearchResults(res.items);
      if (res.items.length === 0) {
        showToast({ type: "info", message: "ไม่พบเรื่องที่ค้นหา", duration: 2500 });
      }
    } catch (err: unknown) {
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "ค้นหาไม่สำเร็จ",
        duration: 2800,
      });
    } finally {
      setSearching(false);
    }
  };

  const chooseBook = async (book: StudioBook) => {
    setSelectedBook(book);
    setSelectedChapterId("");
    setChapters([]);
    setLoadingChapters(true);
    try {
      const items = await getBookChapters(book.id);
      setChapters(items);
      if (items.length > 0) setSelectedChapterId(items[0].id);
      setPickerOpen(false);
    } catch (err: unknown) {
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "โหลดตอนของเรื่องนี้ไม่สำเร็จ",
        duration: 2800,
      });
    } finally {
      setLoadingChapters(false);
    }
  };

  const ensureVersion = async (token: string): Promise<string> => {
    if (versionId) return versionId;
    if (ensureVersionPromiseRef.current) return ensureVersionPromiseRef.current;

    const payload: CreateVersionInput = {
      titleId,
      titleName,
      titleAltName: titleAltName || undefined,
      chapterId: isManualChapter ? undefined : chapterId,
      chapterNumber,
      chapterTitle,
      language,
      description: description || undefined,
      priceCoins,
    };

    if (!payload.titleId || !payload.language) {
      throw new Error("กรุณาระบุข้อมูลให้ครบถ้วน");
    }
    if (!isManualChapter && !payload.chapterId) {
      throw new Error("กรุณาเลือกตอนจากรายการ หรือติ๊ก 'ระบุตอนเอง'");
    }
    if (isManualChapter && !payload.chapterNumber) {
      throw new Error("กรุณาระบุเลขตอน");
    }

    const creation = createVersion(token, payload)
      .then((data) => {
        setVersionId(data.versionId);
        setVersionStatus(data.status);
        return data.versionId;
      })
      .finally(() => {
        ensureVersionPromiseRef.current = null;
      });

    ensureVersionPromiseRef.current = creation;
    return creation;
  };

  const uploadFile = useCallback(
    async (file: File) => {
      if (!user) return;
      const placeholderUrl = URL.createObjectURL(file);
      setPages((prev) => [...prev, { url: placeholderUrl, uploading: true }]);
      setUploadingCount((c) => c + 1);

      try {
        const token = await getIdToken();
        if (!token) throw new Error("ไม่พบ token");
        const vid = await ensureVersion(token);
        const { pageUrl } = await uploadPage(token, vid, file);

        setPages((prev) => prev.map((p) => (p.url === placeholderUrl ? { url: pageUrl } : p)));
        URL.revokeObjectURL(placeholderUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
        setPages((prev) =>
          prev.map((p) => (p.url === placeholderUrl ? { ...p, uploading: false, error: msg } : p)),
        );
        showToast({ type: "error", message: msg, duration: 3000 });
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    },
    [user, getIdToken, showToast, titleId, titleName, titleAltName, chapterId, chapterNumber, chapterTitle, language, description, priceCoins, versionId],
  );

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      showToast({ type: "warning", message: "กรุณาเลือกไฟล์รูปภาพเท่านั้น", duration: 2200 });
      return;
    }
    imageFiles.forEach((f) => {
      void uploadFile(f);
    });
  };

  const handleDeletePage = async (pageUrl: string) => {
    if (pageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(pageUrl);
      setPages((prev) => prev.filter((p) => p.url !== pageUrl));
      return;
    }
    if (!user || !versionId) return;

    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      await deletePage(token, versionId, pageUrl);
      setPages((prev) => prev.filter((p) => p.url !== pageUrl));
    } catch (err: unknown) {
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "ไม่สามารถลบหน้าได้",
        duration: 2800,
      });
    }
  };

  const handleMovePage = async (index: number, direction: -1 | 1) => {
    if (!versionId) return;
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    const moved = next[index];
    next[index] = next[target];
    next[target] = moved;
    setPages(next);
    setSyncingOrder(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      await reorderPages(
        token,
        versionId,
        next.filter((p) => !p.url.startsWith("blob:")).map((p) => p.url),
      );
    } catch (err: unknown) {
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "จัดเรียงหน้าไม่สำเร็จ",
        duration: 2800,
      });
      try {
        const token = await getIdToken();
        if (token) {
          const fresh = await getVersion(token, versionId);
          setPages((fresh.pages ?? []).map((url) => ({ url })));
        }
      } catch {
        // ignore refresh error
      }
    } finally {
      setSyncingOrder(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!user || !versionId) return;
    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      await updateVersionMetadata(token, versionId, { description, priceCoins });
      showToast({ type: "success", message: "บันทึกแล้ว", duration: 2000 });
    } catch (err: unknown) {
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ",
        duration: 2800,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingExisting) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#141414] pb-20 text-white">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.push("/studio")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold">{hasVersion ? "แก้ไขงานแปล" : "อัปโหลดงานแปลใหม่"}</h1>
            <p className="text-xs text-white/40">{hasVersion ? `ID: ${versionId}` : "กรอกข้อมูลและอัปโหลดหน้า"}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/80">ค้นหามังงะและเลือกตอน</h2>
          <button
            type="button"
            disabled={hasVersion}
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-indigo-400/40 hover:bg-indigo-950/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10">
                {selectedBook?.thumbnail ? (
                  <img src={proxyImageUrl(selectedBook.thumbnail)} alt={selectedBook.title} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl">📘</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-white/45">มังงะที่เลือก</p>
                <p className="line-clamp-1 text-sm font-semibold text-white">
                  {titleName || "ยังไม่ได้เลือกมังงะ"}
                </p>
                <p className="line-clamp-1 text-xs text-white/45">
                  {titleId || "กดเพื่อค้นหาและเลือกจาก popup"}
                </p>
              </div>
              {!hasVersion && (
                <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                  เลือกมังงะ
                </span>
              )}
            </div>
          </button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-white/50">ชื่อเรื่องหลัก</label>
              <input value={titleName} readOnly className="w-full rounded-xl border border-white/10 bg-white/5 opacity-50 px-3 py-2 text-sm text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">ชื่ออื่น (ไม่บังคับ)</label>
              <input
                value={titleAltName}
                onChange={(e) => setTitleAltName(e.target.value)}
                disabled={hasVersion}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-40"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/50">ตอน</label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={isManualChapter}
                    onChange={(e) => {
                      setIsManualChapter(e.target.checked);
                      if (e.target.checked) {
                        setChapterId("");
                        setSelectedChapterId("");
                        setChapterNumber("");
                        setChapterTitle("");
                      } else {
                        setChapterId("");
                        setSelectedChapterId("");
                      }
                    }}
                    disabled={hasVersion}
                    className="h-3 w-3 rounded border-white/20 bg-white/5 accent-indigo-600"
                  />
                  <span className="text-[10px] text-white/60">ระบุเอง (ไม่อิง API)</span>
                </label>
              </div>

              {!isManualChapter ? (
                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  disabled={hasVersion || loadingChapters || chapters.length === 0}
                  className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-white disabled:opacity-40"
                >
                  {loadingChapters && <option>กำลังโหลดตอน...</option>}
                  {!loadingChapters && chapters.length === 0 && <option>ยังไม่ได้เลือกเรื่อง/ไม่พบตอน</option>}
                  {!loadingChapters &&
                    chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        ตอน {c.chapterNumber ?? "-"}{c.title ? ` — ${c.title}` : ""} ({c.translatedLanguage})
                      </option>
                    ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <div className="w-1/3">
                    <input
                      placeholder="เลขตอน"
                      value={chapterNumber}
                      onChange={(e) => setChapterNumber(e.target.value)}
                      disabled={hasVersion}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      placeholder="ชื่อตอน (ไม่บังคับ)"
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      disabled={hasVersion}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">ภาษาที่แปล</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={hasVersion}
                className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">ราคา (เหรียญ) — 0 = ฟรี</label>
              <input
                type="number"
                min={0}
                value={priceCoins}
                onChange={(e) => setPriceCoins(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
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
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </div>

          {hasVersion && (
            <button
              onClick={handleSaveMetadata}
              disabled={saving || !isDraft}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">หน้ามังงะ ({pages.length} หน้า)</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !isDraft}
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

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => pages.length === 0 && isDraft && fileInputRef.current?.click()}
            className={`min-h-32 rounded-xl border border-dashed border-white/15 transition ${
              pages.length === 0 && isDraft ? "flex cursor-pointer items-center justify-center hover:border-indigo-400/50 hover:bg-indigo-950/10" : ""
            }`}
          >
            {pages.length === 0 ? (
              <div className="text-center">
                <p className="text-sm text-white/40">วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</p>
                <p className="mt-1 text-xs text-white/25">รองรับ JPG, PNG, WEBP (สูงสุด 10 MB ต่อไฟล์)</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 p-1 sm:grid-cols-4 md:grid-cols-5">
                {pages.map((page, idx) => (
                  <div key={`${page.url}-${idx}`} className="group relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
                    <Image
                      src={toStudioImageUrl(page.url)}
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

                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-white/70">
                      {idx + 1}
                    </span>

                    {!page.uploading && (
                      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleMovePage(idx, -1);
                          }}
                          disabled={idx === 0 || syncingOrder || !isDraft}
                          className="rounded bg-black/70 px-1 text-[10px] text-white/80 disabled:opacity-35"
                        >
                          ↑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleMovePage(idx, 1);
                          }}
                          disabled={idx === pages.length - 1 || syncingOrder || !isDraft}
                          className="rounded bg-black/70 px-1 text-[10px] text-white/80 disabled:opacity-35"
                        >
                          ↓
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeletePage(page.url);
                          }}
                          disabled={!isDraft}
                          className="rounded bg-red-600/80 px-1 text-[10px] text-white disabled:opacity-35"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => router.push("/studio")}
          className="w-full rounded-xl border border-white/15 py-3 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white active:scale-95"
        >
          เสร็จสิ้น — กลับสตูดิโอ
        </button>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#141414]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-white">ค้นหาและเลือกมังงะ</h3>
                <p className="text-xs text-white/45">เหมือนหน้า Search แต่ใน popup</p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.12 5.7A1 1 0 0 0 5.7 7.12L10.59 12 5.7 16.88a1 1 0 1 0 1.42 1.42L12 13.41l4.88 4.89a1 1 0 0 0 1.42-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z" />
                </svg>
              </button>
            </div>

            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex gap-2">
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSearch();
                    }
                  }}
                  placeholder="พิมพ์ชื่อมังงะ..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || !searchText.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {searching ? "กำลังค้นหา..." : "ค้นหา"}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {searchResults.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-white/40">
                  ค้นหามังงะเพื่อแสดงผลลัพธ์
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {searchResults.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => chooseBook(book)}
                      className={`group relative aspect-[2/3] w-full overflow-hidden rounded-xl border text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-black/50 ${
                        selectedBook?.id === book.id
                          ? "border-indigo-400/60 ring-2 ring-indigo-500/20"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      {book.thumbnail ? (
                        <img
                          src={proxyImageUrl(book.thumbnail)}
                          alt={book.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/20">
                          No Cover
                        </div>
                      )}
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <p className="line-clamp-2 text-xs font-semibold text-white">{book.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-white/60">
                          {book.authors?.[0] || book.subtitle || "ไม่ระบุผู้เขียน"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudioUploadPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#141414]" />}>
      <StudioUploadPageContent />
    </Suspense>
  );
}
