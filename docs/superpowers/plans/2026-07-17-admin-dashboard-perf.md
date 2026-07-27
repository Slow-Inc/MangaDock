# Admin Dashboard — Fast Load & State Persistence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin Dashboard pages โหลดทันทีเมื่อกลับมา และ filter/pagination ไม่รีเซ็ตเมื่อ navigate ออกไปแล้วกลับมา

**Architecture:** สองการแก้ไขที่ orthogonal — (1) ใส่ `cacheOrFetch` จาก `apiCache.ts` ที่มีอยู่แล้วเพื่อ cache ข้อมูล admin ด้วย `TTL.SHORT` (60s) ทำให้ revisit ภายใน TTL ไม่ต้องรอ network; (2) ย้าย filter/page state ออกไปอยู่ใน module-level plain object (นอก React component) ที่รอดจากการ unmount ใน SPA session — ทั้งสองแก้ไขแยกกันได้, ไม่ต้องสร้างไฟล์ใหม่, ไม่ต้องเพิ่ม dependency

**Tech Stack:** Next.js 15 App Router, `Frontend/app/lib/apiCache.ts` (cacheOrFetch, cacheClearByTag, TTL), React useState, bun test

## Global Constraints

- ห้ามสร้างไฟล์ใหม่ — แก้ใน 4 ไฟล์ที่มีอยู่เท่านั้น
- cache ต้อง invalidate หลัง mutation (ban/unban/role-change/delete/pin/wallet-adjust) ด้วย `cacheClearByTag`
- module-level store ไม่ควร export — เป็น private ของแต่ละไฟล์
- `authFetch` helper ที่ใช้ใน users/transactions/content เรียก `getIdToken()` ภายใน — ไม่ต้องเปลี่ยน helper
- import เพิ่มเฉพาะ `cacheOrFetch`, `cacheClearByTag`, `TTL` จาก `'../../lib/apiCache'` (หรือ `'../lib/apiCache'` สำหรับ page.tsx ใน `/admin/`)

---

### Task 1: Overview Page — Cache Stats

**Files:**
- Modify: `Frontend/app/admin/page.tsx`

**Interfaces:**
- Consumes: `cacheOrFetch<AdminStats>('admin:stats', fetcher, TTL.SHORT)` จาก `../lib/apiCache`
- Produces: ไม่มี downstream dependencies

- [ ] **Step 1: เพิ่ม import cacheOrFetch และ TTL**

ที่บรรทัดบนสุดของ `Frontend/app/admin/page.tsx` เพิ่มหลัง import เดิม:

```ts
import { cacheOrFetch, TTL } from '../lib/apiCache';
```

- [ ] **Step 2: แทน load function ด้วยเวอร์ชันที่ cache**

แทน:
```ts
const load = useCallback(async () => {
  const token = await getIdToken();
  const res = await fetch('/api/proxy/admin/stats', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) { setError('Failed to load stats'); return; }
  setStats(await res.json());
}, [getIdToken]);
```

ด้วย:
```ts
const load = useCallback(async () => {
  try {
    const data = await cacheOrFetch<AdminStats>(
      'admin:stats',
      async () => {
        const token = await getIdToken();
        const res = await fetch('/api/proxy/admin/stats', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load stats');
        return res.json() as Promise<AdminStats>;
      },
      TTL.SHORT,
      { tags: ['admin:stats'] },
    );
    setStats(data);
  } catch {
    setError('Failed to load stats');
  }
}, [getIdToken]);
```

- [ ] **Step 3: ตรวจสอบ TypeScript ผ่าน**

Run ใน `Frontend/`:
```bash
bunx tsc --noEmit 2>&1 | grep "admin/page"
```
Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add Frontend/app/admin/page.tsx
git commit -m "perf(admin): cache overview stats with TTL.SHORT to skip re-fetch on revisit"
```

---

### Task 2: Users Page — Module State + Cache

**Files:**
- Modify: `Frontend/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `cacheOrFetch`, `cacheClearByTag`, `TTL` จาก `'../../lib/apiCache'`
- Produces: ไม่มี

- [ ] **Step 1: เพิ่ม import และ module-level state store**

แทน import เดิม:
```ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
```

