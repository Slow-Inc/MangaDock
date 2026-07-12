'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: number;
  plan: string;
  trustScore: number;
  joinedAt: string;
  banned: boolean;
  bannedAt: string | null;
}

interface AdminUserDetail extends AdminUser {
  ratingAvg: number;
  walletBalance: number;
  postCount: number;
}

const ROLE_LABEL: Record<number, string> = { 0: 'User', 1: 'Translator', 2: 'Creator', 8: 'Admin', 9: 'Dev' };
const ROLE_OPTIONS = [
  { value: 0, label: 'User' },
  { value: 1, label: 'Translator' },
  { value: 2, label: 'Creator' },
];

function RoleBadge({ role }: { role: number }) {
  const cls =
    role === 9 ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
    role === 8 ? 'bg-red-500/15 text-red-400 border-red-500/30' :
    role === 2 ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
    role === 1 ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' :
    'bg-white/5 text-white/40 border-white/10';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const cls = plan === 'pro' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' : 'bg-white/5 text-white/40 border-white/10';
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{plan}</span>;
}

export default function AdminUsersPage() {
  const { getIdToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterBanned, setFilterBanned] = useState('');
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmRoleUid, setConfirmRoleUid] = useState<string | null>(null);
  const [confirmRole, setConfirmRole] = useState(0);
  const [confirmBanUid, setConfirmBanUid] = useState<string | null>(null);
  const [confirmBanAction, setConfirmBanAction] = useState<'ban' | 'unban'>('ban');
  const [loading, setLoading] = useState(false);
  const LIMIT = 20;
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getIdToken();
    return fetch(url, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }, [getIdToken]);

  const loadUsers = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (search) params.set('search', search);
    if (filterRole !== '') params.set('role', filterRole);
    if (filterPlan) params.set('plan', filterPlan);
    if (filterBanned !== '') params.set('banned', filterBanned);
    const res = await authFetch(`/api/proxy/admin/users?${params}`);
    if (res.ok) { const d = await res.json(); setUsers(d.users); setTotal(d.total); }
    setLoading(false);
  }, [authFetch, search, filterRole, filterPlan, filterBanned]);

  useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPage(1); loadUsers(1); }, 300);
    return () => clearTimeout(searchRef.current);
  }, [search, filterRole, filterPlan, filterBanned, loadUsers]);

  useEffect(() => { loadUsers(page); }, [page, loadUsers]);

  const openDetail = async (uid: string) => {
    const res = await authFetch(`/api/proxy/admin/users/${uid}`);
    if (res.ok) { setDetail(await res.json()); setDetailOpen(true); }
  };

  const submitRoleChange = async () => {
    if (!confirmRoleUid) return;
    await authFetch(`/api/proxy/admin/users/${confirmRoleUid}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: confirmRole }),
    });
    setConfirmRoleUid(null);
    loadUsers(page);
  };

  const submitBanAction = async () => {
    if (!confirmBanUid) return;
    await authFetch(`/api/proxy/admin/users/${confirmBanUid}/${confirmBanAction}`, { method: 'POST' });
    setConfirmBanUid(null);
    loadUsers(page);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Users</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search email or name…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 w-64 focus:outline-none focus:border-white/30"
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={filterPlan}
          onChange={e => setFilterPlan(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none"
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <select
          value={filterBanned}
          onChange={e => setFilterBanned(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="false">Active</option>
          <option value="true">Banned</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {['Name', 'Email', 'Role', 'Plan', 'Trust', 'Joined', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white/40 font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30 text-sm">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30 text-sm">No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.uid} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white font-medium">{u.displayName || '—'}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                <td className="px-4 py-3 text-white/50">{u.trustScore}</td>
                <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{new Date(u.joinedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {u.banned
                    ? <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">Banned</span>
                    : <span className="text-xs text-white/30">Active</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openDetail(u.uid)} className="text-xs text-white/50 hover:text-white transition-colors">Detail</button>
                    {u.role < 8 && (
                      <>
                        <select
                          defaultValue={u.role}
                          onChange={e => { setConfirmRoleUid(u.uid); setConfirmRole(Number(e.target.value)); }}
                          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/60 focus:outline-none"
                        >
                          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        {u.banned ? (
                          <button onClick={() => { setConfirmBanUid(u.uid); setConfirmBanAction('unban'); }}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors">Unban</button>
                        ) : (
                          <button onClick={() => { setConfirmBanUid(u.uid); setConfirmBanAction('ban'); }}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors">Ban</button>
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
        <div className="flex items-center gap-3 text-sm text-white/40">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="disabled:opacity-30 hover:text-white transition-colors">← Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="disabled:opacity-30 hover:text-white transition-colors">Next →</button>
        </div>
      )}

      {/* Detail slide-over */}
      {detailOpen && detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDetailOpen(false)} />
          <div className="relative w-96 bg-[#141414] border-l border-white/10 h-full overflow-y-auto p-6 space-y-5">
            <button onClick={() => setDetailOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
            <h2 className="text-base font-semibold text-white">{detail.displayName || 'Unknown'}</h2>
            <div className="space-y-3 text-sm">
              {[
                ['Email', detail.email],
                ['UID', detail.uid],
                ['Role', <RoleBadge key="r" role={detail.role} />],
                ['Plan', <PlanBadge key="p" plan={detail.plan} />],
                ['Trust Score', detail.trustScore],
                ['Rating Avg', detail.ratingAvg.toFixed(2)],
                ['Wallet Balance', `${detail.walletBalance} coins`],
                ['Posts', detail.postCount],
                ['Joined', new Date(detail.joinedAt).toLocaleString()],
                ['Status', detail.banned ? <span key="s" className="text-red-400">Banned since {new Date(detail.bannedAt!).toLocaleDateString()}</span> : 'Active'],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between items-start gap-4">
                  <span className="text-white/40 shrink-0">{label}</span>
                  <span className="text-white text-right break-all">{val as React.ReactNode}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Role change confirm dialog */}
      {confirmRoleUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmRoleUid(null)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-80 space-y-4">
            <p className="text-sm text-white">Change role to <strong>{ROLE_LABEL[confirmRole]}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmRoleUid(null)} className="text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              <button onClick={submitRoleChange} className="text-sm px-4 py-1.5 bg-white text-black rounded-lg hover:bg-white/90 transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Ban/Unban confirm dialog */}
      {confirmBanUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmBanUid(null)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-80 space-y-4">
            <p className="text-sm text-white">
              {confirmBanAction === 'ban'
                ? 'Hard-ban this user? Their existing sessions will expire immediately.'
                : 'Unban this user?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmBanUid(null)} className="text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              <button onClick={submitBanAction}
                className={`text-sm px-4 py-1.5 rounded-lg transition-colors ${confirmBanAction === 'ban' ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white text-black hover:bg-white/90'}`}>
                {confirmBanAction === 'ban' ? 'Ban' : 'Unban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
