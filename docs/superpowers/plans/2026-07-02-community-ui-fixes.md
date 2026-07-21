# Community UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 community UI bugs — stale form state, silent errors, broken `useIsMobile`, duplicate category list, inaccessible mobile drawer, and dead UI elements.

**Architecture:** All fixes are isolated to `Frontend/app/community/` and `Frontend/app/components/ForumSideMenu.tsx`. No new dependencies. Each task is independently deployable.

**Tech Stack:** Next.js 16, React 19, bun:test, TypeScript, Tailwind CSS

## Global Constraints

- No new npm packages — use existing hooks (`useIsMobile`, `useToast`, `apiCache`), contexts, and utilities only
- All user-visible strings must be Thai (no English copy in UI)
- `bun lint` and `tsc --noEmit` must pass after every task
- Branch: `feat/frontend-ui` (branch off `feat/dashboard`)
- Working directory for all commands: `Frontend/`
- Test runner: `bun test` (files must match `*.test.ts`)
- Do NOT read `.env` files

---

### Task 1: Replace `window.innerWidth` with `useIsMobile` in community pages

**Files:**
- Modify: `Frontend/app/community/page.tsx:67-69`
- Modify: `Frontend/app/community/manga/[mangaId]/page.tsx:69` (same pattern)

**Interfaces:**
- Consumes: `useIsMobile(): boolean` from `../hooks/useIsMobile`
- Produces: nothing (internal state change only)

- [ ] **Step 1: Apply fix to `community/page.tsx`**

Find and replace the one-shot `useEffect` (line 67–69):

```tsx
// BEFORE (line 67-69):
useEffect(() => {
  if (window.innerWidth < 768) setViewMode('compact');
}, []);

// AFTER — add import at top of file alongside other hook imports:
import { useIsMobile } from "../hooks/useIsMobile";

// Add inside CommunityContent() after existing state declarations:
const isMobile = useIsMobile();

// Replace the useEffect with:
useEffect(() => {
  if (isMobile) setViewMode('compact');
}, [isMobile]);
```

- [ ] **Step 2: Apply same fix to `community/manga/[mangaId]/page.tsx`**

Identical change — add `useIsMobile` import, add `const isMobile = useIsMobile();`, replace the `window.innerWidth` `useEffect`.

- [ ] **Step 3: Verify**

```bash
cd Frontend && tsc --noEmit && bun lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/community/page.tsx app/community/manga/[mangaId]/page.tsx
git commit -m "fix(community): replace window.innerWidth with useIsMobile hook"
```

---

### Task 2: Fix `closeModal` to reset full form state

**Files:**
- Modify: `Frontend/app/community/page.tsx:45-48`
- Modify: `Frontend/app/community/manga/[mangaId]/page.tsx` (same `closeModal`)

**Interfaces:**
- Consumes: `setNewPost`, `setSelectedManga`, `setPostImages` (existing state setters)
- Produces: nothing (bug fix, no interface change)

- [ ] **Step 1: Fix `closeModal` in `community/page.tsx`**

```tsx
// BEFORE (line 45-48):
const closeModal = useCallback(() => {
  setIsModalVisible(false);
  setTimeout(() => { setShowCreateModal(false); setPostImages([]); }, 220);
}, []);

// AFTER:
const closeModal = useCallback(() => {
  setIsModalVisible(false);
  setTimeout(() => {
    setShowCreateModal(false);
    setPostImages([]);
    setNewPost({ title: "", content: "", category: "general" as ForumCategory });
    setSelectedManga(null);
  }, 220);
}, []);
```

- [ ] **Step 2: Apply same fix to `community/manga/[mangaId]/page.tsx`**

Find the equivalent `closeModal` (it uses `setShowCreateModal(false); setPostImages([])` pattern without animation) and add the same two resets:

```tsx
// Find the close handler in manga/[mangaId]/page.tsx and add:
setNewPost({ title: "", content: "", category: "general" as ForumCategory });
setSelectedManga(null);
```

- [ ] **Step 3: Verify manually**

Run `bun dev`, open community page, start a post (type title + content), close modal with X button, reopen — fields must be empty.

- [ ] **Step 4: Commit**

```bash
git add app/community/page.tsx "app/community/manga/[mangaId]/page.tsx"
git commit -m "fix(community): reset full form state on modal close"
```

---

### Task 3: Export `CATEGORY_LIST` and use it in mobile strip

