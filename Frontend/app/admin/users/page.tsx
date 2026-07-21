'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cacheOrFetch, cacheClearByTag, TTL } from '../../lib/apiCache';

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
    role === 9 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
    role === 8 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
    role === 2 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
    role === 1 ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
    'bg-white/5 text-white/40 border-white/10';
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{ROLE_LABEL[role] ?? role}</span>;
}

function PlanBadge({ plan }: { plan: string }) {
  const cls = plan === 'pro' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-white/5 text-white/35 border-white/10';
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{plan}</span>;
}

const inputCls = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-colors';

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

  const loadUsers = useCallback(async (p: number) => {
    setLoading(true);
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
      setUsers(d.users);
      setTotal(d.total);
    } catch { /* keep stale data */ }
    setLoading(false);
  }, [authFetch, search, filterRole, filterPlan, filterBanned]);

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPagePersist(1); loadUsers(1); }, 300);
    return () => clearTimeout(searchRef.current);
  }, [search, filterRole, filterPlan, filterBanned, loadUsers]);

  useEffect(() => { loadUsers(page); }, [page, loadUsers]);

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
        <h1 className="text-2xl font-semibold text-white">Users</h1>
        <p className="text-sm text-white/35 mt-0.5">{total.toLocaleString()} total members</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
        <input value={search} onChange={e => setSearchPersist(e.target.value)} placeholder="Search email or name…" className={`${inputCls} w-60`} />
        <select value={filterRole} onChange={e => setFilterRolePersist(e.target.value)} className={`${inputCls} text-white/60`}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={filterPlan} onChange={e => setFilterPlanPersist(e.target.value)} className={`${inputCls} text-white/60`}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <select value={filterBanned} onChange={e => setFilterBannedPersist(e.target.value)} className={`${inputCls} text-white/60`}>
          <option value="">All statuses</option>
          <option value="false">Active</option>
          <option value="true">Banned</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.02]">
              {['Name', 'Email', 'Role', 'Plan', 'Trust', 'Joined', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-white/35 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  {[...Array(8)].map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/5 rounded animate-pulse" style={{ width: `${[80,120,60,40,30,70,50,100][j]}px` }} /></td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-white/30 text-sm">No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.uid} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3.5 text-white font-medium">{u.displayName || '—'}</td>
                <td className="px-4 py-3.5 text-white/45 text-xs">{u.email}</td>
                <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3.5"><PlanBadge plan={u.plan} /></td>
                <td className="px-4 py-3.5 text-white/45">{u.trustScore}</td>
                <td className="px-4 py-3.5 text-white/35 text-xs whitespace-nowrap">{new Date(u.joinedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3.5">
                  {u.banned
                    ? <span className="text-[11px] px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">Banned</span>
                    : <span className="text-xs text-white/25">Active</span>}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openDetail(u.uid)} className="text-xs text-white/40 hover:text-white transition-colors smooth-hover-fast">Detail</button>
                    {u.role < 8 && (
                      <>
                        <select defaultValue={u.role} onChange={e => { setConfirmRoleUid(u.uid); setConfirmRole(Number(e.target.value)); }}
                          className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white/50 focus:outline-none">
                          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        {u.banned ? (
                          <button onClick={() => { setConfirmBanUid(u.uid); setConfirmBanAction('unban'); }} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors smooth-hover-fast">Unban</button>
                        ) : (
                          <button onClick={() => { setConfirmBanUid(u.uid); setConfirmBanAction('ban'); }} className="text-xs text-red-400 hover:text-red-300 transition-colors smooth-hover-fast">Ban</button>
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
        <div className="flex items-center gap-3 text-sm text-white/35">
          <button disabled={page <= 1} onClick={() => setPagePersist(page - 1)} className="disabled:opacity-25 hover:text-white transition-colors smooth-hover-fast">← Prev</button>
          <span className="text-white/50">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPagePersist(page + 1)} className="disabled:opacity-25 hover:text-white transition-colors smooth-hover-fast">Next →</button>
        </div>
      )}

      {/* Detail slide-over */}
      {detailOpen && detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
          <div className="relative w-96 bg-[#0d0d0d] border-l border-white/[0.08] h-full overflow-y-auto p-6 space-y-5">
            <button onClick={() => setDetailOpen(false)} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors text-lg leading-none">✕</button>
            <div>
              <h2 className="text-base font-semibold text-white">{detail.displayName || 'Unknown'}</h2>
              <p className="text-xs text-white/35 mt-0.5">{detail.email}</p>
            </div>
            <div className="space-y-3 text-sm">
              {([
                ['UID', <span key="uid" className="font-mono text-xs text-white/50 break-all">{detail.uid}</span>],
                ['Role', <RoleBadge key="r" role={detail.role} />],
                ['Plan', <PlanBadge key="p" plan={detail.plan} />],
                ['Trust Score', detail.trustScore],
                ['Rating Avg', detail.ratingAvg.toFixed(2)],
                ['__wallet__', null],
                ['Posts', detail.postCount],
                ['Joined', new Date(detail.joinedAt).toLocaleString()],
                ['Status', detail.banned ? <span key="s" className="text-red-400 text-xs">Banned {detail.bannedAt ? new Date(detail.bannedAt).toLocaleDateString() : ''}</span> : <span key="s" className="text-emerald-400 text-xs">Active</span>],
              ] as [string, React.ReactNode][]).map(([label, val]) => {
                if (label === '__wallet__') return (
                  <div key="wallet" className="border-b border-white/[0.05]">
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-white/35 text-xs">Wallet</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs">{detail.walletBalance.toLocaleString()} coins</span>
                        <button onClick={() => { setAdjustOpen(v => !v); setAdjustDelta(''); setAdjustReason(''); }}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
                          {adjustOpen ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                    </div>
                    {adjustOpen && (
                      <div className="pb-3 space-y-2">
                        <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)}
                          placeholder="+100 or -50"
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/40 transition-colors" />
                        <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                          placeholder="Reason (required)…"
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/40 transition-colors" />
                        <div className="flex justify-end">
                          <button onClick={submitAdjust}
                            disabled={adjusting || !adjustDelta || !adjustReason.trim() || parseInt(adjustDelta, 10) === 0 || isNaN(parseInt(adjustDelta, 10))}
                            className="text-xs px-3 py-1.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 rounded-lg hover:bg-indigo-500/25 transition-colors disabled:opacity-35 font-medium">
                            {adjusting ? 'Applying…' : 'Apply'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
                return (
                  <div key={String(label)} className="flex justify-between items-start gap-4 py-2 border-b border-white/[0.05] last:border-0">
                    <span className="text-white/35 shrink-0 text-xs">{label}</span>
                    <span className="text-white text-right text-xs">{val}</span>
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmRoleUid(null)} />
          <div className="relative bg-[#0f0f0f] border border-white/[0.08] rounded-xl p-6 w-80 space-y-4 shadow-2xl">
            <p className="text-sm text-white">Change role to <strong className="text-white">{ROLE_LABEL[confirmRole]}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmRoleUid(null)} className="text-sm text-white/35 hover:text-white transition-colors">Cancel</button>
              <button onClick={submitRoleChange} className="text-sm px-4 py-1.5 bg-white text-black rounded-lg hover:bg-white/90 transition-colors font-medium">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Ban confirm */}
      {confirmBanUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmBanUid(null)} />
          <div className="relative bg-[#0f0f0f] border border-white/[0.08] rounded-xl p-6 w-80 space-y-4 shadow-2xl">
            <p className="text-sm text-white">
              {confirmBanAction === 'ban'
                ? 'Hard-ban this user? Their sessions will expire immediately.'
                : 'Unban this user?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmBanUid(null)} className="text-sm text-white/35 hover:text-white transition-colors">Cancel</button>
              <button onClick={submitBanAction} className={`text-sm px-4 py-1.5 rounded-lg transition-colors font-medium ${confirmBanAction === 'ban' ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white text-black hover:bg-white/90'}`}>
                {confirmBanAction === 'ban' ? 'Ban' : 'Unban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
