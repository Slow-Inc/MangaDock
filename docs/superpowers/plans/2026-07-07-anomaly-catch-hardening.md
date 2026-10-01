# Anomaly-Catch Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three verified bugs where an anomalous-but-reachable HTTP response makes production code throw or silently mask a failure, in the Frontend and Backend only.

**Architecture:** Extract the fragile response-parsing logic out of large stateful files (`AuthContext.tsx`, `userCache.ts`, `readingHistory.ts`) into two small, pure, dependency-light helper modules that can be unit-tested against real `Response` objects (North Star: "extract for testability when it pays off"). The Backend fix is a surgical in-place change plus one spec. No new runtime dependencies.

**Tech Stack:** Next.js 16 / React 19 (Frontend, tests via `bun:test`), NestJS 11 (Backend, tests via Jest).

## Global Constraints

- Engineering North Star: simplest logic that works, surgical changes, no new dependencies. Touch only the parsing seams named below.
- Frontend unit tests use `bun:test` (`import { describe, expect, test } from "bun:test"`) and live next to the file as `*.test.ts` (excluded from tsconfig).
- Backend unit tests use Jest; run a single spec with `npx jest <path> --no-coverage`.
- User-facing error copy stays Thai (matches existing strings in `AuthContext.tsx`).
- No behavior change on the happy path — only anomalous responses change from "throw / silent mask" to "graceful null / friendly error / logged warning".

**Verified scope (do not re-litigate):**
- FALSE POSITIVE — discarded: `Backend/src/cache/cache-orchestrator.service.ts:26` "dead cross-node invalidation". The caller double-stringifies (`set()` line 113 + `RedisService.publish` line 258) which balances the double-parse (subscriber line 237 + handler line 31). The handler works. **No task.**
- OUT OF SCOPE — latent, tracked as follow-ups at the end of this plan: proxy `content-encoding` forwarding (`Frontend/app/api/proxy/[...path]/route.ts:55`) and `proxyImage` client-disconnect handling (`Backend/src/books/books.controller.ts:394`).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `Frontend/app/lib/safeJson.ts` | Parse a `Response` body as a JSON array, collapsing empty/non-JSON/non-array anomalies into `null`. | Create |
| `Frontend/app/lib/safeJson.test.ts` | Unit tests for `parseJsonArray`. | Create |
| `Frontend/app/lib/userCache.ts` | Consume `parseJsonArray` for the favorites/liked sync. | Modify (~line 166–167, +import) |
| `Frontend/app/lib/readingHistory.ts` | Consume `parseJsonArray` for history load + chapter backfill. | Modify (line 105, line 176, +import) |
| `Frontend/app/lib/avatarUpload.ts` | Resolve the avatar URL from the upload response, turning every anomaly into a friendly Thai `Error`. | Create |
| `Frontend/app/lib/avatarUpload.test.ts` | Unit tests for `resolveAvatarUrl`. | Create |
| `Frontend/app/contexts/AuthContext.tsx` | Consume `resolveAvatarUrl` in `uploadProfilePhoto`. | Modify (line 623–629, +import) |
| `Backend/src/forum/forum.service.ts` | Log secondary-query errors in `getPublicProfile` instead of masking them. | Modify (after line 247) |
| `Backend/src/forum/forum.service.spec.ts` | Spec proving the warning fires. | Modify (append describe block) |

---

## Task 1: Frontend — guard JSON-array parsing (userCache + readingHistory)

**Bug:** `userCache.ts:166-167`, `readingHistory.ts:176` and `readingHistory.ts:105` call `await res.json()` after only checking `res.ok`. A backend 200 with an empty/non-JSON body throws `SyntaxError`; a valid-JSON-but-not-array body makes the following `.map`/`.filter` throw `TypeError`. Both are swallowed by the enclosing `catch { /* ignore */ }`, so favorites / reading history silently never load, with no log and no signal.