ด้วย:
```ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cacheOrFetch, cacheClearByTag, TTL } from '../../lib/apiCache';

// Survives SPA navigation — resets on hard refresh only
let savedUsers = { search: '', filterRole: '', filterPlan: '', filterBanned: '', page: 1 };
```

(เพิ่มหลัง import block ทั้งหมด ก่อน interface declarations)

- [ ] **Step 2: Initialize state จาก savedUsers**

ใน component `AdminUsersPage` แทน:
```ts
const [users, setUsers] = useState<AdminUser[]>([]);
const [total, setTotal] = useState(0);
const [page, setPage] = useState(1);
const [search, setSearch] = useState('');
const [filterRole, setFilterRole] = useState('');
const [filterPlan, setFilterPlan] = useState('');
const [filterBanned, setFilterBanned] = useState('');
```

ด้วย:
```ts
const [users, setUsers] = useState<AdminUser[]>([]);
const [total, setTotal] = useState(0);
const [page, setPage] = useState(savedUsers.page);
const [search, setSearch] = useState(savedUsers.search);
const [filterRole, setFilterRole] = useState(savedUsers.filterRole);
const [filterPlan, setFilterPlan] = useState(savedUsers.filterPlan);
const [filterBanned, setFilterBanned] = useState(savedUsers.filterBanned);
```

- [ ] **Step 3: เพิ่ม persisting setters แทน direct setState**

เพิ่ม helper setters หลังประกาศ state (ก่อน `authFetch`):
```ts
const setSearchPersist = (v: string) => { savedUsers.search = v; setSearch(v); };
const setFilterRolePersist = (v: string) => { savedUsers.filterRole = v; setFilterRole(v); };
const setFilterPlanPersist = (v: string) => { savedUsers.filterPlan = v; setFilterPlan(v); };
const setFilterBannedPersist = (v: string) => { savedUsers.filterBanned = v; setFilterBanned(v); };
const setPagePersist = (v: number) => { savedUsers.page = v; setPage(v); };
```

- [ ] **Step 4: แทน loadUsers ด้วยเวอร์ชัน cacheOrFetch**

แทน:
```ts
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
```

ด้วย:
```ts
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
```

- [ ] **Step 5: Invalidate cache หลัง mutation**

ใน `submitRoleChange`:
```ts
const submitRoleChange = async () => {
  if (!confirmRoleUid) return;
  await authFetch(`/api/proxy/admin/users/${confirmRoleUid}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: confirmRole }),
  });
  setConfirmRoleUid(null);
  cacheClearByTag('admin:users');   // ← เพิ่ม
  cacheClearByTag('admin:stats');   // ← เพิ่ม (role count เปลี่ยน)
  loadUsers(page);
};
```

ใน `submitBanAction`:
```ts
const submitBanAction = async () => {
  if (!confirmBanUid) return;
  await authFetch(`/api/proxy/admin/users/${confirmBanUid}/${confirmBanAction}`, { method: 'POST' });
  setConfirmBanUid(null);
  cacheClearByTag('admin:users');   // ← เพิ่ม
  cacheClearByTag('admin:stats');   // ← เพิ่ม (recentBans เปลี่ยน)
  loadUsers(page);
};
```

- [ ] **Step 6: เปลี่ยน setter calls ใน JSX ให้ใช้ persist versions**

ใน JSX ของ filter section แทน:
- `onChange={e => setSearch(e.target.value)}` → `onChange={e => setSearchPersist(e.target.value)}`
- `onChange={e => setFilterRole(e.target.value)}` → `onChange={e => setFilterRolePersist(e.target.value)}`
- `onChange={e => setFilterPlan(e.target.value)}` → `onChange={e => setFilterPlanPersist(e.target.value)}`
- `onChange={e => setFilterBanned(e.target.value)}` → `onChange={e => setFilterBannedPersist(e.target.value)}`

ใน pagination section แทน:
- `onClick={() => setPage(p => p - 1)}` → `onClick={() => setPagePersist(page - 1)}`
- `onClick={() => setPage(p => p + 1)}` → `onClick={() => setPagePersist(page + 1)}`

ใน `submitRoleChange` / `submitBanAction` useEffect trigger:
- ตรวจว่า `setPage(1)` ใน `useEffect` (search debounce) เปลี่ยนเป็น `setPagePersist(1)` ด้วย

- [ ] **Step 7: ตรวจสอบ TypeScript**

```bash
bunx tsc --noEmit 2>&1 | grep "admin/users"
```
Expected: ไม่มี error

- [ ] **Step 8: Commit**

```bash
git add Frontend/app/admin/users/page.tsx
git commit -m "perf(admin): persist users filter state across navigation + cache list responses"
```

---

### Task 3: Transactions Page — Module State + Cache

**Files:**
- Modify: `Frontend/app/admin/transactions/page.tsx`

**Interfaces:**
- Consumes: `cacheOrFetch`, `TTL` จาก `'../../lib/apiCache'`
- Produces: ไม่มี

- [ ] **Step 1: เพิ่ม import และ module-level store**

เพิ่มหลัง import block เดิม:
```ts
import { cacheOrFetch, TTL } from '../../lib/apiCache';

