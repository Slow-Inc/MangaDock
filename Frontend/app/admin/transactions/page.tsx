'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminTransaction {
  id: string;
  uid: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

const TX_TYPES = ['topup', 'purchase', 'refund', 'reward'];
const LIMIT = 20;

function TypeBadge({ type }: { type: string }) {
  const cls =
    type === 'topup'    ? 'bg-green-500/15 text-green-400 border-green-500/30' :
    type === 'purchase' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
    type === 'refund'   ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
    'bg-white/5 text-white/40 border-white/10';
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{type}</span>;
}

export default function AdminTransactionsPage() {
  const { getIdToken } = useAuth();
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterUid, setFilterUid] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [detail, setDetail] = useState<AdminTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getIdToken();
    return fetch(url, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }, [getIdToken]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (filterUid) params.set('uid', filterUid);
    if (filterType) params.set('type', filterType);
    if (filterFrom) params.set('from', new Date(filterFrom).toISOString());
    if (filterTo) params.set('to', new Date(filterTo + 'T23:59:59').toISOString());
    const res = await authFetch(`/api/proxy/admin/transactions?${params}`);
    if (res.ok) { const d = await res.json(); setTransactions(d.transactions); setTotal(d.total); }
    setLoading(false);
  }, [authFetch, filterUid, filterType, filterFrom, filterTo]);

  useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPage(1); load(1); }, 300);
    return () => clearTimeout(searchRef.current);
  }, [filterUid, filterType, filterFrom, filterTo, load]);

  useEffect(() => { load(page); }, [page, load]);

  const openDetail = async (id: string) => {
    const res = await authFetch(`/api/proxy/admin/transactions/${id}`);
    if (res.ok) setDetail(await res.json());
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Transactions</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={filterUid}
          onChange={e => setFilterUid(e.target.value)}
          placeholder="Filter by UID…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 w-64 focus:outline-none focus:border-white/30"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none"
        >
          <option value="">All types</option>
          {TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none"
        />
        <input
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {['UID', 'Type', 'Amount', 'Balance After', 'Created', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-white/40 font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">Loading…</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">No transactions found.</td></tr>
            ) : transactions.map(t => (
              <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] cursor-pointer"
                onClick={() => openDetail(t.id)}>
                <td className="px-4 py-3 text-white/40 font-mono text-xs">{t.uid.slice(0, 8)}…</td>
                <td className="px-4 py-3"><TypeBadge type={t.type} /></td>
                <td className={`px-4 py-3 font-medium ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {t.amount >= 0 ? '+' : ''}{t.amount}
                </td>
                <td className="px-4 py-3 text-white/50">{t.balanceAfter}</td>
                <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-white/30 text-xs">Detail →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm text-white/40">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="disabled:opacity-30 hover:text-white transition-colors">← Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="disabled:opacity-30 hover:text-white transition-colors">Next →</button>
        </div>
      )}

      {/* Detail panel */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDetail(null)} />
          <div className="relative w-96 bg-[#141414] border-l border-white/10 h-full overflow-y-auto p-6 space-y-5">
            <button onClick={() => setDetail(null)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
            <h2 className="text-base font-semibold text-white">Transaction Detail</h2>
            <div className="space-y-3 text-sm">
              {[
                ['ID', detail.id],
                ['UID', detail.uid],
                ['Type', <TypeBadge key="t" type={detail.type} />],
                ['Amount', <span key="a" className={detail.amount >= 0 ? 'text-green-400' : 'text-red-400'}>{detail.amount >= 0 ? '+' : ''}{detail.amount}</span>],
                ['Balance After', `${detail.balanceAfter} coins`],
                ['Description', detail.description || '—'],
                ['Reference ID', detail.referenceId || '—'],
                ['Created', new Date(detail.createdAt).toLocaleString()],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between items-start gap-4">
                  <span className="text-white/40 shrink-0">{label}</span>
                  <span className="text-white text-right break-all font-mono text-xs">{val as React.ReactNode}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
