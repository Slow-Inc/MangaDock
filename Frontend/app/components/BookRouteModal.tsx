"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookDetailModal from "./BookDetailModal";
import { bookFromDetail } from "../lib/bookFromDetail";
import { loadMangaDetail } from "../lib/mangaDetail";
import type { LandingBook } from "../lib/types";
import Loader from "./ui/Loader";
import { DOT_FIELD } from "./skeletonDots";

/**
 * The book popup for a direct /book/<id> visit (shared link, refresh, new tab): there is
 * no card to copy the book from, so it is loaded from the detail API, then shown over the
 * home page rendered behind it. Closing goes to "/" (there is no earlier in-app page).
 */
export default function BookRouteModal({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "missing" | LandingBook>("loading");

  useEffect(() => {
    let cancelled = false;
    loadMangaDetail(id)
      .then((detail) => {
        if (!cancelled) setState(bookFromDetail(detail) ?? "missing");
      })
      .catch(() => {
        if (!cancelled) setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const close = () => router.replace("/");

  if (state === "loading") return <PopupSkeleton onClose={close} />;

  if (state === "missing") {
    return (
      <div className="fixed inset-0 z-200 flex items-center justify-center bg-scrim/75 p-4">
        <div className="rounded-2xl bg-surface p-8 text-center shadow-2xl">
          <p className="text-ink-2">ไม่พบข้อมูลหนังสือ</p>
          <button
            onClick={close}
            className="mt-4 rounded-lg border border-ink-3 px-4 py-2 text-sm text-ink-2 hover:bg-fill"
          >
            ← กลับหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return <BookDetailModal key={state.id} book={state} routed onClose={close} />;
}

/**
 * Stands in for the popup while the detail loads: the same scrim and window as `BookDetailModal`
 * (so the swap does not flash), with the cover in the dot field and quiet bars for the text.
 */
function PopupSkeleton({ onClose }: { onClose: () => void }) {
  const cover = "relative aspect-2/3 shrink-0 overflow-hidden rounded-xl bg-fill ring-1 ring-line";
  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-bg md:bg-scrim/90" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-3xl">
        <div className="flex flex-col items-center gap-5 px-5 pb-6 pt-9 md:flex-row md:items-end md:pt-14">
          <div className={`${cover} w-36 md:w-40`}>
            <div aria-hidden className={`h-full w-full animate-pulse ${DOT_FIELD}`} />
            <Loader context="section" label="กำลังโหลดหนังสือ" className="absolute inset-0 text-ink-3" />
          </div>
          <div aria-hidden className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 md:items-start">
            <div className="h-7 w-2/3 rounded-lg bg-fill" />
            <div className="h-3 w-1/3 rounded bg-fill" />
            <div className="flex gap-1.5">
              <div className="h-6 w-16 rounded-full bg-fill" />
              <div className="h-6 w-20 rounded-full bg-fill" />
              <div className="h-6 w-14 rounded-full bg-fill" />
            </div>
          </div>
        </div>
        <div aria-hidden className="space-y-2.5 px-5 pb-8 pt-4">
          <div className="h-3 w-full rounded bg-fill" />
          <div className="h-3 w-full rounded bg-fill" />
          <div className="h-3 w-4/5 rounded bg-fill" />
          <div className="h-3 w-3/5 rounded bg-fill" />
        </div>
      </div>
    </div>
  );
}