let savedTx = { filterUid: '', filterType: '', filterFrom: '', filterTo: '', page: 1 };
```

- [ ] **Step 2: Initialize state จาก savedTx**

แทน:
```ts
const [page, setPage] = useState(1);
const [filterUid, setFilterUid] = useState('');
const [filterType, setFilterType] = useState('');
const [filterFrom, setFilterFrom] = useState('');
const [filterTo, setFilterTo] = useState('');
```

ด้วย:
```ts
const [page, setPage] = useState(savedTx.page);
const [filterUid, setFilterUid] = useState(savedTx.filterUid);
const [filterType, setFilterType] = useState(savedTx.filterType);
const [filterFrom, setFilterFrom] = useState(savedTx.filterFrom);
const [filterTo, setFilterTo] = useState(savedTx.filterTo);
```

- [ ] **Step 3: เพิ่ม persisting setters**

หลังประกาศ state:
```ts
const setFilterUidPersist = (v: string) => { savedTx.filterUid = v; setFilterUid(v); };
const setFilterTypePersist = (v: string) => { savedTx.filterType = v; setFilterType(v); };
const setFilterFromPersist = (v: string) => { savedTx.filterFrom = v; setFilterFrom(v); };
const setFilterToPersist = (v: string) => { savedTx.filterTo = v; setFilterTo(v); };
const setPagePersist = (v: number) => { savedTx.page = v; setPage(v); };
```

- [ ] **Step 4: แทน load ด้วยเวอร์ชัน cacheOrFetch**

แทน:
```ts
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
```

ด้วย:
```ts
const load = useCallback(async (p: number) => {
  setLoading(true);
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
  } catch { /* keep stale */ }
  setLoading(false);
}, [authFetch, filterUid, filterType, filterFrom, filterTo]);
```

- [ ] **Step 5: เปลี่ยน setter calls ใน JSX**

ใน filter section:
- `onChange={e => setFilterUid(e.target.value)}` → `onChange={e => setFilterUidPersist(e.target.value)}`
- `onChange={e => setFilterType(e.target.value)}` → `onChange={e => setFilterTypePersist(e.target.value)}`
- `onChange={e => setFilterFrom(e.target.value)}` → `onChange={e => setFilterFromPersist(e.target.value)}`
- `onChange={e => setFilterTo(e.target.value)}` → `onChange={e => setFilterToPersist(e.target.value)}`

ใน pagination:
- `onClick={() => setPage(p => p - 1)}` → `onClick={() => setPagePersist(page - 1)}`
- `onClick={() => setPage(p => p + 1)}` → `onClick={() => setPagePersist(page + 1)}`

ใน debounce useEffect: `setPage(1)` → `setPagePersist(1)`

- [ ] **Step 6: TypeScript check**

```bash
bunx tsc --noEmit 2>&1 | grep "admin/transactions"
```
Expected: ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add Frontend/app/admin/transactions/page.tsx
git commit -m "perf(admin): persist transactions filter state + cache list responses"
```

---

### Task 4: Content Page — Module State + Cache + Invalidation

**Files:**
- Modify: `Frontend/app/admin/content/page.tsx`

**Interfaces:**
- Consumes: `cacheOrFetch`, `cacheClearByTag`, `TTL` จาก `'../../lib/apiCache'`
- Produces: ไม่มี

- [ ] **Step 1: เพิ่ม import และ module-level store**

เพิ่มหลัง import block:
```ts
import { cacheOrFetch, cacheClearByTag, TTL } from '../../lib/apiCache';

let savedContent = { search: '', filterCategory: '', filterAuthor: '', page: 1 };
```

