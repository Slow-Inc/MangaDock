"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

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

type PageItem = {
  url: string;
  uploading?: boolean;
  error?: string;
};

type ExistingVersion = {
  versionId: string;
  titleId: string;
  titleName: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  description: string | null;
  pages: string[];
  status: string;
};

export default function StudioUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingVersionId = searchParams.get("versionId");

  const { user, isTranslator, loading } = useAuth();
  const { showToast } = useToast();

  // Form state
  const [titleId, setTitleId] = useState("");
  const [titleName, setTitleName] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [language, setLanguage] = useState("th");
  const [description, setDescription] = useState("");
  const [priceCoins, setPriceCoins] = useState(0);

  const [versionId, setVersionId] = useState<string | null>(existingVersionId);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!existingVersionId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load existing version data if editing
  useEffect(() => {
    if (!existingVersionId || !user) return;
    user.getIdToken().then(async (token) => {
      try {
        const res = await fetch(`${API_BASE}/versions/${existingVersionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: ExistingVersion = await res.json();
        setTitleId(data.titleId);
        setTitleName(data.titleName);
        setChapterId(data.chapterId);
        setChapterNumber(data.chapterNumber);
        setChapterTitle(data.chapterTitle);
        setLanguage(data.language);
        setDescription(data.description ?? "");
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
    if (!loading && user && !isTranslator) router.replace("/studio");
  }, [loading, user, isTranslator, router]);

  /** Create a draft version if one doesn't exist yet. Returns the versionId. */
  const ensureVersion = async (token: string): Promise<string> => {
    if (versionId) return versionId;
    if (!titleId || !chapterId || !language) {
      throw new Error("กรุณากรอก Title ID, Chapter ID และภาษาก่อน");
    }
    const res = await fetch(`${API_BASE}/versions`, {
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
        priceCoins,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message ?? "ไม่สามารถสร้างงานแปลได้");
    }
    const data = await res.json();
    setVersionId(data.versionId);
    return data.versionId;
  };

  /** Upload a single page file. */
  const uploadFile = useCallback(
    async (file: File) => {
      if (!user) return;
      const placeholderUrl = URL.createObjectURL(file);
      const placeholder: PageItem = { url: placeholderUrl, uploading: true };
      setPages((prev) => [...prev, placeholder]);

      try {
        const token = await user.getIdToken();
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
        setPages((prev) =>
          prev.map((p) => (p.url === placeholderUrl ? { url: pageUrl } : p))
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
        setPages((prev) =>
          prev.map((p) => (p.url === placeholderUrl ? { ...p, uploading: false, error: msg } : p))
        );
        showToast({ message: msg });
      } finally {
        URL.revokeObjectURL(placeholderUrl);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, versionId, titleId, chapterId, language, titleName, chapterNumber, chapterTitle, description, priceCoins]
  );

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
    if (!user || !versionId) {
      setPages((prev) => prev.filter((p) => p.url !== pageUrl));
      return;
    }
    try {
      const token = await user.getIdToken();
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
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/versions/${versionId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ description, priceCoins }),
      });
      if (!res.ok) {
        showToast({ message: "บันทึกไม่สำเร็จ" });
        return;
      }
      showToast({ message: "บันทึกแล้ว" });
    } catch {
      showToast({ message: "เกิดข้อผิดพลาด" });
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

  const uploading = pages.some((p) => p.uploading);
  const hasVersion = !!versionId;

  return (
    <div className="min-h-dvh bg-[#141414] pb-20 text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
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

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Metadata form (disabled if version is already created) */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/80">ข้อมูลงานแปล</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-white/50">Title ID (MangaDex)</label>
              <input
                value={titleId}
                onChange={(e) => setTitleId(e.target.value)}
                disabled={hasVersion}
                placeholder="e.g. a96676be-9..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">ชื่อเรื่อง</label>
              <input
                value={titleName}
                onChange={(e) => setTitleName(e.target.value)}
                disabled={hasVersion}
                placeholder="ชื่อมังงะ"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Chapter ID (MangaDex)</label>
              <input
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                disabled={hasVersion}
                placeholder="e.g. d70a2bb5-..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-40"
              />
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
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={hasVersion}
                className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 disabled:opacity-40"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
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
                onChange={(e) => setPriceCoins(Math.max(0, parseInt(e.target.value) || 0))}
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
                <p className="mt-1 text-xs text-white/25">รองรับ JPG, PNG, WEBP (สูงสุด 10 MB ต่อไฟล์)</p>
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
          onClick={() => router.push("/studio")}
          className="w-full rounded-xl border border-white/15 py-3 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white active:scale-95"
        >
          เสร็จสิ้น — กลับสตูดิโอ
        </button>
      </div>
    </div>
  );
}
