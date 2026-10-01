'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cacheOrFetch, cacheClearByTag, TTL } from '../../lib/apiCache';

const savedContent = { search: '', filterCategory: '', filterAuthor: '', page: 1 };

interface AdminPost {
  id: string; title: string; authorUid: string; authorName: string;
  category: string; createdAt: string; pinned: boolean; commentCount: number;
}

const CATEGORIES = ['general', 'announcement', 'spoiler', 'manga_update'];
const LIMIT = 20;
const inputCls = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-colors';

export default function AdminContentPage() {
  const { getIdToken } = useAuth();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(savedContent.page);
  const [search, setSearch] = useState(savedContent.search);
  const [filterCategory, setFilterCategory] = useState(savedContent.filterCategory);
  const [filterAuthor, setFilterAuthor] = useState(savedContent.filterAuthor);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const didMount = useRef(false);

  const setSearchPersist = (v: string) => { savedContent.search = v; setSearch(v); };
  const setFilterCategoryPersist = (v: string) => { savedContent.filterCategory = v; setFilterCategory(v); };
  const setFilterAuthorPersist = (v: string) => { savedContent.filterAuthor = v; setFilterAuthor(v); };
  const setPagePersist = (v: number) => { savedContent.page = v; setPage(v); };

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getIdToken();
    return fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, [getIdToken]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (search) params.set('search', search);
    if (filterCategory) params.set('category', filterCategory);
    if (filterAuthor) params.set('authorUid', filterAuthor);
    try {
      const d = await cacheOrFetch(
        `admin:content:${params}`,
        async () => {
          const res = await authFetch(`/api/proxy/admin/content/posts?${params}`);
          if (!res.ok) throw new Error('Failed');
          return res.json();
        },
        TTL.SHORT,
        { tags: ['admin:content'] },
      );
      setPosts(d.posts);
      setTotal(d.total);
    } catch { /* keep stale */ }
    setLoading(false);
  }, [authFetch, search, filterCategory, filterAuthor]);

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPagePersist(1); load(1); }, 300);
    return () => clearTimeout(searchRef.current);
  }, [search, filterCategory, filterAuthor, load]);

  useEffect(() => { load(page); }, [page, load]);

  const togglePin = async (post: AdminPost) => {
    await authFetch(`/api/proxy/admin/content/posts/${post.id}/pin`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !post.pinned }),
    });
    cacheClearByTag('admin:content');
    load(page);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    await authFetch(`/api/proxy/admin/content/posts/${confirmDeleteId}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    cacheClearByTag('admin:content');
    cacheClearByTag('admin:stats');
    load(page);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Content</h1>
        <p className="text-sm text-white/35 mt-0.5">{total.toLocaleString()} forum posts</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
        <input value={search} onChange={e => setSearchPersist(e.target.value)} placeholder="Search title or content…" className={`${inputCls} w-60`} />
        <select value={filterCategory} onChange={e => setFilterCategoryPersist(e.target.value)} className={`${inputCls} text-white/60`}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={filterAuthor} onChange={e => setFilterAuthorPersist(e.target.value)} placeholder="Author UID…" className={`${inputCls} w-52`} />
      </div>

      {/* Table */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.02]">
              {['Title', 'Author', 'Category', 'Created', 'Comments', 'Pinned', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-white/35 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/5 rounded animate-pulse" style={{ width: `${[160,80,70,60,30,40,80][j]}px` }} /></td>
                  ))}
                </tr>
              ))
            ) : posts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-white/30 text-sm">No posts found.</td></tr>
            ) : posts.map(p => (
              <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3.5 text-white max-w-xs truncate font-medium">{p.title}</td>
                <td className="px-4 py-3.5 text-white/45 text-xs">{p.authorName || p.authorUid.slice(0, 8)}</td>
                <td className="px-4 py-3.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-full border bg-white/[0.04] text-white/45 border-white/[0.08]">{p.category}</span>
                </td>
                <td className="px-4 py-3.5 text-white/35 text-xs whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3.5 text-white/40">{p.commentCount}</td>
                <td className="px-4 py-3.5">
                  {p.pinned
                    ? <span className="text-[11px] text-amber-400 font-medium">Pinned</span>
                    : <span className="text-xs text-white/20">—</span>}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => togglePin(p)} className="text-xs text-white/35 hover:text-white transition-colors smooth-hover-fast">
                      {p.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button onClick={() => setConfirmDeleteId(p.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors smooth-hover-fast">Delete</button>
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

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-[#0f0f0f] border border-white/[0.08] rounded-xl p-6 w-80 space-y-4 shadow-2xl">
            <p className="text-sm text-white">Delete this post? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="text-sm text-white/35 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="text-sm px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
