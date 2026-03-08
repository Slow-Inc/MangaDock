"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import MetaBooksLogo from "./MetaBooksLogo";
import NavbarActions from "./NavbarActions";

const GENRES = [
  { slug: "action",        label: "แอคชัน" },
  { slug: "adventure",     label: "ผจญภัย" },
  { slug: "comedy",        label: "ตลก" },
  { slug: "romance",       label: "โรแมนติก" },
  { slug: "fantasy",       label: "แฟนตาซี" },
  { slug: "drama",         label: "ดราม่า" },
  { slug: "horror",        label: "สยองขวัญ" },
  { slug: "sci-fi",        label: "ไซไฟ" },
  { slug: "slice-of-life", label: "ชีวิตประจำวัน" },
  { slug: "sports",        label: "กีฬา" },
  { slug: "mystery",       label: "ลึกลับ" },
  { slug: "psychological", label: "จิตวิทยา" },
  { slug: "supernatural",  label: "เหนือธรรมชาติ" },
  { slug: "historical",    label: "ประวัติศาสตร์" },
  { slug: "isekai",        label: "อิเซไค" },
  { slug: "mecha",         label: "หุ่นยนต์" },
  { slug: "school-life",   label: "ชีวิตนักเรียน" },
  { slug: "thriller",      label: "ระทึกขวัญ" },
];

const navItems = [
  { label: "หน้าหลัก",     href: "/",                    scrollId: undefined },
  { label: "อ่านต่อ",       href: "/#continue-reading",   scrollId: "continue-reading" },
  { label: "หนังสือทั้งหมด",  href: "/new",                  scrollId: undefined },
  { label: "รายการของฉัน", href: "/mylist",               scrollId: undefined },
];

