# Android Native SDK Login Implementation Plan

> For agentic workers: use superpowers:executing-plans inline, task by task.

**Goal:** SDK login in the CLI Android APK with session handoff to the deployed WebView.
**Architecture:** Kotlin provider module performs SDK token acquisition and bounded Supabase ID-token exchange. A tested JS controller binds the result to the active request and trusted WebView. The web remains session owner.
**Tech Stack:** Credential Manager 1.6.0, Google ID 1.1.1, Meta Login 18.3.0, React Native, OkHttp.
**Spec:** ../specs/2026-10-01-native-sdk-login-design.md

## Global Constraints

- Android com.mobile; deployed Expo-style web request/session protocol; PR #713 remains closed.
- Public config outside checkout; no service-role/App Secret in APK.
- One request, origin binding, cancellation, 120-second SDK wait and 20-second token exchange deadline.
- No session after cancelled, stale or destroyed request. No provider token logging.
- Facebook requires AuthenticationToken and matching nonce; regular access token is rejected.

## Review Focus

- Cancel followed by delayed result must not sign in.
- Missing provider config must settle instead of hanging.
- WebView leaves trusted origin while SDK UI is open: invalidate result.
- Provider returns invalid credentials/non-OIDC Facebook token: show error.
- Session persistence/logout belongs to existing web; verify on a real account.

## Task 1: Bound SDK request controller

Files: Mobile/src/nativeSdkLogin.ts; Mobile/__tests__/nativeSdkLogin.test.ts.
Interface: createNativeSdkLoginController(module, callbacks), start(provider, requestId), cancel(), dispose(). Module signIn(provider,id) returns Promise<{access_token,refresh_token}>; cancel(id).
- [x] Write cancellation, timeout, replacement, malformed result and success tests; run RED.
- [x] Implement controller; run GREEN.

## Task 2: Android SDK module and WebView integration

Files: NativeSdkAuth.kt, MainApplication.kt, build.gradle, AndroidManifest.xml, MangaDockWebViewScreen.tsx, MobileShellRegression.test.tsx.
- [x] Add failing screen integration regression showing deployed Google command invokes SDK and session message, not Linking.openURL.
- [x] Implement Kotlin SDK/provider exchange plus public config, nonce validation and native cancellation.
- [x] Route deployed request to controller; trusted navigation/destruction invalidates it; direct session MessageEvent handoff.
- [x] Run full Jest/lint/tsc and assembleRelease.

## Task 3: Runtime QA and handoff

- [x] Build/install distinctive QA APK with known Google ID/public Supabase config; preserve app data.
- [x] Verify Google SDK UI and cancellation on emulator; report external registration/config errors honestly.
- [ ] Verify Facebook missing-config failure on device and real Facebook SDK acceptance after Client Token/Meta registration.
- [x] Document artifact hash and exact QA outcomes; fresh whole-branch review.

## Execution ledger

- User approved SDK design and requested implementation/testing. Existing isolated delivery worktree is reused on a new native SDK branch; no shared branch changes.
- Public provider IDs discovered from Supabase authorize redirects. No Facebook Client Token located; implement missing-config failure and continue Google QA.

- Final verification: 70 tests / 14 suites, lint, TypeScript, release build and emulator installation passed. Google SDK UI and cancellation observed; real account session acceptance remains pending.
- Google ID 1.1.1 selected after 1.2.1 Kotlin metadata incompatibility with the existing toolchain.
