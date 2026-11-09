# Hybrid Expo/FCM configuration — 2026-11-09

The owner chose the existing Supabase → Nest worker → Expo Push → FCM approach,
confirmed that no EAS project existed, authorized creating new projects, and
completed Expo browser login. Supabase Auth/database remain unchanged. Payment
is excluded. This configuration record does not certify production Phase 5 rollout.

## Provisioned and verified

| Resource | Value |
|---|---|
| Firebase project | `mangadock-push-20261109`, MangaDock Hybrid Push |
| Firebase project number / sender ID | `1065474131120` |
| Android app | `com.mobile` |
| Firebase Android app ID | `1:1065474131120:android:a3cbdcbe4912555d89a775` |
| EAS project | [@saza31255za/mangadock-hybrid](https://expo.dev/accounts/saza31255za/projects/mangadock-hybrid) |
| EAS project ID | `ed3651c9-dd60-4cec-9ffe-96362f90727a` |
| FCM sender | `mangadock-expo-push@mangadock-push-20261109.iam.gserviceaccount.com` |
| Sender project role | `roles/firebasecloudmessaging.admin` |

Enabled IAM, FCM v1, Firebase Installations and FCM Registration APIs on this
new project. Verified the downloaded Android client configuration matches the
project/sender/package above. EAS credentials confirmed **Google Service Account
Key assigned to com.mobile for FCM V1**, with the same Firebase project and sender.
No legacy FCM key, Play Store submission credential or EAS signing keystore was set.
No billing-link operation or EAS cloud build was requested.

Private key/client configuration and local preparation helpers are outside Git:
`C:/Users/woral/.mangadock/push-20261109/`. Do not publish that directory.
The service-account JSON is a private server credential; it is not an APK input.
The Android build receives only the Firebase client JSON and public EAS project ID.
[Public setup metadata](setup.json) contains no access tokens or private keys.

## Source changes

- `Mobile/app.json`: public Expo owner/slug/package/project link. Retained root
  `name: Mobile` for React Native's existing AppRegistry registration.
- `Mobile/eas.json`: production credentials profile for EAS management. Native APK
  assembly/signing still use local Gradle; no Expo prebuild or cloud build.
- `Mobile/android/app/build.gradle`: `1.2.0-phase5-beta.4` / code `11`; fixed
  external Firebase client configuration for google-services plugin `4.4.4`.
  Its `googleServicesJsonFiles` is `Property<Collection<File>>`, not a file
  collection supporting `setFrom`. Apply `.set([file(...)])` after project evaluation
  so the plugin's variant configuration does not overwrite the external file.
- `Mobile/src/hybridPush.ts` and `Mobile/__tests__/hybridPush.test.ts`: distinguish
  document revision from account revision. Connect/ready may finish while Auth
  hydrates in the same document; navigation/disposal still cancels stale handshakes
  and account-bound permission/token/presentation work still rejects account changes.
  Two account-hydration regressions failed before the fix; all three new document/
  account tests pass, including cancellation on navigation.
- `Frontend/app/lib/hybridPushTransport.ts`, its new test file, and
  `Frontend/app/components/HybridPushProvider.tsx`: retry only startup connect/
  session/ready work up to three attempts after late WebView load callbacks,
  stop retrying on disposal, and resync the current account before OS permission.
  Token/registration work remains account-guarded. Focused web tests pass **20/20**
  (17 controller + 3 handshake retry), with types/build/focused lint passing.
- Existing dirty files and other worktrees were preserved. No commit/push,
  production backend/frontend deployment, Supabase migration or user-data change.

## Build and validation

- Reproduced enabled-build failure:
  `No signature of method: org.gradle.api.internal.provider.DefaultProperty.setFrom()`.
- Correcting the property type exposed the plugin's later override:
  `File google-services.json is missing.` despite a valid external file.
- Confirmed the installed plugin's property type with `javap`; deferred configuration
  then passed `:app:processReleaseGoogleServices` using the external file.
- Push-enabled live and isolated-QA release assembly/vital lint passed, with
  `MANGADOCK_PUSH_ENABLED=true` and the actual EAS ID above. Mobile **96/96 tests**
  and TypeScript passed before the handshake fix; final source passes **99/99**, 18
  suites, TypeScript and lint (one existing inline-style warning). Existing
  build/tooling warnings were not suppressed.
- Runtime device/remote-delivery evidence is recorded separately after execution;
  an enabled build or assigned credential alone is not delivery acceptance.
- Final focused checks after the permission-account guard: `bun test
  app/lib/hybridPushController.test.ts app/lib/hybridPushTransport.test.ts` passed
  20/20; `tsc --noEmit` and focused ESLint passed. A direct Node strip-types
  invocation failed with `ERR_MODULE_NOT_FOUND` for extensionless TS imports;
  Bun is the verified runner. No application import changes were needed.

Final physical acceptance with the final Native APK and updated web build passed
**six flows**: real native Expo token → authenticated isolated Backend acknowledgement;
Expo send ticket; actual Android-posted FCM background notification; tap → Collections;
successful Expo/FCM receipt; same-process reload followed by opt-out/registration
removal. [Final results](device-push-results.json) records the installed QA APK hash.
An independent read-only Native ownership query confirms the cleanup marker is
cleared ([native cleanup](native-cleanup.json)). Native notification permission was
granted through the real OS dialog in the initial run and remains granted; opt-out
disables this test registration rather than silently changing Android's permission.

Initial physical run confirmed real Android permission, a real native Expo token
acknowledged by isolated Nest/PGlite, Expo ticket and FCM receipt, an Android-posted
background notification, and notification tap → Collections. Only the owner's
Flip4 was targeted; no other user, live Supabase row or production outbox was used.
The initial cleanup page reload exposed a Native handshake/Auth-hydration race;
the initial cleanup button stayed disabled. A restart allowed explicit opt-out
([initial evidence](device-push-initial-results.json)).
The Native fix above was then regression-tested and rebuilt. A further physical
run still reproduced initialization failure after a late duplicate load-start,
so that run is not relabeled as clean acceptance
([evidence](device-push-native-fix-results.json)). A metadata-only RPC trace showed
valid connect/session/ready/permission/token acknowledgements and duplicate native
load-start callbacks during one navigation; no token was recorded in that trace.
The bounded web startup retry/resync change then passed same-process reload and
explicit opt-out without restart ([cleanup](device-push-cleanup.json)).

## Artifacts and local reproduction

`Mobile/build/push-setup-20261109/` contains immutable local artifacts:

- `hybrid-phase5-push.apk`: live target `https://hayateotsu.space`, native Push enabled.
- `hybrid-phase5-push-local-qa-final.apk`: loopback `http://127.0.0.1:4016`, native Push enabled;
  requires isolated QA services/ADB reverse. Not a production distribution artifact.
- `hybrid-phase5-push-off-rollback.apk`: live target with Push disabled, same code/signing;
  reserved for rollback without uninstall/data clear.

The live/QA builds use ARM64 + x86_64, target SDK 36, existing debug/QA signing.
They are not store releases. Do not install an older code10 artifact as a rollback
requiring data loss; use the code11 Push-off artifact instead.

Final live-target install succeeded on Flip4 in session `111925825` using
`adb install --no-streaming -r`. Installed base.apk SHA-256 matches the live
artifact: `0a306652710c7ce5137b9adbc0545714807f51a3b8e04eef7da41415fa14adb2`.
Actual WebView opened `https://hayateotsu.space/`, title `MangaDock by Hayate |
Manga Streaming Platform`, readyState `complete`, native Push capability `true`.
See [installation](installation.json), [WebView metadata](live-webview.json) and
[original live screenshot](03-live-target.png). App data was preserved.

The first streaming attempt waited over 15 minutes for a Google Play Protect
dialog. Abandoned only this task's shell-owned session `1611298464`; no system/
Play install session was abandoned. The one-time APK scan option was selected
in the actual Play Protect dialog, without enabling automatic uploads or disabling
protection. The non-streaming retry then returned `Success`. A guarded further
retry stopped before mutation because the successful session had already finished;
no third install was started. No security setting was changed.
Stopped only this task's loopback QA API (the QA web server was already stopped),
verified ports 4015/4016 closed, removed this task's ADB reverse/forward mappings
and temporary capture file, and left the live app open. Original evidence files
are indexed in [SHA-256 hashes](evidence-sha256.json).

From `Mobile/android/`, with the existing SDK/JDK environment:

```powershell
.\gradlew.bat :app:assembleRelease :app:lintVitalAnalyzeRelease `
  -PmangadockQaSigning=true '-PreactNativeArchitectures=arm64-v8a,x86_64' `
  '-PmangadockNativeAuthProperties=C:/Users/woral/.mangadock/push-20261109/public-client-enabled.properties'
```

The equivalent `isolated-qa-enabled.properties` and disabled `public-client.properties`
remain external. No Supabase service-role key or Google service-account key belongs
in any APK properties file.

## Remaining deployment boundary

Native Push capability does not enable server delivery. This task did not enable
`PUSH_DELIVERY_ENABLED` (it defaults off in the reviewed source). Compatible web/API
routes, reviewed Supabase retention/push migrations,
real-account registration, outbox/Redis delivery and production signing still need
their rollout workflow. Earlier live Phase 5 routes returned 404. No current live
schema or production deployment was changed as part of this configuration.

## Backup / rollback

- Source backup: `C:/Users/woral/md-hybrid-push-backup-20261109/` (pre-change
  app.json, code10 build.gradle, pre-handshake-fix Native host/tests and web
  Provider/transport). Preserve later edits before restoring anything;
  the EAS profile was newly added. No reset/clean of the dirty worktree.
- IAM backup: `C:/Users/woral/.mangadock/push-20261109/iam-policy.before.json`.
  Roll back only this sender's added role binding while preserving concurrent IAM
  changes. Revoke the newly created service-account key and unassign its EAS FCM
  binding only if the owner chooses to cancel sending; revocation affects future Push.
- Do not automatically delete cloud projects or restore the whole IAM policy over
  newer changes. Supabase and unrelated Firebase project `family-hub-pfdm-2026`
  were not repurposed or modified.
- Native rollback: install the code11 Push-off APK with `adb install -r`, preserving
  app data and the existing certificate. Production server sending was not enabled
  by this task. Keep APKs/private backup outside public distribution.
