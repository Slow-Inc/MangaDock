"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BookDetailModal from "../../components/BookDetailModal";
import type { LandingBook } from "../../lib/types/manga";

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<LandingBook | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(`mb:book:${id}`);
    if (!stored) {
      setNotFound(true);
      return;
    }
    try {
      setBook(JSON.parse(stored) as LandingBook);
    } catch {
      setNotFound(true);
    }
  }, [id]);

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

  if (!book) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
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
