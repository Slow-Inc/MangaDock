'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface AuditLog {
  id: string;
  actor_uid: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  ban_user: 'แบนผู้ใช้',
  unban_user: 'ยกเลิกแบน',
  delete_post: 'ลบโพสต์',
  delete_comment: 'ลบคอมเมนต์',
  change_role: 'เปลี่ยน Role',
  approve_content: 'อนุมัติเนื้อหา',
  reject_content: 'ปฏิเสธเนื้อหา',
};

const ACTION_COLOR: Record<string, string> = {
  ban_user: 'bg-red-500/10 text-red-400 border-red-500/20',
  unban_user: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  delete_post: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  delete_comment: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  change_role: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  approve_content: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  reject_content: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const LIMIT = 20;

const inputCls =
  'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-colors';

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export default function AdminAuditPage() {
  const { getIdToken } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterActorUid, setFilterActorUid] = useState('');
  const actorDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [debouncedActor, setDebouncedActor] = useState('');

  const authFetch = useCallback(
    async (url: string) => {
      const token = await getIdToken();
      return fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    [getIdToken],
  );

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(LIMIT + 1), // fetch one extra to detect hasMore
        offset: String((p - 1) * LIMIT),
      });
      if (filterAction) params.set('action', filterAction);
      if (debouncedActor) params.set('actorUid', debouncedActor);

      try {
        const res = await authFetch(`/api/proxy/admin/audit?${params}`);
        if (!res.ok) throw new Error('Failed');
        const data: AuditLog[] = await res.json();
        setHasMore(data.length > LIMIT);
        setLogs(data.slice(0, LIMIT));
      } catch {
        // keep stale data on error
      }
      setLoading(false);
    },
    [authFetch, filterAction, debouncedActor],
  );

  // Debounce actor UID input
  useEffect(() => {
    clearTimeout(actorDebounce.current);
    actorDebounce.current = setTimeout(() => setDebouncedActor(filterActorUid), 400);
    return () => clearTimeout(actorDebounce.current);
  }, [filterActorUid]);

  // Reload when filters or page changes
  useEffect(() => {
    setPage(1);
  }, [filterAction, debouncedActor]);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
        <p className="text-sm text-white/35 mt-0.5">บันทึกการดำเนินการของ Admin ทั้งหมด</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className={`${inputCls} text-white/60`}
        >
          <option value="">ทุกประเภท</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          value={filterActorUid}
          onChange={e => setFilterActorUid(e.target.value)}
          placeholder="Actor UID…"
          className={`${inputCls} w-72 font-mono text-xs`}
        />
        {(filterAction || filterActorUid) && (
          <button
            onClick={() => { setFilterAction(''); setFilterActorUid(''); setDebouncedActor(''); }}
            className="px-3 py-2 text-xs text-white/35 hover:text-white transition-colors rounded-lg border border-white/[0.06] hover:border-white/20"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.02]">
              {['เวลา', 'ผู้กระทำ', 'การกระทำ', 'เป้าหมาย', 'รายละเอียด'].map(h => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-[11px] font-medium text-white/35 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div
                        className="h-3 bg-white/5 rounded animate-pulse"
                        style={{ width: `${[90, 130, 80, 110, 60][j]}px` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-white/30 text-sm">
                  ยังไม่มี audit log
                </td>
              </tr>
            ) : (
              logs.map(log => {
                const actionCls = ACTION_COLOR[log.action] ?? 'bg-white/5 text-white/50 border-white/10';
                return (
                  <tr
                    key={log.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* เวลา */}
                    <td className="px-4 py-3.5 text-white/35 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    {/* ผู้กระทำ */}
                    <td className="px-4 py-3.5">
                      <span
                        className="font-mono text-[11px] text-white/50 cursor-default"
                        title={log.actor_uid}
                      >
                        {truncate(log.actor_uid, 12)}
                      </span>
                    </td>
                    {/* การกระทำ */}
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${actionCls}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    {/* เป้าหมาย */}
                    <td className="px-4 py-3.5 text-white/40 text-xs">
                      {log.target_type && (
                        <span className="text-white/25 mr-1">{log.target_type}/</span>
                      )}
                      {log.target_id ? (
                        <span className="font-mono" title={log.target_id}>
                          {truncate(log.target_id, 14)}
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    {/* รายละเอียด */}
                    <td className="px-4 py-3.5 text-white/35 text-[11px] font-mono max-w-[200px]">
                      {log.metadata ? (
                        <span className="truncate block" title={JSON.stringify(log.metadata)}>
                          {JSON.stringify(log.metadata)}
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center gap-3 text-sm text-white/35">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="disabled:opacity-25 hover:text-white transition-colors smooth-hover-fast"
          >
            ← ก่อนหน้า
          </button>
          <span className="text-white/50">หน้า {page}</span>
          <button
            disabled={!hasMore}
            onClick={() => setPage(p => p + 1)}
            className="disabled:opacity-25 hover:text-white transition-colors smooth-hover-fast"
          >
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  );
}
