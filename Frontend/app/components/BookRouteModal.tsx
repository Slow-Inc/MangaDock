"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookDetailModal from "./BookDetailModal";
import { bookFromDetail } from "../lib/bookFromDetail";
import { loadMangaDetail } from "../lib/mangaDetail";
import type { LandingBook } from "../lib/types";

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

  if (state === "loading") return null;

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