**Files:**
- Create: `Frontend/app/lib/safeJson.ts`
- Test: `Frontend/app/lib/safeJson.test.ts`
- Modify: `Frontend/app/lib/userCache.ts` (line 166–167, add import at top)
- Modify: `Frontend/app/lib/readingHistory.ts` (line 176, line 105, add import at top)

**Interfaces:**
- Produces: `export async function parseJsonArray<T>(res: Response): Promise<T[] | null>` — returns the parsed array, or `null` if the body is missing, malformed, or not a JSON array.

- [ ] **Step 1: Write the failing test**

Create `Frontend/app/lib/safeJson.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { parseJsonArray } from "./safeJson";

describe("parseJsonArray", () => {
  test("returns the array for a valid JSON array body", async () => {
    const res = new Response(JSON.stringify([{ id: "a" }, { id: "b" }]), { status: 200 });
    expect(await parseJsonArray<{ id: string }>(res)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("returns null for an empty body (would throw SyntaxError)", async () => {
    const res = new Response("", { status: 200 });
    expect(await parseJsonArray(res)).toBeNull();
  });

  test("returns null for a non-JSON body", async () => {
    const res = new Response("<html>oops</html>", { status: 200 });
    expect(await parseJsonArray(res)).toBeNull();
  });

  test("returns null when the JSON body is an object, not an array", async () => {
    const res = new Response(JSON.stringify({ message: "not an array" }), { status: 200 });
    expect(await parseJsonArray(res)).toBeNull();
  });

  test("returns null when the JSON body is literal null", async () => {
    const res = new Response("null", { status: 200 });
    expect(await parseJsonArray(res)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/lib/safeJson.test.ts`
Expected: FAIL — `Cannot find module './safeJson'` (module does not exist yet).

- [ ] **Step 3: Create the helper**

Create `Frontend/app/lib/safeJson.ts`:

