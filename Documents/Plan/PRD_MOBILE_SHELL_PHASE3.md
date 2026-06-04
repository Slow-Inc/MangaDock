# PRD: Phase 3 Android-first Mobile Shell

## Problem Statement

MangaDock currently has a strong web experience, but Phase 3 needs a dedicated Android entry point that can behave like a mobile app while still reusing the existing web app. The immediate problem is not native screen translation; it is giving users an Android Mobile Shell that can load MangaDock, preserve the existing WebView Auth flow, and pass the Zero-Trust `x-hardware-id` requirement for protected content.

Without the Mobile Shell, Android users must use a normal browser session and the project has no controlled place to provide mobile client headers, persist a Mobile Hardware ID, or prepare the Phase 4 native Android roadmap.

## Solution

Build an Android-first Mobile Shell under `Mobile/` using a bare React Native CLI TypeScript project. The app will wrap the existing MangaDock web app in a WebView, load a configurable MangaDock web URL, generate a persistent app-scoped Mobile Hardware ID, and apply Mobile Header Injection for `x-hardware-id` and `x-manga-dock-client`.

The first milestone will keep authentication inside the existing web app through WebView Auth. It will not introduce native OAuth, token injection, native token storage, direct MIT processing, screen capture, or overlay rendering.

## User Stories

1. As an Android reader, I want to open MangaDock from a mobile app icon, so that the platform feels like a dedicated app rather than a browser tab.
2. As an Android reader, I want the Mobile Shell to load the existing MangaDock web app, so that I can keep using the current reader, community, studio, and account flows.
3. As an Android reader, I want the app to remember my web authentication session, so that I do not need to log in every time I reopen the app.
4. As an Android reader, I want protected manga chapter pages to load inside the app, so that I can read without seeing `Missing hardware ID`.
5. As an Android reader, I want translated manga flows to keep working inside the app, so that the Mobile Shell does not break existing Patch Translation and Batch Translation behavior.
6. As a developer, I want the Mobile Shell source isolated under `Mobile/`, so that mobile work has a clear boundary from `Frontend/`, `Backend/`, and `MIT/`.
7. As a developer, I want a single mobile config module for the MangaDock web URL, so that emulator, physical device, staging, and production targets can be changed without scattering hardcoded URLs.
8. As a developer, I want the default Android emulator URL to be `http://10.0.2.2:4000`, so that the app can load the local Next.js frontend running on the host machine.
9. As a developer, I want the Mobile Shell to create a persistent app-scoped Mobile Hardware ID, so that backend Zero-Trust routes can receive `x-hardware-id` without using Android ID or IDFV in Phase 3.
10. As a developer, I want Mobile Header Injection to add `x-hardware-id`, so that backend routes guarded by the Hardware ID middleware can accept requests from the Mobile Shell.
11. As a developer, I want Mobile Header Injection to add `x-manga-dock-client`, so that server logs and future policies can distinguish Android Mobile Shell traffic from normal browser traffic.
12. As a developer, I want WebView Auth to reuse the existing Supabase web flow, so that Phase 3 avoids native OAuth, deep links, token injection, and native token storage risk.
13. As a developer, I want a protected content smoke test, so that the team can prove `x-hardware-id` reaches the backend instead of only proving that the WebView opens.
14. As a developer, I want a fallback path if WebView headers do not reach frontend fetches, so that we can add a frontend bridge only when the smoke test proves it is necessary.
15. As a maintainer, I want the mobile toolchain decision documented, so that future contributors understand why React Native CLI was chosen over Expo.
16. As a maintainer, I want Android-first scope clearly documented, so that Phase 3 does not expand into iOS, screen capture, overlay rendering, or direct MIT mobile client work.
17. As a QA tester, I want README run steps for emulator and physical Android devices, so that I can reproduce the Mobile Shell setup without reverse-engineering local URLs.
18. As a QA tester, I want to verify Mobile Hardware ID persistence across app restarts, so that identity does not change every launch.
19. As a QA tester, I want to verify the app still uses the existing web auth flow, so that introducing the Mobile Shell does not create a new authentication surface.
20. As a future Phase 4 implementer, I want a bare React Native CLI foundation, so that later Android native modules can be added without replacing the Phase 3 app shell.

