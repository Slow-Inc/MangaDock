# Role Mapping v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-map numeric roles to 0=user, 1=translator, 2=creator, 8=admin, 9=dev — upgrading admin from 2→8, adding creator=2 as a distinct tier, and splitting forum category access (announcement admin-only, manga_update translator+).

**Architecture:** DB migration moves existing admin rows (role=2) to role=8 first. Code constants update in lockstep. Forum category logic splits into two per-category thresholds rather than one blanket check.

**Tech Stack:** Supabase MCP (DB), NestJS (Backend), Next.js 16 / React 19 (Frontend + dashboardv2), TypeScript, bun:test

## Global Constraints

- Scope: Backend · Frontend · dashboardv2 (MIT Python excluded)
- DB changes via Supabase MCP `apply_migration` or `execute_sql` only — never raw psql
- Rollback SQL must be noted before any forward migration
- `becomeTranslator()` API stays — sets role=1; role=2 is admin-assigned
- Studio layout gate stays `>= 1`; earnings/wallet/translated-tab stay `>= 1`
- dashboardv2 gate: admin(8) and dev(9) only → `>= 8`

---

## Capability Matrix

| Role | Value | Studio | manga_update | announcement | Earnings tab | dashboardv2 |
|------|-------|--------|-------------|--------------|--------------|-------------|
| user | 0 | ✗ | ✗ | ✗ | ✗ | ✗ |
| translator | 1 | ✓ | ✓ | ✗ | ✓ | ✗ |
| creator | 2 | ✓ | ✓ | ✗ | ✓ | ✗ |
| admin | 8 | ✓ | ✓ | ✓ | ✓ | ✓ |
| dev | 9 | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Files Changed

| File | Change |
|------|--------|
| Supabase DB | `UPDATE profiles SET role=8 WHERE role=2` |
| `Backend/supabase-migration.sql` | role comment update |
| `Backend/scripts/seed-forum.sql` | admin seed: `2` → `8` |
| `Backend/src/users/users.service.ts` | ROLE const + UserRole type |
| `Frontend/app/lib/types/user.ts` | ROLE const + UserRole type |
| `Frontend/app/lib/forumCategories.ts` | split announcement(>=8) vs manga_update(>=1) |
| `Frontend/app/lib/forumCategories.test.ts` | update test cases |
| `Frontend/app/community/profile/[uid]/page.tsx` | RoleBadge add creator=2, gradient update |
| `Frontend/app/components/PostCard.tsx` | author color: add creator orange |
| `Frontend/app/components/CommentThread.tsx` | author color: add creator orange |
| `Frontend/app/community/p/[id]/page.tsx` | author color: add creator orange |
| `dashboardv2/components/auth-gate.tsx` | gate `>= 2` → `>= 8` |

---

## Task 1: DB Migration — admin role 2 → 8

**Files:**
- Supabase DB (via MCP)
- Modify: `Backend/supabase-migration.sql`
- Modify: `Backend/scripts/seed-forum.sql`

**Rollback SQL (save before running forward):**
```sql
-- rollback: revert admin 8 → 2
UPDATE profiles SET role = 2 WHERE role = 8;
```

- [ ] **Step 1: Run forward migration via Supabase MCP**

```sql
-- forward: move existing admins from role=2 to role=8
UPDATE profiles SET role = 8 WHERE role = 2;
```

Expected: rows updated = number of admin users in DB (verify with `SELECT COUNT(*) FROM profiles WHERE role = 8`)

- [ ] **Step 2: Update reference schema comment in `Backend/supabase-migration.sql`**

Find line:
```sql
role INTEGER NOT NULL DEFAULT 0, -- 0=user 1=translator 2=admin 9=dev
```
Replace with:
```sql
role INTEGER NOT NULL DEFAULT 0, -- 0=user 1=translator 2=creator 8=admin 9=dev
```

- [ ] **Step 3: Update seed data in `Backend/scripts/seed-forum.sql`**

Find `2` (admin seed value) and update to `8`:
```sql
-- Before:
('00000000-0000-0000-0000-000000000001', 'MangaDock Official', '...', 2, 'Official System Account'),
-- After:
('00000000-0000-0000-0000-000000000001', 'MangaDock Official', '...', 8, 'Official System Account'),
```

- [ ] **Step 4: Verify DB state**

