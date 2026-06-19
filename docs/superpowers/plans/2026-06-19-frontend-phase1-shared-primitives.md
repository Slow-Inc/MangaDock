# Frontend Phase 1: Shared Primitives (Auth Headers · Protected Page · Loading Screen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-frequency, lowest-risk duplication in `Frontend/` — copy-pasted auth-header construction (4 files), the auth-guard redirect effect (3 studio pages), and the loading-spinner early-return (3 studio pages) — by extracting three shared primitives, with zero behavior change.

**Architecture:** Three small, focused modules. `app/lib/apiUtils.ts` holds two pure functions (`createAuthHeaders`, `parseErrorResponse`) that replace four inline copies. `app/hooks/useProtectedPage.ts` wraps `useAuth()` + the redirect-on-logout effect. `app/components/LoadingScreen.tsx` is the shared full-screen spinner. Every adopting file keeps identical runtime behavior; the only pure-unit-tested piece is `apiUtils.ts` (the others are thin React wrappers verified by lint + build + manual run).

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Bun (runtime + `bun test`), ESLint 9 (`eslint-config-next`). No new dependencies.

## Global Constraints

- **No new dependencies.** devDependencies and dependencies in `Frontend/package.json` stay exactly as they are.
- **Zero behavior change.** Every task is a behavior-preserving refactor. Runtime HTTP requests, headers, redirect timing, and rendered DOM must be byte-identical to today.
- **All paths are relative to `Frontend/`.** Run all commands from `C:\Users\somchai\Desktop\MangaDock\Frontend`.
- **Build is the typecheck gate.** `tsconfig.json` excludes `*.test.ts`, so test files are run only by `bun test`, never by `next build`.
- **Match surrounding style:** every client file starts with `"use client";`, named exports, 2-space indent, double-quoted strings.
- **Verification commands** (exact): `bun test <file>` for unit tests, `bun run lint` for ESLint, `bun run build` for typecheck+compile. NOTE: use `bun run build` / `bun run lint` (the npm-style scripts) — **not** `bun build` (that invokes Bun's own bundler, which is wrong here).
- **Branch:** do not commit on `main`. Before Task 1, create and switch to `refactor/frontend-phase1-shared-primitives`.

---

## File Structure

| File | Responsibility | Created/Modified |
|------|----------------|------------------|
| `app/lib/apiUtils.ts` | Pure helpers: `createAuthHeaders(token?, extra?)`, `parseErrorResponse(res)` | Create |
| `app/lib/apiUtils.test.ts` | `bun:test` unit tests for both helpers | Create |
| `app/lib/communityApi.ts` | Forum API — drop local `authHeaders`, use `createAuthHeaders` | Modify |
| `app/lib/studioApi.ts` | Studio API — drop local `authHeaders` + `parseErrorMessage`, use shared | Modify |
| `app/lib/userCache.ts` | Favorites/liked sync — inline headers → `createAuthHeaders` | Modify |
| `app/lib/readingHistory.ts` | History sync — inline headers → `createAuthHeaders` | Modify |
| `app/hooks/useProtectedPage.ts` | `useAuth()` + redirect-to-`/`-when-logged-out effect | Create |
| `app/components/LoadingScreen.tsx` | Full-screen centered spinner | Create |
| `app/studio/account/page.tsx` | Adopt `useProtectedPage` + `<LoadingScreen />` | Modify |
| `app/studio/wallet/page.tsx` | Adopt `useProtectedPage` + `<LoadingScreen />` | Modify |
| `app/studio/works/page.tsx` | Adopt `useProtectedPage` + `<LoadingScreen />` | Modify |

**Out of scope (deferred, with rationale):**
- `useAuthenticatedData<T>` hook — studio pages use `studioCache` (`getCached`/`setCache`), not `apiCache`, and each fetcher writes multiple `useState`s + multiple cache keys with different user-gating (`account`/`wallet`/`works` gate on `user`; `studio/page.tsx` does not). A generic hook would force rewriting working, heterogeneous code for little clarity gain — violates the North Star. Revisit only when those pages are individually decomposed.
- `studio/page.tsx` (overview) is **not** in the `useProtectedPage` set — it has no redirect guard today; do not add one.

---

## Task 0: Branch setup

- [ ] **Step 1: Create and switch to the feature branch**

Run (from `Frontend/` or repo root — git is repo-wide):
```bash
git checkout -b refactor/frontend-phase1-shared-primitives
```
Expected: `Switched to a new branch 'refactor/frontend-phase1-shared-primitives'`

---

## Task 1: Create `apiUtils.ts` with pure helpers (TDD)

**Files:**
- Create: `app/lib/apiUtils.ts`
- Test: `app/lib/apiUtils.test.ts`

**Interfaces:**
- Consumes: nothing (standalone, only the global `Response`).
- Produces:
  - `createAuthHeaders(token?: string | null, extra?: Record<string, string>): Record<string, string>` — returns a headers object; adds `Authorization: Bearer <token>` only when `token` is truthy; merges `extra` first.
  - `parseErrorResponse(res: Response): Promise<string>` — reads body text; if JSON with `message` (string or string[]) or `error` (string), returns that; else returns the raw body, or `HTTP <status>` when body is empty.

- [ ] **Step 1: Write the failing test**

Create `app/lib/apiUtils.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { createAuthHeaders, parseErrorResponse } from "./apiUtils";

describe("createAuthHeaders", () => {
  test("adds Bearer Authorization when token is present", () => {
    expect(createAuthHeaders("abc")).toEqual({ Authorization: "Bearer abc" });
  });

  test("omits Authorization when token is null/undefined/empty", () => {
    expect(createAuthHeaders(null)).toEqual({});
    expect(createAuthHeaders(undefined)).toEqual({});
    expect(createAuthHeaders("")).toEqual({});
  });

  test("merges extra headers and keeps Authorization", () => {
    expect(createAuthHeaders("abc", { "Content-Type": "application/json" })).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer abc",
    });
  });

  test("returns extra headers only when no token", () => {
    expect(createAuthHeaders(null, { "Content-Type": "application/json" })).toEqual({
      "Content-Type": "application/json",
    });
  });
});

describe("parseErrorResponse", () => {
  test("extracts string message from JSON body", async () => {
    const res = new Response(JSON.stringify({ message: "Bad input" }), { status: 400 });
    expect(await parseErrorResponse(res)).toBe("Bad input");
  });

  test("joins array message from JSON body", async () => {
    const res = new Response(JSON.stringify({ message: ["a", "b"] }), { status: 400 });
    expect(await parseErrorResponse(res)).toBe("a, b");
  });

  test("falls back to error field", async () => {
    const res = new Response(JSON.stringify({ error: "Nope" }), { status: 403 });
    expect(await parseErrorResponse(res)).toBe("Nope");
  });

  test("returns raw text when body is not JSON", async () => {
    const res = new Response("plain text error", { status: 500 });
    expect(await parseErrorResponse(res)).toBe("plain text error");
  });

  test("returns HTTP <status> when body is empty", async () => {
    const res = new Response("", { status: 502 });
    expect(await parseErrorResponse(res)).toBe("HTTP 502");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test app/lib/apiUtils.test.ts`
Expected: FAIL — module `./apiUtils` not found (cannot resolve import).

- [ ] **Step 3: Write the minimal implementation**

Create `app/lib/apiUtils.ts`:
```ts
/**
 * Shared HTTP helpers. Pure, dependency-light, unit-tested in apiUtils.test.ts.
 * Replaces the per-file authHeaders/parseErrorMessage copies in
 * communityApi.ts, studioApi.ts, userCache.ts, readingHistory.ts.
 */

export function createAuthHeaders(
  token?: string | null,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function parseErrorResponse(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const json = JSON.parse(body) as { message?: string | string[]; error?: string };
    if (Array.isArray(json?.message)) return json.message.join(", ");
    if (typeof json?.message === "string") return json.message;
    if (typeof json?.error === "string") return json.error;
  } catch {
    // body is not JSON — fall through
  }
  return body || `HTTP ${res.status}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test app/lib/apiUtils.test.ts`
Expected: PASS — 11 tests pass (4 `createAuthHeaders` + 6 `parseErrorResponse` assertions across the test cases; bun reports per-`test()`, so 9 tests pass).

- [ ] **Step 5: Lint the new files**

Run: `bun run lint`
Expected: no errors for `app/lib/apiUtils.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/lib/apiUtils.ts app/lib/apiUtils.test.ts
git commit -m "feat(frontend): add shared apiUtils (createAuthHeaders, parseErrorResponse)"
```

---

## Task 2: Adopt `apiUtils` in `communityApi.ts` and `studioApi.ts`

**Files:**
- Modify: `app/lib/communityApi.ts`
- Modify: `app/lib/studioApi.ts`

**Interfaces:**
- Consumes: `createAuthHeaders`, `parseErrorResponse` from Task 1.
- Produces: no public API change — all exported function signatures stay identical.

- [ ] **Step 1: Update `communityApi.ts` imports**

At the top of `app/lib/communityApi.ts`, add the import after the existing `apiCache` import (line 3):
```ts
import { createAuthHeaders } from "./apiUtils";
```

- [ ] **Step 2: Delete the local `authHeaders` helper in `communityApi.ts`**

Remove these lines (currently lines 12–16):
```ts
function authHeaders(token: string | null, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}
```
(Keep the `getAuthToken` helper above it — it is unrelated.)

- [ ] **Step 3: Replace all `authHeaders(` call sites in `communityApi.ts`**

Replace every `authHeaders(` with `createAuthHeaders(`. There are call sites in `listPosts`, `getPost`, `createPost`, `listComments`, `createComment`, `updateBannerPosition`, `getProfile`, `deletePost`, `deleteComment`, `updatePost`, `updateComment`, `vote`. The argument lists are unchanged, e.g.:
```ts
// before
headers: authHeaders(token),
// after
headers: createAuthHeaders(token),
```
```ts
// before
headers: authHeaders(token, { "Content-Type": "application/json" }),
// after
headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
```
Also replace the two raw inline header objects in `uploadForumImage` (line 97) and `uploadProfileBanner` (line 177):
```ts
// before
headers: { Authorization: `Bearer ${token}` },
// after
headers: createAuthHeaders(token),
```

- [ ] **Step 4: Update `studioApi.ts` imports**

At the top of `app/lib/studioApi.ts`, add after the existing `apiCache` import (line 3):
```ts
import { createAuthHeaders, parseErrorResponse } from "./apiUtils";
```

- [ ] **Step 5: Delete local `authHeaders` and `parseErrorMessage` in `studioApi.ts`**

Remove the local `parseErrorMessage` function (currently lines 46–57) and the local `authHeaders` function (currently lines 71–76).

- [ ] **Step 6: Update `apiFetch` and all call sites in `studioApi.ts`**

In `apiFetch` (currently lines 59–69), replace `parseErrorMessage(res)` with `parseErrorResponse(res)`:
```ts
// before
const message = await parseErrorMessage(res);
// after
const message = await parseErrorResponse(res);
```
Then replace every remaining `authHeaders(` call in the file with `createAuthHeaders(` (same argument lists). These appear in the studio API functions defined below line 100 (e.g. `getMyProfile`, `updateTranslatorProfile`, `getMyVersions`, `getWalletBalance`, `getWalletTransactions`, `getCreatorEarnings`, topup/purchase functions). Do not change any arguments.

- [ ] **Step 7: Verify lint passes (catches any missed reference)**

Run: `bun run lint`
Expected: no errors. An unconverted `authHeaders(` or `parseErrorMessage(` would now be an "undefined" reference — lint/build must be clean.

- [ ] **Step 8: Verify the build typechecks and compiles**

Run: `bun run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add app/lib/communityApi.ts app/lib/studioApi.ts
git commit -m "refactor(frontend): use shared createAuthHeaders/parseErrorResponse in community + studio API"
```

---

## Task 3: Adopt `createAuthHeaders` in `userCache.ts` and `readingHistory.ts`

**Files:**
- Modify: `app/lib/userCache.ts`
- Modify: `app/lib/readingHistory.ts`

**Interfaces:**
- Consumes: `createAuthHeaders` from Task 1.
- Produces: no public API change.

- [ ] **Step 1: Import `createAuthHeaders` in `userCache.ts`**

Add to the top imports of `app/lib/userCache.ts`:
```ts
import { createAuthHeaders } from "./apiUtils";
```

- [ ] **Step 2: Replace inline headers in `userCache.ts` (`flush`)**

In `flush()` (currently lines 90–93), replace:
```ts
const headers: HeadersInit = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};
```
with:
```ts
const headers = createAuthHeaders(token, { "Content-Type": "application/json" });
```

- [ ] **Step 3: Replace inline headers in `userCache.ts` (`loadUserData`)**

In `loadUserData()` (currently line 159), replace:
```ts
const headers: HeadersInit = { Authorization: `Bearer ${token}` };
```
with:
```ts
const headers = createAuthHeaders(token);
```

- [ ] **Step 4: Import `createAuthHeaders` in `readingHistory.ts`**

Add to the top imports of `app/lib/readingHistory.ts`:
```ts
import { createAuthHeaders } from "./apiUtils";
```

- [ ] **Step 5: Replace inline headers in `readingHistory.ts` (`flushToServer`)**

In `flushToServer()` (currently lines 134–137), replace:
```ts
const headers: HeadersInit = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};
```
with:
```ts
const headers = createAuthHeaders(token, { "Content-Type": "application/json" });
```

- [ ] **Step 6: Replace inline headers in `readingHistory.ts` (`loadHistoryData`)**

In `loadHistoryData()` (currently lines 173–175), replace:
```ts
const res = await fetch(`${API_BASE}/users/me/history`, {
  headers: { Authorization: `Bearer ${token}` },
});
```
with:
```ts
const res = await fetch(`${API_BASE}/users/me/history`, {
  headers: createAuthHeaders(token),
});
```

- [ ] **Step 7: Verify lint + build**

Run: `bun run lint`
Expected: no errors.
Run: `bun run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add app/lib/userCache.ts app/lib/readingHistory.ts
git commit -m "refactor(frontend): use shared createAuthHeaders in userCache + readingHistory"
```

---

## Task 4: Create `useProtectedPage` hook and adopt in studio pages

**Files:**
- Create: `app/hooks/useProtectedPage.ts`
- Modify: `app/studio/account/page.tsx`
- Modify: `app/studio/wallet/page.tsx`
- Modify: `app/studio/works/page.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `app/contexts/AuthContext` (returns at least `{ user, loading, getIdToken, userRole }`), `useRouter()` from `next/navigation`.
- Produces: `useProtectedPage(): ReturnType<typeof useAuth>` — calls `useAuth()`, runs a redirect-to-`/` effect when `!loading && !user`, and returns the full auth object so callers keep destructuring `user`, `loading`, `getIdToken`, `userRole` exactly as before.

> No unit test: this is a thin React hook and the repo has no React test harness (adding one would pull in new deps — out of scope). Verification is lint + build + manual run.

- [ ] **Step 1: Create the hook**

Create `app/hooks/useProtectedPage.ts`:
```ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

/**
 * Auth-gated page helper: returns the full auth context and redirects to "/"
 * once auth has resolved (`!loading`) and there is no signed-in user.
 * Replaces the copy-pasted `useEffect(() => { if (!loading && !user) router.replace("/") })`
 * in studio account/wallet/works pages.
 */
export function useProtectedPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) router.replace("/");
  }, [auth.loading, auth.user, router]);

  return auth;
}
```

- [ ] **Step 2: Adopt in `account/page.tsx`**

In `app/studio/account/page.tsx`:
- Add import (near the other hook imports, e.g. after the `useIsMobile` import on line 23):
```ts
import { useProtectedPage } from "../../hooks/useProtectedPage";
```
- Replace the auth line (currently line 66):
```ts
// before
const { user, loading, getIdToken } = useAuth();
// after
const { user, loading, getIdToken } = useProtectedPage();
```
- Delete the redirect effect (currently lines 96–98):
```ts
useEffect(() => {
  if (!loading && !user) router.replace("/");
}, [loading, user, router]);
```
- Remove the now-unused `useAuth` import (line 7) **only if** `useAuth` is no longer referenced anywhere else in the file. Remove the `const router = useRouter();` declaration (line 65) and the `useRouter` import (line 5) **only if** `router` is no longer referenced elsewhere. (Lint will flag unused imports/vars — let it guide you.)

- [ ] **Step 3: Adopt in `wallet/page.tsx`**

In `app/studio/wallet/page.tsx`:
- Add import:
```ts
import { useProtectedPage } from "../../hooks/useProtectedPage";
```
- Replace the auth line (currently line 149):
```ts
// before
const { user, loading, getIdToken, userRole } = useAuth();
// after
const { user, loading, getIdToken, userRole } = useProtectedPage();
```
- Delete the redirect effect (currently lines 165–167):
```ts
useEffect(() => {
  if (!loading && !user) router.replace("/");
}, [loading, user, router]);
```
- Remove `useAuth` import, `const router = useRouter();` (line 148), and `useRouter` import — each only if now unused (lint will flag).

- [ ] **Step 4: Adopt in `works/page.tsx`**

In `app/studio/works/page.tsx`:
- Add import:
```ts
import { useProtectedPage } from "../../hooks/useProtectedPage";
```
- Replace the auth line (currently line 138):
```ts
// before
const { user, loading, getIdToken } = useAuth();
// after
const { user, loading, getIdToken } = useProtectedPage();
```
- Delete the redirect effect (currently line 158):
```ts
useEffect(() => { if (!loading && !user) router.replace("/"); }, [loading, user, router]);
```
- Remove `useAuth` import, `const router = useRouter();` (line 137), and `useRouter` import — each only if now unused (lint will flag). NOTE: `works/page.tsx` uses `<Link>` from `next/link`, which is separate — do not remove that.

- [ ] **Step 5: Verify lint + build**

Run: `bun run lint`
Expected: no errors, no unused-variable warnings for `router`/`useAuth`/`useRouter`.
Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification (behavior unchanged)**

Run: `bun dev` (then open http://localhost:4000)
- Visit `/studio/account`, `/studio/wallet`, `/studio/works` **while logged out** → each must redirect to `/`.
- Log in, revisit each → page loads normally, data fetches.
Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add app/hooks/useProtectedPage.ts app/studio/account/page.tsx app/studio/wallet/page.tsx app/studio/works/page.tsx
git commit -m "refactor(frontend): extract useProtectedPage hook for studio auth-gated pages"
```

---

## Task 5: Create `<LoadingScreen />` and adopt in studio pages

**Files:**
- Create: `app/components/LoadingScreen.tsx`
- Modify: `app/studio/account/page.tsx`
- Modify: `app/studio/wallet/page.tsx`
- Modify: `app/studio/works/page.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `LoadingScreen` (default export) — renders the full-screen centered spinner currently inlined in the three studio pages.

> No unit test (presentational component, no React test harness). Verify by lint + build + visual check.

- [ ] **Step 1: Create the component**

Create `app/components/LoadingScreen.tsx`:
```tsx
/**
 * Full-screen centered spinner shown while a page's auth/data is resolving.
 * Markup is identical to the early-return blocks previously inlined in
 * studio account/wallet/works pages.
 */
export default function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}
```

- [ ] **Step 2: Adopt in `account/page.tsx`**

In `app/studio/account/page.tsx`:
- Add import (with the other component imports, e.g. after the `Navbar` import on line 6):
```ts
import LoadingScreen from "../../components/LoadingScreen";
```
- Replace the loading early-return block (currently lines 219–225):
```tsx
if (loading) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}
```
with:
```tsx
if (loading) return <LoadingScreen />;
```

- [ ] **Step 3: Adopt in `wallet/page.tsx`**

In `app/studio/wallet/page.tsx`:
- Add import:
```ts
import LoadingScreen from "../../components/LoadingScreen";
```
- Locate the auth-loading early-return block (search for the exact string `min-h-dvh items-center justify-center bg-[#141414]`). Replace the full matching `if (loading) { return ( <div ...> <div ... /> </div> ); }` block with:
```tsx
if (loading) return <LoadingScreen />;
```

- [ ] **Step 4: Adopt in `works/page.tsx`**

In `app/studio/works/page.tsx`:
- Add import:
```ts
import LoadingScreen from "../../components/LoadingScreen";
```
- Locate the auth-loading early-return block (search for `min-h-dvh items-center justify-center bg-[#141414]`). Replace the full matching block with:
```tsx
if (loading) return <LoadingScreen />;
```
NOTE: only replace the block whose spinner matches the markup in Step 1 exactly. If a page has a different skeleton (e.g. `StudioWorksSkeleton`) for its data-loading state, leave that untouched — this task only replaces the full-screen auth-loading spinner.

- [ ] **Step 5: Verify lint + build**

Run: `bun run lint`
Expected: no errors.
Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification**

Run: `bun dev`
- Load `/studio/account`, `/studio/wallet`, `/studio/works` with a logged-in account and a throttled/slow network (or hard refresh) → the centered spinner appears briefly, identical to before, then the page renders.
Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add app/components/LoadingScreen.tsx app/studio/account/page.tsx app/studio/wallet/page.tsx app/studio/works/page.tsx
git commit -m "refactor(frontend): extract LoadingScreen component for studio pages"
```

---

## Final Verification

- [ ] **Step 1: Full clean build**

Run: `bun run build`
Expected: succeeds with no errors.

- [ ] **Step 2: Full lint**

Run: `bun run lint`
Expected: no errors.

- [ ] **Step 3: Unit tests**

Run: `bun test app/lib/apiUtils.test.ts`
Expected: all pass.

- [ ] **Step 4: Notify developer**

Run:
```bash
pwsh -NoProfile -File scripts/notify.ps1 -Message "Frontend Phase 1 refactor done: apiUtils + useProtectedPage + LoadingScreen, build+lint+tests green"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** Phase 1 scope = (a) shared auth headers → Tasks 1–3; (b) `useProtectedPage` → Task 4; (c) `<LoadingScreen>` → Task 5. `parseErrorResponse` (the studioApi error parser) folded into Task 1/2 since it shares the same extraction. `useAuthenticatedData` explicitly deferred with rationale. ✓
- **Placeholders:** none — every code step shows full content; no "add error handling"/"similar to". ✓
- **Type consistency:** `createAuthHeaders(token?: string | null, extra?: Record<string,string>): Record<string,string>` and `parseErrorResponse(res: Response): Promise<string>` are used with identical names/signatures in Tasks 2–3. `useProtectedPage()` returns the `useAuth()` object, matching the existing destructures (`user`, `loading`, `getIdToken`, `userRole`). `LoadingScreen` is a default export, imported as `import LoadingScreen`. ✓
- **Behavior preservation:** `createAuthHeaders` reproduces the exact `if (token) Authorization` logic from `communityApi.authHeaders`; `parseErrorResponse` is a verbatim port of `studioApi.parseErrorMessage`; `LoadingScreen` markup is copied byte-for-byte. ✓
