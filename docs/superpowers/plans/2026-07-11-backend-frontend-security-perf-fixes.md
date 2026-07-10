# Backend & Frontend Security & Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (Backend) land the uncommitted Prettier formatting sweep as an isolated, no-behavior-change commit; (Frontend) fix 4 security vulnerabilities (2 stored-XSS in `/docs`, 1 OAuth token exfiltration, 1 login-CSRF) and 3 React re-render performance regressions on the `feat/dashboard` branch.

**Backend scope note:** The security + performance review of the Backend `feat/dashboard` diff (124 files) found **zero** security or performance findings — the entire diff is a Prettier reformat plus 5 semantically-inert edits (`let`→`const`, a removed stale eslint comment, an equivalent `??` re-parenthesization, a dropped `!` non-null assertion, a redundant `(data as any)` cast removal). There is nothing to fix; the only Backend task is commit hygiene (Part 0). All real fix work is Frontend (Parts A & B).

**Architecture:** Each Frontend fix moves its security/perf-critical decision into a **small, dependency-light pure function** (a URL sanitizer, an origin-trust guard, a page-URL resolver, a mermaid config object) so the logic is unit-testable with `bun test` without a DOM, then the React component calls that function. React memoization fixes wrap components in `React.memo` and stabilize their prop identities with `useMemo`/`useCallback` in the parent.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9, `mermaid` ^11.16, Supabase Auth. Tests: `bun:test` (`*.test.ts`), `react-dom/server` `renderToString` for component smoke tests.

## Global Constraints

- **No new runtime dependencies.** Per repo North Star ("remove complexity rather than prop it up") the mermaid XSS fix MUST use mermaid's built-in `securityLevel`, not a new DOMPurify dependency. Only `mermaid` ^11.16.0 (already present) may be relied on.
- **Test runner:** run Frontend tests with `bun test <path>` from `Frontend/`. Test files are `*.test.ts` colocated in `__tests__/` dirs (see `Frontend/app/docs/__tests__/MarkdownRenderer.test.ts`). They are excluded from `tsconfig` and run only under `bun test`.
- **Pure helpers must not read `window`/globals directly** — the bun test env has no DOM. Any function that needs the current origin takes it as a `selfOrigin: string` parameter; the React call site passes `window.location.origin`.
- **URL scheme guard = repo convention (verbatim):** `/^\s*(javascript|data|vbscript|file):/i` → replace with `'#'`. Already used correctly at `Frontend/app/community/p/[id]/page.tsx:500`; reuse the same regex.
- **Surgical changes only.** Match surrounding style (2-space indent, double quotes in TS lib files, no semicolon-free style — files use semicolons). Do not reformat untouched lines.
- **Commit after every task** with the exact message given. Branch is `feat/dashboard` (already checked out); commit onto it.

---

## File Structure

**New files (pure, unit-tested helpers):**
- `Frontend/app/lib/oauthCallback.ts` — OAuth popup postMessage contract: message type constant, sender, and receiver-trust guard. Consumed by both the callback page (sender) and `AuthContext` (receiver). One responsibility: the cross-window OAuth message trust boundary.
- `Frontend/app/lib/oauthCallback.test.ts` — tests for the above.
- `Frontend/app/lib/readerPages.ts` — pure page-URL resolution + other-language next-chapter map derivation extracted from `MangaReader`. One responsibility: deriving reader-render inputs from chapter data.
- `Frontend/app/lib/readerPages.test.ts` — tests for the above.
- `Frontend/app/docs/utils.test.ts` — tests for the new `sanitizeDocsUrl` added to the existing `docs/utils.ts`.
- `Frontend/app/docs/__tests__/MermaidRenderer.test.ts` — tests the exported `MERMAID_CONFIG`.

**Modified files:**
- `Frontend/app/auth/callback/page.tsx` — use `postOAuthCallbackMessage` (no more `"*"`).
- `Frontend/app/contexts/AuthContext.tsx` — use `isTrustedOAuthCallbackMessage` (origin check) in the popup `message` listener.
- `Frontend/app/docs/MermaidRenderer.tsx` — export `MERMAID_CONFIG`; set `securityLevel: 'strict'`.
- `Frontend/app/docs/utils.ts` — add `sanitizeDocsUrl`.
- `Frontend/app/docs/DocsClient.tsx` — apply `sanitizeDocsUrl` to markdown link `href`.
- `Frontend/app/components/MangaReader.tsx` — `useMemo` for `pages`/`otherLangNextMap`, `useCallback` for `goToChapter`/`langLabel`; consume `readerPages.ts` helpers.
- `Frontend/app/components/reader/PageRenderer.tsx` — wrap default export in `React.memo`.
- `Frontend/app/community/p/[id]/page.tsx` — drop comment-target vote events; stable `useCallback` for the comment-added handler.
- `Frontend/app/components/CommentThread.tsx` — wrap default export in `React.memo`.

---

## PART 0 — BACKEND: isolate the formatting sweep (no behavior change)

### Task 0: Commit the Backend Prettier sweep as its own `style` commit

**Why:** The whole `Backend/src` working-tree diff is formatting (line-wrapping, trailing commas, `(x) =>` params, multi-line imports) plus the 5 inert edits listed in the scope note. Committing it separately keeps `git blame` and future logic-change reviews clean, and gets these ~124 files off the working tree so the Frontend tasks below commit in isolation. There is no code to change — only to verify-then-commit.

**Files:**
- Commit (no edits): all modified `Backend/src/**` and `Backend/test/**` files currently in the working tree.

**Interfaces:** none (commit-only task).

- [ ] **Step 1: Confirm the review's conclusion — the diff is formatting + the 5 known inert edits**

Run (spot-check the 5 non-formatting edits are exactly the expected inert ones):