- [ ] **Step 2: Initialize state จาก savedContent**

แทน:
```ts
const [page, setPage] = useState(1);
const [search, setSearch] = useState('');
const [filterCategory, setFilterCategory] = useState('');
const [filterAuthor, setFilterAuthor] = useState('');
```

ด้วย:
```ts
const [page, setPage] = useState(savedContent.page);
const [search, setSearch] = useState(savedContent.search);
const [filterCategory, setFilterCategory] = useState(savedContent.filterCategory);
const [filterAuthor, setFilterAuthor] = useState(savedContent.filterAuthor);
```

- [ ] **Step 3: เพิ่ม persisting setters**

```ts
const setSearchPersist = (v: string) => { savedContent.search = v; setSearch(v); };
const setFilterCategoryPersist = (v: string) => { savedContent.filterCategory = v; setFilterCategory(v); };
const setFilterAuthorPersist = (v: string) => { savedContent.filterAuthor = v; setFilterAuthor(v); };
const setPagePersist = (v: number) => { savedContent.page = v; setPage(v); };
```

- [ ] **Step 4: แทน load ด้วยเวอร์ชัน cacheOrFetch**

แทน:
```ts
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
```

ด้วย:
```ts
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
```

- [ ] **Step 5: Invalidate cache หลัง mutation**

ใน `togglePin`:
```ts
const togglePin = async (post: AdminPost) => {
  await authFetch(`/api/proxy/admin/content/posts/${post.id}/pin`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned: !post.pinned }),
  });
  cacheClearByTag('admin:content');   // ← เพิ่ม
  load(page);
};
```

ใน `confirmDelete`:
```ts
const confirmDelete = async () => {
  if (!confirmDeleteId) return;
  await authFetch(`/api/proxy/admin/content/posts/${confirmDeleteId}`, { method: 'DELETE' });
  setConfirmDeleteId(null);
  cacheClearByTag('admin:content');   // ← เพิ่ม
  cacheClearByTag('admin:stats');     // ← เพิ่ม (activePosts เปลี่ยน)
  load(page);
};
```

- [ ] **Step 6: เปลี่ยน setter calls ใน JSX**

ใน filter section:
- `onChange={e => setSearch(e.target.value)}` → `onChange={e => setSearchPersist(e.target.value)}`
- `onChange={e => setFilterCategory(e.target.value)}` → `onChange={e => setFilterCategoryPersist(e.target.value)}`
- `onChange={e => setFilterAuthor(e.target.value)}` → `onChange={e => setFilterAuthorPersist(e.target.value)}`

ใน pagination:
- `onClick={() => setPage(p => p - 1)}` → `onClick={() => setPagePersist(page - 1)}`
- `onClick={() => setPage(p => p + 1)}` → `onClick={() => setPagePersist(page + 1)}`

ใน debounce useEffect: `setPage(1)` → `setPagePersist(1)`

- [ ] **Step 7: TypeScript check**

```bash
bunx tsc --noEmit 2>&1 | grep "admin/content"
```
Expected: ไม่มี error

- [ ] **Step 8: Commit**

```bash
git add Frontend/app/admin/content/page.tsx
git commit -m "perf(admin): persist content filter state + cache list, invalidate on pin/delete"
```

---

## ผลลัพธ์ที่คาดหวัง

| ปัญหา | ก่อน | หลัง |
|-------|------|------|
| กลับมาที่ Overview (ภายใน 60s) | ~300ms network wait | instant จาก cache |
| กลับมาที่ Users/Content/Tx (same filter) | refetch ใหม่ทั้งหมด | instant จาก cache |
| กลับมาที่ Users หลัง navigate ออก | search/page reset | คืนค่าเดิม |
| หลัง ban user แล้วกลับ Overview | stats stale | invalidated → fresh |

## วิธีตรวจสอบ (manual)

1. เปิด Admin → Users, ค้นหา user, ไปหน้า 2
2. คลิก Content ใน sidebar
3. คลิก Users อีกครั้ง → search text และ pagination ต้องยังอยู่
4. เปิด Network tab → ไม่มี `/admin/users?...` request ใหม่ (cache hit)
5. Ban user → กลับ Overview → recentBans อัปเดต (cache invalidated)