export default function Navbar() {
  const [scrolled, setScrolled]   = useState(false);
  const [genreOpen, setGenreOpen] = useState(false);
  const [mobileGenreOpen, setMobileGenreOpen] = useState(false);
  const pathname                   = usePathname();
  const router                     = useRouter();
  const genreRef                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close genre dropdown on outside click
  useEffect(() => {
    if (!genreOpen) return;
    const handler = (e: MouseEvent) => {
      if (genreRef.current && !genreRef.current.contains(e.target as Node)) {
        setGenreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [genreOpen]);

  // Close genre dropdown on route change
  useEffect(() => { setGenreOpen(false); setMobileGenreOpen(false); }, [pathname]);

  const handleNavClick = (
    e: React.MouseEvent,
    item: (typeof navItems)[number]
  ) => {
    if (item.scrollId) {
      e.preventDefault();
      if (pathname === "/") {
        document
          .getElementById(item.scrollId)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        router.push("/");
        setTimeout(() => {
          document
            .getElementById(item.scrollId!)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 600);
      }
    }
  };

  return (
    <>
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-white/10 shadow-lg"
          : "border-b border-transparent"
      }`}
    >
      {/* Blur + bg overlay — kept as a child so dropdown's backdrop-blur isn't blocked by parent compositing */}
      <div
        className={`pointer-events-none absolute inset-0 -z-10 transition-all duration-500 ${
          scrolled ? "bg-black/60 backdrop-blur-xl" : "bg-transparent"
        }`}
      />

      {/* Gradient shadow */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-black/70 to-transparent transition-opacity duration-500 ${
          scrolled ? "opacity-0" : "opacity-100"
        }`}
      />

      <div className="flex h-16 w-full items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-8">
          <Link href="/">
            <MetaBooksLogo className="h-9" />
          </Link>

          <nav className="hidden items-center gap-1 text-sm md:flex">
            {/* Regular nav items */}
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href.split("?")[0]);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item)}
                  className={`rounded-lg px-3 py-2 transition-colors duration-200 ${
                    isActive
                      ? "font-semibold text-white"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* หมวดหมู่ dropdown */}
            <div ref={genreRef} className="relative">
              <button
                onClick={() => setGenreOpen((p) => !p)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 transition-colors duration-200 ${
                  genreOpen || pathname.startsWith("/categories")
                    ? "font-semibold text-white"
                    : "text-white/65 hover:text-white"
                }`}
              >
                หมวดหมู่
                <svg
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${genreOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* Dropdown panel */}
              <div
                className={`absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/15 bg-black/70 shadow-2xl backdrop-blur-sm transition-all duration-200 origin-top-left ${
                  genreOpen
                    ? "pointer-events-auto scale-100 opacity-100"
                    : "pointer-events-none scale-95 opacity-0"
                }`}
              >
                {/* Header */}
                <div className="border-b border-white/10 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                    เลือกหมวดหมู่
                  </p>
                </div>

                {/* Genre grid */}
                <div className="grid grid-cols-3 gap-1 p-3">
                  {GENRES.map((g) => {
                    const isActive = pathname === `/categories/${g.slug}`;
                    return (
                      <Link
                        key={g.slug}
                        href={`/categories/${g.slug}`}
                        onClick={() => setGenreOpen(false)}
                        className={`rounded-lg px-2 py-1.5 text-center text-xs transition-colors duration-150 ${
                          isActive
                            ? "bg-white/15 font-semibold text-white"
                            : "text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {g.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>
        </div>

        <NavbarActions />
      </div>
    </header>

    {/* ── Mobile bottom navigation (Webtoon-style) ── */}
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black md:hidden">
      {/* Genre dropdown (slides up from bottom nav) */}
      <div
        className={`overflow-hidden border-b border-white/10 transition-all duration-300 ${
          mobileGenreOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0 border-b-0"
        }`}
      >
        <div className="grid grid-cols-4 gap-1 bg-black p-3">
          {GENRES.map((g) => {
            const active = pathname === `/categories/${g.slug}`;
            return (
              <Link
                key={g.slug}
                href={`/categories/${g.slug}`}
                onClick={() => setMobileGenreOpen(false)}
                className={`rounded-lg px-1.5 py-2 text-center text-[11px] transition-colors duration-150 ${
                  active
                    ? "bg-white/15 font-semibold text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {g.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex h-16 items-center justify-around px-2">
        {/* หน้าหลัก */}
        <Link href="/" className={`flex flex-col items-center justify-center gap-0.5 px-2 text-[10px] transition-colors duration-200 ${pathname === "/" ? "text-white" : "text-white/45"}`}>
          <svg viewBox="0 0 24 24" fill={pathname === "/" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={pathname === "/" ? 0 : 2} className="h-5 w-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>หน้าหลัก</span>
        </Link>

        {/* หนังสือทั้งหมด */}
        <Link href="/new" className={`flex flex-col items-center justify-center gap-0.5 px-2 text-[10px] transition-colors duration-200 ${pathname.startsWith("/new") ? "text-white" : "text-white/45"}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname.startsWith("/new") ? 2.5 : 2} className="h-5 w-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>หนังสือทั้งหมด</span>
        </Link>

        {/* ค้นหา (center) */}
        <Link href="/search" className={`flex flex-col items-center justify-center gap-0.5 px-2 text-[10px] transition-colors duration-200 ${pathname.startsWith("/search") ? "text-white" : "text-white/45"}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname.startsWith("/search") ? 2.5 : 2} className="h-5 w-5" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <span>ค้นหา</span>
        </Link>

        {/* หมวดหมู่ (dropdown toggle) */}
        <button
          onClick={() => setMobileGenreOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 px-2 text-[10px] transition-colors duration-200 ${
            mobileGenreOpen || pathname.startsWith("/categories") ? "text-white" : "text-white/45"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname.startsWith("/categories") ? 2.5 : 2} className="h-5 w-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>หมวดหมู่</span>
        </button>

        {/* รายการของฉัน */}
        <Link href="/mylist" className={`flex flex-col items-center justify-center gap-0.5 px-2 text-[10px] transition-colors duration-200 ${pathname.startsWith("/mylist") ? "text-white" : "text-white/45"}`}>
          <svg viewBox="0 0 24 24" fill={pathname.startsWith("/mylist") ? "currentColor" : "none"} stroke="currentColor" strokeWidth={pathname.startsWith("/mylist") ? 0 : 2} className="h-5 w-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span>รายการของฉัน</span>
        </Link>
      </div>
    </nav>
    </>
  );
}