```sql
SELECT role, COUNT(*) FROM profiles GROUP BY role ORDER BY role;
```
Expected: no rows with role=2 (unless creator users exist, which they won't yet)

---

## Task 2: Backend — ROLE const + UserRole type

**Files:**
- Modify: `Backend/src/users/users.service.ts` (top of file, ROLE const)

**Interfaces:**
- Produces: `export const ROLE = { USER: 0, TRANSLATOR: 1, CREATOR: 2, ADMIN: 8, DEV: 9 } as const`
- Produces: `export type UserRole = 0 | 1 | 2 | 8 | 9`

- [ ] **Step 1: Update ROLE const and UserRole type**

Find:
```ts
export const ROLE = { USER: 0, TRANSLATOR: 1, ADMIN: 2, DEV: 9 } as const;
export type UserRole = typeof ROLE[keyof typeof ROLE]; // 0 | 1 | 2 | 9
```
Replace with:
```ts
export const ROLE = { USER: 0, TRANSLATOR: 1, CREATOR: 2, ADMIN: 8, DEV: 9 } as const;
export type UserRole = typeof ROLE[keyof typeof ROLE]; // 0 | 1 | 2 | 8 | 9
```

- [ ] **Step 2: Verify no remaining hardcoded admin=2 guards in users.service.ts**

Run grep — expect 0 hits for `role === 2` or `role >= 2`:
```bash
grep -n "role === 2\|role >= 2\|ADMIN: 2" Backend/src/users/users.service.ts
```
The only gate in this file is `role < 1` (line 644) which stays unchanged.

- [ ] **Step 3: Run Backend tests**

```bash
cd Backend && npm test --no-coverage 2>&1 | tail -5
```
Expected: `916 passed` (or current count), 0 failed

---

## Task 3: Frontend — ROLE const + UserRole type

**Files:**
- Modify: `Frontend/app/lib/types/user.ts`

- [ ] **Step 1: Update ROLE const and UserRole type**

Find:
```ts
export const ROLE = { USER: 0, TRANSLATOR: 1, ADMIN: 2, DEV: 9 } as const;
export type UserRole = typeof ROLE[keyof typeof ROLE]; // 0 | 1 | 2 | 9
```
Replace with:
```ts
export const ROLE = { USER: 0, TRANSLATOR: 1, CREATOR: 2, ADMIN: 8, DEV: 9 } as const;
export type UserRole = typeof ROLE[keyof typeof ROLE]; // 0 | 1 | 2 | 8 | 9
```

---

## Task 4: Frontend — Forum categories split (announcement >= 8, manga_update >= 1)

**Files:**
- Modify: `Frontend/app/lib/forumCategories.ts`
- Modify: `Frontend/app/lib/forumCategories.test.ts`

**Interfaces:**
- `availableCategories(role: number | null | undefined): ForumCategory[]` — unchanged signature, changed logic

- [ ] **Step 1: Update `availableCategories` in forumCategories.ts**

Replace entire `availableCategories` function:
```ts
// RESTRICTED set and isRestrictedCategory stay unchanged

export function availableCategories(role: number | null | undefined): ForumCategory[] {
  const r = role ?? 0;
  return CATEGORY_LIST.filter(cat => {
    if (cat === 'announcement') return r >= 8;   // admin/dev only
    if (cat === 'manga_update') return r >= 1;   // translator+
    return true;
  });
}
```

- [ ] **Step 2: Update tests in forumCategories.test.ts**

Replace the test file contents:
```ts
/**
 * availableCategories — role-gated forum categories.
 *
 * announcement: admin(8)/dev(9) เท่านั้น
 * manga_update: translator(1) ขึ้นไป
 */
import { expect, test } from "bun:test";
import { availableCategories, isRestrictedCategory, CATEGORY_LIST } from "./forumCategories";

// ── announcement: admin-only (>= 8) ────────────────────────────────────

test("admin (8) sees all four categories including announcement", () => {
  expect(availableCategories(8)).toEqual([
    "general", "announcement", "spoiler", "manga_update",
  ]);
});

test("dev (9) sees all four categories including announcement", () => {
  expect(availableCategories(9)).toEqual([
    "general", "announcement", "spoiler", "manga_update",
  ]);
});

test("creator (2) does NOT see announcement", () => {
  expect(availableCategories(2)).toEqual(["general", "spoiler", "manga_update"]);
});

test("translator (1) does NOT see announcement", () => {
  expect(availableCategories(1)).toEqual(["general", "spoiler", "manga_update"]);
});

// ── manga_update: translator+ (>= 1) ───────────────────────────────────

test("regular user (0) sees only general and spoiler", () => {
  expect(availableCategories(0)).toEqual(["general", "spoiler"]);
});

test("unauthenticated (null) sees only general and spoiler", () => {
  expect(availableCategories(null)).toEqual(["general", "spoiler"]);
});

// ── isRestrictedCategory helper ─────────────────────────────────────────

test("announcement and manga_update are restricted", () => {
  expect(isRestrictedCategory("announcement")).toBe(true);
  expect(isRestrictedCategory("manga_update")).toBe(true);
});

test("general and spoiler are not restricted", () => {
  expect(isRestrictedCategory("general")).toBe(false);
  expect(isRestrictedCategory("spoiler")).toBe(false);
});

// ── CATEGORY_LIST export ──────────────────────────────────────────────────

test("CATEGORY_LIST contains all four categories", () => {
  expect(CATEGORY_LIST).toEqual(["general", "announcement", "spoiler", "manga_update"]);
});

test("CATEGORY_LIST is readonly (same reference every import)", () => {
  expect(Array.isArray(CATEGORY_LIST)).toBe(true);
});
```

- [ ] **Step 3: Run forumCategories tests**

```bash
cd Frontend && bun test app/lib/forumCategories.test.ts
```
Expected: 10 pass, 0 fail

---

## Task 5: Frontend UI — RoleBadge + author color + profile gradient

**Files:**
- Modify: `Frontend/app/community/profile/[uid]/page.tsx` (RoleBadge + gradientClass)
- Modify: `Frontend/app/components/PostCard.tsx` (author color ×2 locations)
- Modify: `Frontend/app/components/CommentThread.tsx` (author color)
- Modify: `Frontend/app/community/p/[id]/page.tsx` (author color)

- [ ] **Step 1: Update RoleBadge map in `community/profile/[uid]/page.tsx`**

Find:
```ts
  const map: Record<number, { cls: string; label: string }> = {
    1: { cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", label: "Translator" },
    2: { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Admin" },
    9: { cls: "bg-purple-500/15 text-purple-400 border-purple-500/30", label: "Dev" },
  };
```
Replace with:
```ts
  const map: Record<number, { cls: string; label: string }> = {
    1: { cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", label: "Translator" },
    2: { cls: "bg-orange-500/15 text-orange-400 border-orange-500/30", label: "Creator" },
    8: { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Admin" },
    9: { cls: "bg-purple-500/15 text-purple-400 border-purple-500/30", label: "Dev" },
  };
```

- [ ] **Step 2: Update gradientClass in `community/profile/[uid]/page.tsx`**

Find:
```ts
  const gradientClass =
    profile.role >= 1
      ? "bg-gradient-to-br from-indigo-950/80 via-indigo-900/30 to-[#141414]"
      : "bg-gradient-to-br from-white/[0.06] to-[#141414]";
```
Replace with:
```ts
  const gradientClass =
    profile.role === 1
      ? "bg-gradient-to-br from-indigo-950/80 via-indigo-900/30 to-[#141414]"
      : profile.role === 2
      ? "bg-gradient-to-br from-orange-950/70 via-orange-900/25 to-[#141414]"
      : "bg-gradient-to-br from-white/[0.06] to-[#141414]";
```

- [ ] **Step 3: Update author color in `PostCard.tsx` (location 1, line ~95)**

Find:
```ts
                post.authorRole === 1 ? "text-indigo-400" : "text-white/50"
```
Replace with:
```ts
                post.authorRole === 1 ? "text-indigo-400" :
                post.authorRole === 2 ? "text-orange-400" : "text-white/50"
```

- [ ] **Step 4: Update author color in `PostCard.tsx` (location 2, line ~180)**

Find:
```ts
              post.authorRole === 1 ? "text-indigo-400" : "text-white/80"
```
Replace with:
```ts
              post.authorRole === 1 ? "text-indigo-400" :
              post.authorRole === 2 ? "text-orange-400" : "text-white/80"
```

- [ ] **Step 5: Update author color in `CommentThread.tsx`**

Find:
```ts
                  comment.authorRole === 1 ? "text-indigo-400" : "text-white/80"
```
Replace with:
```ts
                  comment.authorRole === 1 ? "text-indigo-400" :
                  comment.authorRole === 2 ? "text-orange-400" : "text-white/80"
```

- [ ] **Step 6: Update author color in `community/p/[id]/page.tsx`**

Find:
```ts
                  post.authorRole === 1 ? "text-indigo-400" : "text-white/80"
```
Replace with:
```ts
                  post.authorRole === 1 ? "text-indigo-400" :
                  post.authorRole === 2 ? "text-orange-400" : "text-white/80"
```

---

## Task 6: dashboardv2 — auth-gate >= 8

**Files:**
- Modify: `dashboardv2/components/auth-gate.tsx`

**Risk:** If this gate is NOT updated before deployment, creators (role=2) would have access to the admin dashboard. The DB migration (Task 1) must complete first to avoid false positives.

**Rollback:** revert `>= 8` → `>= 2`

- [ ] **Step 1: Update gate condition**

Find:
```ts
    setState(role != null && role >= 2 ? "ok" : "forbidden");
```
Replace with:
```ts
    setState(role != null && role >= 8 ? "ok" : "forbidden");
```

- [ ] **Step 2: Run dashboardv2 tests**

```bash
cd dashboardv2 && bun test && bun run tsc --noEmit
```
Expected: 86 pass, 0 fail, tsc clean

---

## Task 7: Verify — full type-check + test suites

- [ ] **Step 1: Backend tests**

```bash
cd Backend && npm test --no-coverage 2>&1 | tail -5
```
Expected: all suites pass

- [ ] **Step 2: Frontend type-check**

```bash
cd Frontend && bun run tsc --noEmit 2>&1
```
Expected: no output (exit 0). Only pre-existing mermaid error (`Cannot find module 'mermaid'`) is acceptable.

- [ ] **Step 3: Frontend forumCategories test**

```bash
cd Frontend && bun test app/lib/forumCategories.test.ts
```
Expected: 10 pass, 0 fail

- [ ] **Step 4: dashboardv2 full check**

```bash
cd dashboardv2 && bun test && bun run tsc --noEmit
```
Expected: 86 pass, tsc clean

- [ ] **Step 5: Notify developer**

```bash
& "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -File "C:\Users\somchai\Desktop\MangaDock\scripts\notify.ps1" -Message "role v2 done: creator=2 admin=8 dev=9, tsc clean, all tests green"
```
