# My Posts — Navbar Link + Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ user เข้าถึงโพสต์ของตัวเองได้จาก Navbar และดูโพสต์ทั้งหมดได้ (ไม่ติด limit 20)

**Architecture:** เพิ่ม `@Query('authorUid')` filter ใน Backend `listPosts` → expose ผ่าน `listPostsByUser()` ใน `communityApi.ts` → Navbar dropdown links ไป profile page → profile posts tab มี "โหลดเพิ่ม" button ที่ append ผลจาก API. ไม่มีหน้าใหม่ ไม่มี module ใหม่.

**Tech Stack:** NestJS 11 (Backend), Next.js 16 + React 19 (Frontend), Supabase PostgREST, bun test / Jest

## Global Constraints

- ไม่เพิ่ม npm/bun package ใหม่
- `tsc --noEmit` ผ่านหลังทุก task
- `bun lint` ผ่านหลังทุก task
- string ที่ user เห็นต้องเป็นภาษาไทย (ตาม pattern ที่มีอยู่)
- ห้ามแตะ logic ที่ไม่เกี่ยวกับ task นี้

---

## File Map

| Action | Path | หน้าที่ |
|--------|------|---------|
| Modify | `Backend/src/forum/forum.service.ts` | เพิ่ม `authorUid?` param (arg 7) + filter `.eq('author_uid', authorUid)` |
| Modify | `Backend/src/forum/forum.controller.ts` | เพิ่ม `@Query('authorUid')` + pass ไป service |
| Modify | `Frontend/app/lib/communityApi.ts` | เพิ่ม `listPostsByUser(uid, offset, limit)` |
| Modify | `Frontend/app/components/NavbarActions.tsx` | เพิ่ม "โปรไฟล์ของฉัน" ใน dropdown |
| Modify | `Frontend/app/community/profile/[uid]/page.tsx` | posts tab: `extraPosts` state + "โหลดโพสต์เพิ่ม" button |

---

### Task 1: Backend — expose `authorUid` filter บน `GET /forum/posts`

**Files:**
- Modify: `Backend/src/forum/forum.service.ts:76-82` (signature), `Backend/src/forum/forum.service.ts:94-95` (filter block)
- Modify: `Backend/src/forum/forum.controller.ts:62-78` (listPosts method)
- Test: `Backend/src/forum/forum.service.spec.ts`

**Interfaces:**
- Produces: `listPosts(category?, mangaId?, sort, limit, offset, userUid?, authorUid?)` — ส่ง posts ที่กรองเฉพาะ `author_uid = authorUid` เมื่อระบุ

- [ ] **Step 1: เขียน failing test ใน `forum.service.spec.ts`**

เพิ่มต่อจาก test suite ที่มีอยู่แล้ว:

```typescript
it('listPosts filters by authorUid when provided', async () => {
  const mockRow = {
    id: 'p1',
    author_uid: 'user-abc',
    title: 'T',
    content: 'C',
    category: 'general',
    target_manga_id: null,
    image_urls: [],
    upvotes: 0,
    downvotes: 0,
    comment_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    pinned: false,
    author: { display_name: 'Alice', photo_url: null, role: 0 },
    comments: [],
  };

  // Intercept: expect the query to use .eq('author_uid', 'user-abc')
  // The test uses the existing supabase mock pattern in this file
  // แก้ mock ตาม pattern ที่ใช้อยู่ใน spec file นี้เพื่อ return [mockRow]
  // และ verify ว่า result.items[0].authorUid === 'user-abc'
  
  // ดู pattern การ mock supabase จาก test ที่มีอยู่ใน file แล้วเขียนให้ตรง
  const result = await service.listPosts(
    undefined, undefined, 'new', 20, 0,
    undefined, // userUid (vote status)
    'user-abc', // authorUid (filter)
  );
  expect(result.items.every(p => p.authorUid === 'user-abc')).toBe(true);
});
```

- [ ] **Step 2: รัน test เพื่อยืนยัน fail**

```bash
cd Backend
npx jest src/forum/forum.service.spec.ts --no-coverage -t "filters by authorUid"
```

Expected: FAIL — "Expected: true, Received: false" หรือ type error

- [ ] **Step 3: แก้ `forum.service.ts` — เพิ่ม `authorUid` param และ filter**

เปลี่ยน signature ของ `listPosts` จาก:
```typescript
async listPosts(
  category?: ForumCategory, 
  mangaId?: string, 
  sort: 'new' | 'hot' = 'new',
  limit = 20, 
  offset = 0,
  userUid?: string
): Promise<{ items: ForumPost[], total: number }>
```

เป็น:
```typescript
async listPosts(
  category?: ForumCategory, 
  mangaId?: string, 
  sort: 'new' | 'hot' = 'new',
  limit = 20, 
  offset = 0,
  userUid?: string,
  authorUid?: string,
): Promise<{ items: ForumPost[], total: number }>
```

และเพิ่ม filter ต่อจาก `if (mangaId) query = query.eq('target_manga_id', mangaId);`:
```typescript
if (authorUid) query = query.eq('author_uid', authorUid);
```

