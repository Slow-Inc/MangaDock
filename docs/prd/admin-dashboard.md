# PRD: Admin Dashboard

**Status:** Ready-for-agent
**Author:** akkanop-x (via 2026-07-12 /grill-me session)
**Date:** 2026-07-12

---

## Overview

MangaDock currently has an `ADMIN` role (numeric 8) defined in both Frontend and Backend, but no administrative UI exists. Admins can post announcements in the forum but cannot manage users, moderate content, or inspect transactions. This PRD scopes a **new `/admin` dashboard** inside the existing Next.js Frontend with a companion `admin` module in the NestJS Backend, covering user management (A), forum content moderation (B), and transaction inspection (C).

**(ไทย)** MangaDock มี role `ADMIN` (ตัวเลข 8) อยู่แล้วทั้งใน Frontend และ Backend แต่ยังไม่มี UI สำหรับ admin เลย admin ทำได้แค่โพสต์ announcement ในฟอรั่ม แต่ยังจัดการ user, moderate content หรือตรวจ transaction ไม่ได้ PRD นี้กำหนดขอบเขตการสร้าง **admin dashboard ใหม่ที่ `/admin`** ใน Next.js Frontend ที่มีอยู่ พร้อม `admin` module ใหม่ใน NestJS Backend ครอบคลุม user management (A), forum content moderation (B) และ transaction inspection (C)

---

## Goals

- Give admins a purpose-built UI to manage users (view, change role, ban/unban) without touching the database directly.
- Give admins a forum moderation surface to list, delete, and pin/unpin posts across all categories.
- Give admins read-only visibility into wallet transactions with detail drill-down.
- Provide a summary overview (stat cards + recent activity) as the landing page.
- Protect all admin surfaces with a hard `role >= ADMIN(8)` guard at both Frontend route and Backend controller level.

**(ไทย)**
- ให้ admin มี UI โดยเฉพาะสำหรับจัดการ user (ดู, เปลี่ยน role, ban/unban) โดยไม่ต้องแตะ database ตรงๆ
- ให้ admin มี surface สำหรับ moderate forum เพื่อ list, ลบ และ pin/unpin โพสต์ทุก category
- ให้ admin ดู wallet transaction แบบ read-only พร้อม detail drill-down
- มีหน้า overview สรุป (stat card + recent activity) เป็นหน้าแรก
- ป้องกัน admin surface ทั้งหมดด้วย guard `role >= ADMIN(8)` ทั้งฝั่ง Frontend route และ Backend controller

## Non-goals

- Report/flag system for user-submitted content reports — phase 2.
- Manual coin grant to users — phase 2 (requires audit trail design).
- Transaction refund / reverse — phase 2 (requires atomic rollback design).
- CSV export of any data — phase 2.
- Manga catalog management (add/edit/delete manga, chapters) — separate epic.
- System health monitoring — use existing Dashboard app.
- Elevating users to `ADMIN(8)` or `DEV(9)` role via UI (must be done directly in DB).

**(ไทย)**
- ระบบ report/flag สำหรับ user รายงาน content — phase 2
- Coin grant manual ให้ user — phase 2 (ต้องออกแบบ audit trail ก่อน)
- Refund / reverse transaction — phase 2 (ต้องออกแบบ atomic rollback)
- Export CSV — phase 2
- Manga catalog management — epic แยก
- System health monitoring — ใช้ Dashboard app ที่มีอยู่แล้ว
- ยกระดับ user เป็น `ADMIN(8)` หรือ `DEV(9)` ผ่าน UI (ต้องแก้ใน DB โดยตรง)

---

## User Stories