**Files:**
- Modify: `Frontend/app/lib/forumCategories.ts` (export `ALL_CATEGORIES` as `CATEGORY_LIST`)
- Modify: `Frontend/app/community/page.tsx:195` (use `CATEGORY_LIST` in mobile strip)
- Modify: `Frontend/app/community/manga/[mangaId]/page.tsx:244` (same)
- Modify: `Frontend/app/components/ForumSideMenu.tsx:31` (migrate to `CATEGORY_LIST`)
- Test: `Frontend/app/lib/forumCategories.test.ts`

**Interfaces:**
- Produces: `CATEGORY_LIST: readonly ForumCategory[]` exported from `forumCategories.ts`

- [ ] **Step 1: Write failing test**

Create `Frontend/app/lib/forumCategories.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { CATEGORY_LIST, availableCategories, isRestrictedCategory } from "./forumCategories";

describe("forumCategories", () => {
  it("CATEGORY_LIST contains all four categories", () => {
    expect(CATEGORY_LIST).toEqual(["general", "announcement", "spoiler", "manga_update"]);
  });

  it("CATEGORY_LIST is readonly (same reference every import)", () => {
    expect(Array.isArray(CATEGORY_LIST)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd Frontend && bun test app/lib/forumCategories.test.ts
```

Expected: `FAIL — CATEGORY_LIST is not exported`

- [ ] **Step 3: Export `CATEGORY_LIST` from `forumCategories.ts`**

```ts
// In Frontend/app/lib/forumCategories.ts, change:
const ALL_CATEGORIES: readonly ForumCategory[] = [
  "general",
  "announcement",
  "spoiler",
  "manga_update",
];

// To:
export const CATEGORY_LIST: readonly ForumCategory[] = [
  "general",
  "announcement",
  "spoiler",
  "manga_update",
];

// Update the two internal references from ALL_CATEGORIES to CATEGORY_LIST:
const RESTRICTED: ReadonlySet<ForumCategory> = new Set(["announcement", "manga_update"]);
// (availableCategories and isRestrictedCategory already reference ALL_CATEGORIES — update those too)
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
cd Frontend && bun test app/lib/forumCategories.test.ts
```

Expected: `2 pass`

- [ ] **Step 5: Migrate mobile strip in `community/page.tsx`**

Find the hardcoded array around line 195 (pattern: `['general', 'announcement', 'spoiler', 'manga_update']`). Add `CATEGORY_LIST` to the existing `forumCategories` import and use it:

```tsx
// In the import (already present at line 14):
import { availableCategories, isRestrictedCategory, CATEGORY_LIST } from "../lib/forumCategories";

// Replace the hardcoded array in the mobile strip map:
// BEFORE: {['general', 'announcement', 'spoiler', 'manga_update'].map(cat => ...)}
// AFTER:  {CATEGORY_LIST.map(cat => ...)}
```

- [ ] **Step 6: Apply same migration to `manga/[mangaId]/page.tsx:244` and `ForumSideMenu.tsx:31`**

Same pattern — import `CATEGORY_LIST` and replace the hardcoded array.

- [ ] **Step 7: Verify**

```bash
cd Frontend && bun test app/lib/forumCategories.test.ts && tsc --noEmit
```

Expected: `2 pass`, no TS errors.

- [ ] **Step 8: Commit**

```bash
git add app/lib/forumCategories.ts app/lib/forumCategories.test.ts \
  app/community/page.tsx "app/community/manga/[mangaId]/page.tsx" \
  app/components/ForumSideMenu.tsx
git commit -m "refactor(community): export CATEGORY_LIST and use it in all three category strip locations"
```

---

### Task 4: Add `useToast` error handling + `CommunityErrorBoundary`

**Files:**
- Create: `Frontend/app/community/components/CommunityErrorBoundary.tsx`
- Modify: `Frontend/app/community/page.tsx:84` (add `useToast`)
- Modify: `Frontend/app/community/trending/page.tsx:82-85` (add `useToast` + `AbortController` + `apiCache`)

**Interfaces:**
- Consumes: `useToast` from `../../contexts/ToastContext`, `apiCache`/`TTL` from `../../lib/apiCache`
- Produces: `CommunityErrorBoundary` (React class component, wraps children)

- [ ] **Step 1: Create `CommunityErrorBoundary.tsx`**

```tsx
"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class CommunityErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-4 py-20 text-white/60">
          <p className="text-lg">เกิดข้อผิดพลาด</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          >
            โหลดใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap community page content with `CommunityErrorBoundary`**

In `community/page.tsx`, import `CommunityErrorBoundary` and wrap the `<Suspense>` block:

```tsx
import { CommunityErrorBoundary } from "./components/CommunityErrorBoundary";

// In the return JSX, wrap:
<CommunityErrorBoundary>
  <Suspense fallback={...}>
    <CommunityContent />
  </Suspense>
