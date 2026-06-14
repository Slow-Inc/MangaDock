# ADR 015 — Frontend auth context: Supabase AppUser adapter, OAuth popup+postMessage, cross-user cache isolation, toast login prompt

- **Status:** Accepted (2026-06-14) — implemented. All four sub-decisions are live in `Frontend/app/contexts/AuthContext.tsx`, `Frontend/app/auth/callback/page.tsx`, and `Frontend/app/lib/apiCache.ts`.
- **Area:** Frontend (Next.js 16 / React 19, Supabase Auth)
- **Scope:** documents the existing four-part auth/session architecture in the React context, not a proposal.

## Context

The Frontend authenticates via Supabase Auth (Google OAuth, Facebook OAuth, email/password) but the app is a client-side SPA with persistent shared layouts (community forum) and an in-memory L1 API cache. Four forces shape the auth layer:

1. **Provider coupling.** Supabase's `User` type (`user_metadata`, `identities`, `email_confirmed_at`, snake_case provider names like `google`/`facebook`/`email`) would leak into every UI component if consumed directly. The codebase carries Firebase-era provider conventions (`google.com`, `facebook.com`, `password`) that the rest of the UI still speaks.
2. **OAuth must not wipe SPA state.** A classic redirect-based OAuth flow navigates the whole document away and back, destroying in-memory React/cache state and scroll position. The app needs OAuth to complete without tearing down the running SPA.
3. **Shared-device privacy.** The L1 API cache (`Frontend/app/lib/apiCache.ts`) is a process-global `Map` (one per browser tab, not per user). Forum posts, search results, and profile data cached for user A would be served to user B if A signs out and B signs in on the same device/tab — a cross-user data-bleed leak.
4. **Unauthenticated UX.** Auth-required actions need a prompt that fits the app's toast UX and can open the login modal, not a blocking native `alert()`.

## Decision

The auth layer makes four coupled decisions, all in `Frontend/app/contexts/AuthContext.tsx` unless noted.

### 1. Supabase `User` → stable `AppUser` via an adapter

`AppUser` (defined at `AuthContext.tsx:30-43`) is the only user shape the UI sees: `uid`/`id`, `email`, `displayName`, `photoURL`, `emailVerified`, `role`, and a normalized `providerData[]`. `adaptUser(u: SupabaseUser)` (`:54-79`) maps Supabase fields into it — reading `user_metadata` (`display_name`/`full_name`/`name`, `avatar_url`/`picture`, `role`), deriving `emailVerified` from `!!u.email_confirmed_at`, and flattening `u.identities`. `mapProviderId(provider)` (`:46-51`) translates Supabase provider names to the UI's canonical IDs: `google → google.com`, `facebook → facebook.com`, `email → password`, else passthrough. `unlinkAccount` (`:575-598`) maps these IDs back to Supabase names, confirming the adapter is the single translation seam in both directions. Every place the context publishes a user — the `onAuthStateChange` listener (`:266`) and the profile-mutation refreshes — routes through `adaptUser`.

### 2. OAuth via popup + `postMessage`, not redirect

`signInWithGoogle`/`signInWithFacebook` (`:400-420`) call `supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } })`. `skipBrowserRedirect: true` means Supabase returns the provider URL instead of navigating; the app opens it in a centred popup via `openOAuthPopup(data.url)` (`:323-398`) and keeps the SPA running. The same pattern is reused by `linkGoogleAccount`/`linkFacebookAccount` (`:555-573`) and social `reauthenticateUser` (`:668-677`).

The popup callback page `Frontend/app/auth/callback/page.tsx` runs inside the popup, lets the Supabase client auto-process the token, then `window.opener.postMessage({ type: "supabase:oauth:callback", access_token, refresh_token }, "*")` on `SIGNED_IN`/`TOKEN_REFRESHED` (`callback/page.tsx:35-50`), or posts `{ error_code, error }` on the error path (`:23-32`), and closes itself. The opener's `onMessage` handler (`AuthContext.tsx:341-380`) filters on `event.data?.type === "supabase:oauth:callback"`, maps Supabase error codes to the UI's Firebase-style codes (`identity_already_exists → auth/credential-already-in-use`, `email_exists → auth/email-already-in-use`), and only calls `supabase.auth.setSession()` if the opener missed the shared-localStorage write (`:373-378`). A `setInterval(..., 500)` polls `popup.closed` as a fallback (`:384-396`), rejecting with `auth/popup-closed-by-user` if the user closes the popup without completing — this also defends against cross-origin `popup.closed` access throwing. On success the flow calls `reloadPage()` (`:408`, `:419`).

### 3. Full L1 cache clear on every auth-state change

