# Hybrid Phase 5 implementation and resume point — 2026-10-26

Branch: `feat/mobile-hybrid-phase5-20261026`, directly based on pushed hybrid
Phase 4 `69badd5f`. Native Phase 5 Mobile sources and the dirty `md-hybrid-phase45`
worktree were not used as the base or overwritten.

## Delivered

| Area | Behavior |
|---|---|
| Following/personalized feed | Existing follow graph, chronological/ranked pagination, retry and empty states, Community entry point |
| Reading collections | Private by default, create/edit/delete, manga search/add/remove, public share URL, guest read and immediate privacy revocation |
| Hybrid destinations | Feed, collections, UUID collection detail and notification settings deep links; native Home shortcuts |
| OS push | SDK 56 notifications inside the CLI WebView shell; opt-in, denial guidance, acknowledged registration, local preview and opt-out |
| Session lifecycle | Auth stays in web; logout removes registration before Supabase sign-out, account switches suppress presentation, interrupted ownership cleanup retries |
| Notification routing | Cold/foreground/background response listener, duplicate response rejection, recipient matching and allowed product destinations |
| Delivery backend | Durable PostgreSQL outbox, binding checks, Redis dispatch, leases, bounded retry/dead letters and Expo receipts; disabled by default |

Backend/Frontend retention and delivery source is reused from `b168975`; the
hybrid bridge, web controller adapter, settings UI and Android integration are new.
Architecture: [ADR 034](../../docs/adr/034-hybrid-phase5-web-session-and-os-push.md).

## Validation

- Mobile: **91/91 tests**, 17 suites; TypeScript passes. ESLint has zero errors
  (one pre-existing inline-style warning).
- Push web controller: **16/16** tests; auth/cache regression: **12/12**.
- Backend: build and **18/18** PostgreSQL/HTTP/worker tests pass. These use real
  migration SQL in isolated PGlite and substitute provider/Redis boundaries.
- Frontend: TypeScript, focused ESLint and production build pass. Browser QA at
  **390 and 1280 px** covers collection CRUD/share/privacy, feed modes/retry and
  the hybrid Push UI. The final pass uses the **actual Next proxy** and isolated
  Nest/PGlite feature services. Auth/catalog and Android OS APIs are QA fixtures.
  No real user writes or remote push are performed.
- Broad Frontend: **510 pass, 8 fail, 2 errors**. The pushed Phase 4 baseline run
  reproduces the same **8 fail / 2 errors** (494 pass), in docs SSR/Markdown and
  missing Playwright test dependency. Auth harness was updated for the new optional
  cleanup import; its 12 auth/cache regressions pass.
- Backend full CI configuration on **Node 22 passes 114 suites / 1,179 tests**.
  A broad run on Node 26.3.0 stopped in timer teardown with
  `ReferenceError: setTimeout is not defined`; use the repository's Node 22 CI runtime.
- The local Windows run with CI-pinned Bun 1.3.14 stalled in the existing
  `reviewsFetch.test.ts` timeout case and was stopped; it is not a green CI claim.
  The completed broad Frontend results above use Bun 1.4.4.
- Android ARM64 `assembleRelease` and `lintVitalAnalyzeRelease` pass. Enabled
  push with missing configuration fails before compilation with an actionable
  EAS/Firebase error. Notifications modules/services are in generated autolinking
  and the merged manifest. Unneeded external-storage permissions are removed.

Screenshots and browser results: [QA evidence](../../docs/reports/hybrid-phase5-2026-10-26/README.md).

## APK and reproduction

QA version **1.2.0-phase5-beta.1 / code 8**, `com.mobile`, ARM64 + x86_64, target SDK 36,
existing debug/QA signing. Public Frontend/Supabase settings are copied from the
accepted Phase 4 local properties file; **push remains disabled**.
The final multi-ABI binary's size/hash are in [apk.json](../../docs/reports/hybrid-phase5-2026-10-26/apk.json).
An earlier ARM64 build was installed over code 7 on Z Flip4 and the app process
started without observed native/JS fatal errors. The final multi-ABI update did
not finish while the phone cover screen was active and its installer was stopped (cause not established);
physical acceptance of the final binary remains pending. No uninstall/data clear.

```powershell
# Mobile/ (Node and Android SDK installed)
npm.cmd ci
npm.cmd run typecheck
npm.cmd test -- --runInBand
npm.cmd run lint

# Mobile/android/. Public client properties are outside Git.
$env:ANDROID_HOME='C:/path/to/Android/Sdk'
$env:NODE_ENV='production'
.\gradlew.bat :app:assembleRelease :app:lintVitalAnalyzeRelease `
  -PmangadockQaSigning=true '-PreactNativeArchitectures=arm64-v8a,x86_64' `
  -PmangadockNativeAuthProperties=C:/path/to/public-client.properties
```