```bash
cd Backend
git diff --word-diff=porcelain -- src/books/mangadex.service.ts | grep -E '^[+-](let |const )chapters'   # let→const
git diff -- src/books/llm.service.ts | grep -nE '^[-+].*eslint-disable-next-line no-console'              # removed stale comment
git diff -- src/supabase/supabase.service.ts | grep -nE '\.value!?'                                       # value! → value
git diff -- src/forum/forum.service.ts | grep -nE '\(data as any\)'                                        # cast removed
git diff -- src/books/landing.service.ts | grep -nE 'stillCached'                                          # ?? re-parenthesization
```
Expected: each shows the inert edit described in the scope note and nothing more surprising. If any file shows an unexplained logic change, STOP and re-review that file before committing.

- [ ] **Step 2: Prove behavior is unchanged — run the Backend unit tests**

Run: `cd Backend && npm test`
Expected: green **except** the known pre-existing failures recorded in memory `project_backend_pre_existing_test_failures` (books suite: 14 pubsub-batch + 2 hmac = 16 fails that predate this branch). No NEW failures. If a failure appears outside that known set, a "formatting" edit changed behavior — STOP and investigate that file.

- [ ] **Step 3: Stage only the Backend source/test files (not the untracked docs/PRD files)**

Run:

```bash
cd C:/Users/somchai/Desktop/MangaDock
git add Backend/src Backend/test
git status --short Backend/   # verify: only tracked-file "M" entries staged, nothing unexpected
```

- [ ] **Step 4: Commit**

```bash
git commit -m "style(backend): prettier formatting sweep (no behavior change)

Line-wrapping, trailing commas, (x) => params, multi-line imports across
Backend/src. Reviewed hunk-by-hunk: formatting only, plus 5 semantically-inert
edits (let->const, stale eslint comment removed, equivalent ?? reparen, dropped
! assertion, redundant cast removed). Unit tests green (minus 16 known
pre-existing failures). Security + perf review: no findings."
```

- [ ] **Step 5: Verify the working tree is now clean of Backend changes**

Run: `cd C:/Users/somchai/Desktop/MangaDock && git status --short Backend/`
Expected: no output (all Backend source/test changes are committed). The Frontend tasks below now commit in isolation.

---

## PART A — SECURITY FIXES

### Task 1: OAuth callback — stop broadcasting session tokens with `targetOrigin: "*"`

**Vuln 1 (High, confidence 9):** `Frontend/app/auth/callback/page.tsx:39` posts `access_token` + `refresh_token` to `window.opener` with target origin `"*"`, letting any opener origin (e.g. an attacker page that opened the popup) read the victim's full session → account takeover.

**Files:**
- Create: `Frontend/app/lib/oauthCallback.ts`
- Create: `Frontend/app/lib/oauthCallback.test.ts`
- Modify: `Frontend/app/auth/callback/page.tsx:23-50`

**Interfaces:**
- Produces (consumed by Task 2 and the callback page):
  - `export const OAUTH_CALLBACK_TYPE = "supabase:oauth:callback";`
  - `export interface OAuthCallbackPayload { access_token?: string; refresh_token?: string; error_code?: string; error?: string; }`
  - `export function postOAuthCallbackMessage(opener: Pick<Window, "postMessage">, payload: OAuthCallbackPayload, selfOrigin: string): void` — posts `{ type: OAUTH_CALLBACK_TYPE, ...payload }` to `opener` with `targetOrigin = selfOrigin` (never `"*"`).

- [ ] **Step 1: Write the failing test**

Create `Frontend/app/lib/oauthCallback.test.ts`:

```ts
import { expect, test, describe } from "bun:test";
import { postOAuthCallbackMessage, OAUTH_CALLBACK_TYPE } from "./oauthCallback";

describe("postOAuthCallbackMessage", () => {
  test("posts to the exact self origin, never a wildcard", () => {
    const calls: Array<{ msg: unknown; target: string }> = [];
    const opener = { postMessage: (msg: unknown, target: string) => { calls.push({ msg, target }); } };

    postOAuthCallbackMessage(
      opener,
      { access_token: "a", refresh_token: "r" },
      "https://app.example.com",
    );

    expect(calls.length).toBe(1);
    expect(calls[0].target).toBe("https://app.example.com");
    expect(calls[0].target).not.toBe("*");
    expect(calls[0].msg).toEqual({
      type: OAUTH_CALLBACK_TYPE,
      access_token: "a",
      refresh_token: "r",
    });
  });

  test("passes through the error payload with the tagged type", () => {
    const calls: Array<{ msg: unknown; target: string }> = [];
    const opener = { postMessage: (msg: unknown, target: string) => { calls.push({ msg, target }); } };

    postOAuthCallbackMessage(opener, { error_code: "email_exists", error: "taken" }, "https://app.example.com");

    expect(calls[0].msg).toEqual({ type: OAUTH_CALLBACK_TYPE, error_code: "email_exists", error: "taken" });
    expect(calls[0].target).toBe("https://app.example.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/lib/oauthCallback.test.ts`
Expected: FAIL — `Cannot find module './oauthCallback'`.

- [ ] **Step 3: Write minimal implementation**

Create `Frontend/app/lib/oauthCallback.ts`:

```ts
export const OAUTH_CALLBACK_TYPE = "supabase:oauth:callback";

export interface OAuthCallbackPayload {
  access_token?: string;
  refresh_token?: string;
  error_code?: string;
  error?: string;
}

/**
 * Post the OAuth popup result back to the opener.
 *
 * SECURITY: `targetOrigin` MUST be the app's own origin (`selfOrigin`), never
 * `"*"`. The popup and its opener are same-origin in the intended flow; a
 * wildcard would deliver the session tokens to a malicious opener that merely
 * launched the popup (account takeover). See plan 2026-07-11 Vuln 1.
 */
export function postOAuthCallbackMessage(
  opener: Pick<Window, "postMessage">,
  payload: OAuthCallbackPayload,
  selfOrigin: string,
): void {
  opener.postMessage({ type: OAUTH_CALLBACK_TYPE, ...payload }, selfOrigin);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/lib/oauthCallback.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the callback page to the helper**

In `Frontend/app/auth/callback/page.tsx`, add the import near the top (after the existing `supabase` import on line 4):

```ts
import { postOAuthCallbackMessage } from "../../lib/oauthCallback";
```

Replace the error-path block (currently lines 24-29):

```tsx
      if (window.opener) {
        window.opener.postMessage(
          { type: "supabase:oauth:callback", error_code: errorCode, error: errorDesc || error },
          "*"
        );
      }
