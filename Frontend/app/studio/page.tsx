"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const API_BASE = "/api/proxy";

type ChapterVersion = {
  versionId: string;
  titleId: string;
  titleName: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  status: "draft" | "pending_moderation" | "published" | "rejected";
  pages: string[];
  priceCoins: number;
  qualityScore: number;
  description: string | null;
};

const STATUS_LABEL: Record<ChapterVersion["status"], { label: string; color: string }> = {
  draft: { label: "ร่าง", color: "text-white/40 bg-white/10" },
  pending_moderation: { label: "รอตรวจสอบ", color: "text-yellow-300 bg-yellow-500/15" },
  published: { label: "เผยแพร่แล้ว", color: "text-green-300 bg-green-500/15" },
  rejected: { label: "ถูกปฏิเสธ", color: "text-red-300 bg-red-500/15" },
};

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/15 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-3xl">
        📚
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-white">ยังไม่มีงานแปล</p>
        <p className="mt-1 text-xs text-white/40">เริ่มต้นด้วยการอัปโหลดงานแปลชิ้นแรกของคุณ</p>
      </div>
      <button
        onClick={onNew}
        className="mt-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95"
      >
        อัปโหลดงานแปลใหม่
      </button>
    </div>
  );
}

function VersionCard({
  version,
  onSubmit,
  onDelete,
}: {
  version: ChapterVersion;
  onSubmit: (v: ChapterVersion) => void;
  onDelete: (v: ChapterVersion) => void;
}) {
  const meta = STATUS_LABEL[version.status];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
      <div className="flex items-start gap-3">
        {/* Page count thumbnail */}
        <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl bg-white/8 text-xs font-semibold text-white/50">
          {version.pages.length}p
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{version.titleName || "ไม่ระบุชื่อเรื่อง"}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-white/40">
            ตอนที่ {version.chapterNumber}
            {version.chapterTitle ? ` — ${version.chapterTitle}` : ""}
            <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">
              {version.language.toUpperCase()}
            </span>
          </p>
          {version.description && (
            <p className="mt-1 line-clamp-2 text-xs text-white/30">{version.description}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {(version.status === "draft" || version.status === "rejected") && (
        <div className="mt-3 flex gap-2">
          <Link
            href={`/studio/upload?versionId=${version.versionId}`}
            className="flex-1 rounded-xl border border-white/15 py-2 text-center text-xs font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            แก้ไข / อัปโหลดหน้า
          </Link>
          {version.status === "draft" && version.pages.length > 0 && (
            <button
              onClick={() => onSubmit(version)}
              className="flex-1 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              เผยแพร่งานแปล
            </button>
          )}
          <button
            onClick={() => onDelete(version)}
            className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            ลบ
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudioPage() {
  const router = useRouter();
  const { user, isTranslator, loading, userRole, becomeTranslator } = useAuth();
  const { showToast } = useToast();

  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [becomingTranslator, setBecomingTranslator] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!user) return;
    setLoadingVersions(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/versions/translator/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingVersions(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user && isTranslator) {
      fetchVersions();
    } else if (user && !isTranslator && !loading) {
      setLoadingVersions(false);
    }
  }, [user, isTranslator, loading, fetchVersions]);

  const handleBecomeTranslator = async () => {
    setBecomingTranslator(true);
    try {
      await becomeTranslator({});
      showToast({ message: "ยินดีด้วย! คุณเป็นนักแปลแล้ว 🎉" });
      await fetchVersions();
    } catch (err: unknown) {
      showToast({ message: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" });
    } finally {
      setBecomingTranslator(false);
    }
  };

  const handleSubmit = async (version: ChapterVersion) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/versions/${version.versionId}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast({ message: err?.message ?? "ไม่สามารถเผยแพร่งานแปลได้" });
        return;
      }
      showToast({ message: "เผยแพร่งานแปลแล้ว" });
      await fetchVersions();
    } catch {
      showToast({ message: "เกิดข้อผิดพลาด" });
    }
  };

  const handleDelete = async (version: ChapterVersion) => {
    if (!user) return;
    if (!confirm(`ยืนยันการลบงานแปล "${version.titleName}" ตอนที่ ${version.chapterNumber}?`)) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/versions/${version.versionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        showToast({ message: "ไม่สามารถลบได้" });
        return;
      }
      showToast({ message: "ลบงานแปลแล้ว" });
      await fetchVersions();
    } catch {
      showToast({ message: "เกิดข้อผิดพลาด" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#141414] text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
          <div>
            <h1 className="text-xl font-bold">สตูดิโอของฉัน</h1>
            <p className="text-sm text-white/40">
              {isTranslator ? `บทบาท: ${userRole}` : "อัปโหลดและจัดการงานแปลของคุณ"}
            </p>
          </div>
          {isTranslator && (
            <Link
              href="/studio/upload"
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95"
            >
              + อัปโหลดใหม่
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Not a translator yet */}
        {!isTranslator && (
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-6">
            <h2 className="text-base font-semibold">เริ่มต้นเป็นนักแปล</h2>
            <p className="mt-2 text-sm text-white/50">
              สมัครเป็นนักแปลเพื่อเริ่มอัปโหลดงานแปลมังงะของคุณ
              และแบ่งปันให้กับผู้อ่านทั่วโลก
            </p>
            <button
              onClick={handleBecomeTranslator}
              disabled={becomingTranslator}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
            >
              {becomingTranslator ? "กำลังดำเนินการ..." : "สมัครเป็นนักแปล"}
            </button>
          </div>
        )}

        {/* Versions list */}
        {isTranslator && (
          <>
            {loadingVersions ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            ) : versions.length === 0 ? (
              <EmptyState onNew={() => router.push("/studio/upload")} />
            ) : (
              <div className="space-y-3">
                {versions.map((v) => (
                  <VersionCard
                    key={v.versionId}
                    version={v}
                    onSubmit={handleSubmit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