## Implementation Decisions

- Build the Mobile Shell under `Mobile/`.
- Use a bare React Native CLI TypeScript project, not Expo. This is recorded in ADR 0001 because the later Android native roadmap makes the toolchain choice meaningful.
- Make Phase 3 Android-first. iOS support is not an acceptance criterion for this PRD.
- Use `react-native-webview` for the WebView shell.
- Use a single mobile config module for the MangaDock web URL.
- Default the development web URL to `http://10.0.2.2:4000` for Android emulator usage.
- Allow the web URL to be overridden later for LAN, staging, and production environments.
- Generate a Mobile Hardware ID as an app-scoped persistent UUID.
- Do not use Android ID, IDFV, or broader device fingerprinting in this milestone.
- Store the Mobile Hardware ID persistently so it survives app restarts.
- Apply Mobile Header Injection by sending `x-hardware-id` and `x-manga-dock-client` from the WebView layer first.
- Treat the frontend bridge fallback as conditional work. It should only be added if the protected content smoke test proves WebView header injection does not reach the relevant backend requests.
- Keep WebView Auth as the Phase 3 authentication model. The embedded MangaDock web app continues to use the existing Supabase web authentication flow.
- Do not store Supabase tokens in native storage.
- Do not add native OAuth callbacks, deep links, or token injection in this PRD.
- Protected content for this PRD means backend routes that reject requests with `Missing hardware ID` when `x-hardware-id` is absent, especially chapter pages, translation, version, and upload flows.
- Keep `Frontend/`, `Backend/`, and `MIT/` changes out of the first milestone unless the protected content smoke test proves a minimal frontend bridge fallback is required.
- Document setup and run steps in the Mobile Shell README, including emulator and physical-device URL guidance.

## Testing Decisions

- Tests should verify external behavior rather than internal implementation details.
- The mobile config module should be testable as a small deep module: given no override, it returns the Android emulator default; given an override, it returns the configured web URL.
- The mobile identity module should be testable as a deep module: first call creates a Mobile Hardware ID, subsequent calls return the same value, and failures are surfaced clearly.
- The WebView shell should be verified by Android smoke testing rather than brittle snapshot testing.
- Verify the Android app builds and runs on an emulator.
- Verify the WebView loads the configured MangaDock web URL.
- Verify the same Mobile Hardware ID is reused after closing and reopening the app.
- Verify outbound requests include `x-hardware-id` and `x-manga-dock-client` using backend logs, network inspection, or a temporary diagnostic route if needed.
- Verify a protected content route does not return `Missing hardware ID` when reached from the Mobile Shell.
- Verify WebView Auth still works through the embedded web app without native token handling.
- If a frontend bridge fallback is added, test only the helper behavior that attaches the Mobile Hardware ID to proxy requests; do not test implementation details of WebView internals.
- If `Frontend/` or `Backend/` is modified, run the relevant existing lint/build/test command for that subsystem.

## Out of Scope

- iOS support.
- Expo migration or Expo app scaffold.
- Native OAuth.
- Native deep links for auth callbacks.
- Native Supabase token storage.
- Token injection from native code into the web app.
- Android ID, IDFV, or production-grade device fingerprinting.
- MediaProjection screen capture.
- WindowManager overlay rendering.
- Realtime screen translation.
- Direct MIT mobile client behavior.
- Push notifications.
- Offline reading.
- Mobile-specific redesign of MangaDock screens.
- Changes to Patch Translation, Batch Translation, or MIT internals.

## Further Notes

- Work is on branch `feat/mobile-shell-phase3`, which has already been pushed to `origin/feat/mobile-shell-phase3`.
- The default Android emulator URL `http://10.0.2.2:4000` maps to the host machine's `Frontend/` dev server on port `4000`.
- The key acceptance risk is not whether a WebView can open MangaDock; it is whether Mobile Header Injection reaches the backend paths guarded by the Hardware ID middleware.
- The first implementation should stay small and prove the shell boundary before adding native auth or Phase 4 Android features.
