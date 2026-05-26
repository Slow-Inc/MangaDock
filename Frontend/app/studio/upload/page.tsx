"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useLocalLenis } from "../../hooks/useLocalLenis";
import { searchBooks, StudioBook, getBookCoverUrl } from "../../lib/studioApi";
import { resolvedThumbnail } from "../../lib/imgUrl";
import { StudioSelect } from "../components/StudioSelect";

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

const SEARCH_DEBOUNCE_MS = 600;
const MIN_SEARCH_QUERY_LENGTH = 2;

type PageItem = {
  url: string;
  uploading?: boolean;
  error?: string;
};

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

function MangaPickerModal({
  isOpen,
  onClose,
  onSelect,
  asPage,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (book: StudioBook) => void;
  asPage?: boolean;
}) {
  const pickerRouter = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudioBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);
  const resultsScrollRef = useRef<HTMLDivElement>(null);

  useLocalLenis(resultsScrollRef, "vertical", shouldRender && visible);

  // On mobile, redirect to dedicated search page instead of showing modal
  useEffect(() => {
    if (isOpen && !asPage && typeof window !== "undefined" && window.innerWidth < 768) {
      pickerRouter.push("/studio/search");
      onClose();
      return;
    }
  }, [isOpen, asPage, pickerRouter, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      setHasSearched(false);
      return;
    }

    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      setHasSearched(false);
      return;
    }

    setSearching(false);
    setHasSearched(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const requestId = ++searchRequestRef.current;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchBooks(trimmed);
        if (requestId !== searchRequestRef.current) return;
        setResults(data.items);
        setHasSearched(true);
      } catch {
        if (requestId !== searchRequestRef.current) return;
        setResults([]);
        setHasSearched(true);
      } finally {
        if (requestId !== searchRequestRef.current) return;
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }

    setVisible(false);
    const timer = setTimeout(() => {
      setShouldRender(false);
      setQuery("");
      setResults([]);
      setSearching(false);
      setHasSearched(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (asPage || !shouldRender) return;

    const scrollY = window.scrollY;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyOverflow = document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [shouldRender, asPage]);

  if (!shouldRender) return null;

  const trimmedQuery = query.trim();
  const isSearchReady = trimmedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  const searchInput = (
    <div className="relative">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35"
      >
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาชื่อมังงะ..."
        className="w-full rounded-2xl border border-white/12 bg-white/5 py-3 pl-12 pr-12 text-base text-white placeholder-white/25 outline-none transition focus:border-white/25 focus:bg-white/8"
      />
      {searching && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}
      {!searching && query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/50 transition hover:bg-white/20 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  const resultsHeightClass = !isSearchReady
    ? "h-44"
    : searching
      ? "h-56"
      : results.length === 0
        ? "h-44"
        : results.length <= 3
          ? "h-56"
          : "h-[420px]";

  const resultsList = (
    <div
      ref={resultsScrollRef}
      className={asPage ? "custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain" : `custom-scrollbar min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/20 transition-[height] duration-300 ${resultsHeightClass}`}
    >
      <div>
        {!isSearchReady ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 px-4 text-white/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-white/30">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/40">พิมพ์ชื่อมังงะเพื่อค้นหา</p>
            </div>
          </div>
        ) : searching ? (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-14 w-10 shrink-0 animate-pulse rounded-xl bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/10" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/8" />
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 px-4 text-white/40">
            <p className="text-sm">ไม่พบผลลัพธ์สำหรับ &ldquo;{trimmedQuery}&rdquo;</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {results.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => {
                  onSelect(book);
                  onClose();
                }}
                className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/8"
              >
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-xl bg-white/8 border border-white/8">
                  {book.thumbnail ? (
                    <img src={resolvedThumbnail(book as any)} alt={book.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{book.title}</p>
                  {book.subtitle ? <p className="mt-0.5 truncate text-xs text-white/35">{book.subtitle}</p> : null}
                  {book.authors && book.authors.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-indigo-400/60">{book.authors[0]}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Full-page mode for mobile
  if (asPage) {
    return (
      <div className="flex min-h-dvh flex-col bg-[#141414] pb-[calc(var(--mobile-nav-height)+1.5rem+env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#141414]/90 px-4 py-3 backdrop-blur-xl">
          <button
            onClick={onClose}
            aria-label="กลับ"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">ค้นหามังงะ</p>
            <p className="text-[11px] text-white/40">เลือกมังงะสำหรับอัปโหลดงานแปล</p>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {searchInput}
          {resultsList}
        </div>
      </div>
    );
  }

  // Desktop modal mode
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-12 sm:pt-16 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-2xl transition-all duration-300 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-white/90">ค้นหามังงะ</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            ปิด
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {searchInput}
          {resultsList}
        </div>
      </div>
    </div>
  );
}

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

  const [versionId, setVersionId] = useState<string | null>(existingVersionId);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [loadingExisting, setLoadingExisting] = useState(!!existingVersionId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  /**
   * Single in-flight version-creation promise, shared across all concurrent
   * uploadFile() calls. Without this, rapid multi-file selections can each
   * see versionId === null and race to create multiple draft versions.
   */
  const ensureVersionPromiseRef = useRef<Promise<string> | null>(null);
  /**
   * Always-current ref to `pages` used by the unmount cleanup so that blob
   * URLs added after mount are still revoked when the component unmounts.
   */
  const pagesRef = useRef<PageItem[]>(pages);
  pagesRef.current = pages;

  // Pick up selected book from mobile search page via sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("mb:studio:selectedBook");
    if (stored) {
      sessionStorage.removeItem("mb:studio:selectedBook");
      try {
        const book: StudioBook = JSON.parse(stored);
        setTitleId(book.id);
        setTitleName(book.title);
        setTitleThumbnail(book.thumbnail ? resolvedThumbnail(book as any) : getBookCoverUrl(book.id));
      } catch {}
    }
  }, []);

  // Load existing version data if editing
  useEffect(() => {
    if (!existingVersionId || !user) return;
    getIdToken().then(async (token) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingVersionId, user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  /** Create a draft version if one doesn't exist yet. Returns the versionId.
   *  All concurrent callers share the same in-flight promise so only one
   *  version is ever created per upload session. */
  const ensureVersion = async (token: string): Promise<string> => {
    // Fast path: version already exists
    if (versionId) return versionId;

    // If another concurrent call is already creating the version, await it
    if (ensureVersionPromiseRef.current) return ensureVersionPromiseRef.current;

    if (!titleId || !language) {
      throw new Error("กรุณาเลือกมังงะและภาษาก่อน");
    }

    const creation = fetch(`${API_BASE}/versions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId,
        titleName,
        chapterId,
        chapterNumber,
        chapterTitle,
        language,
        description,
        priceCoins: Number(priceCoins) || 0,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? "ไม่สามารถสร้างงานแปลได้");
      }
      const data = await res.json();
      setVersionId(data.versionId);
      return data.versionId as string;
    }).finally(() => {
      ensureVersionPromiseRef.current = null;
    });

    ensureVersionPromiseRef.current = creation;
    return creation;
  };

  /** Upload a single page file. */
  const uploadFile = useCallback(
    async (file: File) => {
      if (!user) return;
      const placeholderUrl = URL.createObjectURL(file);
      const placeholder: PageItem = { url: placeholderUrl, uploading: true };
      setPages((prev) => [...prev, placeholder]);

      try {
        const token = await getIdToken();
        if (!token) throw new Error("ไม่พบ token");
        const vid = await ensureVersion(token);

        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_BASE}/upload/versions/${vid}/pages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message ?? "อัปโหลดไม่สำเร็จ");
        }
        const { pageUrl } = await res.json();
        // Replace the placeholder with the real server URL, then revoke the
        // blob so it doesn't leak — we now have the permanent URL.
        setPages((prev) =>
          prev.map((p) => (p.url === placeholderUrl ? { url: pageUrl } : p))
        );
        URL.revokeObjectURL(placeholderUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
        // Keep the placeholder URL in state so the preview still renders while
        // the error is visible. The blob will be revoked when the user removes
        // the page or navigates away (handled by the cleanup effect below).
        setPages((prev) =>
          prev.map((p) => (p.url === placeholderUrl ? { ...p, uploading: false, error: msg } : p))
        );
        showToast({ message: msg });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, versionId, titleId, chapterId, language, titleName, chapterNumber, chapterTitle, description, priceCoins]
  );

  // Revoke any remaining blob URLs (e.g. failed uploads) on unmount.
  // pagesRef always holds the latest pages so URLs added after mount are covered.
  useEffect(() => {
    return () => {
      pagesRef.current.forEach((p) => {
        if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
    };
  }, []);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      showToast({ message: "กรุณาเลือกไฟล์รูปภาพเท่านั้น" });
      return;
    }
    imageFiles.forEach(uploadFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleDeletePage = async (pageUrl: string) => {
    // If it's a local blob (upload error case), just remove it from state and revoke
    if (pageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(pageUrl);
      setPages((prev) => prev.filter((p) => p.url !== pageUrl));
      return;
    }
    if (!user || !versionId) {
      setPages((prev) => prev.filter((p) => p.url !== pageUrl));
      return;
    }
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      const res = await fetch(`${API_BASE}/upload/versions/${versionId}/pages`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl }),
      });
      if (!res.ok) {
        showToast({ message: "ไม่สามารถลบหน้าได้" });
        return;
      }
      setPages((prev) => prev.filter((p) => p.url !== pageUrl));
    } catch {
      showToast({ message: "เกิดข้อผิดพลาด" });
    }
  };

  const handleSaveMetadata = async () => {
    if (!user || !versionId) return;
    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      const res = await fetch(`${API_BASE}/versions/${versionId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ description, priceCoins: Number(priceCoins) || 0 }),
      });
      if (!res.ok) {
        showToast({ type: "error", message: "บันทึกไม่สำเร็จ" });
        return;
      }
      showToast({ type: "success", message: "บันทึกแล้ว" });
    } catch {
      showToast({ type: "error", message: "เกิดข้อผิดพลาด" });
    } finally {
      setSaving(false);
    }
  };

  const handleDone = async () => {
    if (!titleId) {
      showToast({ type: "warning", message: "กรุณาเลือกมังงะก่อน" });
      return;
    }
    if (!chapterNumber.trim()) {
      showToast({ type: "warning", message: "กรุณากรอกหมายเลขตอน" });
      return;
    }
    if (!language) {
      showToast({ type: "warning", message: "กรุณาเลือกภาษาที่แปล" });
      return;
    }
    if (pages.length === 0) {
      showToast({ type: "warning", message: "กรุณาอัปโหลดหน้ามังงะอย่างน้อย 1 หน้า" });
      return;
    }
    if (pages.some((p) => p.uploading)) {
      showToast({ type: "info", message: "กรุณารอให้การอัปโหลดเสร็จสิ้นก่อน" });
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
          setTitleThumbnail(book.thumbnail ? resolvedThumbnail(book as any) : getBookCoverUrl(book.id));
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
