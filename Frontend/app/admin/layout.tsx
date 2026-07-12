'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { ROLE } from '../lib/types/user';

const NAV = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/users', label: 'Users', exact: false },
  { href: '/admin/content', label: 'Content', exact: false },
  { href: '/admin/transactions', label: 'Transactions', exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user !== undefined && (user === null || (user.role ?? 0) < ROLE.ADMIN)) {
      router.replace('/');
    }
  }, [user, router]);

  // Prevent flash of content while auth resolves or redirecting
  if (user === undefined || user === null || (user.role ?? 0) < ROLE.ADMIN) return null;

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-white/10 flex flex-col pt-8 px-3 gap-1">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest px-3 mb-3">Admin</p>
        {NAV.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href) && href !== '/admin';
          const isOverview = exact && pathname === '/admin';
          const isActive = isOverview || active;
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
