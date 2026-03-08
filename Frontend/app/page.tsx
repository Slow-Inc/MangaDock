import BookRow from "./components/BookRow";
import ContinueReadingRow from "./components/ContinueReadingRow";
import HeroCarousel from "./components/HeroCarousel";
import Navbar from "./components/Navbar";
import TopTenRow from "./components/TopTenRow";

type LandingBook = {
  id: string;
  title: string;
  subtitle: string;
  authors: string[];
  description: string;
  thumbnail: string;
  /** Local /img-cache/… path returned when backend IMAGE_CACHE_ENABLED=true */
  thumbnailLocal?: string;
  /** false = forceLocal mode and file not yet cached */
  thumbnailCached?: boolean;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
};

type LandingRow = {
  id: string;
  title: string;
  query: string;
  items: LandingBook[];
};

type LandingResponse = {
  hero: LandingBook | null;
  rows: LandingRow[];
  updatedAt: string;
};

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

const getLandingData = async (forceLocal = false): Promise<LandingResponse | null> => {
  try {
    const url = `${API_BASE}/books/landing${forceLocal ? "?forceLocal=true" : ""}`;
    const response = await fetch(url, {
      next: { revalidate: forceLocal ? 0 : 1800 },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LandingResponse;
  } catch {
    return null;
  }
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ forceLocal?: string }>;
}) {
  const params = await searchParams;
  const forceLocal = params.forceLocal === "1";
  const data = await getLandingData(forceLocal);
  const rows = data?.rows?.filter((row) => row.items.length > 0) ?? [];
  const topRankedBooks = rows[0]?.items?.slice(0, 10) ?? [];
  const hasData = rows.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {topRankedBooks.length > 0 && <HeroCarousel books={topRankedBooks} />}

      <main className="relative z-10 space-y-10 px-6 pb-20 md:pb-16 lg:px-12">
        {!hasData && (
          <section className="mx-auto max-w-5xl rounded-3xl border border-white/15 bg-white/8 p-8 text-white backdrop-blur-2xl">
            <h2 className="text-2xl font-bold">ยังโหลดรายการหนังสือไม่ได้</h2>
            <p className="mt-2 text-sm text-white/75">
              ขณะนี้ Google Books API อาจติด rate limit ชั่วคราว ให้ลองรีเฟรชอีกครั้ง หรือตั้งค่า
              <span className="mx-1 font-semibold">GOOGLE_BOOKS_API_KEY</span>
              ใน backend เพื่อเพิ่มโควตา
            </p>
          </section>
        )}

        <ContinueReadingRow />

        {topRankedBooks.length > 0 && (
          <TopTenRow books={topRankedBooks} />
        )}

        {rows.map((row) => (
          <BookRow
            key={row.id}
            rowId={row.id}
            rowTitle={row.title}
            items={row.items}
            seeMoreHref={`/new?tab=${row.id}`}
          />
        ))}
      </main>
    </div>
  );
}