1. As an **admin**, I want a summary overview so I can see platform health at a glance without clicking into each section.
2. As an **admin**, I want to search and filter all users so I can find a specific account quickly.
3. As an **admin**, I want to change a user's role between USER / TRANSLATOR / CREATOR so I can approve or revoke creator access without touching the database.
4. As an **admin**, I want to hard-ban a user so their existing sessions expire immediately and they cannot log back in.
5. As an **admin**, I want to unban a user so I can reverse a ban that was issued in error.
6. As an **admin**, I want to see a user's profile detail (role, plan, trust score, wallet balance, post count) so I can make informed moderation decisions.
7. As an **admin**, I want to list all forum posts with filters so I can find problematic content.
8. As an **admin**, I want to delete any forum post so I can remove content that violates the rules.
9. As an **admin**, I want to pin and unpin forum posts so I can surface important announcements.
10. As an **admin**, I want to list all wallet transactions with filters so I can investigate payment issues.
11. As an **admin**, I want to view a transaction's detail (amount, coin balance before/after, user, timestamp) so I can investigate discrepancies.
12. As a **maintainer**, I want all admin endpoints protected by a single `AdminGuard` at the controller level so there is no risk of missing a role check on individual methods.

**(ไทย)**
1. ในฐานะ **admin** ฉันอยากได้หน้า overview สรุปเพื่อดูภาพรวม platform โดยไม่ต้องคลิกเข้าแต่ละส่วน
2. ในฐานะ **admin** ฉันอยากค้นหาและกรอง user ทั้งหมดเพื่อหา account ที่ต้องการได้เร็ว
3. ในฐานะ **admin** ฉันอยากเปลี่ยน role ของ user ระหว่าง USER / TRANSLATOR / CREATOR โดยไม่ต้องแตะ database
4. ในฐานะ **admin** ฉันอยาก hard-ban user เพื่อให้ session ที่มีอยู่ expire ทันทีและ login ใหม่ไม่ได้
5. ในฐานะ **admin** ฉันอยาก unban user เพื่อย้อน ban ที่ออกผิดพลาด
6. ในฐานะ **admin** ฉันอยากดู profile detail ของ user (role, plan, trust score, wallet balance, จำนวนโพสต์) เพื่อตัดสินใจ moderate อย่างมีข้อมูล
7. ในฐานะ **admin** ฉันอยาก list โพสต์ forum ทั้งหมดพร้อม filter เพื่อหา content ที่มีปัญหา
8. ในฐานะ **admin** ฉันอยากลบโพสต์ forum ใดก็ได้เพื่อลบ content ที่ละเมิดกฎ
9. ในฐานะ **admin** ฉันอยาก pin และ unpin โพสต์ forum เพื่อ surface announcement สำคัญ
10. ในฐานะ **admin** ฉันอยาก list wallet transaction ทั้งหมดพร้อม filter เพื่อตรวจสอบปัญหา payment
11. ในฐานะ **admin** ฉันอยากดู detail ของ transaction (amount, coin balance ก่อน/หลัง, user, timestamp) เพื่อตรวจสอบความไม่สอดคล้อง
12. ในฐานะ **maintainer** ฉันอยากให้ admin endpoint ทั้งหมดถูกป้องกันด้วย `AdminGuard` ตัวเดียวที่ระดับ controller เพื่อไม่มีความเสี่ยงพลาด role check ในแต่ละ method

---

## Functional Requirements

### Frontend — Layout & Guard (F0)

- FR-1: `app/admin/layout.tsx` wraps all `/admin/*` routes; redirects to `/` if `userRole < ADMIN(8)`.
- FR-2: Layout renders a persistent **left sidebar** with links to Overview, Users, Content, Transactions. Active link is highlighted. Sidebar is separate from the main app Navbar.
- FR-3: All admin pages are `"use client"` and read role from `AuthContext` — no new auth mechanism.

### Frontend — Overview `/admin` (F1)

- FR-4: Four stat cards: **Total users** (+ new today), **Active posts** (forum post count), **Transactions today** (count + coin sum), **Recently banned** (count last 7 days).
- FR-5: A **Recent bans** table below the cards: columns uid, displayName, bannedAt — last 10 entries.

### Frontend — Users `/admin/users` (F2)

