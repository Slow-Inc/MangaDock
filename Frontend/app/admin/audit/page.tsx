'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminTableSkeleton from '../components/AdminTableSkeleton';
import AdminLoadError from '../components/AdminLoadError';

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
  pin_post: 'ปักหมุดโพสต์',
  unpin_post: 'เลิกปักหมุดโพสต์',
  delete_comment: 'ลบคอมเมนต์',
  change_role: 'เปลี่ยน Role',
  approve_content: 'อนุมัติเนื้อหา',
  reject_content: 'ปฏิเสธเนื้อหา',
};

const ACTION_COLOR: Record<string, string> = {
  ban_user: 'bg-danger/10 text-danger border-danger/40',
  unban_user: 'bg-ok/10 text-ok border-ok/40',
  delete_post: 'bg-danger/10 text-danger border-danger/40',
  pin_post: 'bg-accent/10 text-accent border-accent/40',
  unpin_post: 'bg-fill text-ink-2 border-line',
  delete_comment: 'bg-danger/10 text-danger border-danger/40',
  change_role: 'bg-accent/10 text-accent border-accent/40',
  approve_content: 'bg-ok/10 text-ok border-ok/40',
  reject_content: 'bg-danger/10 text-danger border-danger/40',
};

const LIMIT = 20;

const inputCls =
  'bg-fill border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink-3 focus:bg-raised transition-colors';

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export default function AdminAuditPage() {
  const { getIdToken } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
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
      setLoadFailed(false);
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
        setLoadFailed(true); // keep stale data on error
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
        <h1 className="text-2xl font-semibold text-ink">Audit Log</h1>
        <p className="text-sm text-ink-3 mt-0.5">บันทึกการดำเนินการของ Admin ทั้งหมด</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 p-4 bg-fill border border-line rounded-xl">
        <select
          aria-label="กรองตามการกระทำ"
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className={`${inputCls} text-ink-2`}
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
            className="px-3 py-2 text-xs text-ink-2 hover:text-ink transition-colors rounded-lg border border-line hover:border-ink-3"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {loadFailed && <AdminLoadError what="audit log" onRetry={() => load(page)} />}

      {/* Table */}
      <div tabIndex={0} role="region" aria-label="Audit log table" className="border border-line rounded-xl overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line bg-fill">
              {['เวลา', 'ผู้กระทำ', 'การกระทำ', 'เป้าหมาย', 'รายละเอียด'].map(h => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-[11px] font-medium text-ink-3 uppercase whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={8} columns={[90, 130, 80, 110, 60]} />
            ) : logs.length === 0 && !loadFailed ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-3 text-sm">
                  ยังไม่มี audit log
                </td>
              </tr>
            ) : (
              logs.map(log => {
                const actionCls = ACTION_COLOR[log.action] ?? 'bg-fill text-ink-2 border-line';
                return (
                  <tr
                    key={log.id}
                    className="border-b border-line last:border-0 hover:bg-fill transition-colors"
                  >
                    {/* เวลา */}
                    <td className="px-4 py-3.5 text-ink-3 text-xs whitespace-nowrap">
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
                        className="font-mono text-[11px] text-ink-2 cursor-default whitespace-nowrap"
                        title={log.actor_uid}
                      >
                        {truncate(log.actor_uid, 12)}
                      </span>
                    </td>
                    {/* การกระทำ */}
                    <td className="px-4 py-3.5">
                      <span className={`whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full border ${actionCls}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    {/* เป้าหมาย */}
                    <td className="px-4 py-3.5 text-ink-3 text-xs">
                      {log.target_type && (
                        <span className="text-ink-3 mr-1">{log.target_type}/</span>
                      )}
                      {log.target_id ? (
                        <span className="font-mono whitespace-nowrap" title={log.target_id}>
                          {truncate(log.target_id, 14)}
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    {/* รายละเอียด */}
                    <td className="px-4 py-3.5 text-ink-3 text-[11px] font-mono max-w-[200px]">
                      {log.metadata ? (
                        <span className="truncate block" title={JSON.stringify(log.metadata)}>
                          {JSON.stringify(log.metadata)}
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
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
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="disabled:opacity-25 hover:text-ink transition-colors smooth-hover-fast"
          >
            ← ก่อนหน้า
          </button>
          <span className="text-ink-2">หน้า {page}</span>
          <button
            disabled={!hasMore}
            onClick={() => setPage(p => p + 1)}
            className="disabled:opacity-25 hover:text-ink transition-colors smooth-hover-fast"
          >
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  );
}