```

with:

```tsx
      if (window.opener) {
        postOAuthCallbackMessage(
          window.opener,
          { error_code: errorCode ?? undefined, error: (errorDesc || error) ?? undefined },
          window.location.origin,
        );
      }
```

Replace the success-path block (currently lines 38-47):

```tsx
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "supabase:oauth:callback",
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            },
            "*"
          );
        }
```

with:

```tsx
        if (window.opener) {
          postOAuthCallbackMessage(
            window.opener,
            { access_token: session.access_token, refresh_token: session.refresh_token },
            window.location.origin,
          );
        }
```

- [ ] **Step 6: Verify the wildcard is gone**

Run: `cd Frontend && grep -n '"\*"' app/auth/callback/page.tsx`
Expected: no output (exit code 1). Then `cd Frontend && bun test app/lib/oauthCallback.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git add Frontend/app/lib/oauthCallback.ts Frontend/app/lib/oauthCallback.test.ts Frontend/app/auth/callback/page.tsx
git commit -m "fix(auth): post OAuth session to opener with exact origin, not wildcard

Vuln 1 (High): callback broadcast access_token+refresh_token with
targetOrigin '*', letting a malicious opener read the victim session.
Extract postOAuthCallbackMessage (unit-tested) and pass window.location.origin."
```

---

### Task 2: OAuth message listener — reject messages from untrusted origins

**Vuln 4 (Medium, confidence 7):** `Frontend/app/contexts/AuthContext.tsx:345-346` accepts `{type:"supabase:oauth:callback", access_token, refresh_token}` from **any** origin (gated only on `data.type`) and calls `supabase.auth.setSession()`, enabling login-CSRF / session fixation while the popup listener is active.

**Files:**
- Modify: `Frontend/app/lib/oauthCallback.ts` (add the guard)
- Modify: `Frontend/app/lib/oauthCallback.test.ts` (add tests)
- Modify: `Frontend/app/contexts/AuthContext.tsx:345-354`

**Interfaces:**
- Consumes: `OAUTH_CALLBACK_TYPE` (Task 1).
- Produces (consumed by `AuthContext`):
  - `export function isTrustedOAuthCallbackMessage(event: Pick<MessageEvent, "origin" | "data">, selfOrigin: string): boolean` — true only when `event.origin === selfOrigin` AND `event.data?.type === OAUTH_CALLBACK_TYPE`.

- [ ] **Step 1: Write the failing test**

Append to `Frontend/app/lib/oauthCallback.test.ts`:

```ts
import { isTrustedOAuthCallbackMessage } from "./oauthCallback";

