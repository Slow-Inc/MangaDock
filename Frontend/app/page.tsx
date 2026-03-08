import Link from "next/link";
type Poster = {
  title: string;
  subtitle: string;
  gradient: string;
  badge?: string;
};

type Shelf = {
  title: string;
  posters: Poster[];
};

const oauthBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

const shelves: Shelf[] = [
  {
    title: 'มาแรงในสัปดาห์นี้',
    posters: [
      { title: 'After Midnight', subtitle: 'Mystery', gradient: 'linear-gradient(135deg,#0f172a,#1e293b,#334155)', badge: 'HOT' },
      { title: 'Flame of Dawn', subtitle: 'Fantasy', gradient: 'linear-gradient(135deg,#7c2d12,#c2410c,#fb923c)', badge: 'NEW' },
      { title: 'Zero Protocol', subtitle: 'Tech Thriller', gradient: 'linear-gradient(135deg,#111827,#1d4ed8,#38bdf8)' },
      { title: 'Velvet Room', subtitle: 'Romance', gradient: 'linear-gradient(135deg,#3f1d38,#7e22ce,#d946ef)' },
      { title: 'Crimson Ledger', subtitle: 'Crime', gradient: 'linear-gradient(135deg,#111827,#7f1d1d,#dc2626)' },
      { title: 'Northern Signal', subtitle: 'Sci‑Fi', gradient: 'linear-gradient(135deg,#0f172a,#155e75,#2dd4bf)' },
    ],
  },
  {
    title: 'Top 10 E-Book ประเทศไทย',
    posters: [
      { title: '1. Silent Code', subtitle: 'Bestseller', gradient: 'linear-gradient(135deg,#1f2937,#111827,#030712)' },
      { title: '2. Glass Heart', subtitle: 'Romance', gradient: 'linear-gradient(135deg,#3b0764,#6d28d9,#a855f7)' },
      { title: '3. Phantom Trace', subtitle: 'Thriller', gradient: 'linear-gradient(135deg,#0f172a,#374151,#6b7280)' },
      { title: '4. Atlas of Stars', subtitle: 'Sci‑Fi', gradient: 'linear-gradient(135deg,#082f49,#0e7490,#67e8f9)' },
      { title: '5. Ember Court', subtitle: 'Fantasy', gradient: 'linear-gradient(135deg,#451a03,#92400e,#f59e0b)' },
      { title: '6. Broken Compass', subtitle: 'Adventure', gradient: 'linear-gradient(135deg,#1f2937,#0f766e,#34d399)' },
    ],
  },
  {
    title: 'แนะนำสำหรับคุณ',
    posters: [
      { title: 'Quantum Bloom', subtitle: 'Sci‑Fi', gradient: 'linear-gradient(135deg,#312e81,#4338ca,#818cf8)' },
      { title: 'Noir District', subtitle: 'Detective', gradient: 'linear-gradient(135deg,#020617,#1e293b,#475569)' },
      { title: 'Paper Kingdom', subtitle: 'Young Adult', gradient: 'linear-gradient(135deg,#3f3f46,#71717a,#a1a1aa)' },
      { title: 'Echo Ritual', subtitle: 'Horror', gradient: 'linear-gradient(135deg,#111827,#1f2937,#ef4444)' },
      { title: 'Ocean of Ink', subtitle: 'Drama', gradient: 'linear-gradient(135deg,#082f49,#0e7490,#22d3ee)' },
      { title: 'Golden Arc', subtitle: 'Business', gradient: 'linear-gradient(135deg,#451a03,#a16207,#facc15)' },
    ],
  },
];

function PosterCard({ poster }: { poster: Poster }) {
  return (
    <div className="book-card shrink-0 w-48 sm:w-56">
      <div
        className="relative h-72 rounded-2xl border overflow-hidden"
        style={{
          borderColor: 'var(--border)',
          background: poster.gradient,
        }}
      >
        {poster.badge && (
          <span className="absolute top-3 left-3 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">
            {poster.badge}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 p-4">
          <p className="text-base font-semibold text-white">{poster.title}</p>
          <p className="text-xs text-slate-300">{poster.subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function ShelfRow({ shelf }: { shelf: Shelf }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {shelf.title}
        </h2>
        <Link href="#" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          ดูทั้งหมด
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {shelf.posters.map((poster) => (
          <PosterCard key={poster.title} poster={poster} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="pb-16" style={{ background: 'var(--bg)' }}>
      <section className="relative min-h-[82vh] overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 70% 30%, rgba(239,68,68,0.3) 0%, transparent 70%), linear-gradient(180deg, rgba(2,6,23,0.4) 0%, rgba(2,6,23,0.96) 75%)',
          }}
        />
        <div className="absolute -top-24 right-20 h-72 w-72 rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute top-40 left-16 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pt-28 pb-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-red-500">MetaBooks Originals</p>
            <h1 className="mb-4 text-5xl font-bold leading-tight text-white md:text-6xl" style={{ fontFamily: 'var(--font-display)' }}>
              อ่านให้สุด
              <br />
              แล้วหยุดไม่ได้
            </h1>
            <p className="mb-8 max-w-xl text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Landing Page สไตล์ Netflix สำหรับแพลตฟอร์มขาย E‑Book พร้อมระบบ OAuth ผ่าน Google และ Facebook เชื่อมกับ NestJS API โดยตรง
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={`${oauthBaseUrl}/auth/google`} className="btn-primary px-6 py-3 text-sm">
                เข้าสู่ระบบด้วย Google
              </a>
              <a href={`${oauthBaseUrl}/auth/facebook`} className="btn-ghost px-6 py-3 text-sm">
                เข้าสู่ระบบด้วย Facebook
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-8">
              {[
                ['50K+', 'E-Book'],
                ['4.9/5', 'คะแนนรีวิว'],
                ['24/7', 'แนะนำหนังสือด้วย AI'],
              ].map(([number, label]) => (
                <div key={label}>
                  <p className="text-2xl font-bold text-white">{number}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl p-6 sm:p-8">
            <p className="mb-4 text-xs uppercase tracking-widest text-amber-300">กำลังได้รับความนิยม</p>
            <div className="space-y-3">
              {[
                ['The Last Library', 'Drama • 1.2M views'],
                ['Algorithm of Love', 'Romance • 950K views'],
                ['Shattered Realm', 'Fantasy • 870K views'],
              ].map(([title, meta]) => (
                <div key={title} className="rounded-xl border bg-black/25 p-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {meta}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {shelves.map((shelf) => (
        <ShelfRow key={shelf.title} shelf={shelf} />
      ))}
    </main>
  );
}