- [ ] **Step 4: แก้ `forum.controller.ts` — เพิ่ม `@Query('authorUid')` และ pass ไป service**

เปลี่ยน `listPosts` method ใน controller:
```typescript
@Get('posts')
@UseGuards(OptionalAuthGuard)
async listPosts(
  @Req() req: MaybeAuthenticatedRequest,
  @Query('category') category?: ForumCategory,
  @Query('mangaId') mangaId?: string,
  @Query('sort') sort: 'new' | 'hot' = 'hot',
  @Query('limit') limit?: string,
  @Query('offset') offset?: string,
  @Query('authorUid') authorUid?: string,
) {
  return this.forumService.listPosts(
    category,
    mangaId,
    sort,
    Math.min(100, limit ? (parseInt(limit, 10) || 20) : 20),
    offset ? (parseInt(offset, 10) || 0) : 0,
    req.uid,
    authorUid,
  );
}
```

- [ ] **Step 5: รัน test เพื่อยืนยัน pass**

```bash
cd Backend
npx jest src/forum/forum.service.spec.ts --no-coverage
```

Expected: PASS (ทั้ง suite)

- [ ] **Step 6: ตรวจ typecheck + commit**

```bash
cd Backend && npm run build
```

Expected: ไม่มี TypeScript error

```bash
git add Backend/src/forum/forum.service.ts Backend/src/forum/forum.controller.ts Backend/src/forum/forum.service.spec.ts
git commit -m "feat(forum): expose authorUid filter on GET /forum/posts"
```

---

### Task 2: Frontend API — เพิ่ม `listPostsByUser`

**Files:**
- Modify: `Frontend/app/lib/communityApi.ts`

**Interfaces:**
- Consumes: `GET /api/proxy/forum/posts?authorUid={uid}&offset={n}&limit=20` (จาก Task 1)
- Produces: `listPostsByUser(uid: string, offset: number, limit?: number): Promise<{ items: ForumPost[]; total: number }>`

- [ ] **Step 1: เพิ่ม `listPostsByUser` ใน `communityApi.ts`**

เพิ่มต่อจาก function `listPosts` ที่มีอยู่แล้ว:

```typescript
export async function listPostsByUser(
  uid: string,
  offset: number,
  limit = 20,
): Promise<{ items: ForumPost[]; total: number }> {
  const token = await getAuthToken();
  const params = new URLSearchParams({
    authorUid: uid,
    offset: offset.toString(),
    limit: limit.toString(),
    sort: 'new',
  });
  const res = await fetch(`${API_BASE}/forum/posts?${params.toString()}`, {
    headers: createAuthHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch user posts');
  return res.json() as Promise<{ items: ForumPost[]; total: number }>;
}
```

หมายเหตุ: ไม่ใช้ `cacheOrFetch` เพราะ user ต้องการเห็นโพสต์ใหม่สุดของตัวเองทันที

- [ ] **Step 2: typecheck**

```bash
cd Frontend && tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add Frontend/app/lib/communityApi.ts
git commit -m "feat(community): add listPostsByUser API helper"
```

---

### Task 3: Frontend — Navbar link "โปรไฟล์ของฉัน"

**Files:**
- Modify: `Frontend/app/components/NavbarActions.tsx`

**Interfaces:**
- Consumes: `user.uid` จาก `useAuth()` (มีอยู่แล้วใน component นี้)
- Produces: button "โปรไฟล์ของฉัน" ใน dropdown → navigate ไป `/community/profile/{uid}`

- [ ] **Step 1: เพิ่ม button ใน dropdown ของ `NavbarActions.tsx`**

เพิ่ม **ก่อน** button "ออกจากระบบ" (บรรทัดที่มี `signOut`):

```tsx
<button
  onClick={() => {
    setMenuOpen(false);
    router.push(`/community/profile/${user.uid}`);
  }}
  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
  โปรไฟล์ของฉัน
</button>
```

- [ ] **Step 2: typecheck + lint**

```bash
cd Frontend && tsc --noEmit && bun lint
```

Expected: pass ทั้งคู่

- [ ] **Step 3: commit**

```bash
git add Frontend/app/components/NavbarActions.tsx
git commit -m "feat(navbar): add โปรไฟล์ของฉัน link to user dropdown"
```

---

### Task 4: Frontend — Posts tab pagination บน Profile page

**Files:**
- Modify: `Frontend/app/community/profile/[uid]/page.tsx`

**Interfaces:**
- Consumes: `listPostsByUser(uid, offset, limit)` จาก Task 2
- Consumes: `data.posts` (initial 20 posts จาก `getProfile`) — ไม่เปลี่ยนวิธี initial load
- Produces: posts tab แสดง initial posts + extraPosts, มีปุ่ม "โหลดโพสต์เพิ่ม" เมื่อ `hasMorePosts`

- [ ] **Step 1: เพิ่ม import และ state ใหม่**

เพิ่ม import ที่หัวไฟล์:
```typescript
import { listPostsByUser } from "../../../lib/communityApi";
```

