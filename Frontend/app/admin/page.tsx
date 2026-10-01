'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { cacheOrFetch, TTL } from '../lib/apiCache';

interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  activePosts: number;
  transactionsToday: { count: number; coinSum: number };
  recentBans: Array<{ uid: string; displayName: string; bannedAt: string }>;
}

const CARDS = (s: AdminStats) => [
  {
    label: 'Total Users', value: s.totalUsers.toLocaleString(), sub: `+${s.newUsersToday} today`,
    color: 'text-blue-400', ring: 'bg-blue-500/10 border-blue-500/20',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>,
  },
  {
    label: 'Active Posts', value: s.activePosts.toLocaleString(), sub: 'forum posts',
    color: 'text-emerald-400', ring: 'bg-emerald-500/10 border-emerald-500/20',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  },
  {
    label: 'Transactions Today', value: s.transactionsToday.count.toLocaleString(), sub: `${s.transactionsToday.coinSum.toLocaleString()} coins`,
    color: 'text-amber-400', ring: 'bg-amber-500/10 border-amber-500/20',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    label: 'Recently Banned', value: s.recentBans.length.toLocaleString(), sub: 'last 10 entries',
    color: 'text-red-400', ring: 'bg-red-500/10 border-red-500/20',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  },
];

function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-2.5 w-20 bg-white/10 rounded" />
        <div className="h-7 w-7 rounded-lg bg-white/10" />
      </div>
      <div className="h-8 w-14 bg-white/10 rounded mb-2" />
      <div className="h-2.5 w-16 bg-white/5 rounded" />
    </div>
  );
}

export default function AdminOverviewPage() {
  const { getIdToken } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await cacheOrFetch<AdminStats>(
        'admin:stats',
        async () => {
          const token = await getIdToken();
          const res = await fetch('/api/proxy/admin/stats', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) throw new Error('Failed to load stats');
          return res.json() as Promise<AdminStats>;
        },
        TTL.SHORT,
        { tags: ['admin:stats'] },
      );
      setStats(data);
    } catch {
      setError('Failed to load stats');
    }
  }, [getIdToken]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="text-sm text-white/35 mt-0.5">Platform health at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {!stats
          ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          : CARDS(stats).map(({ label, value, sub, color, ring, icon }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all smooth-hover-fast">
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs text-white/40 uppercase tracking-wide">{label}</p>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg border shrink-0 ${ring} ${color}`}>{icon}</div>
              </div>
              <p className="text-3xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/30 mt-1">{sub}</p>
            </div>
          ))}
      </div>

      {/* Recent bans */}
      <div>
        <h2 className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-4">Recent Bans</h2>

        {!stats ? (
          <div className="border border-white/[0.07] rounded-xl overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-white/5 last:border-0 animate-pulse flex items-center gap-6">
                <div className="h-3 w-28 bg-white/10 rounded" />
                <div className="h-3 w-52 bg-white/5 rounded" />
                <div className="h-3 w-24 bg-white/5 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : stats.recentBans.length === 0 ? (
          <p className="text-white/30 text-sm">No bans recorded.</p>
        ) : (
          <div className="border border-white/[0.07] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  {['User', 'UID', 'Banned At'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-white/35 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentBans.map((b) => (
                  <tr key={b.uid} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-white font-medium">{b.displayName || '—'}</td>
                    <td className="px-5 py-3.5 text-white/35 font-mono text-xs">{b.uid}</td>
                    <td className="px-5 py-3.5 text-white/40 text-xs">{new Date(b.bannedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
