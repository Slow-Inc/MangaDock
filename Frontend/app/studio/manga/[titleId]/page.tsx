"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  deleteVersion,
  getBookCoverUrl,
  getMyVersions,
  publishVersion,
} from "../../../lib/studioApi";
import type { ChapterVersion } from "../../../lib/types";
import { getCached, setCache } from "../../../lib/studioCache";
import { cacheOrFetch, TTL } from "../../../lib/apiCache";
import { StudioChaptersSkeleton } from "../../components/StudioSkeleton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CoverImage } from "../../components/CoverImage";
import Loader from "../../../components/ui/Loader";
import { PRIMARY_FILL } from "../../../components/ui/Button";
import Coin from "../../../components/ui/Coin";
import Mascot from "../../../components/mascot/Mascot";
import CopyButton from "../../../components/ui/CopyButton";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: "แบบร่าง", color: "text-ink-3 bg-fill" },
  published: { label: "เผยแพร่แล้ว", color: "text-ok bg-ok/15" },
  pending_moderation: { label: "รอตรวจสอบ", color: "text-accent bg-accent/15" },
};

/** Single version row used inside a group */
function VersionRow({
  version,
  onSubmit,
  onDelete,
  isLast,
}: {
  version: ChapterVersion;
  onSubmit: (v: ChapterVersion) => void;
  onDelete: (v: ChapterVersion) => void;
  isLast: boolean;
}) {
  const meta = STATUS_LABEL[version.status];
  return (
    <div className="relative flex gap-0 pb-2">
      {/* Tree connector — absolute so dot is always at card top */}
      <div className="relative w-8 shrink-0 self-stretch">
        {/* vertical line: full height for non-last, half height for last */}
        <div
          className="absolute left-3.5 top-0 w-px bg-line"
          style={{ bottom: isLast ? "50%" : "0" }}
        />
        {/* horizontal branch + dot, fixed at 1.5rem from top (center of the card icon row) */}
        <div className="absolute left-3.5 top-6 flex items-center">
          <div className="h-px w-4 bg-line" />
          <div className="h-1.5 w-1.5 rounded-full bg-ink-3" />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 rounded-xl border border-line bg-fill p-3">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg bg-fill text-[11px] font-semibold text-ink-3">
            {version.pages.length}p
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {version.chapterTitle && (
                <p className="text-xs font-semibold text-ink">{version.chapterTitle}</p>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                {meta.label}
              </span>
              <span className="rounded-full bg-fill px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
                {version.language.toUpperCase()}
              </span>
              {version.priceCoins > 0 && (
                <span className="rounded-full bg-coin/15 px-2 py-0.5 text-[10px] font-semibold text-coin">
                  <Coin className="mr-0.5 inline align-[-0.125em]" />{version.priceCoins}
                </span>
              )}
            </div>
            {version.description && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-3">{version.description}</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          <Link
            href={`/studio/upload?versionId=${encodeURIComponent(version.versionId)}`}
            className="flex-1 rounded-lg border border-line py-1.5 text-center text-[11px] font-semibold text-ink-2 transition hover:bg-fill hover:text-ink"
          >
            แก้ไข / อัปโหลดหน้า
          </Link>
          {version.status === "draft" && version.pages.length > 0 && (
            <button
              onClick={() => onSubmit(version)}
              className={`flex-1 rounded-lg ${PRIMARY_FILL} py-1.5 text-[11px] font-semibold transition`}
            >
              เผยแพร่
            </button>
          )}
          <button
            onClick={() => onDelete(version)}
            className="rounded-lg border border-danger/25 px-2.5 py-1.5 text-[11px] font-semibold text-danger transition hover:bg-danger/10"
          >
            ลบ
          </button>
        </div>
      </div>
    </div>
  );
}

/** Group header + expandable children for chapters sharing the same chapterNumber */
function ChapterGroup({
  chapterNumber,
  versions,
  onSubmit,
  onDelete,
}: {
  chapterNumber: string;
  versions: ChapterVersion[];
  onSubmit: (v: ChapterVersion) => void;
  onDelete: (v: ChapterVersion) => void;
}) {
  const [open, setOpen] = useState(versions.length === 1);
  const hasMultiple = versions.length > 1;

  // Summary badges for the collapsed header
  const statusCounts = versions.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      {/* Header row */}
      <div
        role={hasMultiple ? "button" : undefined}
        tabIndex={hasMultiple ? 0 : undefined}
        onClick={() => hasMultiple && setOpen((o) => !o)}
        onKeyDown={(e) => { if (hasMultiple && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen((o) => !o); } }}
        className={`flex w-full items-center gap-3 rounded-2xl border border-line bg-fill p-4 text-left transition ${hasMultiple ? "cursor-pointer hover:border-ink-3 hover:bg-raised active:scale-[0.99]" : ""}`}
      >
        {/* Chapter number badge */}
        <div className="flex h-12 min-w-10 max-w-24 shrink-0 flex-col items-center justify-center rounded-xl bg-fill px-2">
          <span className="text-[10px] text-ink-3">ตอน</span>
          <span className="max-w-full truncate text-sm font-bold text-ink" title={chapterNumber}>{chapterNumber || "?"}</span>
        </div>

        <div className="min-w-0 flex-1">
          {/* If single version, show its title */}
          {versions.length === 1 && versions[0].chapterTitle && (
            <p className="truncate text-sm font-semibold text-ink">{versions[0].chapterTitle}</p>
          )}
          {/* Status summary badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {statusCounts.published > 0 && (
              <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-semibold text-ok">
                เผยแพร่ {statusCounts.published}
              </span>
            )}
            {statusCounts.draft > 0 && (
              <span className="rounded-full bg-fill px-2 py-0.5 text-[10px] font-semibold text-ink-3">
                แบบร่าง {statusCounts.draft}
              </span>
            )}
            {!hasMultiple && versions[0].priceCoins > 0 && (
              <span className="rounded-full bg-coin/15 px-2 py-0.5 text-[10px] font-semibold text-coin">
                <Coin className="mr-0.5 inline align-[-0.125em]" />{versions[0].priceCoins}
              </span>
            )}
          </div>
          {hasMultiple && (
            <p className="mt-0.5 text-[11px] text-ink-3">{versions.length} เวอร์ชัน</p>
          )}
        </div>

        {/* Expand/collapse arrow — only for multi-version */}
        {hasMultiple && (
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}

        {/* Single version: show inline action buttons */}
        {!hasMultiple && (
          <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Link
              href={`/studio/upload?versionId=${encodeURIComponent(versions[0].versionId)}`}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-2 transition hover:bg-fill hover:text-ink"
            >
              แก้ไข
            </Link>
            {versions[0].status === "draft" && versions[0].pages.length > 0 && (
              <button
                onClick={() => onSubmit(versions[0])}
                className={`rounded-xl ${PRIMARY_FILL} px-3 py-2 text-xs font-semibold transition`}
              >
                เผยแพร่
              </button>
            )}
            <button
              onClick={() => onDelete(versions[0])}
              className="rounded-xl border border-danger/25 px-3 py-2 text-xs font-semibold text-danger transition hover:bg-danger/10"
            >
              ลบ
            </button>
          </div>
        )}
      </div>

      {/* Expanded children tree — grid slide animation */}
      {hasMultiple && (
        <div
          className="grid transition-all duration-300 ease-in-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="ml-4 mt-1">
              {versions.map((v, i) => (
                <VersionRow
                  key={v.versionId}
                  version={v}
                  onSubmit={onSubmit}
                  onDelete={onDelete}
                  isLast={i === versions.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MangaDetailPage() {
  const params = useParams<{ titleId: string }>();
  const titleId = decodeURIComponent(params.titleId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTitleName = searchParams.get('titleName');
  const { user, loading, getIdToken } = useAuth();
  const { showToast } = useToast();

  const [allVersions, setAllVersions] = useState<ChapterVersion[]>(() => getCached<ChapterVersion[]>("studio:versions") ?? []);
  const [loadingVersions, setLoadingVersions] = useState(() => getCached("studio:versions") === null);
  const hasFetched = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState<ChapterVersion | null>(null);

  const versions = allVersions.filter((v) => v.titleId === titleId);
  
  const [displayTitle, setDisplayTitle] = useState(() => {
    if (queryTitleName) return queryTitleName;
    if (versions.length > 0) return versions[0].titleName;
    return "กำลังโหลด...";
  });

  useEffect(() => {
    if (versions.length > 0) {
      setDisplayTitle(versions[0]?.titleName ?? "ไม่ระบุชื่อเรื่อง");
    } else if (!loadingVersions && displayTitle === "กำลังโหลด...") {
      cacheOrFetch<{ title?: string }>(
        `manga:${titleId}:studio-detail`,
        async () => {
          const res = await fetch(`/api/proxy/books/manga/${titleId}`);
          if (!res.ok) throw new Error(`manga detail ${res.status}`); // not cached as an untitled answer (#983)
          return res.json();
        },
        TTL.LONG,
      )
        .then((data) => {
          if (data && data.title) {
            setDisplayTitle(data.title);
          } else {
            setDisplayTitle("ไม่ระบุชื่อเรื่อง");
          }
        })
        .catch(() => setDisplayTitle("ไม่ระบุชื่อเรื่อง"));
    }
  }, [versions.length, loadingVersions, titleId, displayTitle]);

  const coverUrl = getBookCoverUrl(titleId);

  const fetchVersions = useCallback(async () => {
    if (!user) return;

    const cached = getCached<ChapterVersion[]>("studio:versions");
    if (cached) {
      setAllVersions(cached);
      setLoadingVersions(false);
    } else {
      setLoadingVersions(true);
    }

    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      const data = await getMyVersions(token);
      setAllVersions(data);
      setCache("studio:versions", data);
    } catch {
      showToast({ type: "error", message: "ไม่สามารถโหลดรายการเวอร์ชันได้", duration: 3000 });
    } finally {
      setLoadingVersions(false);
    }
  }, [user, getIdToken, showToast]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      fetchVersions();
    }
  }, [user, fetchVersions]);

  const handleSubmit = async (version: ChapterVersion) => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      await publishVersion(token, version.versionId);
      showToast({ type: "success", message: "เผยแพร่งานแปลแล้ว", duration: 2500 });
      await fetchVersions();
    } catch (e: unknown) {
      showToast({
        type: "error",
        message: e instanceof Error ? e.message : "ไม่สามารถเผยแพร่งานแปลได้",
        duration: 3000,
      });
    }
  };

  const handleDelete = (version: ChapterVersion) => {
    setConfirmDelete(version);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const version = confirmDelete;
    // don't close yet — let ConfirmDialog show loading spinner
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      await deleteVersion(token, version.versionId);
      setConfirmDelete(null); // close on success
      showToast({ type: "success", message: "ลบงานแปลแล้ว", duration: 2200 });
      await fetchVersions();
    } catch (e: unknown) {
      setConfirmDelete(null); // also close on error
      showToast({
        type: "error",
        message: e instanceof Error ? e.message : "ไม่สามารถลบงานแปลได้",
        duration: 3000,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <Loader context="page" className="text-ink-2" />
      </div>
    );
  }

  return (
    <div className="text-ink">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Back */}
        <div className="mb-5">
          <Link
            href="/studio/works"
            className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition hover:text-ink"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            สตูดิโอของฉัน
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-fill">
              <CoverImage
                src={coverUrl}
                alt={displayTitle}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">{displayTitle}</h2>
              <p className="mt-0.5 text-sm text-ink-3">
                {loadingVersions ? "กำลังโหลด..." : `${versions.length} ตอนที่อัปโหลด`}
              </p>
              <CopyButton
                value={typeof window === "undefined" ? `/book/${titleId}` : `${window.location.origin}/book/${encodeURIComponent(titleId)}`}
                label="คัดลอกลิงก์หน้าเรื่อง"
                className="mt-3"
              />
            </div>
          </div>
          <Link
            href={`/studio/upload?titleId=${encodeURIComponent(titleId)}&titleName=${encodeURIComponent(displayTitle)}`}
            className={`shrink-0 rounded-xl ${PRIMARY_FILL} px-4 py-2.5 text-center text-sm font-semibold transition active:scale-95 sm:ml-auto sm:self-start`}
          >
            + อัปโหลดตอนใหม่
          </Link>
        </div>

        {/* Chapter list */}
        {loadingVersions && versions.length === 0 ? (
          <StudioChaptersSkeleton />
        ) : !loadingVersions && versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line py-16">
            <Mascot area="studio" size={72} />
            <p className="text-sm text-ink-3">ยังไม่มีตอนที่อัปโหลดสำหรับมังงะเรื่องนี้</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              // Group versions by chapterNumber, preserving sorted order of groups
              const sorted = versions.slice().sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));
              const groupMap = new Map<string, ChapterVersion[]>();
              for (const v of sorted) {
                const key = v.chapterNumber ?? "";
                if (!groupMap.has(key)) groupMap.set(key, []);
                groupMap.get(key)!.push(v);
              }
              return Array.from(groupMap.entries()).map(([chapterNumber, grpVersions]) => (
                <ChapterGroup
                  key={chapterNumber}
                  chapterNumber={chapterNumber}
                  versions={grpVersions}
                  onSubmit={handleSubmit}
                  onDelete={handleDelete}
                />
              ));
            })()}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete !== null}
        title={`ยืนยันการลบงานแปล ตอนที่ ${confirmDelete?.chapterNumber}?`}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
