import BookRow from "./components/BookRow";
import ContinueReadingRow from "./components/ContinueReadingRow";
import HeroCarousel from "./components/HeroCarousel";
import HomeCachedLanding from "./components/HomeCachedLanding";
import HomeStatusLine from "./components/HomeStatusLine";
import Navbar from "./components/Navbar";
import TopTenRow from "./components/TopTenRow";
import type { LandingBook, LandingPayload as LandingResponse } from "./lib/types";

type LandingFetchResult = {
  data: LandingResponse | null;
  backendUnavailable: boolean;
};

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

const getLandingData = async (forceLocal = false): Promise<LandingFetchResult> => {
  try {
    const url = `${API_BASE}/books/landing${forceLocal ? "?forceLocal=true" : ""}`;
    const response = await fetch(url, {
      next: { revalidate: forceLocal ? 0 : 1800 },
    });

    if (!response.ok) {
      return { data: null, backendUnavailable: true };
    }

    return { data: (await response.json()) as LandingResponse, backendUnavailable: false };
  } catch {
    return { data: null, backendUnavailable: true };
  }
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ forceLocal?: string }>;
}) {
  const params = await searchParams;
  const forceLocal = params.forceLocal === "1";
  const { data, backendUnavailable } = await getLandingData(forceLocal);
  const rows = data?.rows?.filter((row) => row.items.length > 0) ?? [];
  const topRankedBooks = rows[0]?.items?.slice(0, 10) ?? [];
  const hasData = rows.length > 0;
  const staleTimestamp = data?.fromStaleCache && hasData
    ? (data.staleUpdatedAt ?? data.updatedAt)
    : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {topRankedBooks.length > 0 && <HeroCarousel books={topRankedBooks} />}

      <main className="relative z-10 space-y-10 px-6 pb-20 md:pb-16 lg:px-12">
        <HomeStatusLine serverUnavailable={backendUnavailable} staleTimestamp={staleTimestamp} />

        {backendUnavailable && <HomeCachedLanding />}

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