`clearAllApiCache()` (`apiCache.ts:91-93`) does `store.clear()` — it wipes the entire 500-entry (`MAX_ENTRIES = 500`, `:11`) LRU regardless of tags or TTL tier (`TTL.SHORT`/`MEDIUM`/`LONG`, `:4-8`). The auth context invokes it at **every** transition that changes identity:
- account switch detected (`lastUidRef.current !== suUser.id`) in the `onAuthStateChange` listener (`:272-276`),
- `SIGNED_OUT` event (`:299-304`),
- explicit `signOut()` (`:508`),
- `deleteAccount()` (`:693`).

It is always paired with `clearUserCache()` + `clearHistory()` for the local-first caches. This is the security-relevant invariant: a full clear is correct-by-construction regardless of how individual entries were tagged.

### 4. `showLoginPrompt()` toast, never `alert()`

`showLoginPrompt()` (`:201-215`) shows an info toast ("กรุณาเข้าสู่ระบบเพื่อใช้ฟีเจอร์นี้") with a "เข้าสู่ระบบ" action that dismisses the toast and opens the login modal (`setLoginOpen(true)`). The modal is rendered lazily and gated on `loginOpen` (`:805`, `LoginModalLazy` at `:811-815`). The context exposes `showLoginPrompt` to all consumers via the memoized provider value (`:766-798`); no auth-required UI path uses a native `alert()`.

## Alternatives considered

- **Expose Supabase `User` directly to the UI — rejected (coupling).** Every component would depend on Supabase's schema and snake_case provider names; an auth-provider swap would touch the whole UI. The `adaptUser`/`mapProviderId` seam confines that knowledge to one file (evidenced by `unlinkAccount` mapping back through the same two ID conventions).
- **Redirect-based OAuth — rejected (loses SPA state).** A full-document redirect tears down in-memory React state, the L1 cache, and scroll position. `skipBrowserRedirect: true` + popup keeps the running SPA intact; the `postMessage` channel is what makes the popup viable even when the callback and opener differ in origin/localStorage isolation (`AuthContext.tsx:370-378`, `callback/page.tsx` comment).
- **Per-tag / per-key cache invalidation on auth change — rejected (fragile).** `apiCache.ts` already supports `cacheInvalidate(...keys)` (`:78-80`) and `cacheClearByTag(tag)` (`:82-88`), but using them on auth change requires *every* cached entry to be perfectly tagged with its owning user — one mis-tagged forum/search/profile entry leaks across users. A full `store.clear()` is safe by construction and cheap (the cache repopulates on demand via stale-while-revalidate).
- **`alert()` for unauthenticated flows — rejected (jarring UX).** A blocking native dialog breaks the app's toast-based UX and can't offer an inline "sign in" action. (Native `alert()` survives only in non-auth error paths such as unlock/top-up failures in `BookDetailModal.tsx`, not in the auth-required prompt path.)

## Consequences

- **Positive — cross-user privacy guarantee on shared devices.** The unconditional `clearAllApiCache()` on every identity transition means forum/search/profile data cached for one user is never served to the next on the same tab. Being a full clear, it cannot be defeated by a mis-tagged entry.
- **Positive — single point of provider coupling.** Swapping or augmenting the auth provider is localized to `adaptUser`/`mapProviderId` and the `signInWithOAuth` calls; the rest of the UI keeps consuming `AppUser`.
- **Positive — OAuth without SPA teardown.** Popup + `postMessage` + `reloadPage()` on success keeps in-memory state alive during the OAuth handshake and gives explicit, mapped error codes to the UI.
- **Positive — consistent toast UX** for auth-required actions via `showLoginPrompt()` with a one-tap path into the login modal.
- **Negative / limits — the cache-clear invariant is implicit and easy to drop.** `clearAllApiCache()` lives in the auth context, not enforced by the cache module. A cache refactor (e.g. switching to scoped/keyed caches, or introducing a second cache store) that forgets to re-wire all four call sites silently reintroduces cross-user bleed with no test or type error to catch it.
- **Negative / limits — popup OAuth race conditions.** Correctness depends on the `closedPoll` interval, the `message` listener, and `popup.close()` all being torn down on every exit path; popup blockers reject up-front (`auth/popup-blocked`, `:334-337`); and the `postMessage` target origin is `"*"`, with safety resting on the `type` filter rather than an origin check.
- **Negative / limits — full clear discards still-valid cross-user-safe entries** (e.g. quasi-static `TTL.LONG` catalog data), forcing a re-fetch after every sign-in/out. Accepted as the price of a provably-safe clear.
- **Follow-ups:** consider moving the auth-change cache reset behind a single helper the cache module owns (so it can't be forgotten in a refactor); add an explicit allowed-origin check in the `postMessage` handler; if `message` delivery ever proves flaky, the `popup.closed` poll already provides a fallback resolution path.