- FR-6: Paginated table of all users; columns: displayName, email, role badge, plan badge, trustScore, joinedAt, banned status.
- FR-7: Filter bar: search by email/displayName, filter by role, filter by plan, filter by banned.
- FR-8: Row actions: **View detail** (slide-over panel), **Change role** (dropdown USER/TRANSLATOR/CREATOR — ADMIN and DEV are not options), **Ban** / **Unban**.
- FR-9: Change role shows a confirmation dialog before submitting.
- FR-10: Ban shows a confirmation dialog; on confirm calls ban endpoint; row updates to show banned badge.
- FR-11: Detail panel shows: avatar, displayName, email, role, plan, trustScore, ratingAvg, wallet balance, post count, joinedAt, last seen.

### Frontend — Content `/admin/content` (F3)

- FR-12: Paginated table of all forum posts; columns: title (truncated), author, category badge, createdAt, pinned status, comment count.
- FR-13: Filter bar: search by title/content, filter by category, filter by author uid.
- FR-14: Row actions: **Delete** (with confirmation dialog), **Pin** / **Unpin**.

### Frontend — Transactions `/admin/transactions` (F4)

- FR-15: Paginated table of all wallet transactions; columns: uid, type, amount (coin delta), balanceAfter, createdAt.
- FR-16: Filter bar: filter by uid, filter by type, date range picker.
- FR-17: Row click opens a detail panel: full transaction fields including balanceBefore, balanceAfter, metadata.

---

### Backend — AdminGuard (B0)

- FR-18: `AdminGuard` implements `CanActivate`; reads `role` from the JWT claims (already decoded by `AuthGuard`); throws `ForbiddenException` if `role < 8`.
- FR-19: All controllers in `Backend/src/admin/` are decorated `@UseGuards(AuthGuard, AdminGuard)` at the class level.

### Backend — Admin Module (B1)

- FR-20: `Backend/src/admin/` contains: `admin.module.ts`, `admin.controller.ts`, `admin.service.ts`, `admin.guard.ts`. Imports `UsersModule`, `ForumModule`, `WalletModule`, `SupabaseModule`.
- FR-21: `AdminService` delegates to existing services — it does **not** duplicate query logic.

### Backend — User Management Endpoints (B2)

- FR-22: `GET /admin/users` — paginated list; query params: `page`, `limit`, `search` (email/displayName), `role`, `plan`, `banned`.
- FR-23: `PATCH /admin/users/:uid/role` — body `{ role: 0 | 1 | 2 }`. Rejects with `400` if requested role ≥ 8. Rejects with `403` if target user's current role ≥ 8.
- FR-24: `POST /admin/users/:uid/ban` — calls `supabase.auth.admin.updateUserById(uid, { ban_duration: '876600h' })`. Records ban timestamp.
- FR-25: `POST /admin/users/:uid/unban` — calls `supabase.auth.admin.updateUserById(uid, { ban_duration: 'none' })`.
- FR-26: `GET /admin/users/:uid` — full profile detail including wallet balance and post count.

### Backend — Content Moderation Endpoints (B3)

- FR-27: `GET /admin/content/posts` — paginated list of all forum posts; query params: `page`, `limit`, `search`, `category`, `authorUid`.
- FR-28: `DELETE /admin/content/posts/:id` — hard-deletes post and its comments.
- FR-29: `PATCH /admin/content/posts/:id/pin` — body `{ pinned: boolean }`.

### Backend — Transaction Endpoints (B4)

- FR-30: `GET /admin/transactions` — paginated list; query params: `page`, `limit`, `uid`, `type`, `from` (ISO date), `to` (ISO date).
- FR-31: `GET /admin/transactions/:id` — full transaction detail.

### Backend — Overview Stats Endpoint (B5)

- FR-32: `GET /admin/stats` — returns `{ totalUsers, newUsersToday, activePosts, transactionsToday: { count, coinSum }, recentBans: [{ uid, displayName, bannedAt }] }`.

---

## Security Constraints

