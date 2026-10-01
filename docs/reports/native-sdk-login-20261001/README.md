# Android native SDK login QA — 2026-10-01

## Implemented

- Google Credential Manager 1.6.0 + Google ID 1.1.1, Meta Login 18.3.0.
- Native SDK module uses provider ID tokens, native nonces and a 20-second
  Supabase HTTP exchange. SDK request timeout is 120 seconds.
- Deployed web command/session protocol is reused; no PR #713/frontend deploy
  or Vercel dependency is required for this SDK path.
- Origin check before native request and immediately before injected session
  delivery; stale/cancelled/navigation-invalidated results are discarded.
- Native SDK logout follows successful Supabase logout (excluding scope=others),
  clears Google credential state and calls Meta logOut. It does not create a
  second native Supabase session store.
- Meta SDK requires its public Client Token and an OIDC AuthenticationToken.
  Missing configuration or Graph-only token settles as an error.
- Meta automatic events/advertiser collection/auto-init disabled in manifest.

## Validation

- 70 tests / 14 Jest suites pass; ESLint and TypeScript pass.
- SDK screen regression runs the actual injected delivery script against a
  foreign origin, proving it cannot dispatch session tokens there.
- Regression verifies delivery before loadEnd, SDK success, malformed session,
  errors, timeout, cancellation, replacement, destruction and trusted logout.
- Android Kotlin SDK integration and release QA builds compile successfully.
- First Google ID 1.2.1 build failed because it needs Kotlin 2.4 metadata; use
  1.1.1 compatible with the app's Kotlin 2.1 rather than upgrading all RN tooling.

## Observed emulator behavior

- Existing app data preserved using install -r on emulator-5554.
- Google click launched `com.google.android.gms/.identitycredentials.ui.CredentialChooserActivity`.
- Google Play Services showed its "Sign in with ease" account-addition UI.
- Back returned `TYPE_USER_CANCELED`, native rejected with auth/sdk-cancelled and
  WebView showed a readable Thai cancellation message.
- Full real-account ID-token exchange, signed-in WebView identity, persistence
  and logout/another-account acceptance remain pending. No successful login is
  claimed from the mock tests or account-addition UI.
- Facebook App ID is configured, Client Token absent. Its real SDK login/token
  acceptance is pending that public configuration and Meta Android registration.
- Custom domain still serves a dev server; avoid HMR/navigation during login.

## Provider configuration needed for real acceptance

- Google: Android OAuth registration for package com.mobile and QA SHA-1
  `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, same project as
  the discovered Web Client ID. Supabase must accept that ID-token audience.
- Facebook: MANGADOCK_FACEBOOK_CLIENT_TOKEN in the external properties file;
  Meta Android package/activity, signing key hash and app test-user access.
- Current public SDK config file is outside the repository in the user's Temp
  directory. App Secrets/service-role keys are neither needed nor embedded.
- Provider ID-token SDK flow does not depend on the mangadock browser redirect
  allowlist; ordinary browser OAuth/account linking still does.

## Review

Whole-branch review found an origin handoff race and missing native logout.
Both were fixed with RED/GREEN regressions. Final review is recorded below.

Final independent review found no remaining reviewed code blocker. Real-account
Google acceptance/persistence/account switching and Facebook SDK login remain
runtime verification gaps.

Final QA build succeeded in 15 seconds (248 tasks). Reinstall and launch succeeded.
APK SHA256: `6FA1DEECA4F92F0F55DF067FDE98BDE2A56E9E51287B80209AF2D8D13DFFE224`.

Artifact/checksum: see artifacts.json after final build/install.
