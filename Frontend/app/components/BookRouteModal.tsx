"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BookDetailModal from "./BookDetailModal";
import { bookFromDetail } from "../lib/bookFromDetail";
import { loadMangaDetail } from "../lib/mangaDetail";
import type { LandingBook } from "../lib/types";
import Loader from "./ui/Loader";
import { DOT_FIELD } from "./skeletonDots";
import LoadError from "./ui/LoadError";
import { isNotFound } from "../lib/httpError";
import { useDialogFocus } from "../hooks/useDialogFocus";

/**
 * The book popup for a direct /book/<id> visit (shared link, refresh, new tab): there is
 * no card to copy the book from, so it is loaded from the detail API, then shown over the
 * home page rendered behind it. Closing goes to "/" (there is no earlier in-app page).
 */
export default function BookRouteModal({ id }: { id: string }) {
  const router = useRouter();
  // "missing" only for a 404, or a detail bookFromDetail cannot use; any other failure — a network error, a 5xx, a 200 of
  // the wrong shape — is "failed", with a retry (#919)
  const [state, setState] = useState<"loading" | "missing" | "failed" | LandingBook>("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadMangaDetail(id)
      .then((detail) => {
        if (!cancelled) setState(bookFromDetail(detail) ?? "missing");
      })
      .catch((err) => {
        if (!cancelled) setState(isNotFound(err) ? "missing" : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [id, retry]);

  const close = useCallback(() => router.replace("/"), [router]);

  if (state === "loading") return <PopupSkeleton onClose={close} />;

  if (state === "missing") {
    return (
      <NoticeDialog label="ไม่พบข้อมูลหนังสือ" onClose={close}>
        <p className="text-ink-2">ไม่พบข้อมูลหนังสือ</p>
        <button
          onClick={close}
          className="mt-4 rounded-lg border border-ink-3 px-4 py-2 text-sm text-ink-2 hover:bg-fill"
        >
          ← กลับหน้าแรก
        </button>
      </NoticeDialog>
    );
  }

  if (state === "failed") {
    return (
      <NoticeDialog label="โหลดหนังสือไม่สำเร็จ" onClose={close}>
        <LoadError
          what="หนังสือ"
          framed={false}
          onRetry={() => {
            setState("loading");
            setRetry((n) => n + 1);
          }}
        />
        <button onClick={close} className="mt-3 text-sm text-ink-2 hover:text-ink">
          ← กลับหน้าแรก
        </button>
      </NoticeDialog>
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
  const root = useRef<HTMLDivElement>(null);
  useDialogFocus(root, () => true); // aria-modal: Tab stays inside (#919 review)
  // A slow fetch must not trap anyone: Escape and a close button work as in the popup itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="กำลังโหลดหนังสือ" className="fixed inset-0 z-200 flex items-center justify-center outline-none md:p-4">
      <div className="absolute inset-0 bg-bg md:bg-scrim/90" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-3xl">
        <button
          onClick={onClose}
          title="ปิด"
          aria-label="ปิด"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-bg/80 text-ink transition-colors hover:bg-raised"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
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

/**
 * The small "not found" / "could not load" window for a direct /book link (#919): a real dialog — focus starts on its
 * first button, Escape and the scrim close it — as the loading skeleton and the popup itself already are.
 */
function NoticeDialog({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useDialogFocus(root, () => true); // aria-modal: Tab stays inside (#837)
  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-200 flex items-center justify-center p-4 outline-none">
      <div className="absolute inset-0 bg-scrim/75" onClick={onClose} />
      <div ref={box} className="relative w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-2xl">
        {children}
      </div>
    </div>
  );
}
