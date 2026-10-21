'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cacheOrFetch, TTL } from '../../lib/apiCache';
import AdminTableSkeleton from '../components/AdminTableSkeleton';
import AdminLoadError from '../components/AdminLoadError';

const savedTx = { filterUid: '', filterType: '', filterFrom: '', filterTo: '', page: 1 };

interface AdminTransaction {
  id: string; uid: string; type: string; amount: number;
  balanceAfter: number; description: string; referenceId: string | null; createdAt: string;
}

const TX_TYPES = ['topup', 'purchase', 'refund', 'reward'];
const LIMIT = 20;
const inputCls = 'bg-fill border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink-3 focus:bg-raised transition-colors';

function TypeBadge({ type }: { type: string }) {
  const cls =
    type === 'topup'    ? 'bg-ok/10 text-ok border-ok/40' :
    type === 'purchase' ? 'bg-accent/10 text-accent border-accent/40' :
    type === 'refund'   ? 'bg-coin/10 text-coin border-coin/40' :
    'bg-fill text-ink-3 border-line';
  return <span className={`whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{type}</span>;
}

export default function AdminTransactionsPage() {
  const { getIdToken } = useAuth();
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(savedTx.page);
  const [filterUid, setFilterUid] = useState(savedTx.filterUid);
  const [filterType, setFilterType] = useState(savedTx.filterType);
  const [filterFrom, setFilterFrom] = useState(savedTx.filterFrom);
  const [filterTo, setFilterTo] = useState(savedTx.filterTo);
  const [detail, setDetail] = useState<AdminTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const didMount = useRef(false);

  const setFilterUidPersist = (v: string) => { savedTx.filterUid = v; setFilterUid(v); };
  const setFilterTypePersist = (v: string) => { savedTx.filterType = v; setFilterType(v); };
  const setFilterFromPersist = (v: string) => { savedTx.filterFrom = v; setFilterFrom(v); };
  const setFilterToPersist = (v: string) => { savedTx.filterTo = v; setFilterTo(v); };
  const setPagePersist = (v: number) => { savedTx.page = v; setPage(v); };

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getIdToken();
    return fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, [getIdToken]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setLoadFailed(false);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (filterUid) params.set('uid', filterUid);
    if (filterType) params.set('type', filterType);
    if (filterFrom) params.set('from', new Date(filterFrom).toISOString());
    if (filterTo) params.set('to', new Date(filterTo + 'T23:59:59').toISOString());
    try {
      const d = await cacheOrFetch(
        `admin:tx:${params}`,
        async () => {
          const res = await authFetch(`/api/proxy/admin/transactions?${params}`);
          if (!res.ok) throw new Error('Failed');
          return res.json();
        },
        TTL.SHORT,
        { tags: ['admin:tx'] },
      );
      setTransactions(d.transactions);
      setTotal(d.total);
    } catch {
      setLoadFailed(true); // keep stale
    }
    setLoading(false);
  }, [authFetch, filterUid, filterType, filterFrom, filterTo]);

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPagePersist(1); load(1); }, 300);
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
      <div>
        <h1 className="text-2xl font-semibold text-ink">Transactions</h1>
        <p className="text-sm text-ink-3 mt-0.5">{total.toLocaleString()} total records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 p-4 bg-fill border border-line rounded-xl">
        <input value={filterUid} onChange={e => setFilterUidPersist(e.target.value)} placeholder="Filter by UID…" className={`${inputCls} w-60`} />
        <select aria-label="Filter by type" value={filterType} onChange={e => setFilterTypePersist(e.target.value)} className={`${inputCls} text-ink-2`}>
          <option value="">All types</option>
          {TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" aria-label="From date" value={filterFrom} onChange={e => setFilterFromPersist(e.target.value)} className={`${inputCls} text-ink-2`} />
        <input type="date" aria-label="To date" value={filterTo} onChange={e => setFilterToPersist(e.target.value)} className={`${inputCls} text-ink-2`} />
      </div>

      {loadFailed && <AdminLoadError what="transactions" onRetry={() => load(page)} />}

      {/* Table */}
      <div tabIndex={0} role="region" aria-label="Transactions table" className="border border-line rounded-xl overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line bg-fill">
              {['UID', 'Type', 'Amount', 'Balance After', 'Created', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-[11px] font-medium text-ink-3 uppercase tracking-wide whitespace-nowrap">{h || <span className="sr-only">Detail</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={5} columns={[80, 60, 50, 60, 90, 40]} />
            ) : transactions.length === 0 && !loadFailed ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-3 text-sm">No transactions found.</td></tr>
            ) : transactions.map(t => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-fill transition-colors cursor-pointer" onClick={() => openDetail(t.id)}>
                <td className="px-4 py-3.5 text-ink-3 font-mono text-xs">{t.uid.slice(0, 8)}…</td>
                <td className="px-4 py-3.5"><TypeBadge type={t.type} /></td>
                <td className={`px-4 py-3.5 font-medium ${t.amount >= 0 ? 'text-ok' : 'text-danger'}`}>
                  {t.amount >= 0 ? '+' : ''}{t.amount}
                </td>
                <td className="px-4 py-3.5 text-ink-3">{t.balanceAfter}</td>
                <td className="px-4 py-3.5 text-ink-3 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3.5 text-ink-3 text-xs">Detail →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <button disabled={page <= 1} onClick={() => setPagePersist(page - 1)} className="disabled:opacity-25 hover:text-ink transition-colors smooth-hover-fast">← Prev</button>
          <span className="text-ink-2">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPagePersist(page + 1)} className="disabled:opacity-25 hover:text-ink transition-colors smooth-hover-fast">Next →</button>
        </div>
      )}

      {/* Detail panel */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-scrim/80" onClick={() => setDetail(null)} />
          <div className="relative w-96 bg-surface border-l border-line h-full overflow-y-auto p-6 space-y-5">
            <button onClick={() => setDetail(null)} className="absolute top-4 right-4 text-ink-2 hover:text-ink transition-colors text-lg leading-none">✕</button>
            <div>
              <h2 className="text-base font-semibold text-ink">Transaction Detail</h2>
              <p className="text-xs text-ink-3 mt-0.5 font-mono">{detail.id}</p>
            </div>
            <div className="space-y-0 text-sm">
              {([
                ['UID', <span key="uid" className="font-mono text-xs text-ink-2 break-all">{detail.uid}</span>],
                ['Type', <TypeBadge key="t" type={detail.type} />],
                ['Amount', <span key="a" className={`font-medium ${detail.amount >= 0 ? 'text-ok' : 'text-danger'}`}>{detail.amount >= 0 ? '+' : ''}{detail.amount}</span>],
                ['Balance After', `${detail.balanceAfter} coins`],
                ['Description', detail.description || '—'],
                ['Reference ID', detail.referenceId || '—'],
                ['Created', new Date(detail.createdAt).toLocaleString()],
              ] as [string, React.ReactNode][]).map(([label, val]) => (
                <div key={String(label)} className="flex justify-between items-start gap-4 py-2.5 border-b border-line last:border-0">
                  <span className="text-ink-3 shrink-0 text-xs">{label}</span>
                  <span className="text-ink text-right text-xs break-all">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
