# Hybrid Phase 4 acceptance — 2026-10-24

Branch `feat/mobile-hybrid-phase4-20261024` (worktree `C:/Users/woral/md-hybrid-phase4`, base `origin/main` `66d5f8b`, uncommitted).
Scope set by the owner: **latest Phase 4 product parity delivered as the hybrid shell** (React Native CLI 0.85.3 + WebView over `https://hayateotsu.space`). Phase 5 (feed, collections, push) and the old capture/overlay R&D are out of scope.

ภาษาไทย: ขอบเขตตามที่เจ้าของงานกำหนด คือ Phase 4 ตามแผนล่าสุด แต่ส่งมอบเป็นแอป hybrid (WebView) ไม่รวม Phase 5 และงานจับภาพหน้าจอ/overlay เดิม

## Architecture decision (branch-specific)

The product UI is the deployed web app; the shell owns only what a browser page cannot do on Android:

| Shell responsibility | Implementation |
| --- | --- |
| Social login with system browser + PKCE return | `legacyOAuthBridge.ts`, `MangaDockWebViewScreen.tsx` (exact `mangadock://auth/callback`) |
| Device identity headers on API calls | `webViewBridge.ts`, `mobileHeaders.ts` |
| Product deep links (Phase 4 routes only) | `navigation/productLinks.ts`, manifest |
| Android Back over web dialog layers | `modal_state` bridge + Escape dispatch |
| File export to the OS share sheet | blob interceptor + `MangaDockFileShare.kt` + FileProvider |
| Load-failure retry screen, renderer-crash recovery | `renderError`, `onRenderProcessGone` |

Consequence: web fixes reach the app only when the team deploys the Frontend; the APK needs a rebuild only for shell changes.

## Build

| Item | Value |
| --- | --- |
| APK | `Mobile/build/apk/2026-10-24/MangaDock-1.1.0-phase4-beta.2-code7-arm64.apk` |
| Version | `1.1.0-phase4-beta.2`, code 7, `com.mobile`, arm64-v8a, target SDK 36 |
| Size / SHA-256 | 24,751,912 bytes / `bf2d11473b2f940422c845acc22239419dc3610bc15efcc829fadfe8ca444dda` |
| Installed on device | `base.apk` SHA-256 identical |
| Permissions | `INTERNET` only (no capture, overlay or storage permission) |
| Signing | existing QA/debug configuration — **not** a production or store release |
| Build | `assembleRelease` + `lintVitalAnalyzeRelease` pass (log `Mobile/build/qa-android-build-code7.log`) |

## Source checks (final tree)

| Suite | Result |
| --- | --- |
| Mobile Jest | **82/82**, 16 suites (was 73; +9 regression tests) |
| Mobile TypeScript / ESLint | pass / 0 errors (1 pre-existing inline-style warning) |
| Backend Jest (Node 22) | **1,179/1,179**, 114 suites |
| Backend MIT guard e2e | **7/7** |
| Frontend product tests (bun) | **450/450** before the comment fix; `community/p/[id]/__tests__` 4/4 after |

## Defects found on the device and fixed

| # | Found (physical Z Flip4) | Root cause | Fix | Verified |
| --- | --- | --- | --- | --- |
| D1 | "Export CSV" did nothing: API 200, no file, no prompt | Android WebView cannot download `blob:` links | Injected interceptor reads same-origin blob before revoke; native module writes to `cache/shared/` and opens the share sheet via FileProvider (CSV/TXT/JSON, ≤10 MB, sanitised name) | `device/20-csv-export-before-fix.jpg` → `device/21-csv-export-share-sheet.jpg` |
| D2 | Offline/failed load showed Chrome's error page with no retry in production | No `renderError` | Native retry screen in the app's theme | `device/30-offline-retry-screen.jpg`, retry returns to same page signed in |
| D3 | WebView renderer crash had no recovery | No `onRenderProcessGone` | Remount WebView at the last same-origin URL | CDP `Page.crash`: same PID, reopened `/mylist?tab=history` (`device/33-renderer-crash-recovers-last-page.jpg`) |
| D4 | Hardware Back closed Reader **and** book popup at once | Shell called `goBack()`; Reader has no history entry | Bridge reports visible `aria-modal` dialogs; Back sends Escape (web closes top layer first); quick second Back falls through | Back 1 → popup kept, Back 2 → home (`device/44-after-hardware-back-1.jpg`, `45-after-hardware-back-2.jpg`) |
| D5 | Callback arriving after process restart was silently dropped | Verifier lives in the previous process | Native notice "การเข้าสู่ระบบถูกขัดจังหวะ…", code never exchanged | `device/60-cold-oauth-callback-notice.jpg` |
| D6 | QA `[diag]` badge covered the community create-post button | Bottom-right placement | Moved bottom-left (QA builds only) | `device/62-deeplink-community-cold.jpg` vs `72-facebook-session-after-restart.jpg` |
| D7 | Own new comment sometimes rendered twice | SSE `comment` event can beat the POST response; submit path appended without de-duplication | `Frontend/app/lib/commentList.ts` `appendComment` used by both paths + test | Seen twice on device run 1; **source fix needs a Frontend deploy** |

## Device acceptance — 29-slice matrix

Device: Galaxy Z Flip4 SM-F721B, Android 16, WebView 155, main display 360×800 CSS px. Statuses follow the checklist rules (`PASS`, `PARTIAL`, `NOT_RUN`, `BLOCKED`). Evidence paths are relative to `docs/reports/hybrid-phase4-2026-10-24/`.

