'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  activePosts: number;
  transactionsToday: { count: number; coinSum: number };
  recentBans: Array<{ uid: string; displayName: string; bannedAt: string }>;
}

export default function AdminOverviewPage() {
  const { getIdToken } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getIdToken();
    const res = await fetch('/api/proxy/admin/stats', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { setError('Failed to load stats'); return; }
    setStats(await res.json());
  }, [getIdToken]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!stats) return <p className="text-white/40 text-sm">Loading…</p>;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, sub: `+${stats.newUsersToday} today` },
    { label: 'Active Posts', value: stats.activePosts, sub: 'forum posts' },
    { label: 'Transactions Today', value: stats.transactionsToday.count, sub: `${stats.transactionsToday.coinSum} coins` },
    { label: 'Recently Banned', value: stats.recentBans.length, sub: 'last 10 entries' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-white">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, sub }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-xs text-white/40 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
            <p className="text-xs text-white/30 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Recent bans */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Recent Bans</h2>
        {stats.recentBans.length === 0 ? (
          <p className="text-white/30 text-sm">No bans recorded.</p>
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/40 font-normal">User</th>
                  <th className="text-left px-4 py-3 text-white/40 font-normal">UID</th>
                  <th className="text-left px-4 py-3 text-white/40 font-normal">Banned At</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBans.map((b) => (
                  <tr key={b.uid} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white">{b.displayName || '—'}</td>
                    <td className="px-4 py-3 text-white/40 font-mono text-xs">{b.uid}</td>
                    <td className="px-4 py-3 text-white/40">{new Date(b.bannedAt).toLocaleString()}</td>
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
