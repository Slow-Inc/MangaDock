'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cacheOrFetch, cacheClearByTag, TTL } from '../../lib/apiCache';
import AdminTableSkeleton from '../components/AdminTableSkeleton';
import AdminLoadError from '../components/AdminLoadError';
import { PRIMARY_FILL } from '../../components/ui/Button';

const savedUsers = { search: '', filterRole: '', filterPlan: '', filterBanned: '', page: 1 };

interface AdminUser {
  uid: string; email: string; displayName: string;
  role: number; plan: string; trustScore: number;
  joinedAt: string; banned: boolean; bannedAt: string | null;
}
interface AdminUserDetail extends AdminUser {
  ratingAvg: number; walletBalance: number; postCount: number;
}

const ROLE_LABEL: Record<number, string> = { 0: 'User', 1: 'Translator', 2: 'Creator', 8: 'Admin', 9: 'Dev' };
const ROLE_OPTIONS = [{ value: 0, label: 'User' }, { value: 1, label: 'Translator' }, { value: 2, label: 'Creator' }];
const LIMIT = 20;

function RoleBadge({ role }: { role: number }) {
  const cls =
    role === 9 ? 'bg-fill text-ink border-ink-3' :
    role === 8 ? 'bg-danger/10 text-danger border-danger/40' :
    role === 2 ? 'text-ink border-ink-3' :
    role === 1 ? 'bg-accent/10 text-accent border-accent/40' :
    'text-ink-3 border-line';
  return <span className={`whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{ROLE_LABEL[role] ?? role}</span>;
}

function PlanBadge({ plan }: { plan: string }) {
  const cls = plan === 'pro' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-fill text-ink-3 border-line';
  return <span className={`whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{plan}</span>;
}

const inputCls = 'bg-fill border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-ink-3 focus:bg-raised transition-colors';

export default function AdminUsersPage() {
  const { getIdToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(savedUsers.page);
  const [search, setSearch] = useState(savedUsers.search);
  const [filterRole, setFilterRole] = useState(savedUsers.filterRole);
  const [filterPlan, setFilterPlan] = useState(savedUsers.filterPlan);
  const [filterBanned, setFilterBanned] = useState(savedUsers.filterBanned);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmRoleUid, setConfirmRoleUid] = useState<string | null>(null);
  const [confirmRole, setConfirmRole] = useState(0);
  const [confirmBanUid, setConfirmBanUid] = useState<string | null>(null);
  const [confirmBanAction, setConfirmBanAction] = useState<'ban' | 'unban'>('ban');
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const didMount = useRef(false);

  const setSearchPersist = (v: string) => { savedUsers.search = v; setSearch(v); };
  const setFilterRolePersist = (v: string) => { savedUsers.filterRole = v; setFilterRole(v); };
  const setFilterPlanPersist = (v: string) => { savedUsers.filterPlan = v; setFilterPlan(v); };
  const setFilterBannedPersist = (v: string) => { savedUsers.filterBanned = v; setFilterBanned(v); };
  const setPagePersist = (v: number) => { savedUsers.page = v; setPage(v); };

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getIdToken();
    return fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, [getIdToken]);

  // Only the latest request writes the table: a slower answer for an older filter or page is dropped (#1004)
  const loadSeq = useRef(0);
  const loadUsers = useCallback(async (p: number) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setLoadFailed(false);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (search) params.set('search', search);
    if (filterRole !== '') params.set('role', filterRole);
    if (filterPlan) params.set('plan', filterPlan);
    if (filterBanned !== '') params.set('banned', filterBanned);
    try {
      const d = await cacheOrFetch(
        `admin:users:${params}`,
        async () => {
          const res = await authFetch(`/api/proxy/admin/users?${params}`);
          if (!res.ok) throw new Error('Failed');
          return res.json();
        },
        TTL.SHORT,
        { tags: ['admin:users'] },
      );
      if (seq !== loadSeq.current) return;
      setUsers(d.users);
      setTotal(d.total);
    } catch {
      if (seq !== loadSeq.current) return;
      setLoadFailed(true); // keep stale data
    }
    if (seq === loadSeq.current) setLoading(false);
  }, [authFetch, search, filterRole, filterPlan, filterBanned]);

  // The loader through a ref: both effects below must not re-run when a filter, or the session, rebuilds it —
  // that fired requests per keystroke and repeated the first load (#1004)
  const loadRef = useRef(loadUsers);
  useEffect(() => { loadRef.current = loadUsers; }, [loadUsers]);

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPagePersist(1); loadRef.current(1); }, 300);
    return () => clearTimeout(searchRef.current);
  }, [search, filterRole, filterPlan, filterBanned]);

  useEffect(() => { loadRef.current(page); }, [page]);

  const openDetail = async (uid: string) => {
    const res = await authFetch(`/api/proxy/admin/users/${uid}`);
    if (res.ok) { setDetail(await res.json()); setDetailOpen(true); setAdjustOpen(false); setAdjustDelta(''); setAdjustReason(''); }
  };

  const submitAdjust = async () => {
    if (!detail) return;
    const delta = parseInt(adjustDelta, 10);
    if (!delta || !adjustReason.trim()) return;
    setAdjusting(true);
    const res = await authFetch(`/api/proxy/admin/users/${detail.uid}/wallet`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta, reason: adjustReason.trim() }),
    });
    if (res.ok) {
      const { balance } = await res.json();
      setDetail(prev => prev ? { ...prev, walletBalance: balance } : prev);
      setAdjustOpen(false); setAdjustDelta(''); setAdjustReason('');
    }
    setAdjusting(false);
  };

  const submitRoleChange = async () => {
    if (!confirmRoleUid) return;
    await authFetch(`/api/proxy/admin/users/${confirmRoleUid}/role`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: confirmRole }),
    });
    setConfirmRoleUid(null);
    cacheClearByTag('admin:users');
    cacheClearByTag('admin:stats');
    loadUsers(page);
  };

  const submitBanAction = async () => {
    if (!confirmBanUid) return;
    await authFetch(`/api/proxy/admin/users/${confirmBanUid}/${confirmBanAction}`, { method: 'POST' });
    setConfirmBanUid(null);
    cacheClearByTag('admin:users');
    cacheClearByTag('admin:stats');
    loadUsers(page);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Users</h1>
        <p className="text-sm text-ink-3 mt-0.5">{total.toLocaleString()} total members</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 p-4 bg-fill border border-line rounded-xl">
        <input value={search} onChange={e => setSearchPersist(e.target.value)} aria-label="Search users by email or name" placeholder="Search email or name…" className={`${inputCls} w-60`} />
        <select aria-label="Filter by role" value={filterRole} onChange={e => setFilterRolePersist(e.target.value)} className={`${inputCls} text-ink-2`}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select aria-label="Filter by plan" value={filterPlan} onChange={e => setFilterPlanPersist(e.target.value)} className={`${inputCls} text-ink-2`}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <select aria-label="Filter by status" value={filterBanned} onChange={e => setFilterBannedPersist(e.target.value)} className={`${inputCls} text-ink-2`}>
          <option value="">All statuses</option>
          <option value="false">Active</option>
          <option value="true">Banned</option>
        </select>
      </div>

      {loadFailed && <AdminLoadError what="users" onRetry={() => loadUsers(page)} />}

      {/* Table */}
      <div tabIndex={0} role="region" aria-label="Users table" className="border border-line rounded-xl overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line bg-fill">
              {['Name', 'Email', 'Role', 'Plan', 'Trust', 'Joined', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-ink-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={5} columns={[80, 120, 60, 40, 30, 70, 50, 100]} />
            ) : users.length === 0 && !loadFailed ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-3 text-sm">No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.uid} className="border-b border-line last:border-0 hover:bg-fill transition-colors">
                <td className="px-4 py-3.5 text-ink font-medium max-w-[14rem] truncate" title={u.displayName || undefined}>{u.displayName || '—'}</td>
                <td className="px-4 py-3.5 text-ink-3 text-xs">{u.email}</td>
                <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3.5"><PlanBadge plan={u.plan} /></td>
                <td className="px-4 py-3.5 text-ink-3">{u.trustScore}</td>
                <td className="px-4 py-3.5 text-ink-3 text-xs whitespace-nowrap">{new Date(u.joinedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3.5">
                  {u.banned
                    ? <span className="whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full border bg-danger/10 text-danger border-danger/40">Banned</span>
                    : <span className="text-xs text-ink-3">Active</span>}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openDetail(u.uid)} className="text-xs text-ink-2 hover:text-ink transition-colors smooth-hover-fast">Detail</button>
                    {u.role < 8 && (
                      <>
                        <select aria-label={`Role of ${u.displayName || u.email}`} defaultValue={u.role} onChange={e => { setConfirmRoleUid(u.uid); setConfirmRole(Number(e.target.value)); }}
                          className="bg-fill border border-line rounded px-2 py-1 text-xs text-ink-2">
                          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        {u.banned ? (
                          <button onClick={() => { setConfirmBanUid(u.uid); setConfirmBanAction('unban'); }} className="text-xs text-ok hover:text-ok/80 transition-colors smooth-hover-fast">Unban</button>
                        ) : (
                          <button onClick={() => { setConfirmBanUid(u.uid); setConfirmBanAction('ban'); }} className="text-xs text-danger hover:text-danger/80 transition-colors smooth-hover-fast">Ban</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
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

      {/* Detail slide-over */}
      {detailOpen && detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-scrim/80" onClick={() => setDetailOpen(false)} />
          <div className="relative w-96 bg-surface border-l border-line h-full overflow-y-auto p-6 space-y-5">
            <button onClick={() => setDetailOpen(false)} aria-label="Close user details" className="absolute top-4 right-4 text-ink-2 hover:text-ink transition-colors text-lg leading-none">✕</button>
            <div>
              <h2 className="text-base font-semibold text-ink">{detail.displayName || 'Unknown'}</h2>
              <p className="text-xs text-ink-3 mt-0.5">{detail.email}</p>
            </div>
            <div className="space-y-3 text-sm">
              {([
                ['UID', <span key="uid" className="font-mono text-xs text-ink-2 break-all">{detail.uid}</span>],
                ['Role', <RoleBadge key="r" role={detail.role} />],
                ['Plan', <PlanBadge key="p" plan={detail.plan} />],
                ['Trust Score', detail.trustScore],
                ['Rating Avg', detail.ratingAvg.toFixed(2)],
                ['__wallet__', null],
                ['Posts', detail.postCount],
                ['Joined', new Date(detail.joinedAt).toLocaleString()],
                ['Status', detail.banned ? <span key="s" className="text-danger text-xs">Banned {detail.bannedAt ? new Date(detail.bannedAt).toLocaleDateString() : ''}</span> : <span key="s" className="text-ok text-xs">Active</span>],
              ] as [string, React.ReactNode][]).map(([label, val]) => {
                if (label === '__wallet__') return (
                  <div key="wallet" className="border-b border-line">
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-ink-3 text-xs">Wallet</span>
                      <div className="flex items-center gap-2">
                        <span className="text-ink text-xs">{detail.walletBalance.toLocaleString()} coins</span>
                        <button onClick={() => { setAdjustOpen(v => !v); setAdjustDelta(''); setAdjustReason(''); }}
                          className="text-[11px] text-accent hover:text-ink transition-colors">
                          {adjustOpen ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                    </div>
                    {adjustOpen && (
                      <div className="pb-3 space-y-2">
                        <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)}
                          aria-label="Coin adjustment amount"
                          placeholder="+100 or -50"
                          className="w-full bg-fill border border-line rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:border-ink-3 transition-colors" />
                        <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                          aria-label="Reason for the adjustment" aria-required="true"
                          placeholder="Reason (required)…"
                          className="w-full bg-fill border border-line rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:border-ink-3 transition-colors" />
                        <div className="flex justify-end">
                          <button onClick={submitAdjust}
                            disabled={adjusting || !adjustDelta || !adjustReason.trim() || parseInt(adjustDelta, 10) === 0 || isNaN(parseInt(adjustDelta, 10))}
                            className="text-xs px-3 py-1.5 bg-accent/10 text-accent border border-accent/40 rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-35 font-medium">
                            {adjusting ? 'Applying…' : 'Apply'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
                return (
                  <div key={String(label)} className="flex justify-between items-start gap-4 py-2 border-b border-line last:border-0">
                    <span className="text-ink-3 shrink-0 text-xs">{label}</span>
                    <span className="text-ink text-right text-xs">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Role confirm */}
      {confirmRoleUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-scrim/80" onClick={() => setConfirmRoleUid(null)} />
          <div className="relative bg-surface border border-line rounded-xl p-6 w-80 space-y-4 shadow-2xl">
            <p className="text-sm text-ink">Change role to <strong className="text-ink">{ROLE_LABEL[confirmRole]}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmRoleUid(null)} className="text-sm text-ink-2 hover:text-ink transition-colors">Cancel</button>
              <button onClick={submitRoleChange} className={`text-sm px-4 py-1.5 rounded-lg transition-colors font-medium ${PRIMARY_FILL}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Ban confirm */}
      {confirmBanUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-scrim/80" onClick={() => setConfirmBanUid(null)} />
          <div className="relative bg-surface border border-line rounded-xl p-6 w-80 space-y-4 shadow-2xl">
            <p className="text-sm text-ink">
              {confirmBanAction === 'ban'
                ? 'Hard-ban this user? Their sessions will expire immediately.'
                : 'Unban this user?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmBanUid(null)} className="text-sm text-ink-2 hover:text-ink transition-colors">Cancel</button>
              <button onClick={submitBanAction} className={`text-sm px-4 py-1.5 rounded-lg transition-colors font-medium ${confirmBanAction === 'ban' ? 'bg-danger text-bg hover:bg-danger/90' : PRIMARY_FILL}`}>
                {confirmBanAction === 'ban' ? 'Ban' : 'Unban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
