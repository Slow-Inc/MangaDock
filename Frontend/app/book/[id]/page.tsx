"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BookDetailModal from "../../components/BookDetailModal";
import type { LandingBook } from "../../lib/types/manga";

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book] = useState<LandingBook | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(`mb:book:${id}`);
      return stored ? (JSON.parse(stored) as LandingBook) : null;
    } catch {
      return null;
    }
  });
  const notFound = book === null;

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#141414]">
        <div className="text-center">
          <p className="text-white/50">ไม่พบข้อมูลหนังสือ</p>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            ← กลับ
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414]">
      <BookDetailModal
        book={book}
        asPage
        onClose={() => router.back()}
      />
    </main>
  );
}
