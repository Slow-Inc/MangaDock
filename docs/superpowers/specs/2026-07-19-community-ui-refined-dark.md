---
name: community-ui-refined-dark
type: project
description: Community UI refresh — Refined Dark direction targeting Feed/PostCard, Post Detail, and feed pagination
---

# Community UI — Refined Dark Design Spec

**Date:** 2026-07-19  
**Status:** Implemented  
**Files:** `Frontend/app/components/PostCard.tsx`, `Frontend/app/community/page.tsx`, `Frontend/app/community/p/[id]/page.tsx`

---

## Problem

หน้า Community มี UX friction หลายจุดที่ลดประสบการณ์ผู้ใช้:
1. Feed ไม่มี pagination — แสดงแค่ 20 โพสต์แรก ไม่มีทางเลื่อนดูเพิ่ม
2. PostCard (card mode) แสดง category เป็น raw key ภาษาอังกฤษ (`spoiler`, `announcement`) แทนภาษาไทย — bug
3. Role badge ใน card mode ไม่มีสีตาม role (เป็น `bg-white/10` ทั้งหมด) ขัดกับ compact mode ที่มีสีครบ
4. Comment input ใน post detail ดูโล่ง — ไม่มี avatar ของผู้ใช้, ไม่มี spinner ขณะส่ง
5. Login prompt ใน comment section เป็นแค่ข้อความ ไม่มี CTA ปุ่มใดให้กด
6. Empty state ของ feed มีแค่ข้อความ ไม่มี icon หรือ CTA
7. Comment count double-increment: `handlePostComment` เพิ่ม `commentCount` เองและ SSE `"comment"` event ก็เพิ่มอีกครั้ง
8. Mobile filter strip ใช้ `CATEGORY_LIST` ทั้งหมดโดยไม่ role-gate (regular user เห็น "ประกาศ" ที่ตัวเองสร้างไม่ได้)

## Direction: Refined Dark

คง dark theme (#08090d base) — เพิ่ม visual depth, ลด friction, ปรับ micro-details:
- Better hover depth (shadow lift แทนแค่ border change)
- Role-colored badges แทน monochrome
- Contextual avatar ใน comment input
- Meaningful empty states พร้อม CTA

---

## Changes Implemented

### PostCard.tsx

| Change | Detail |
|--------|--------|
| Bug fix | Category tag ใน card footer: `{post.category}` → `CAT_LABEL[post.category]` (Thai labels) |
| Avatar | `w-10 h-10` → `w-11 h-11` + `ring-1 ring-white/10` |
| Role badge | `bg-white/10 text-white/70` → role-colored: indigo (translator) / orange (creator) / red (admin/dev) |
| Card hover | เพิ่ม `hover:shadow-2xl hover:shadow-black/30` |
| Image grid | `gap-1` → `gap-1.5` + `rounded-lg` บน image items |

### page.tsx (Feed)

| Change | Detail |
|--------|--------|
| Pagination | `fetchPosts` รีเซ็ต offset + `loadMore` append; state: `offset`, `total`, `loadingMore` |
| Load more button | แสดงเมื่อ `posts.length < total`; disabled + spinner ขณะโหลด |
| Empty state | Icon + text + ปุ่ม "สร้างโพสต์แรก" (เฉพาะ logged-in user) |
| Mobile filter | `CATEGORY_LIST` → `availableCategories(userRole)` (role-gate) |

### p/[id]/page.tsx (Post Detail)

| Change | Detail |
|--------|--------|
| Comment h2 | แสดง count: `ความคิดเห็น (N)` |
| Comment input | เพิ่ม user avatar + spinner ใน submit button |
| Login prompt | Icon + ปุ่ม "เข้าสู่ระบบ" → `showLoginPrompt()` |
| Comment spacing | `space-y-6` → `space-y-4` |
| Bug fix | ลบ `commentCount++` ใน `handlePostComment` — ให้ SSE event เป็น single source of truth |

---

## Reused Patterns

- `availableCategories(userRole)` — `Frontend/app/lib/forumCategories.ts`
- `isSocialCdnUrl` — `Frontend/app/lib/avatarUpload.ts`
- `listPosts({ offset, limit })` — pagination API พร้อมอยู่แล้ว ไม่ต้องเปลี่ยน backend
- Load-more pattern — อ้างอิงจาก `Frontend/app/community/profile/[uid]/page.tsx`
- `smooth-hover` CSS utility — `Frontend/app/globals.css`
