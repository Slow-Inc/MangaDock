# Phase 3 delivery — 2026-10-01

## Scope and acceptance

The user accepted Google/Facebook login, session persistence after reopening,
authenticated chapter reading and backend receipt of both shell headers on the
previous `1.0.1-beta.2` APK. This is manual user confirmation, not a new automated
end-to-end login run.

Delivery work is based on `feat/mobile-shell-phase3` at `ae327dc`, which already
contains native navigation, onboarding, settings and diagnostics. Preserve those
features while porting the earlier QA fixes into `MangaDockWebViewScreen`.
The delivery branch remains `1.0.1-beta.3` / version code 4. Social OAuth in this
CLI candidate uses PKCE plus a random request ID. It rejects token-only, unsolicited,
stale and mismatched callbacks. Results wait for WebView loading and remain queued
until the frontend acknowledges receipt. After process recreation or a page reload
that loses its pending listener, cancel and restart login; automatic recovery is not claimed.
The matching frontend must be deployed with the native candidate; Supabase redirect
configuration must allow the callback including its `request_id` query parameter.

`main` currently contains a separate Expo Mobile implementation and a different
native auth message protocol. The CLI delivery PR targets `feat/mobile-shell-phase3`.
Promoting the whole CLI branch to `main` requires an explicit integration decision;
deploying its older complete AuthContext over the current production context would
remove newer functionality.

## Production frontend verification

GitHub deployment metadata identifies Vercel as the production deployment service.
The latest successful Production deployment observed on 2026-10-01 references
`91d639269200078b7687607ff9a99763b32ebe56` (`main`), created on 2026-09-26.
It does not contain this delivery branch's source changes. Login acceptance remains
valid as the user's manual result; it does not establish source deployment parity.

The separate branch `fix/oauth-callback-completion-20261001` ports callback/hydration
fixes into current `main`, retaining its MFA, trusted callback message envelope and
native bridge protocol. Run its CI and use the team's Vercel deployment process
with real environment values after that PR is approved and merged.
Do not publish a build compiled with placeholder Supabase configuration.

## Release signing

The Gradle release build requires all four values below, supplied through environment
variables or private user-level `~/.gradle/gradle.properties`:

```properties
MANGADOCK_UPLOAD_STORE_FILE=C:/private/path/team-upload-key.keystore
MANGADOCK_UPLOAD_STORE_PASSWORD=<private value>
MANGADOCK_UPLOAD_KEY_ALIAS=<team alias>
MANGADOCK_UPLOAD_KEY_PASSWORD=<private value>
```

Use the team's existing key when one exists. Private signing files are ignored by
Git. No production key was generated and no passwords were saved by this task.
From `Mobile/android`, with JAVA_HOME and ANDROID_HOME configured:

```powershell
./gradlew.bat assembleRelease bundleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64'
```

For internal QA only, explicitly add `-PmangadockQaSigning=true`. This signs with
the existing debug key. These QA APK/AAB files are not store release artifacts.
Production signing remains pending until the team's keystore is available.

See [React Native signing](https://reactnative.dev/docs/signed-apk-android) and
[Android app signing](https://developer.android.com/studio/publish/app-signing).

## Physical Android test

Only `emulator-5554` was attached during delivery preparation. Connect an Android
phone with USB debugging and authorize this computer. Record its model, Android
version and the APK checksum, then test:

- Installation and native onboarding/home/settings/diagnostics.
- Google and Facebook login returning to the intended app.
- Close/reopen session persistence and an authorized chapter.
- Backend receipt of `x-hardware-id` and `x-manga-dock-client`.
- Search, keyboard, Back, rotation and manual recovery after network loss.

Use `adb -s <phone-serial> install -r <qa-apk>` only when an installed app has the
same signing certificate. A production-signed APK cannot update the debug-signed
preview in place. Preserve existing app data while resolving any signing mismatch.

The earlier user acceptance does not cover the new native navigation integration
automatically. Recheck the delivery artifact before publishing.

## Validation and review

- Mobile: 55 tests across 12 suites; lint and TypeScript passed.
- Matching CLI frontend: 12 auth/cache regressions passed; TypeScript and targeted lint passed with one existing unused-parameter warning.
- Final QA APK/AAB build: BUILD SUCCESSFUL in 22s, 257 tasks. Final APK reinstall succeeded without clearing app data.
- Emulator smoke: native onboarding/home, production WebView home and Android Back to native home were observed. Real OAuth against the matching CLI frontend and physical-device checks remain pending.
- Independent review found cache ownership, callback binding and queue-delivery issues; fixes and regressions were added and the reviewer verified all findings resolved within the reviewed scope.
- Artifacts/checksums: [metadata](../../docs/reports/phase3-delivery-20261001/artifacts.json); [build log](../../docs/reports/phase3-delivery-20261001/build.log); [home screenshot](../../docs/reports/phase3-delivery-20261001/home.png).

## Browser callback adapter — latest artifact, 2026-10-01

- Implements deployed Expo-style command compatibility inside the CLI APK; no frontend merge is required for this adapter.
- Native public config is materialized before injection (native constants may be non-enumerable). Native URL parsing uses an explicit URL ponyfill; the emulator exposed a failure hidden by Node's complete URL implementation.
- Verification: 61 tests / 13 suites pass; ESLint and TypeScript pass. Final APK build succeeded (19s, 248 tasks), reinstall preserves app data.
- APK: mangadock-phase3-beta3-browser-callback-20261001.apk, version 1.0.1-beta.3/code 4, QA debug signing, arm64-v8a+x86_64. SHA256 A3848E91BA90BA1E3DE06712FD4B7E96D1A8F60032D79165382B9DE776E8BD64.
- Runtime: native OAuth start observed, system Chrome opened. Browser landed at localhost:4000/auth/callback instead of returning to app.
- Independent no-credential server probe: authorize returns 302/accounts.google.com; an access_denied callback with the server-issued OAuth state returns 302/http://localhost/auth/callback with no request_id. This confirms the requested deep link is not preserved by current Auth redirect configuration. No credentials or callback codes were printed.
- Required external action: in Supabase project eqgcnoljbiwosecydjqd, Authentication → URL Configuration → Redirect URLs, add mangadock://auth/callback** and save. Re-run browser login afterwards. Auth config mutation is unavailable through connected tools and no management token is present.
- Real successful Google/Facebook login and signed-in callback remain unverified for this artifact. Unit code-exchange/session handoff coverage does not establish provider/redirect acceptance.
- Android currently has two apps claiming mangadock://; choose Mobile in the resolver. Do not clear app data or uninstall the other app during QA.
- PR #713 remains unmerged; PR #711 holds native delivery changes.
