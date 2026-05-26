# Session Summary

## สิ่งที่ทำเสร็จแล้วในเซสชันนี้ (Completed Tasks)

1.  **Dropdown Animation Fix:** แก้ปัญหา open/close animation ของ kebab menu ให้ลื่นไหลขึ้นด้วยการใช้ `useEffect` + `flushSync`
2.  **Comment Submit Refresh Fix:** ปรับปรุง UX ด้วย optimistic update และ silent re-fetch แทนการเซ็ต `setLoading(true)` ทุกครั้งเมื่อคอมเมนต์ ทำให้หน้าไม่กระพริบ
3.  **Studio Mobile Back Button:** เพิ่มปุ่มกลับหน้าหลักตรงกลาง bottom nav สไตล์ `bg-indigo-600` filled circle ให้ดูโดดเด่นและเป็นพรีเมียม
4.  **Google Books Legacy Cleanup:** ถอดถอนโค้ด Legacy โดยลบ `google-books.service.ts` และเคลียร์ reference ที่เกี่ยวข้องทั้งหมดออกจากระบบ
5.  **SSE T4-Standard:** วางโครงสร้างสถาปัตยกรรมแบบ Real-time ด้วย Redis Pub/Sub + `ForumEventsService` + SSE endpoints + `useForumStream` hooks + `VoteButtons` (externalCounts) และระบบแจ้งเตือน "มี N โพสต์ใหม่" banner

---

## รายละเอียด SSE Implementation (SSE T4-Standard Detail)

### Backend — ไฟล์ที่สร้างและแก้ไข

#### `Backend/src/cache/redis.service.ts` (แก้ไข)
เพิ่ม Pub/Sub layer เข้าไปใน RedisService ที่มีอยู่แล้ว:
- เพิ่ม `subscriber: Redis | null` และ `subscriptions: Map<string, Set<handler>>`
- `ensureSubscriber()` — สร้าง `client.duplicate()` แบบ lazy (ต้องแยก connection เพราะ ioredis ที่อยู่ใน SUBSCRIBE mode ใช้ command อื่นไม่ได้)
- `publish(channel, data)` — JSON.stringify แล้ว `PUBLISH` ไปยัง Redis channel
- `subscribe(channel, handler)` — subscribe lazily, คืน unsubscribe function
- `onModuleDestroy` — quit subscriber connection เพิ่มเติมจาก main client
- **Graceful fallback**: ถ้า Redis ไม่พร้อม `subscribe()` คืน no-op และ `publish()` ไม่ throw error

#### `Backend/src/cache/cache.module.ts` (แก้ไข)
- เพิ่ม `RedisService` เข้า `exports` array — เพราะ `ForumEventsService` ต้อง inject RedisService แต่ CacheModule ไม่ได้ export มาก่อน

#### `Backend/src/forum/forum-events.service.ts` (ไฟล์ใหม่)
Service กลางสำหรับ broadcast และ stream SSE events:
- Union type `ForumSSEEvent`: `vote | comment | post_edited | post_deleted | comment_deleted`
- Union type `FeedSSEEvent`: `new_post`
- `postSubject: Subject<ForumSSEEvent>` — RxJS Subject สำหรับ in-process routing
- `feedSubject: Subject<FeedSSEEvent>` — RxJS Subject สำหรับ feed
- `onModuleInit()` — subscribe ไปยัง Redis channel `forum:events` และ `forum:feed`; parse JSON แล้ว push เข้า Subject
- `broadcastPostEvent(event)` — publish ไป Redis ถ้ามี, fallback push โดยตรงเข้า Subject (สำหรับ single-instance mode)
- `broadcastFeedEvent(event)` — เหมือนกันสำหรับ feed
- `getPostStream(postId)` — filter Subject เฉพาะ postId ที่ตรง, map เป็น `{ data: event }` format ของ NestJS SSE
- `getFeedStream()` — map feedSubject เป็น MessageEvent format

#### `Backend/src/forum/forum.module.ts` (แก้ไข)
- เพิ่ม `ForumEventsService` เข้า `providers` และ `exports`