describe("isTrustedOAuthCallbackMessage", () => {
  const self = "https://app.example.com";

  test("accepts a correctly-typed message from the same origin", () => {
    const event = { origin: self, data: { type: OAUTH_CALLBACK_TYPE, access_token: "a" } };
    expect(isTrustedOAuthCallbackMessage(event, self)).toBe(true);
  });

  test("rejects a correctly-typed message from a foreign origin", () => {
    const event = { origin: "https://evil.example.com", data: { type: OAUTH_CALLBACK_TYPE, access_token: "a" } };
    expect(isTrustedOAuthCallbackMessage(event, self)).toBe(false);
  });

  test("rejects an unrelated message type from the same origin", () => {
    const event = { origin: self, data: { type: "provider-changed" } };
    expect(isTrustedOAuthCallbackMessage(event, self)).toBe(false);
  });

  test("rejects a message with no data", () => {
    const event = { origin: self, data: null };
    expect(isTrustedOAuthCallbackMessage(event, self)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/lib/oauthCallback.test.ts`
Expected: FAIL — `isTrustedOAuthCallbackMessage` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `Frontend/app/lib/oauthCallback.ts`:

```ts
/**
 * Trust guard for the OAuth popup `message` listener.
 *
 * SECURITY: the receiver must verify `event.origin` before consuming any
 * tokens — the callback page is same-origin as the opener, so a message from
 * any other origin is forged (login CSRF / session fixation). See Vuln 4.
 */
export function isTrustedOAuthCallbackMessage(
  event: Pick<MessageEvent, "origin" | "data">,
  selfOrigin: string,
): boolean {
  return event.origin === selfOrigin && event.data?.type === OAUTH_CALLBACK_TYPE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/lib/oauthCallback.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 5: Wire the listener to the guard**

In `Frontend/app/contexts/AuthContext.tsx`, add to the import from the helper (create the import near the other `../lib` imports at the top of the file):

```ts
import { isTrustedOAuthCallbackMessage } from "../lib/oauthCallback";
```

Replace the guard at the top of `onMessage` (currently line 346):

```ts
      const onMessage = async (event: MessageEvent) => {
        if (event.data?.type !== "supabase:oauth:callback") return;
```

with:

```ts
      const onMessage = async (event: MessageEvent) => {
        if (!isTrustedOAuthCallbackMessage(event, window.location.origin)) return;
```

Leave the rest of `onMessage` (the destructuring on line 351, the error mapping, and the `setSession` call) unchanged.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd Frontend && bun test app/lib/oauthCallback.test.ts`
Expected: PASS. Also confirm the wiring: `cd Frontend && grep -n "isTrustedOAuthCallbackMessage" app/contexts/AuthContext.tsx` → 2 lines (import + call).

- [ ] **Step 7: Commit**

```bash
git add Frontend/app/lib/oauthCallback.ts Frontend/app/lib/oauthCallback.test.ts Frontend/app/contexts/AuthContext.tsx
git commit -m "fix(auth): validate event.origin before accepting OAuth popup tokens

Vuln 4 (Medium): the popup message listener trusted any origin and called
setSession with attacker tokens (login CSRF). Add isTrustedOAuthCallbackMessage
(unit-tested) requiring event.origin === window.location.origin."
```

---

### Task 3: Mermaid — render diagrams with `securityLevel: 'strict'`

**Vuln 2 (High, confidence 8):** `Frontend/app/docs/MermaidRenderer.tsx:14` initializes mermaid with `securityLevel: 'loose'` (disables mermaid's internal DOMPurify sanitization and allows `click`/HTML labels) and injects the SVG via `dangerouslySetInnerHTML` (`:94`). The `chart` comes from GitHub issue/PR/comment bodies (`DocsClient.tsx:639/659`), which are attacker-controllable on the public repo → stored XSS. Setting `securityLevel: 'strict'` (mermaid's default) re-enables sanitization and disables interaction directives, closing the vector with no new dependency.

**Files:**
- Modify: `Frontend/app/docs/MermaidRenderer.tsx:5-43`
- Create: `Frontend/app/docs/__tests__/MermaidRenderer.test.ts`

**Interfaces:**
- Produces: `export const MERMAID_CONFIG` — the object passed to `mermaid.initialize`, with `securityLevel: 'strict'`. Exported so the security-critical setting is unit-assertable without loading the ~1MB mermaid module.

- [ ] **Step 1: Write the failing test**

Create `Frontend/app/docs/__tests__/MermaidRenderer.test.ts`:

```ts
import { expect, test, describe } from "bun:test";
import { MERMAID_CONFIG } from "../MermaidRenderer";

describe("MermaidRenderer config", () => {
  test("uses strict security level so untrusted diagram sources cannot inject HTML/JS", () => {
    expect(MERMAID_CONFIG.securityLevel).toBe("strict");
  });

  test("does not start rendering automatically", () => {
    expect(MERMAID_CONFIG.startOnLoad).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/docs/__tests__/MermaidRenderer.test.ts`
Expected: FAIL — `MERMAID_CONFIG` is not exported (and the current value would be `'loose'`).

> Note: `MermaidRenderer.tsx` uses `await import('mermaid')` inside `getMermaid`, so importing the module for this test does NOT pull in mermaid itself — only the exported config object is evaluated.

- [ ] **Step 3: Extract the config and set strict**

In `Frontend/app/docs/MermaidRenderer.tsx`, replace the top-of-file section (currently lines 5-43) so the config object is a named export and `securityLevel` is `'strict'`:

```tsx
let mermaidIdCounter = 0;
let mermaidInitialized = false;

export const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'dark',
  // SECURITY: 'strict' keeps mermaid's built-in DOMPurify sanitization on and
  // disables `click`/HTML-label directives. Diagram sources can come from
  // attacker-controlled GitHub issue/PR/comment bodies (see plan 2026-07-11
  // Vuln 2) — never 'loose'.
  securityLevel: 'strict' as const,
  flowchart: {
    curve: 'step',
    useMaxWidth: false,
  },
  themeVariables: {
    background: '#0f1118',
    mainBkg: '#1c1f2e',
    nodeBorder: '#4a90d9',
    clusterBkg: '#1a1d2b',
    clusterBorder: '#3a4060',
    titleColor: '#e8eaf6',
    edgeLabelBackground: '#1c1f2e',
    lineColor: '#6baed6',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    primaryColor: '#1c2a3e',
    primaryTextColor: '#e8eaf6',
    primaryBorderColor: '#4a90d9',
    secondaryColor: '#1a2030',
    tertiaryColor: '#141824',
    labelBackground: '#1c1f2e',
    textColor: '#c9d1e0',
    nodeTextColor: '#e8eaf6',
  },
};

async function getMermaid() {
  const mermaid = (await import('mermaid')).default;
  if (!mermaidInitialized) {
    mermaid.initialize(MERMAID_CONFIG);
    mermaidInitialized = true;
  }
  return mermaid;
}
```

Leave the `MermaidRenderer` component body (lines 46+) unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/docs/__tests__/MermaidRenderer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm the existing docs test still passes**

Run: `cd Frontend && bun test app/docs/__tests__/MarkdownRenderer.test.ts`
Expected: PASS (2 tests) — the mermaid-block routing test is unaffected by the config change.

- [ ] **Step 6: Commit**

```bash
git add Frontend/app/docs/MermaidRenderer.tsx Frontend/app/docs/__tests__/MermaidRenderer.test.ts
git commit -m "fix(docs): render mermaid with securityLevel strict (XSS)

Vuln 2 (High): diagram sources include attacker-controlled GitHub issue/PR
bodies; 'loose' disabled sanitization and enabled click directives, injected
via dangerouslySetInnerHTML. Export MERMAID_CONFIG and set 'strict'."
```

---

### Task 4: Sanitize markdown link `href` in the docs renderer

**Vuln 3 (High, confidence 8):** `Frontend/app/docs/DocsClient.tsx:124` builds `<a href={lm[2]}>` from markdown `[text](url)` in GitHub-sourced bodies with no scheme check. React does not strip `javascript:` hrefs → click-XSS. Apply the repo's scheme guard.

**Files:**
- Modify: `Frontend/app/docs/utils.ts` (add `sanitizeDocsUrl`)
- Create: `Frontend/app/docs/utils.test.ts`
- Modify: `Frontend/app/docs/DocsClient.tsx:121-125`

**Interfaces:**
- Produces (consumed by `DocsClient`): `export function sanitizeDocsUrl(url: string): string` — returns `"#"` when the trimmed URL matches `/^\s*(javascript|data|vbscript|file):/i`, otherwise the trimmed URL.

- [ ] **Step 1: Write the failing test**

Create `Frontend/app/docs/utils.test.ts`:

```ts
import { expect, test, describe } from "bun:test";
import { sanitizeDocsUrl } from "./utils";

describe("sanitizeDocsUrl", () => {
  test("neutralizes javascript: URLs", () => {
    expect(sanitizeDocsUrl("javascript:alert(1)")).toBe("#");
    expect(sanitizeDocsUrl("  JavaScript:alert(1)")).toBe("#");
  });

  test("neutralizes data:, vbscript:, and file: URLs", () => {
    expect(sanitizeDocsUrl("data:text/html,<script>1</script>")).toBe("#");
    expect(sanitizeDocsUrl("vbscript:msgbox(1)")).toBe("#");
    expect(sanitizeDocsUrl("file:///etc/passwd")).toBe("#");
  });

  test("passes http, https, mailto, and relative URLs through (trimmed)", () => {
    expect(sanitizeDocsUrl("https://github.com/Slow-Inc/MangaDock")).toBe("https://github.com/Slow-Inc/MangaDock");
    expect(sanitizeDocsUrl("  http://example.com ")).toBe("http://example.com");
    expect(sanitizeDocsUrl("mailto:dev@example.com")).toBe("mailto:dev@example.com");
    expect(sanitizeDocsUrl("/docs/overview")).toBe("/docs/overview");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/docs/utils.test.ts`
Expected: FAIL — `sanitizeDocsUrl` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `Frontend/app/docs/utils.ts`:

```ts
/**
 * Neutralize dangerous URL schemes before placing a user/API-supplied URL in an
 * <a href>. Docs render GitHub issue/PR/comment bodies (attacker-controlled),
 * and React does not strip `javascript:` hrefs. Mirrors the repo convention at
 * community/p/[id]/page.tsx. See plan 2026-07-11 Vuln 3.
 */
export function sanitizeDocsUrl(url: string): string {
  const trimmed = url.trim();
  return /^\s*(javascript|data|vbscript|file):/i.test(trimmed) ? "#" : trimmed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/docs/utils.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Apply the sanitizer at the link render site**

In `Frontend/app/docs/DocsClient.tsx`, add `sanitizeDocsUrl` to the existing import from `./utils` (currently `import { relativeDate, labelFg } from './utils';` on line 90):

```ts
import { relativeDate, labelFg, sanitizeDocsUrl } from './utils';
```

Replace the link branch in `renderInline` (currently lines 121-125):

```tsx
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lm) {
      const ext = lm[2].startsWith('http');
      return <a key={i} href={lm[2]} className="text-[#0071e3] underline underline-offset-2 hover:text-[#0058b0] transition-colors duration-150" target={ext ? '_blank' : undefined} rel={ext ? 'noreferrer' : undefined}>{lm[1]}</a>;
    }
```

with:

```tsx
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lm) {
      const href = sanitizeDocsUrl(lm[2]);
      const ext = href.startsWith('http');
      return <a key={i} href={href} className="text-[#0071e3] underline underline-offset-2 hover:text-[#0058b0] transition-colors duration-150" target={ext ? '_blank' : undefined} rel={ext ? 'noreferrer' : undefined}>{lm[1]}</a>;
    }
```

- [ ] **Step 6: Run tests to verify**

Run: `cd Frontend && bun test app/docs/utils.test.ts app/docs/__tests__/MarkdownRenderer.test.ts`
Expected: PASS. Confirm wiring: `cd Frontend && grep -n "sanitizeDocsUrl" app/docs/DocsClient.tsx` → 2 lines.

- [ ] **Step 7: Commit**

```bash
git add Frontend/app/docs/utils.ts Frontend/app/docs/utils.test.ts Frontend/app/docs/DocsClient.tsx
git commit -m "fix(docs): sanitize markdown link href scheme (XSS)

Vuln 3 (High): [text](javascript:...) in GitHub-sourced bodies rendered a live
javascript: href. Add sanitizeDocsUrl (repo scheme guard, unit-tested) and
apply it in renderInline."
```

---

## PART B — PERFORMANCE FIXES

### Task 5: Stabilize reader-derived values (`pages`, `otherLangNextMap`, callbacks)

**Perf 2 (Medium, confidence 7) + prerequisite for Perf 1:** `Frontend/app/components/MangaReader.tsx:385-397` rebuilds the `pages` array (N× `encodeURIComponent`) and `:70-82` rebuilds `otherLangNextMap` on **every** render — including the 1-second translation timer tick and every MIT progress event — and `goToChapter`/`langLabel` get fresh identities each render. This task extracts the two derivations into pure, tested helpers and memoizes all four values so their identity is stable. (Task 6 then adds `React.memo` to `PageRenderer`, which only pays off once these props are stable.)

**Files:**
- Create: `Frontend/app/lib/readerPages.ts`
- Create: `Frontend/app/lib/readerPages.test.ts`
- Modify: `Frontend/app/components/MangaReader.tsx` (imports; lines 70-82, 104, 275-279, 385-397)

**Interfaces:**
- Consumes: `ChapterPageItem` type from `../hooks/useChapters`.
- Produces (consumed by `MangaReader` and its tests):
  - `export function resolveReaderPages(originals: string[], locals: string[] | undefined, apiBase: string): string[]`
  - `export function buildOtherLangNextMap(chapterList: ChapterPageItem[], currentIdx: number, currentChapterNum: string | null, currentLang: string | null): Map<string, ChapterPageItem>`

- [ ] **Step 1: Write the failing test**

Create `Frontend/app/lib/readerPages.test.ts`:

```ts
import { expect, test, describe } from "bun:test";
import { resolveReaderPages, buildOtherLangNextMap } from "./readerPages";
import type { ChapterPageItem } from "../hooks/useChapters";

describe("resolveReaderPages", () => {
  test("passes through already-proxied /api/ URLs unchanged", () => {
    expect(resolveReaderPages(["/api/img-proxy?url=x"], undefined, "http://be:3001")).toEqual(["/api/img-proxy?url=x"]);
  });

  test("prefers a local /img-cache path prefixed with the api base", () => {
    expect(resolveReaderPages(["https://cdn/x.jpg"], ["/img-cache/a.jpg"], "http://be:3001"))
      .toEqual(["http://be:3001/img-cache/a.jpg"]);
  });

  test("routes a remote URL through the img-proxy, encoded", () => {
    expect(resolveReaderPages(["https://cdn/x y.jpg"], undefined, "http://be:3001"))
      .toEqual(["/api/img-proxy?url=https%3A%2F%2Fcdn%2Fx%20y.jpg"]);
  });
});

describe("buildOtherLangNextMap", () => {
  const item = (id: string, lang: string, num: string | null): ChapterPageItem =>
    ({ id, translatedLanguage: lang, chapterNumber: num } as ChapterPageItem);

  test("returns one higher-numbered chapter per other language, excluding current lang", () => {
    const list = [
      item("c1", "en", "10"),  // current (idx 0)
      item("c2", "th", "11"),
      item("c3", "ja", "9"),   // lower → skipped
      item("c4", "th", "12"),  // dup lang → first (c2) wins
    ];
    const map = buildOtherLangNextMap(list, 0, "10", "en");
    expect(map.get("th")?.id).toBe("c2");
    expect(map.has("ja")).toBe(false);
    expect(map.has("en")).toBe(false);
  });

  test("returns an empty map when currentIdx < 0", () => {
    expect(buildOtherLangNextMap([], -1, null, "en").size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/lib/readerPages.test.ts`
Expected: FAIL — `Cannot find module './readerPages'`.

- [ ] **Step 3: Write the pure helpers (extracted verbatim from MangaReader)**

Create `Frontend/app/lib/readerPages.ts`:

```ts
import type { ChapterPageItem } from "../hooks/useChapters";

/**
 * Resolve the display URL for each page (extracted from MangaReader #582).
 * Already-proxied /api/ URLs pass through; locally-cached /img-cache paths are
 * prefixed with the backend base; everything else is routed through the
 * img-proxy (encoded) so the browser never hits the MangaDex CDN directly.
 */
export function resolveReaderPages(
  originals: string[],
  locals: string[] | undefined,
  apiBase: string,
): string[] {
  return originals.map((orig, i) => {
    if (orig.startsWith("/api/")) return orig;
    const local = locals?.[i];
    if (local && local.startsWith("/img-cache")) return `${apiBase}${local}`;
    return `/api/img-proxy?url=${encodeURIComponent(orig)}`;
  });
}

/**
 * For each OTHER language, the first chapter after the current position whose
 * chapter number is strictly higher (extracted from MangaReader). The current
 * language is excluded.
 */
export function buildOtherLangNextMap(
  chapterList: ChapterPageItem[],
  currentIdx: number,
  currentChapterNum: string | null,
  currentLang: string | null,
): Map<string, ChapterPageItem> {
  if (currentIdx < 0) return new Map<string, ChapterPageItem>();
  const map = new Map<string, ChapterPageItem>();
  for (const ch of chapterList.slice(currentIdx + 1)) {
    if (currentChapterNum !== null && ch.chapterNumber !== null) {
      if (parseFloat(ch.chapterNumber) <= parseFloat(currentChapterNum)) continue;
    }
    if (!map.has(ch.translatedLanguage)) map.set(ch.translatedLanguage, ch);
  }
  if (currentLang) map.delete(currentLang);
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/lib/readerPages.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Consume the helpers + memoize in MangaReader**

In `Frontend/app/components/MangaReader.tsx`:

(a) Ensure `useMemo` and `useCallback` are imported from `react` (add them to the existing `react` import if missing).

(b) Add the helper import near the other `../lib` imports:

```ts
import { resolveReaderPages, buildOtherLangNextMap } from "../lib/readerPages";
```

(c) Replace the `otherLangNextMap` IIFE (currently lines 70-82) with a memoized call:

```tsx
  const otherLangNextMap = useMemo(
    () => buildOtherLangNextMap(chapterList, currentIdx, currentChapterNum, currentLang),
    [chapterList, currentIdx, currentChapterNum, currentLang],
  );
```

(d) Replace the `langLabel` definition (currently line 104):

```tsx
  const langLabel = useCallback((l: string) => LANG_LABEL[l] ?? l.toUpperCase(), []);
```

(Keep the `LANG_LABEL` const on line 103 as-is, directly above.)

(e) Replace `goToChapter` (currently lines 275-279) with a `useCallback` (the three setters are stable `useState` dispatchers, so deps are empty):

```tsx
  const goToChapter = useCallback((ch: ChapterPageItem) => {
    setCurrentChapterId(ch.id);
    setCurrentChapterNumber(ch.chapterNumber);
    setCurrentChapterTitle(ch.title);
  }, []);
```

(f) Replace the inline `resolvePages` function + `pages` derivation (currently lines 385-397) with a memoized derivation via the helper:

```tsx
  // Prefer locally-cached paths when available; non-cached pages route through
  // the img-proxy. Memoized so translation-timer ticks / scroll setPage don't
  // re-encode every URL and churn the array identity (plan 2026-07-11 Perf 2).
  const pages = useMemo(
    () => useSaver
      ? resolveReaderPages(data?.dataSaverPages ?? [], data?.localDataSaverPages, API_BASE)
      : resolveReaderPages(data?.pages ?? [], data?.localPages, API_BASE),
    [data, useSaver],
  );
```

- [ ] **Step 6: Verify build + tests**

Run: `cd Frontend && bun test app/lib/readerPages.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: tests PASS; `tsc` reports no new errors in `MangaReader.tsx` (the extracted helpers keep the same types). If `tsc` surfaces a pre-existing unrelated error elsewhere, confirm it also exists on `git stash` baseline before proceeding.

- [ ] **Step 7: Commit**

```bash
git add Frontend/app/lib/readerPages.ts Frontend/app/lib/readerPages.test.ts Frontend/app/components/MangaReader.tsx
git commit -m "perf(reader): memoize page-URL + other-lang-map derivation and callbacks

Perf 2: pages/otherLangNextMap rebuilt every render (incl. 1s translate tick);
goToChapter/langLabel got fresh identities. Extract pure helpers (unit-tested)
and useMemo/useCallback so PageRenderer props are stable for Task 6's memo."
```

---

### Task 6: Wrap `PageRenderer` in `React.memo`

**Perf 1 (Medium, confidence 8):** `Frontend/app/components/reader/PageRenderer.tsx` is a plain component that maps every page in the chapter. With Task 5 stabilizing its props, wrapping it in `React.memo` lets it skip re-reconciling all N `<img>` subtrees on translation-timer ticks and scroll-driven `setPage` updates that don't change its inputs.

**Files:**
- Modify: `Frontend/app/components/reader/PageRenderer.tsx:53` and end-of-file
- Create: `Frontend/app/components/reader/__tests__/PageRenderer.memo.test.ts`

**Interfaces:**
- Consumes: stabilized props from Task 5 (`pages`, `otherLangNextMap`, `goToChapter`, `langLabel`, memoized `viewport` unchanged — viewport identity is out of scope here; memo still skips renders whenever the parent re-renders without changing any prop, which is the translation-tick case once `pages` et al. are stable).
- Produces: the default export is now a `React.memo`-wrapped component (same props, `PageRendererProps`).

- [ ] **Step 1: Write the failing test**

Create `Frontend/app/components/reader/__tests__/PageRenderer.memo.test.ts`:

```ts
import { expect, test, describe } from "bun:test";
import PageRenderer from "../PageRenderer";

describe("PageRenderer", () => {
  test("is wrapped in React.memo so stable props skip re-render", () => {
    // React.memo components carry the react.memo type tag.
    expect((PageRenderer as unknown as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/components/reader/__tests__/PageRenderer.memo.test.ts`
Expected: FAIL — the plain function export has no `$$typeof` memo tag.

- [ ] **Step 3: Wrap the export in `React.memo`**

In `Frontend/app/components/reader/PageRenderer.tsx`:

(a) Rename the component declaration (line 53) from a default-exported function to a named function:

```tsx
function PageRendererImpl({
```

(keep the full destructured prop list and body exactly as-is).

(b) Add `memo` to the React import at the top of the file. The file currently imports only types from react; add a value import:

```tsx
import { memo } from "react";
```

(c) At the very end of the file, after the function body's closing brace, add:

```tsx
/**
 * Memoized: the parent (MangaReader) re-renders once per second during batch
 * translation (page-elapsed tick) and on every scroll-driven setPage. With
 * stable props (plan 2026-07-11 Task 5) memo skips re-reconciling all N page
 * <img> subtrees when nothing this component reads has changed.
 */
const PageRenderer = memo(PageRendererImpl);
export default PageRenderer;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/components/reader/__tests__/PageRenderer.memo.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify types**

Run: `cd Frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `PageRenderer` (the memo wrapper preserves `PageRendererProps`).

- [ ] **Step 6: Manual runtime verification (record result)**

Start the dev server (`cd Frontend && bun dev`), open a chapter with ≥20 pages on a narrow viewport (continuous mode), press "แปลทั้งตอน", and with React DevTools Profiler "Highlight updates" enabled confirm the page `<img>` list is NOT flashing on every 1-second tick (only the status pill updates). Note the observed before/after in the PR description. (This is the eyeball proof; the memo tag test is the automated gate.)

- [ ] **Step 7: Commit**

```bash
git add Frontend/app/components/reader/PageRenderer.tsx Frontend/app/components/reader/__tests__/PageRenderer.memo.test.ts
git commit -m "perf(reader): wrap PageRenderer in React.memo

Perf 1: with stable props (Task 5) the memo skips re-reconciling all N page
<img> subtrees on the 1s translate tick and scroll setPage updates."
```

---

### Task 7: Stop comment-vote SSE events from re-rendering the whole comment tree

**Perf 3 (Medium, confidence 7):** `Frontend/app/community/p/[id]/page.tsx:93-98` stores **every** vote event (post- and comment-target) into `voteCounts`, but only `post:<id>` is ever read (`:293`, `:537`). Comment-target events re-render `PostDetailPage` → the whole recursive `CommentThread` list, discarding the result. Fix: only store post-target vote events, wrap `CommentThread` in `React.memo`, and give it a stable `onCommentAdded` callback.

**Files:**
- Modify: `Frontend/app/community/p/[id]/page.tsx:91-98`, `581-587`
- Modify: `Frontend/app/components/CommentThread.tsx:15` and end-of-file
- Create: `Frontend/app/community/p/[id]/__tests__/voteEvent.test.ts`

**Interfaces:**
- Produces: `export function isDisplayedVoteEvent(targetType: string): boolean` (added to a new small module `Frontend/app/lib/voteEvents.ts`) — true only for `"post"`. Consumed by the page's SSE handler.
- `CommentThread` default export becomes `React.memo`-wrapped (same props).

- [ ] **Step 1: Write the failing test**

Create `Frontend/app/lib/voteEvents.ts` will be created in Step 3; first the test.

Create `Frontend/app/community/p/[id]/__tests__/voteEvent.test.ts`:

```ts
import { expect, test, describe } from "bun:test";
import { isDisplayedVoteEvent } from "../../../../lib/voteEvents";

describe("isDisplayedVoteEvent", () => {
  test("keeps post-target vote events (the only ones rendered)", () => {
    expect(isDisplayedVoteEvent("post")).toBe(true);
  });

  test("drops comment-target vote events (never displayed → wasted re-render)", () => {
    expect(isDisplayedVoteEvent("comment")).toBe(false);
    expect(isDisplayedVoteEvent("reply")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Frontend && bun test app/community/p/\[id\]/__tests__/voteEvent.test.ts`
Expected: FAIL — `Cannot find module '.../lib/voteEvents'`.

- [ ] **Step 3: Write the guard helper**

Create `Frontend/app/lib/voteEvents.ts`:

```ts
/**
 * Post-detail only renders the POST's own vote counts (voteCounts.get(`post:id`));
 * comment vote counts are not displayed from the SSE map. Storing comment-target
 * vote events forces a full recursive CommentThread re-render whose result is
 * discarded (plan 2026-07-11 Perf 3). Only keep events we actually render.
 */
export function isDisplayedVoteEvent(targetType: string): boolean {
  return targetType === "post";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Frontend && bun test app/community/p/\[id\]/__tests__/voteEvent.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Apply the guard in the SSE handler**

In `Frontend/app/community/p/[id]/page.tsx`, add the import with the other `../../../lib` imports:

```ts
import { isDisplayedVoteEvent } from "../../../lib/voteEvents";
```

Replace the `"vote"` case (currently lines 93-98):

```tsx
        case "vote":
          setVoteCounts(prev => new Map(prev).set(
            `${event.targetType}:${event.targetId}`,
            { upvotes: event.upvotes, downvotes: event.downvotes },
          ));
          break;
```

with:

```tsx
        case "vote":
          if (!isDisplayedVoteEvent(event.targetType)) break;
          setVoteCounts(prev => new Map(prev).set(
            `${event.targetType}:${event.targetId}`,
            { upvotes: event.upvotes, downvotes: event.downvotes },
          ));
          break;
```

- [ ] **Step 6: Stabilize the `onCommentAdded` callback and memoize `CommentThread`**

(a) In `Frontend/app/community/p/[id]/page.tsx`, ensure `useCallback` is imported from `react`. Above the return / near the other handlers, add a stable handler (it depends only on `fetchData`, which must itself be stable — if `fetchData` is not already `useCallback`-wrapped, wrap it, else reference it directly):

```tsx
  const handleCommentAdded = useCallback(() => fetchData(true), [fetchData]);
```

Replace the list render (currently lines 581-587):

```tsx
          comments.map(comment => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onCommentAdded={() => fetchData(true)}
            />
          ))
```

with (stable callback → memo holds):

```tsx
          comments.map(comment => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onCommentAdded={handleCommentAdded}
            />
          ))
```

(b) In `Frontend/app/components/CommentThread.tsx`, add `memo` to the react import (line 3):

```ts
import { useState, useRef, memo } from "react";
```

Rename the component declaration (line 15) from `export default function CommentThread(` to a named function:

```tsx
function CommentThreadImpl({
```

(keep the prop signature and body — including the recursive `<CommentThread ... depth={depth + 1}>` self-reference near line 386 — unchanged; the recursion resolves to the memoized export below).

At the end of the file add:

```tsx
/**
 * Memoized: PostDetailPage re-renders on post-vote / comment-add SSE events.
 * With a stable onCommentAdded (parent useCallback) memo skips reconciling
 * unchanged comment subtrees (plan 2026-07-11 Perf 3).
 */
const CommentThread = memo(CommentThreadImpl);
export default CommentThread;
```

- [ ] **Step 7: Run tests + types**

Run: `cd Frontend && bun test app/community/p/\[id\]/__tests__/voteEvent.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: tests PASS; no new `tsc` errors in `page.tsx`/`CommentThread.tsx`.

- [ ] **Step 8: Commit**

```bash
git add Frontend/app/lib/voteEvents.ts Frontend/app/community/p/[id]/__tests__/voteEvent.test.ts Frontend/app/community/p/[id]/page.tsx Frontend/app/components/CommentThread.tsx
git commit -m "perf(community): stop discarded comment-tree re-renders on vote SSE

Perf 3: comment-target vote events were stored but never displayed, forcing a
full recursive CommentThread re-render. Drop them (isDisplayedVoteEvent,
unit-tested), memo CommentThread, and pass a stable onCommentAdded."
```

---

## Final Verification

- [ ] **Run the full Frontend test suite**

Run: `cd Frontend && bun test`
Expected: all tests PASS, including the 6 new test files (`oauthCallback`, `MermaidRenderer`, `docs/utils`, `readerPages`, `PageRenderer.memo`, `voteEvent`) and the pre-existing `MarkdownRenderer` test.

- [ ] **Lint**

Run: `cd Frontend && bun lint`
Expected: no new errors on the modified files.

- [ ] **Security spot-check (grep)**

```bash
cd Frontend
grep -n '"\*"' app/auth/callback/page.tsx        # → no output
grep -n "securityLevel" app/docs/MermaidRenderer.tsx   # → 'strict'
grep -n "sanitizeDocsUrl" app/docs/DocsClient.tsx      # → used in renderInline
grep -n "isTrustedOAuthCallbackMessage" app/contexts/AuthContext.tsx  # → used in onMessage
```

- [ ] **Manual E2E (per repo `feedback_verify_before_claiming`):**
  1. **OAuth:** log in via Google popup → still succeeds (same-origin postMessage). Confirm no console error about origin mismatch.
  2. **Docs XSS:** view a `/docs` issue whose body contains ` ```mermaid ` with a `click`/HTML-label payload and a `[x](javascript:alert(1))` link → diagram renders inert, link href is `#`, no script executes.
  3. **Reader perf:** batch-translate a ≥20-page chapter → page images do not flash every second in the DevTools Profiler.
  4. **Community perf:** open a thread with many comments while comment votes stream in → comment list does not re-render per vote event.

---

## Self-Review Notes

- **Spec coverage:** Backend review (no findings) → Task 0 commit-hygiene only; all 4 Frontend security findings (Vuln 1–4) → Tasks 1–4; all 3 Frontend perf findings (Perf 1–3) → Tasks 5–7 (Perf 1 split across Tasks 5+6 because memo needs stable props first). ✅
- **Type consistency:** `OAUTH_CALLBACK_TYPE`/`OAuthCallbackPayload` defined in Task 1, reused in Task 2; `resolveReaderPages`/`buildOtherLangNextMap` names match between `readerPages.ts` and its consumers/tests; `PageRendererImpl`→`PageRenderer` and `CommentThreadImpl`→`CommentThread` wrapper names consistent. ✅
- **No placeholders:** every code step shows the full replacement code; no "add error handling"/"similar to". ✅
- **Assumption flagged for the implementer:** Task 7 Step 6 assumes `fetchData` is stable or wrappable in `useCallback`. If `fetchData` closes over changing state, wrap its definition in `useCallback` with the correct deps first, then `handleCommentAdded` inherits stability. Verify before wiring.
