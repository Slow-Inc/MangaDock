"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Navbar from "../components/Navbar";
import ForumSideMenu from "../components/ForumSideMenu";
import { ReactLenis } from 'lenis/react';
import type { ForumCategory } from "../lib/types";

function CommunityLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Derive active states from URL to keep sidebar in sync across pages
  const category = (searchParams.get('category') as ForumCategory) || undefined;
  const mangaId = searchParams.get('mangaId') || undefined;
  // Highlight sidebar when on /community/manga/[id] route
  const routeMangaId = pathname.match(/^\/community\/manga\/([^/]+)/)?.[1];
  const activeMangaId = mangaId ?? routeMangaId;
  const isOnTrending = pathname === '/community/trending';

  useEffect(() => {
    const handleToggle = () => setIsMobileMenuOpen(prev => !prev);
    window.addEventListener('toggleMobileMenu', handleToggle);
    return () => window.removeEventListener('toggleMobileMenu', handleToggle);
  }, []);

  const handleMobileSelect = () => {
    setIsMobileMenuOpen(false);
  };

  const navigateToFeed = (mId?: string, cat?: ForumCategory) => {
    if (mId) {
      router.push(`/community/manga/${mId}`);
    } else {
      const params = new URLSearchParams();
      if (cat) params.set('category', cat);
      router.push(`/community${params.toString() ? `?${params.toString()}` : ''}`);
    }
  };

  return (
    <div className="min-h-screen bg-[--surface-base]">
      <Navbar />
      
      {/* Mobile Drawer Overlay */}
      <div 
        className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <div
          className={`absolute top-0 left-0 w-[300px] h-full bg-[--surface-overlay] shadow-2xl border-r border-white/10 transition-transform duration-300 ease-out overflow-y-auto custom-scrollbar p-6 ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
            <h2 className="font-black text-white uppercase tracking-widest text-xs">Community</h2>
            <button onClick={() => setIsMobileMenuOpen(false)} aria-label="ปิดเมนู" className="text-white/40 hover:text-white">
              <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
              </svg>
            </button>
          </div>
          <ForumSideMenu
            onMangaSelect={(id) => { navigateToFeed(id, category); handleMobileSelect(); }}
            selectedMangaId={activeMangaId}
            onCategorySelect={(cat) => { navigateToFeed(mangaId, cat); handleMobileSelect(); }}
            selectedCategory={category}
            onTrendingSelect={() => { router.push('/community/trending'); handleMobileSelect(); }}
            isOnTrending={isOnTrending}
          />
        </div>
      </div>

      <main className="pt-24 lg:pt-28 pb-20 px-4 lg:px-10 max-w-7xl mx-auto [overflow-x:clip]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12">
          {/* Sidebar Column (Left) - Persistent and Pre-loaded */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-28 self-start h-[calc(100vh-8rem)]">
            <ReactLenis 
              options={{ lerp: 0.08, wheelMultiplier: 1, smoothWheel: true }} 
              className="h-full overflow-y-auto overscroll-contain custom-scrollbar pr-2 pb-6"
            >
              <ForumSideMenu
                onMangaSelect={(id) => navigateToFeed(id, category)}
                selectedMangaId={activeMangaId}
                onCategorySelect={(cat) => navigateToFeed(mangaId, cat)}
                selectedCategory={category}
                onTrendingSelect={() => router.push('/community/trending')}
                isOnTrending={isOnTrending}
              />
            </ReactLenis>
          </aside>

          {/* Dynamic Content Column */}
          <div className="col-span-full lg:col-span-8 xl:col-span-9 min-w-0 relative">
            {children}
          </div>

        </div>
      </main>
    </div>
  );
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
        <div className="min-h-screen bg-[--surface-base] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        </div>
    }>
      <CommunityLayoutContent>{children}</CommunityLayoutContent>
    </Suspense>
  );
}