For a configured push build add these values to the same **external** properties
file (not the repository):

```properties
MANGADOCK_PUSH_ENABLED=true
MANGADOCK_EAS_PROJECT_ID=<existing-team-project-uuid>
MANGADOCK_GOOGLE_SERVICES_JSON=C:/private/firebase-client-com.mobile.json
```

Register the existing Firebase Android app **com.mobile**, QA/release signing
certificates and FCM v1 credentials in that EAS project. No new cloud project or
provider setting was created. `google-services.json` and external signing data
must remain outside Git. Server-side `PUSH_DELIVERY_ENABLED` stays false until
database/provider/device acceptance is complete.

```powershell
# Backend/: builds + isolated migration/authorization/worker tests
npm.cmd run test:phase5
# Frontend/: existing Bun runner, plus auth regressions
bun test app/lib/hybridPushController.test.ts
npm.cmd run test:auth
# Local browser QA: start Backend/test/phase5-preview.cjs on 4015,
# build/start the Frontend on 4016 with phase5.supabase.co QA public settings.
$env:PLAYWRIGHT_MODULE='C:/tools/node_modules/playwright'
$env:PHASE5_USE_PROXY='true'
$env:PHASE5_QA_OUTPUT='C:/path/to/qa-output'
node scripts/phase5-browser.cjs
```

## Experiment ledger

| Run | Observation / conclusion |
|---|---|
| Initial Mobile import | Eager AsyncStorage import broke Jest module loading even with push disabled; require it with Expo only when the host is created. Same tests and native build pass. |
| Native host tests | A test fixture lacked public EAS configuration before token acquisition; add the real module boundary fixture and a bounded wait, then verify stale-token rejection. |
| Browser opt-in | Backend returned `400 Device header mismatch`; QA forwarding had dropped hardware headers. Production proxy already forwards them. Fix the harness, then pass through the actual Next proxy. |
| Broad auth regression | The VM harness rejected the new cleanup import. Extend its optional-module boundary and rerun auth/cache tests; all 12 pass. |
| Expo source trace | Reading the same FCM token emits a token event; deduplicate changes to avoid a refresh loop. Disable Expo auto-server mapping before native unregister. Covered by native host tests. |
| Android packaging | A parallel ADB streamed install held the output APK open and blocked re-packaging. Stop only that owned installer, build successfully, then install a copied immutable QA artifact with `--no-streaming`. |
| Emulator ABI | ARM64-only installed on the x86 emulator but SoLoader required x86_64. Multi-ABI QA build starts the app/WebView without native/JS crash. |
| Public endpoint | The deployed `hayateotsu.space` page returned Cloudflare Tunnel error 1033 during emulator QA. This is a direct observation, not a root-cause diagnosis or production-flow acceptance. |
| Final browser rerun | Automatic approval review blocked restarting the local Next QA server with an `INTERNAL_API_URL` override; no further reason was supplied. Prior actual-proxy browser acceptance passed; final ownership-recovery changes have unit/type/build coverage. |
| Full CI runtime | Node 22 Backend full Jest passes 1,179/1,179. Local Windows Bun 1.3.14 hangs in the existing reviews timeout test; Bun 1.4.4 broad results and baseline comparison are recorded separately. |

## Resume here / งานที่ต้องทำต่อก่อน rollout

1. Inspect the real existing schema and apply the reviewed retention migration,
   then push migration through the team's database workflow. No remote migration
   was executed here.
2. Deploy compatible Backend/Frontend from this branch. The public site continues
   to serve its deployed revision until that deployment happens.
3. Provide existing EAS/Firebase settings for **com.mobile**, build an enabled APK,
   and verify remote delivery/receipts, denied/granted permission, token rotation,
   background/cold tap, logout/account switching and offline cleanup on Android.
4. Validate actual Redis multi-worker/recovery and production signing/distribution.
   FCM/APNs acceptance, external MangaDex chapter polling and iOS are not certified.

ภาษาไทย: โค้ด Phase 5 ต่อบน hybrid แล้วและผ่านการทดสอบตามขอบเขตด้านบน แต่ยังไม่ใช่
production rollout ต้องลง migration, deploy เว็บ/API, ใส่ EAS/Firebase ของทีม
และตรวจรับการส่ง Push จริงก่อนเปิดใช้งาน