```ts
/**
 * Parse a fetch Response body as a JSON array, tolerating anomalous responses.
 *
 * A backend that returns HTTP 200 with an empty or non-JSON body makes
 * `res.json()` throw `SyntaxError`, and a body that is valid JSON but not an
 * array makes downstream `.map`/`.filter` throw `TypeError`. At the call sites
 * both are swallowed by a `catch { /* ignore *\/ }`, so the data load silently
 * never happens. This helper collapses both anomalies into a single `null`
 * return the caller can branch on.
 *
 * @returns the parsed array, or `null` if the body is missing, malformed, or
 *          not a JSON array.
 */
export async function parseJsonArray<T>(res: Response): Promise<T[] | null> {
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? (data as T[]) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/lib/safeJson.test.ts`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Wire into `userCache.ts`**

Add the import near the top of `Frontend/app/lib/userCache.ts` (it already imports `createAuthHeaders` from `./apiUtils`; add beside it):

```ts
import { parseJsonArray } from "./safeJson";
```

Replace lines 166–167:

```ts
    const remoteFavs: CachedBook[] = await favRes.json();
    const remoteLiked: string[] = await likedRes.json();
```

with:

```ts
    const remoteFavs = await parseJsonArray<CachedBook>(favRes);
    const remoteLiked = await parseJsonArray<string>(likedRes);
    if (!remoteFavs || !remoteLiked) return;
```

- [ ] **Step 6: Wire into `readingHistory.ts`**

Add the import near the top of `Frontend/app/lib/readingHistory.ts` (beside its existing `createAuthHeaders` import):

```ts
import { parseJsonArray } from "./safeJson";
```

Replace line 176:

```ts
    const remote: HistoryBook[] = await res.json();
```

with:

```ts
    const remote = await parseJsonArray<HistoryBook>(res);
    if (!remote) return;
```

Replace line 105:

```ts
        const chapters: { id: string; chapterNumber: string | null }[] = await res.json();
```

with:

```ts
        const chapters = await parseJsonArray<{ id: string; chapterNumber: string | null }>(res);
        if (!chapters) return;
```

- [ ] **Step 7: Verify the whole Frontend lib suite + types are green**

Run: `cd Frontend && bun test app/lib/ && bun run lint`
Expected: all `app/lib` tests pass (including the new `safeJson.test.ts`); lint clean. `remoteFavs`/`remote`/`chapters` are now non-null past the guards, so `.map`/`.find` calls type-check.

- [ ] **Step 8: Commit**

```bash
git add Frontend/app/lib/safeJson.ts Frontend/app/lib/safeJson.test.ts Frontend/app/lib/userCache.ts Frontend/app/lib/readingHistory.ts
git commit -m "fix(frontend): guard JSON-array parsing in user/history sync (parseJsonArray)"
```

---

## Task 2: Frontend — guard avatar upload response parsing

**Bug:** `AuthContext.tsx:627-629` (`uploadProfilePhoto`) calls `await res.json()` on the success path with no guard (unlike the error path at line 624 which uses `.catch(() => ({}))`). A 200 with an empty/non-JSON body throws `SyntaxError`; a 200 whose body lacks a string `url` makes `data.url` `undefined`, so `url.startsWith` throws `TypeError: Cannot read properties of undefined (reading 'startsWith')`. Either propagates to the avatar-upload UI as a cryptic crash even though the upload actually succeeded.

**Files:**
- Create: `Frontend/app/lib/avatarUpload.ts`
- Test: `Frontend/app/lib/avatarUpload.test.ts`
- Modify: `Frontend/app/contexts/AuthContext.tsx` (line 623–629, add import)

**Interfaces:**
- Produces: `export async function resolveAvatarUrl(res: Response): Promise<string>` — returns the proxied avatar URL on a valid response; throws `Error` with a user-facing Thai message on any anomaly (non-ok, empty body, missing/empty `url`).

- [ ] **Step 1: Write the failing test**

Create `Frontend/app/lib/avatarUpload.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { resolveAvatarUrl } from "./avatarUpload";

describe("resolveAvatarUrl", () => {
  test("prefixes /api/proxy for a relative url", async () => {
    const res = new Response(JSON.stringify({ url: "/uploads/a.png" }), { status: 200 });
    expect(await resolveAvatarUrl(res)).toBe("/api/proxy/uploads/a.png");
  });

  test("returns an absolute url unchanged", async () => {
    const res = new Response(JSON.stringify({ url: "https://cdn.example.com/a.png" }), { status: 200 });
    expect(await resolveAvatarUrl(res)).toBe("https://cdn.example.com/a.png");
  });

  test("throws a friendly message on an empty 200 body (was SyntaxError)", async () => {
    const res = new Response("", { status: 200 });
    expect(resolveAvatarUrl(res)).rejects.toThrow("เซิร์ฟเวอร์ไม่ส่ง URL");
  });

  test("throws a friendly message when the url field is missing (was TypeError)", async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    expect(resolveAvatarUrl(res)).rejects.toThrow("เซิร์ฟเวอร์ไม่ส่ง URL");
  });

  test("surfaces the backend error message on a non-ok response", async () => {
    const res = new Response(JSON.stringify({ message: "ไฟล์ใหญ่เกินไป" }), { status: 400 });
    expect(resolveAvatarUrl(res)).rejects.toThrow("ไฟล์ใหญ่เกินไป");
  });

  test("falls back to the status code when the error body is not JSON", async () => {
    const res = new Response("nope", { status: 500 });
    expect(resolveAvatarUrl(res)).rejects.toThrow("อัพโหลดไม่สำเร็จ (500)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/lib/avatarUpload.test.ts`
Expected: FAIL — `Cannot find module './avatarUpload'`.

- [ ] **Step 3: Create the helper**

Create `Frontend/app/lib/avatarUpload.ts`:

```ts
/**
 * Resolve the avatar URL from a POST /users/me/avatar response.
 *
 * The old success path called `res.json()` unguarded: a 200 with an empty /
 * non-JSON body threw `SyntaxError`, and a 200 whose body lacked a string
 * `url` threw `TypeError` on `url.startsWith`. Both surfaced to the UI as a
 * cryptic crash even though the upload had succeeded. This helper turns every
 * anomaly into a friendly Thai Error and only returns a URL when the body is
 * valid.
 *
 * @throws Error with a user-facing Thai message on any failure.
 */
export async function resolveAvatarUrl(res: Response): Promise<string> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err?.message || `อัพโหลดไม่สำเร็จ (${res.status})`);
  }
  const data = (await res.json().catch(() => ({}))) as { url?: unknown };
  const url = data?.url;
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("อัพโหลดไม่สำเร็จ: เซิร์ฟเวอร์ไม่ส่ง URL ของรูป");
  }
  return url.startsWith("/") ? `/api/proxy${url}` : url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/lib/avatarUpload.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Wire into `AuthContext.tsx`**

Add the import beside the other relative imports at the top of `Frontend/app/contexts/AuthContext.tsx`:

```ts
import { resolveAvatarUrl } from "../lib/avatarUpload";
```

Replace lines 623–629:

```ts
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `อัพโหลดไม่สำเร็จ (${res.status})`);
    }
    const data = await res.json();
    const url = data.url as string;
    return url.startsWith("/") ? `/api/proxy${url}` : url;
```

with:

```ts
    return resolveAvatarUrl(res);
```

(The surrounding `uploadProfilePhoto` still builds the `FormData` and issues the `fetch` into `res`; only the response handling moves to the helper.)

- [ ] **Step 6: Verify tests + lint**

Run: `cd Frontend && bun test app/lib/avatarUpload.test.ts && bun run lint`
Expected: 6 tests pass; lint clean (no unused `data`/`url`/`err` bindings left in `AuthContext.tsx`).

- [ ] **Step 7: Commit**

```bash
git add Frontend/app/lib/avatarUpload.ts Frontend/app/lib/avatarUpload.test.ts Frontend/app/contexts/AuthContext.tsx
git commit -m "fix(frontend): guard avatar upload response parsing (resolveAvatarUrl)"
```

---

## Task 3: Backend — surface secondary-query errors in getPublicProfile

**Bug:** `forum.service.ts:247` (`getPublicProfile`) checks `.error` on only the first of five parallel Supabase queries. `postsRes`, `commentsRes`, `likedVotesRes`, and `versionsRes` are consumed as `(...Res.data ?? [])` (lines 251, 264, 288, 300) with their `.error` never inspected. A transient failure on one of those returns HTTP 200 with that section silently empty — indistinguishable from a genuine "no data" state, and unobservable. Fix: log each secondary error (keep the graceful-degrade fallback; the profile itself is still essential and still throws).

**Files:**
- Modify: `Backend/src/forum/forum.service.ts` (insert after line 247)
- Test: `Backend/src/forum/forum.service.spec.ts` (append a `describe` block)

**Interfaces:**
- Consumes: existing `this.logger` (a `Logger` already used at `forum.service.ts:210`) and the five `*Res` results already destructured at line 216.
- Produces: no new exported symbol — behavior change only (a `logger.warn` per failed secondary query).

- [ ] **Step 1: Write the failing test**

Append to `Backend/src/forum/forum.service.spec.ts` (uses the file's existing `makeService` helper):

```ts
describe('ForumService.getPublicProfile', () => {
  it('logs a warning when a secondary query returns an error instead of masking it', async () => {
    // A query builder that is both chainable and awaitable, resolving to {data, error}.
    // getPublicProfile awaits the `profiles` builder via `.single()` and the other
    // four builders directly (they end at `.limit()`/`.in()`), so both paths are covered.
    const thenableChain = (result: { data: unknown; error: unknown }) => {
      const chain: any = {};
      for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.single = jest.fn().mockResolvedValue(result);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej);
      return chain;
    };

    const service = makeService((table: string) => {
      switch (table) {
        case 'profiles':
          return thenableChain({ data: { uid: 'u1', role: 'user' }, error: null });
        case 'forum_posts':
          return thenableChain({ data: null, error: { message: 'boom' } }); // failing secondary
        default:
          return thenableChain({ data: [], error: null });
      }
    });

    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    await service.getPublicProfile('u1', 'viewer1');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('posts'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Backend && npx jest src/forum/forum.service.spec.ts -t "logs a warning when a secondary query" --no-coverage`
Expected: FAIL — `warnSpy` received 0 calls (the error is currently masked, no warning is emitted).

- [ ] **Step 3: Implement the fix**

In `Backend/src/forum/forum.service.ts`, immediately after line 247:

```ts
    if (profileRes.error || !profileRes.data) throw new NotFoundException('Profile not found');
```

insert:

```ts
    // Secondary sections degrade gracefully to empty on error, but a silently
    // empty section is indistinguishable from a real "no data" state. Log each
    // failure so a transient query error is observable instead of masked.
    for (const [name, r] of [
      ['posts', postsRes],
      ['comments', commentsRes],
      ['likedVotes', likedVotesRes],
      ['versions', versionsRes],
    ] as const) {
      if (r.error) {
        this.logger.warn(
          `getPublicProfile: ${name} query failed for uid=${uid}: ${JSON.stringify(r.error)}`,
        );
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Backend && npx jest src/forum/forum.service.spec.ts -t "logs a warning when a secondary query" --no-coverage`
Expected: PASS.

- [ ] **Step 5: Run the full forum spec to confirm no regression**

Run: `cd Backend && npx jest src/forum/forum.service.spec.ts --no-coverage`
Expected: all existing `ForumService` tests still pass, plus the new one.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/forum/forum.service.ts Backend/src/forum/forum.service.spec.ts
git commit -m "fix(backend): log secondary query errors in getPublicProfile instead of masking"
```

---

## Follow-ups (out of scope for this plan — latent, not currently reachable)

Log these as issues; do not implement here.

1. **Proxy re-emits `content-encoding`/`content-length` over an already-decoded body** — `Frontend/app/api/proxy/[...path]/route.ts:55-58` copies all upstream headers except `transfer-encoding`/`connection`. Node's undici transparently decodes gzip/br when `upstream.body` is consumed, but the original `content-encoding` + compressed `content-length` are still forwarded → browser `ERR_CONTENT_DECODING_FAILED`. **Latent today** because the NestJS backend ships no `compression` middleware (grep: 0 matches), so it never sets `content-encoding`. Fix when adding compression or any compressing upstream: also strip `content-encoding` and `content-length` in the header-copy loop.

2. **`proxyImage` has no client-disconnect / stream-error handling** — `Backend/src/books/books.controller.ts:394-428` manually pumps the upstream stream into `res` with a `try/catch` only around `reader.read()`, unlike the hardened sibling `uploads.controller.ts:60-71` / `img-cache.controller.ts`. On a browser cancel it keeps reading the whole upstream and writing to a dead socket (wasted bandwidth / possible post-close `res.write`). Add `res.on('close', () => reader.cancel())` to match the siblings.

---

## Self-Review

**1. Spec coverage** — Three verified live bugs, three tasks: #1 avatar upload → Task 2; #2 getPublicProfile masked errors → Task 3; #3 userCache/readingHistory unguarded `res.json()` (3 call sites) → Task 1. False-positive (cache-orchestrator) explicitly excluded with rationale. Latent findings captured as follow-ups. No gaps.

**2. Placeholder scan** — No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows complete code; every run step shows the exact command and expected outcome.

**3. Type consistency** — `parseJsonArray<T>(res: Response): Promise<T[] | null>` is defined in Task 1 Step 3 and consumed with matching generics (`CachedBook`, `string`, `HistoryBook`, inline chapter type) in Steps 5–6. `resolveAvatarUrl(res: Response): Promise<string>` defined in Task 2 Step 3, consumed in Step 5. Task 3 adds no exported symbol and reuses the existing `this.logger` and the `*Res` names already destructured at `forum.service.ts:216`. Consistent.
