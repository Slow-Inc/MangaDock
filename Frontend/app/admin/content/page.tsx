'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminPost {
  id: string;
  title: string;
  authorUid: string;
  authorName: string;
  category: string;
  createdAt: string;
  pinned: boolean;
  commentCount: number;
}

const CATEGORIES = ['general', 'announcement', 'spoiler', 'manga_update'];
const LIMIT = 20;

export default function AdminContentPage() {
  const { getIdToken } = useAuth();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
    if (search) params.set('search', search);
    if (filterCategory) params.set('category', filterCategory);
    if (filterAuthor) params.set('authorUid', filterAuthor);
    const res = await authFetch(`/api/proxy/admin/content/posts?${params}`);
    if (res.ok) { const d = await res.json(); setPosts(d.posts); setTotal(d.total); }
    setLoading(false);
  }, [authFetch, search, filterCategory, filterAuthor]);

  useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPage(1); load(1); }, 300);
    return () => clearTimeout(searchRef.current);
  }, [search, filterCategory, filterAuthor, load]);

  useEffect(() => { load(page); }, [page, load]);

  const togglePin = async (post: AdminPost) => {
    await authFetch(`/api/proxy/admin/content/posts/${post.id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !post.pinned }),
    });
    load(page);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    await authFetch(`/api/proxy/admin/content/posts/${confirmDeleteId}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    load(page);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Content Moderation</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or content…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 w-64 focus:outline-none focus:border-white/30"
        />
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={filterAuthor}
          onChange={e => setFilterAuthor(e.target.value)}
          placeholder="Author UID…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 w-56 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {['Title', 'Author', 'Category', 'Created', 'Comments', 'Pinned', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white/40 font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-white/30 text-sm">Loading…</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-white/30 text-sm">No posts found.</td></tr>
            ) : posts.map(p => (
              <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white max-w-xs truncate">{p.title}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{p.authorName || p.authorUid.slice(0, 8)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-white/5 text-white/50 border-white/10">{p.category}</span>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-white/40">{p.commentCount}</td>
                <td className="px-4 py-3">
                  {p.pinned
                    ? <span className="text-xs text-yellow-400">📌 Pinned</span>
                    : <span className="text-xs text-white/20">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => togglePin(p)}
                      className="text-xs text-white/40 hover:text-white transition-colors">
                      {p.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button onClick={() => setConfirmDeleteId(p.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
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

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-80 space-y-4">
            <p className="text-sm text-white">Delete this post? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="text-sm px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