เพิ่ม state ใหม่ใน component (ต่อจาก state เดิม):
```typescript
const [extraPosts, setExtraPosts] = useState<ForumPost[]>([]);
const [hasMorePosts, setHasMorePosts] = useState(true);
const [loadingMorePosts, setLoadingMorePosts] = useState(false);
```

- [ ] **Step 2: เพิ่ม `handleLoadMorePosts` handler**

เพิ่มใน `// ── Handlers ──` section:
```typescript
const handleLoadMorePosts = async () => {
  if (!uid || loadingMorePosts) return;
  setLoadingMorePosts(true);
  try {
    const loaded = posts.length + extraPosts.length;
    const result = await listPostsByUser(uid, loaded, 20);
    setExtraPosts((prev) => [...prev, ...result.items]);
    if (result.items.length < 20) setHasMorePosts(false);
  } catch {
    // silent — user can retry by clicking again
  } finally {
    setLoadingMorePosts(false);
  }
};
```

- [ ] **Step 3: Reset `extraPosts` และ `hasMorePosts` เมื่อ `uid` เปลี่ยน**

เพิ่มใน `useEffect` ที่ดู `uid` (บรรทัดที่เรียก `getProfile`):
```typescript
useEffect(() => {
  if (!uid) return;
  setLoading(true);
  setExtraPosts([]);         // reset extra posts เมื่อ navigate ระหว่าง profile
  setHasMorePosts(true);     // reset has-more flag
  getProfile(uid)
    .then((d) => {
      setData(d);
      setBannerYPos(d.profile.bannerPosition ?? 50);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
}, [uid]);
```

- [ ] **Step 4: แก้ posts tab render — รวม extraPosts + เพิ่มปุ่ม "โหลดโพสต์เพิ่ม"**

เปลี่ยน posts tab block (ส่วน `{tab === "posts" && (...)}`) จาก:
```tsx
{tab === "posts" && (
  posts.length > 0 ? (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewMode="compact" />
      ))}
    </div>
  ) : <EmptyState text="ยังไม่มีโพสต์" />
)}
```

เป็น:
```tsx
{tab === "posts" && (
  posts.length > 0 || extraPosts.length > 0 ? (
    <div className="space-y-3">
      {[...posts, ...extraPosts].map((p) => (
        <PostCard key={p.id} post={p} viewMode="compact" />
      ))}
      {hasMorePosts && (
        <button
          onClick={handleLoadMorePosts}
          disabled={loadingMorePosts}
          className="w-full py-3 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingMorePosts ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              กำลังโหลด...
            </>
          ) : (
            'โหลดโพสต์เพิ่ม'
          )}
        </button>
      )}
    </div>
  ) : <EmptyState text="ยังไม่มีโพสต์" />
)}
```

- [ ] **Step 5: อัปเดต tabs count — แสดง total จาก API แทนที่จะเป็น static `posts.length`**

เปลี่ยน tab count ของ "posts" จาก:
```typescript
{ id: "posts", label: "โพสต์", count: posts.length },
```
เป็น:
```typescript
{ id: "posts", label: "โพสต์", count: posts.length + extraPosts.length },
```

- [ ] **Step 6: typecheck + lint**

```bash
cd Frontend && tsc --noEmit && bun lint
```

Expected: pass ทั้งคู่

- [ ] **Step 7: commit**

```bash
git add Frontend/app/community/profile/[uid]/page.tsx
git commit -m "feat(profile): paginated posts tab with โหลดโพสต์เพิ่ม button"
```

---

## Verification

```bash
# Backend tests
cd Backend && npx jest src/forum/forum.service.spec.ts --no-coverage

# Frontend typecheck
cd Frontend && tsc --noEmit && bun lint
```

**Manual E2E checklist:**
1. Login → click avatar → เห็น "โปรไฟล์ของฉัน" ใน dropdown
2. คลิก "โปรไฟล์ของฉัน" → navigate ไป `/community/profile/{uid}`
3. Tab "โพสต์" แสดงโพสต์ 20 รายการแรก
4. ถ้ามีโพสต์มากกว่า 20: ปุ่ม "โหลดโพสต์เพิ่ม" ปรากฏ
5. คลิก "โหลดโพสต์เพิ่ม" → โพสต์ถัดไปถูก append
6. เมื่อโหลดจนครบ: ปุ่มหายไป
7. navigate ไป profile อื่นแล้วกลับมา: extraPosts ถูก reset

---

## Notes

- **ทำไมไม่ cache `listPostsByUser`**: user ต้องการเห็น draft/โพสต์ใหม่สุดของตัวเองทันที — cache อาจซ่อนโพสต์ที่เพิ่งสร้าง
- **ทำไม `hasMorePosts` เริ่มต้นเป็น `true`**: initial 20 posts อาจครบพอดี (= exactly 20) หรือน้อยกว่า; เมื่อ click "โหลดเพิ่ม" และได้ < 20 items กลับมาค่อย set เป็น `false`; ถ้า profile มีโพสต์ < 20 ปุ่มจะ visible แต่ click แล้วจะซ่อน (UX acceptable — ไม่เพิ่ม complexity)
- **`extraPosts` reset เมื่อ uid เปลี่ยน**: ป้องกัน posts ของ user A ค้างบน profile ของ user B
