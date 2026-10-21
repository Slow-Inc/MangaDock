'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { ROLE } from '../lib/types/user';
import { adminGate } from './components/adminGate';
import { usePageTitle } from '../hooks/pageTitle';

const NAV = [
  {
    href: '/admin',
    label: 'Overview',
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Users',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: '/admin/content',
    label: 'Content',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/transactions',
    label: 'Transactions',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/audit',
    label: 'Audit Log',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

function isNavActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href) && href !== '/admin';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, getIdToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const activeNav = NAV.find(({ href, exact }) => isNavActive(pathname, href, exact));
  usePageTitle(activeNav ? `${activeNav.label} · Admin` : 'Admin');
  // The authoritative role (profiles.role): the JWT can lag for an admin promoted in the panel (#817).
  const mobileNavRef = useRef<HTMLElement>(null);
  const [profile, setProfile] = useState<{ uid: string; role: number | null } | null>(null);
  const uid = user?.uid;
  const jwtRole = user?.role;

  useEffect(() => {
    if (loading || !uid || (jwtRole ?? 0) >= ROLE.ADMIN) return;
    let active = true;
    (async () => {
      let role: number | null = null;
      try {
        const token = await getIdToken();
        const res = token ? await fetch('/api/proxy/users/me', { headers: { Authorization: `Bearer ${token}` } }) : null;
        if (res?.ok) {
          const r = Number((await res.json())?.role);
          role = Number.isFinite(r) ? r : null;
        }
      } catch { /* role stays null → redirect */ }
      if (active) setProfile({ uid, role });
    })();
    return () => { active = false; };
  }, [loading, uid, jwtRole, getIdToken]);

  const gate = adminGate({ user, loading, profileRole: profile && profile.uid === uid ? profile.role : undefined });

  useEffect(() => {
    if (gate === 'redirect') router.replace('/');
  }, [gate, router]);

  // Keep the active tab visible in the scrolling mobile strip (Audit Log sits past the right edge at 390px).
  useEffect(() => {
    mobileNavRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname, gate]);

  if (gate !== 'allow') return null;

  return (
    <div className="flex min-h-screen flex-col bg-bg md:flex-row">
      {/* Mobile top bar (#819): the sidebar would leave ~120px of content at phone width */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg md:hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <p className="text-sm font-semibold text-ink">Admin Panel</p>
          <Link href="/" className="text-xs text-ink-2 hover:text-ink smooth-hover-fast">Back to App</Link>
        </div>
        <nav ref={mobileNavRef} className="mobile-tabs-scroll flex gap-1 overflow-x-auto scroll-px-3 px-3 pb-3" aria-label="Admin">
          {NAV.map(({ href, label, exact }) => {
            const isActive = isNavActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs smooth-hover-fast ${
                  isActive ? 'bg-accent/10 text-accent font-medium border-accent/40' : 'text-ink-2 border-transparent hover:text-ink hover:bg-fill'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-line flex-col sticky top-0 h-screen overflow-hidden">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fill border border-line shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-accent">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink leading-tight">Admin Panel</p>
              <p className="text-[11px] text-ink-3 leading-tight">MangaDock</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-[0.1em] px-3 mb-2.5">Management</p>
          {NAV.map(({ href, label, exact, icon }) => {
            const isActive = isNavActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm smooth-hover-fast border ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium border-accent/40'
                    : 'text-ink-2 hover:text-ink hover:bg-fill border-transparent'
                }`}
              >
                {icon}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-line">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-ink-2 hover:text-ink smooth-hover-fast transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