| Slice | Observed on the hybrid build | Status |
| --- | --- | --- |
| S01 sign-in/restore/isolation | Restore after force-stop (Google earlier, Facebook today); logout; account switch keeps cache/wallet isolated. Email login: no email test account | PARTIAL |
| S02 social PKCE/TOTP/cancel | Google (prior session) and Facebook full login pass; cancel pass; cold callback handled gracefully. TOTP: no MFA fixture | PARTIAL |
| S03 search → chapter → CAPTCHA → Reader | Search 200; Reader opens real chapter, first image loads, CAPTCHA gate passes | PASS |
| S04 Studio published chapter | Needs creator fixture | BLOCKED |
| S05 Reader modes/zoom/navigation | Single/continuous, zoom 100→150→100 %, tap-zone paging, chapter 0→1, landscape 800×330 and back, layered Back. Web Reader has no swipe and no double/RTL mode | PASS (web feature set) |
| S06 single-page MIT patches | 201, 2 patches, overlays loaded, geometry matches server within 0.1 %; EN→TH fixture translated correctly | PASS |
| S07 batch lifecycle | SSE progress stages, heartbeat, disconnect + reattach, failure event, UI stop at 3/26, 15 s background without reload | PASS |
| S08–S09 coins/unlock/QR payment | No payment fixture; no real-money action taken | BLOCKED |
| S10 APK on physical Android | QA-signed code 7 installed, hash matched, core flows above | PASS (QA signing) |
| S11 home/discovery | 18 read APIs 200, home/community/book screens, deep links warm + cold, traversal rejected | PASS |
| S12 library/history/CSV/share | Favourite, follow, like on → server → off (restored); CSV export to share sheet | PASS |
| S13 review/comment/report | Review 4★ submit → server → delete; reporting not run (affects real moderation queue) | PARTIAL |
| S14 profile/follows/banner | Follow pass; photo picker open/cancel/reopen pass; crop/upload not run | PARTIAL |
| S15 daily check-in | Grants coins, not reversible — not run by owner decision | NOT_RUN |
| S16 notifications | List/count 200; no unread item to mark | PARTIAL |
| S17 settings/stats | Profile settings and stats reads 200 | PARTIAL |
| S18 security (signup/recovery/TOTP/devices) | Needs test accounts | BLOCKED |
| S19 wallet | Balance/transactions/earnings 200; per-account balance isolation | PASS |
| S20 community feeds | Feed, categories, feed-SSE "new post" banner, deep link | PASS |
| S21 post CRUD | Text post via composer 201 → delete 204 → GET 404; image upload not run | PARTIAL |
| S22 replies/votes/SSE/background | Vote 201, comment 201, external comment appears via SSE, still live after 20 s background | PASS |
| S23–S25 creator workspace/upload/earnings | Needs creator fixture (own studio stats read 200) | BLOCKED |
| S26–S28 staff | Needs staff fixture; account is a reader | BLOCKED |
| S29 production release | Needs production keystore, endpoints and store distribution | BLOCKED |

Shell-only gates (not in the native matrix): offline retry, renderer recovery, Back layering, deep links, file picker cancel, share sheet, OAuth cancel — all **PASS** on the final binary.

**Conclusion:** every Phase 4 gate that can be exercised with the owner's reader account now passes on the physical device, and all shell defects found were fixed. Phase 4 is **not** certified as a production release: payment, creator, staff, security/TOTP and release-signing rows remain BLOCKED on fixtures/keys the team must supply.

ภาษาไทย: ทุกเกตที่ทดสอบได้ด้วยบัญชีผู้อ่านผ่านบนเครื่องจริงแล้ว และแก้บั๊กที่พบใน shell ครบ แต่ยังไม่ใช่ release production เพราะแถว payment/creator/staff/security/TOTP/signing ยังต้องใช้บัญชีทดสอบ, payment fixture และ keystore จริงจากทีม

## Observations for other owners (not changed here)

- Backend batch loads every page before calling MIT, so one unreachable page fails the whole job (`batch-sse-failure-result.json`).
- After a disconnect and reattach, MIT re-processed page 0 (duplicate work) while the client still received each page once.
- MIT output for an already-Thai page translated to English was poor (`DOLNES` only); English → Thai fixtures were correct.
- Several older community post images return "โหลดรูปไม่ได้" on the deployed server.
- The Reader's top-bar stop button is desktop-only; on phones the stop control is in the "more" menu (works).

## Reproduce

From the repo root with the app in the foreground and CDP forwarded to `127.0.0.1:9226`:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/woral/md-phase5-tools/node_modules/playwright'
node Mobile/scripts/phase4-device-qa.cjs inventory
node Mobile/scripts/phase4-device-qa.cjs reader
node Mobile/scripts/phase4-device-qa.cjs translate        # fresh Reader mount
node Mobile/scripts/phase4-device-qa.cjs batch            # add --failure for the error path
node Mobile/scripts/phase4-device-qa.cjs reader-modes     # restores rotation settings
node Mobile/scripts/phase4-device-qa.cjs library-writes   # owner-approved, self-restoring
node Mobile/scripts/phase4-device-qa.cjs review-write     # owner-approved, deletes the review
node Mobile/scripts/phase4-device-qa.cjs community-writes # owner-approved, deletes post/comments
```

Device screenshots were re-encoded from the original screencap PNGs to JPEG (quality 0.82) to keep the repository small; the harness still writes PNGs. Screenshots include the owner's profile avatar; photo-picker screenshots were deleted because they showed the personal gallery. No tokens, auth codes, e-mail addresses or device serials are stored in the evidence.