- Admin cannot set role to ADMIN(8) or DEV(9) via API — enforced at both Frontend (dropdown excludes them) and Backend (FR-23 400 rejection).
- Admin cannot modify any user whose current role ≥ ADMIN(8) — enforced at Backend (FR-23 403 rejection).
- All `/admin/*` Backend routes require both `AuthGuard` (valid JWT) + `AdminGuard` (role ≥ 8) — no route is guarded by only one.
- Ban uses Supabase Auth hard-ban (`ban_duration: '876600h' ≈ 100 years`) so existing sessions expire immediately without requiring additional middleware.

**(ไทย)**
- Admin ตั้ง role เป็น ADMIN(8) หรือ DEV(9) ผ่าน API ไม่ได้ — enforce ทั้ง Frontend (dropdown ไม่มีตัวเลือก) และ Backend (FR-23 reject 400)
- Admin แก้ user ที่มี role ≥ ADMIN(8) อยู่แล้วไม่ได้ — enforce ที่ Backend (FR-23 reject 403)
- Backend route `/admin/*` ทั้งหมดต้องการทั้ง `AuthGuard` (JWT valid) + `AdminGuard` (role ≥ 8) — ไม่มี route ที่ guard แค่ตัวเดียว
- Ban ใช้ Supabase Auth hard-ban (`ban_duration: '876600h' ≈ 100 ปี`) ทำให้ session ที่มีอยู่ expire ทันทีโดยไม่ต้องเพิ่ม middleware

---

## Implementation Slices

| Slice | Label | Blocked by | งาน |
|-------|-------|-----------|-----|
| **I1 — Backend foundation** | AFK | — | `admin.module`, `AdminGuard`, `GET /admin/stats` |
| **I2 — User management API** | AFK | I1 | FR-22–26 endpoints + unit tests |
| **I3 — Content + Transaction API** | AFK | I1 | FR-27–31 endpoints + unit tests |
| **I4 — Frontend layout + Overview** | AFK | I1 | `admin/layout.tsx`, Overview page consuming `/admin/stats` |
| **I5 — Frontend Users page** | AFK | I2 + I4 | Users table, filters, role change, ban/unban, detail panel |
| **I6 — Frontend Content + Transactions** | AFK | I3 + I4 | Content table + Transactions table + filters + detail |

---

## Testing Decisions

- `AdminGuard` unit-tested: allows role 8/9, rejects 0/1/2/7.
- `PATCH /admin/users/:uid/role` unit-tested: rejects target role ≥ 8, rejects setting role ≥ 8.
- Frontend guard (`admin/layout.tsx`) tested via role mock: role 7 → redirect, role 8 → renders, role 9 → renders.
- No snapshot tests. Integration: run the admin UI against the dev server.

**(ไทย)**
- `AdminGuard` unit test: อนุญาต role 8/9, reject 0/1/2/7
- `PATCH /admin/users/:uid/role` unit test: reject target role ≥ 8, reject การตั้ง role ≥ 8
- Frontend guard (`admin/layout.tsx`) test ด้วย role mock: role 7 → redirect, role 8 → render, role 9 → render
- ไม่มี snapshot test; integration: รัน admin UI กับ dev server

---

## Further Notes

- The `admin` Backend module calls existing services (`UsersService`, `ForumService`, `WalletService`) — no logic duplication. If a method needed by admin doesn't exist on the service, add it to the service (not inline in `AdminService`).
- Pagination default: `limit=20`, max `limit=100`.
- All admin actions (role change, ban, delete post) should be logged via NestJS `Logger` at `warn` level with `uid` of the acting admin and target.

**(ไทย)**
- `admin` module ใน Backend เรียก service ที่มีอยู่แล้ว (`UsersService`, `ForumService`, `WalletService`) — ไม่ duplicate logic ถ้า method ที่ admin ต้องการยังไม่มีใน service ให้เพิ่มใน service นั้น (ไม่ใช่ inline ใน `AdminService`)
- Pagination default: `limit=20`, max `limit=100`
- Admin action ทุกอย่าง (เปลี่ยน role, ban, ลบโพสต์) ควร log ผ่าน NestJS `Logger` ระดับ `warn` พร้อม `uid` ของ admin ที่ทำและ target