#### `Backend/src/forum/forum.service.ts` (แก้ไข)
Inject `ForumEventsService` และเพิ่ม broadcast หลังทุก mutation:
- `createPost()` → broadcast `new_post` feed event (fire-and-forget `.catch()`)
- `deletePost()` → broadcast `post_deleted` event
- `deleteComment()` → เปลี่ยน `select('author_uid')` เป็น `select('author_uid, post_id')` เพื่อดึง postId สำหรับ routing, broadcast `comment_deleted`
- `updatePost()` → เก็บ result ก่อน return, broadcast `post_edited`
- `createComment()` → เก็บ result ก่อน return, broadcast `comment` event
- `vote()` → เก็บ result ก่อน return; สำหรับ comment votes ต้องทำ DB lookup แยก (`from('forum_comments').select('post_id').eq('id', dto.targetId)`) เพื่อหา postId, broadcast `vote` event

#### `Backend/src/forum/forum.controller.ts` (แก้ไข)
เพิ่ม 2 SSE endpoints:
```typescript
@Sse('posts/:id/stream')   // real-time events สำหรับ post หนึ่งๆ (vote, comment, edit, delete)
@Sse('feed/stream')        // real-time notification เมื่อมี post ใหม่ในระบบ
```
ทั้งคู่ใช้ `merge()` กับ `interval(25_000)` heartbeat เพื่อป้องกัน proxy ปิด connection เมื่อไม่มี data

---

### Frontend — ไฟล์ที่สร้างและแก้ไข

#### `Frontend/app/hooks/useForumStream.ts` (ไฟล์ใหม่)
Hook 2 ตัว:

**`usePostStream({ postId, onEvent, enabled })`**
- เปิด `EventSource` ไปยัง `/forum/posts/:id/stream`
- `onEventRef = useRef(onEvent)` — อัปเดต ref ทุก render เพื่อหลีกเลี่ยง stale closure
- Auto-reconnect: `onerror` → exponential backoff `Math.min(1000 * 2^retries, 30000)`, max 6 retries
- Cleanup: close EventSource และ clear timeout เมื่อ unmount

**`useFeedStream({ onNewPost, enabled })`**
- เปิด `EventSource` ไปยัง `/forum/feed/stream`
- Filter เฉพาะ `type === "new_post"` events
- Auto-reconnect แบบเดียวกัน

#### `Frontend/app/components/VoteButtons.tsx` (แก้ไข)
- เพิ่ม prop `externalCounts?: { upvotes: number; downvotes: number }`
- เพิ่ม `useEffect` sync: อัปเดต local state จาก SSE เมื่อ `!loading && externalCounts` มีค่า
- **ป้องกัน conflict**: ถ้า user กำลัง vote อยู่ (`loading === true`) จะ ignore SSE update เพื่อไม่ให้ขัดกับ optimistic state

#### `Frontend/app/community/p/[id]/page.tsx` (แก้ไข)
- เพิ่ม `voteCounts: Map<string, {upvotes, downvotes}>` state — key คือ `"post:id"` หรือ `"comment:id"`
- Wired `usePostStream` ด้วย `useCallback` handler สำหรับทุก event type:
  - `vote` → `setVoteCounts(prev => new Map(prev).set(key, counts))`
  - `comment` → dedup check (`prev.some(c => c.id === event.comment.id)`) แล้ว append + increment commentCount
  - `post_edited` → อัปเดต title/content/updatedAt ใน post state
  - `post_deleted` → `router.push("/community")`
  - `comment_deleted` → filter comment ออกจาก state
- ส่ง `externalCounts` ให้ `<VoteButtons>` ทั้ง post และทุก comment

#### `Frontend/app/community/page.tsx` (แก้ไข)
- Wired `useFeedStream` — `onNewPost` callback เพิ่ม `newPostCount` ทีละ 1
- `useEffect` ที่เรียก `fetchPosts()` รีเซ็ต `newPostCount` เป็น 0 ทุกครั้งที่โหลดโพสต์ใหม่
- เพิ่ม Banner UI: sticky `top-20 z-30`, แสดงเมื่อ `newPostCount > 0`, `animate-in slide-in-from-top-2`, กดแล้ว call `fetchPosts()` + reset count

---

## จุดที่ให้ Gemini ตรวจสอบต่อ (Review Pending)

1.  **Redis duplicate connection:** ตรวจสอบการเชื่อมต่อซ้ำซ้อนของ Redis
2.  **CORS สำหรับ SSE:** ตรวจสอบการตั้งค่า CORS เพื่อรองรับ Server-Sent Events อย่างถูกต้อง
3.  **Load balancer keep-alive:** ตรวจสอบและตั้งค่า keep-alive สำหรับ Load Balancer
4.  **Google Books cleanup completeness:** ยืนยันความสมบูรณ์ในการล้าง Legacy Code ของ Google Books ว่าไม่มีส่วนใดตกหล่น