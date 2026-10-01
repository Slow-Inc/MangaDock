# CLI Google/Facebook pending login — 2026-10-01

## Reproduction and cause

The installed React Native CLI APK injects __MANGA_DOCK_CLIENT__=android-mobile-shell
and __MANGA_DOCK_NATIVE_AUTH__.startOAuth(provider, authorizeUrl). Its native handler
requires source=mangadock-web/type=oauth_start and an authorize URL containing a
mangadock://auth/callback?request_id=... redirect.

Current main AuthContext detects any ReactNativeWebView and posts the Expo-only
mangadock:oauth:start/provider/requestId message. The CLI handler ignores it, so no
browser starts and the pending login promise waits for its 120-second deadline.

New regression tests execute the real AuthProvider. Before the fix, Google and
Facebook both made zero signInWithOAuth calls and five new CLI regressions failed.

The live emulator also showed an unrelated Next.js HMR module-factory error.
Read-only HTTP inspection of https://hayateotsu.space showed next-devtools bundles,
confirming the custom domain currently serves a dev server rather than proving
parity with the latest GitHub/Vercel production deployment. Its displayed source
path is D:/Github/worktrees; this task does not own that remote server checkout.

## Fix

- Detect CLI capabilities separately from Expo.
- CLI uses WebView-local PKCE, a random bound request_id, the installed startOAuth
  bridge and the native callback custom event. An abortable PKCE HTTP exchange prepares tokens without mutating the shared session; only a still-active result is committed by the SDK.
- Ignore stale callback IDs and duplicate callbacks; reject code-less bearer payloads.
- Send consumed ACK, release pending listeners/timers and support cancellation.
- Keep a 120-second deadline during a stalled code exchange as well as browser wait. The SDK auth fetch used during session commit also has a 20-second deadline including response-body reads.
- Preserve existing Expo session protocol, ordinary browser implicit flow and MFA.
- Reuse this path for account-linking flows that use the common callback/open helper.

## Verification

- npm run test:auth: 23 passed, including CLI Google/Facebook, nonce mismatch,
  cancellation, token-only callback rejection, stalled exchange, Expo compatibility,
  flow selection, late aborted responses, provider account linking, bounded commit fetch, existing auth/MFA and account cache regressions.
- TypeScript and targeted ESLint passed.
- Next production compilation passed with placeholder QA Supabase configuration.
  This local compiled output is not a deployable production artifact.
- Real authenticated provider login remains a manual test on a matching deployed
  frontend; no account credentials or callback tokens were logged by this task.

PKCE code exchange must use the same local verifier storage where the flow began:
https://supabase.com/docs/guides/auth/sessions/pkce-flow

## Rollout

For Android QA, run this branch's frontend on the development computer and use
ADB reverse with a localhost-targeted QA APK. See [local Android QA instructions](LOCAL_ANDROID_QA.md).
This route does not use Vercel or require a main merge. The existing dev command
already serves port 4000; the OAuth implementation has no Vercel dependency.

For rollout, publish this frontend on the endpoint loaded by the APK. A main
merge alone does not establish that a separately hosted custom-domain dev server
has pulled the fix. Native custom-scheme URL parsing and the Supabase callback
allowlist must also be corrected before claiming end-to-end login acceptance.
