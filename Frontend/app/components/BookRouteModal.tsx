"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookDetailModal from "./BookDetailModal";
import { bookFromDetail } from "../lib/bookFromDetail";
import { parseJsonOrNull } from "../lib/safeJson";
import type { LandingBook, MangaDetail } from "../lib/types";

const API_BASE = "/api/proxy";

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
    fetch(`${API_BASE}/books/manga/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? parseJsonOrNull<MangaDetail>(res) : null))
      .then((detail) => {
        if (!cancelled) setState((detail && bookFromDetail(detail)) || "missing");
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
      <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="rounded-2xl bg-[#141414] p-8 text-center shadow-2xl">
          <p className="text-white/60">ไม่พบข้อมูลหนังสือ</p>
          <button
            onClick={close}
            className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            ← กลับหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return <BookDetailModal key={state.id} book={state} routed onClose={close} />;
}
