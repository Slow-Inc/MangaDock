"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

const API_BASE = "/api/proxy";

export type PageItem = {
  url: string;
  uploading?: boolean;
  error?: string;
};

// ── Pure helpers (unit-tested directly, no React/DOM) ───────────────────────

/** Keep only image files from a FileList-derived array. */
export function filterImageFiles(files: File[]): File[] {
  return files.filter((f) => f.type.startsWith("image/"));
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; level: "warning" | "info"; message: string };

/** The 5 gates handleDone runs, in order, before finishing an upload. */
export function validateReadyToFinish(s: {
  titleId: string;
  chapterNumber: string;
  language: string;
  pages: PageItem[];
}): ValidationResult {
  if (!s.titleId) {
    return { ok: false, level: "warning", message: "กรุณาเลือกมังงะก่อน" };
  }
  if (!s.chapterNumber.trim()) {
    return { ok: false, level: "warning", message: "กรุณากรอกหมายเลขตอน" };
  }
  if (!s.language) {
    return { ok: false, level: "warning", message: "กรุณาเลือกภาษาที่แปล" };
  }
  if (s.pages.length === 0) {
    return { ok: false, level: "warning", message: "กรุณาอัปโหลดหน้ามังงะอย่างน้อย 1 หน้า" };
  }
  if (s.pages.some((p) => p.uploading)) {
    return { ok: false, level: "info", message: "กรุณารอให้การอัปโหลดเสร็จสิ้นก่อน" };
  }
  return { ok: true };
}

/** Append an optimistic uploading placeholder page. */
export function appendPlaceholder(pages: PageItem[], placeholderUrl: string): PageItem[] {
  return [...pages, { url: placeholderUrl, uploading: true }];
}

/** Replace the placeholder blob URL with the real server page URL. */
export function replacePlaceholder(pages: PageItem[], blobUrl: string, realUrl: string): PageItem[] {
  return pages.map((p) => (p.url === blobUrl ? { url: realUrl } : p));
}

/** Mark a placeholder as errored (keeps the blob preview visible). */
export function markPlaceholderError(pages: PageItem[], blobUrl: string, msg: string): PageItem[] {
  return pages.map((p) => (p.url === blobUrl ? { ...p, uploading: false, error: msg } : p));
}

/** Remove a page by its url (blob or server). */
export function removePageByUrl(pages: PageItem[], url: string): PageItem[] {
  return pages.filter((p) => p.url !== url);
}

// ── Hook ─────────────────────────────────────────────────────────────────

export interface UseStudioUploadArgs {
  user: unknown | null;
  getIdToken: () => Promise<string | null>;
  showToast: (t: { type?: "success" | "error" | "warning" | "info"; message: string }) => void;
  existingVersionId: string | null;
  getVersionMetadata: () => {
    titleId: string;
    titleName: string;
    chapterId: string;
    chapterNumber: string;
    chapterTitle: string;
    language: string;
    description: string;
    priceCoins: string | number;
  };
}

export interface UseStudioUploadResult {
  pages: PageItem[];
  setPages: Dispatch<SetStateAction<PageItem[]>>;
  versionId: string | null;
  setVersionId: (v: string | null) => void;
  saving: boolean;
  uploadFile: (file: File) => Promise<void>;
  handleFilesSelected: (files: FileList | null) => void;
  handleDrop: (e: React.DragEvent) => void;
  deletePage: (pageUrl: string) => Promise<void>;
  saveMetadata: () => Promise<void>;
}

export function useStudioUpload({
  user,
  getIdToken,
  showToast,
  existingVersionId,
  getVersionMetadata,
}: UseStudioUploadArgs): UseStudioUploadResult {
  const [versionId, setVersionId] = useState<string | null>(existingVersionId);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [saving, setSaving] = useState(false);

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
  // Always-current ref to getIdToken so effects and callbacks don't need it
  // in their dep arrays (it is not wrapped in useCallback in AuthContext).
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;
  // Always-current ref to the metadata getter so ensureVersion reads fresh
  // form values without needing all 8 fields in its own dep array.
  const getVersionMetadataRef = useRef(getVersionMetadata);
  getVersionMetadataRef.current = getVersionMetadata;

  /** Create a draft version if one doesn't exist yet. Returns the versionId.
   *  All concurrent callers share the same in-flight promise so only one
   *  version is ever created per upload session. */
  const ensureVersion = useCallback(async (token: string): Promise<string> => {
    // Fast path: version already exists
    if (versionId) return versionId;

    // If another concurrent call is already creating the version, await it
    if (ensureVersionPromiseRef.current) return ensureVersionPromiseRef.current;

    const { titleId, titleName, chapterId, chapterNumber, chapterTitle, language, description, priceCoins } =
      getVersionMetadataRef.current();

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
  }, [versionId]);

  /** Upload a single page file. */
  const uploadFile = useCallback(
    async (file: File) => {
      if (!user) return;
      const placeholderUrl = URL.createObjectURL(file);
      setPages((prev) => appendPlaceholder(prev, placeholderUrl));

      try {
        const token = await getIdTokenRef.current();
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
        setPages((prev) => replacePlaceholder(prev, placeholderUrl, pageUrl));
        URL.revokeObjectURL(placeholderUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
        // Keep the placeholder URL in state so the preview still renders while
        // the error is visible. The blob will be revoked when the user removes
        // the page or navigates away (handled by the cleanup effect below).
        setPages((prev) => markPlaceholderError(prev, placeholderUrl, msg));
        showToast({ message: msg });
      }
    },
    [user, ensureVersion, showToast]
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

  const handleFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const imageFiles = filterImageFiles(Array.from(files));
      if (imageFiles.length === 0) {
        showToast({ message: "กรุณาเลือกไฟล์รูปภาพเท่านั้น" });
        return;
      }
      imageFiles.forEach(uploadFile);
    },
    [showToast, uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected]
  );

  const deletePage = useCallback(
    async (pageUrl: string) => {
      // If it's a local blob (upload error case), just remove it from state and revoke
      if (pageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pageUrl);
        setPages((prev) => removePageByUrl(prev, pageUrl));
        return;
      }
      if (!user || !versionId) {
        setPages((prev) => removePageByUrl(prev, pageUrl));
        return;
      }
      try {
        const token = await getIdTokenRef.current();
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
        setPages((prev) => removePageByUrl(prev, pageUrl));
      } catch {
        showToast({ message: "เกิดข้อผิดพลาด" });
      }
    },
    [user, versionId, showToast]
  );

  const saveMetadata = useCallback(async () => {
    if (!user || !versionId) return;
    setSaving(true);
    try {
      const token = await getIdTokenRef.current();
      if (!token) throw new Error("ไม่พบ token");
      const { description, priceCoins } = getVersionMetadataRef.current();
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
  }, [user, versionId, showToast]);

  return {
    pages,
    setPages,
    versionId,
    setVersionId,
    saving,
    uploadFile,
    handleFilesSelected,
    handleDrop,
    deletePage,
    saveMetadata,
  };
}