</CommunityErrorBoundary>
```

- [ ] **Step 3: Add `useToast` to `fetchPosts` error path**

```tsx
// Add import inside CommunityContent:
const { showToast } = useToast();

// Replace the catch block (line 84):
// BEFORE:
} catch (err) {
  console.error(err);
}

// AFTER:
} catch {
  showToast({ type: "error", message: "โหลดโพสต์ไม่สำเร็จ กรุณาลองใหม่", duration: 4000 });
}
```

- [ ] **Step 4: Add `useToast` + `AbortController` + cache to `trending/page.tsx`**

```tsx
// Add imports:
import { useToast } from "../../contexts/ToastContext";
import { apiCache, TTL } from "../../lib/apiCache";

// Inside the component, replace the fetch useEffect:
const { showToast } = useToast();

useEffect(() => {
  const cached = apiCache.get<LandingBook[]>("community:trending");
  if (cached) { setManga(cached); setLoading(false); return; }

  const controller = new AbortController();
  setLoading(true);

  getTrendingManga(20)
    .then((items) => {
      if (controller.signal.aborted) return;
      apiCache.set("community:trending", items, TTL.MEDIUM);
      setManga(items);
    })
    .catch(() => {
      if (controller.signal.aborted) return;
      showToast({ type: "error", message: "โหลดมังงะ trending ไม่สำเร็จ", duration: 4000 });
    })
    .finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

  return () => controller.abort();
}, [showToast]);
```

- [ ] **Step 5: Verify**

```bash
cd Frontend && tsc --noEmit && bun lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/community/components/CommunityErrorBoundary.tsx \
  app/community/page.tsx app/community/trending/page.tsx
git commit -m "fix(community): add useToast error handling and CommunityErrorBoundary"
```

---

### Task 5: Mobile drawer accessibility

**Files:**
- Modify: `Frontend/app/community/layout.tsx:49-78`

**Interfaces:**
- Consumes: `useEffect`, `useRef` (already imported)
- Produces: accessible drawer (no interface change)

- [ ] **Step 1: Add `role`, `aria-modal`, focus management, and Escape key to the drawer**

Read `community/layout.tsx` lines 40–90 first to find the exact drawer JSX. Then apply:

```tsx
// 1. Add a ref to the drawer container for focus management:
const drawerRef = useRef<HTMLDivElement>(null);

// 2. In the useEffect that handles toggleMobileMenu, after setMenuOpen(true):
useEffect(() => {
  if (menuOpen) {
    // Move focus into drawer
    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
  }
}, [menuOpen]);

// 3. Add Escape key handler:
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && menuOpen) setMenuOpen(false);
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [menuOpen]);

// 4. Add attributes to the drawer div:
// BEFORE: <div className="fixed inset-y-0 left-0 z-50 ...">
// AFTER:
<div
  ref={drawerRef}
  role="dialog"
  aria-modal="true"
  aria-label="เมนู"
  className="fixed inset-y-0 left-0 z-50 ..."
>
```

- [ ] **Step 2: Verify**

```bash
cd Frontend && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/community/layout.tsx
git commit -m "fix(community): add focus trap, role=dialog, and Escape key to mobile drawer"
```

---

### Task 6: Quick fixes — dead button, Thai copy, trending cache polish

**Files:**
- Modify: `Frontend/app/components/ForumSideMenu.tsx:258` (dead button)
- Modify: `Frontend/app/components/ForumSideMenu.tsx:271-273` (English strings)

**Interfaces:**
- Consumes: `useRouter` from `next/navigation` (already imported in ForumSideMenu or add it)
- Produces: nothing (UX fixes)

- [ ] **Step 1: Fix "See All Communities" dead button**

```tsx
// In ForumSideMenu.tsx, add router if not present:
import { useRouter } from "next/navigation";
const router = useRouter();

// Find the button around line 258 and add onClick:
// BEFORE:
<button className="...text-indigo-400/60 hover:text-indigo-400...">
  See All Communities
</button>

// AFTER:
<button
  className="...text-indigo-400/60 hover:text-indigo-400..."
  onClick={() => router.push("/community/trending")}
>
  ดูทั้งหมด
</button>
```

- [ ] **Step 2: Translate community rules to Thai**

```tsx
// BEFORE (line 271-273):
{["Respect others", "No spoilers", "No spam"].map(...)}

// AFTER:
{["เคารพซึ่งกันและกัน", "ไม่สปอย", "ไม่สแปม"].map(...)}
```

- [ ] **Step 3: Verify**

```bash
cd Frontend && tsc --noEmit && bun lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/ForumSideMenu.tsx
git commit -m "fix(community): wire See All Communities button and translate rules to Thai"
```
