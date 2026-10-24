# PRD: MangaDock native Android migration with full feature parity

Date: 2026-10-02
Status: Published as PRD #724 on 2026-10-03; all 29 slices published as #725–#753. Phase 2/3 source is locally implemented and final source-review findings corrected (218 tests/typecheck/Hermes export passed). Phase 1 and replacement live/visual/signed-device acceptance remain open.
วันที่: 2026-10-02
สถานะ: เผยแพร่ PRD #724 วันที่ 2026-10-03 และ slices ทั้ง 29 งานเป็น #725–#753 แล้ว Source Phase 2/3 implement ในเครื่องและแก้ findings source review สุดท้ายแล้ว (218 tests/typecheck/Hermes export ผ่าน) ยังเปิด acceptance live/visual/signed-device Phase 1 และการแทนแอปครบ

[Published PRD / PRD ที่เผยแพร่](https://github.com/Slow-Inc/MangaDock/issues/724) · [Publication receipts / ผลการเผยแพร่](native-migration-publish/published.json) · [Phase 2 progress and remaining gates / ความคืบหน้า Phase 2 และเกณฑ์ที่เหลือ](2026-10-03-native-phase2-implementation.md).

## EN

### Problem Statement

MangaDock's Android app currently presents the existing web application inside a hybrid WebView shell. Readers and other users need the same MangaDock workflows as native mobile screens, while keeping their existing accounts, purchases, content, and translation service.

This is a client migration, not a new product or a rewrite of business rules. The completed native app must preserve existing product capabilities; phases determine delivery order rather than permanently removing features.

### Solution

Replace the Android application UI with Expo and React Native screens, using the existing Backend APIs, Supabase Auth, MIT, and server-side data. The native application contains no embedded WebView. OAuth and Turnstile verification use a system-browser auth session and return to the app.

Visual baseline (user clarification): port the existing responsive **mobile** layout from Frontend, using root `DESIGN.md` for identity/tokens. Preserve its artwork, content hierarchy, navigation order, and screen-specific controls through native components; this migration does not authorize a new product design. See the [reference mapping and verification limits](2026-10-02-native-responsive-design-parity.md). Apply this criterion to every phase.

Phase 1 delivers an internally distributed APK beta: sign in, search, choose MangaDex or published Studio Chapters, unlock or top up when needed, read natively, and use Single-Page Translation or Batch Translation. Translation runs while the app is active with its Reader open.

Phase 2 migrates discovery, personal collections and history, social reading, accounts, Wallet history, and Community. Phase 3 migrates creator Studio and existing role-gated management workflows, followed by a complete feature-parity release review.

Each beta clearly identifies which workflows are delivered. Later-phase workflows are not routed through an embedded web application; full parity is the gate for replacing the existing released application.

### User Stories

1. As a mobile user, I want MangaDock product screens rendered natively without an embedded WebView, so that I can use the application through native mobile controls.
2. As an existing user, I want my account, content, purchases, balance, and permissions preserved, so that moving to native does not create a separate account or data silo.
3. As a reader, I want email/password sign-in, session restoration, and refresh, so that I can return to the app without unnecessary repeated sign-in.
4. As a user, I want existing Google and Facebook sign-in through the system browser, so that I can continue using my current login provider.
5. As a user with enrolled TOTP, I want to complete its challenge before protected account use, so that native respects the same authentication requirement.
6. As a user, I want logout and account changes to isolate in-flight requests and local user state, so that another account's content and payment state do not appear in my session.
7. As a reader, I want captcha verification in the system browser to return me to the intended native screen, so that I can read protected content without an embedded browser.
8. As a reader, I want search, pagination, and honest empty/error states, so that I can find manga and recover from failed searches.
9. As a reader, I want the existing home, new releases, genres, and related-manga discovery flows, so that native retains the ways I currently discover manga.
10. As a reader, I want manga details and readable Chapter information, so that I can choose what to read.
11. As a reader, I want MangaDex Chapters and published Studio versions shown with language, availability, and price, so that I can choose the appropriate content source.
12. As a reader, I want to open a MangaDex Chapter in a native Reader, so that the existing external-catalog reading flow is usable.
13. As a reader, I want to open an accessible published Studio Chapter natively, so that uploaded content is supported alongside MangaDex.
14. As a reader, I want paged and continuous reading, so that I can retain my preferred existing reading mode.
15. As a reader, I want pinch/pan and double-tap controls that keep image and Patch placement aligned, so that zoomed translations remain readable.
16. As a reader, I want current-Page information, page jumps, Chapter selection, and previous/next Chapter navigation, so that I can move through both content sources.
17. As a reader, I want existing HD/saver choices respected by images and translation, so that translated Patches match the image I see.
18. As a reader, I want Single-Page Translation in the native Reader, so that I can translate the current Page.
19. As a reader, I want Batch Translation for the complete Chapter, so that translated Pages appear as the existing server processes them.
20. As a reader, I want existing source/target language and available model choices, so that native uses the translation options supported by my deployment.
21. As a reader, I want real progress, stage information when supplied, and distinct successful/failed Page counts, so that failed work is not shown as translated.
22. As a reader, I want cancel and background/Reader-exit behavior explained accurately, so that I understand that server cancellation can wait for the current Page.
23. As a reader, I want to restart incomplete translation using existing cache/context rules, so that I can recover without assuming that every cached Page is always skipped.
24. As a reader, I want captcha expiry recovery to preserve Chapter/Page position and require an intentional retry, so that I can resume without duplicate expensive requests.
25. As a reader, I want the existing original/translated display and comparison behavior, so that I can inspect the source and its translation.
26. As a reader, I want to see my coin balance and confirm an existing paid-Chapter unlock, so that I can read paid uploaded content.
27. As a reader, I want already-unlocked, insufficient-funds, denied, and failed-purchase states handled, so that I am not misled into repeated purchases.
28. As a reader, I want existing topup amounts and a native PromptPay QR screen, so that I can replenish coins through the existing payment flow.
29. As a reader, I want a pending payment restored after visiting my banking app or reopening MangaDock, so that I can see server-confirmed payment results.
30. As a reader, I want paid/expired/cancelled payment states, updated balance, and a return to my intended Chapter, so that the purchase-to-reading flow completes.
31. As a beta tester, I want an installable Android APK and useful diagnostics with a clear delivered-feature list, so that I can test the native reading flow and report failures.
32. As a reader, I want my existing library, bookmarks, reading history, and continue-reading behavior, so that my personal reading data stays useful across clients.
33. As a reader, I want existing ratings, reviews, reader comments, and reports, so that I can participate in social reading from native.
34. As a user, I want public profiles and existing follow actions, so that my social connections remain available.
35. As a user, I want existing daily check-in and in-app notifications, so that I can receive rewards and account/content updates.
36. As a user, I want existing profile, preferences, statistics, and settings screens, so that I can manage my current account experience.
37. As a user, I want existing registration, recovery, password, linked-account, TOTP-management, session, and account-danger flows, so that account lifecycle and security remain complete.
38. As a user, I want existing Wallet transaction history, so that I can inspect purchases and topups from native.
39. As a Community user, I want existing feeds, categories, trending, manga discussions, and post details, so that I can browse Community natively.
40. As a Community author, I want existing post creation, attachments, editing, and deletion, so that I can publish and maintain my content.
41. As a Community participant, I want existing replies, votes, reports, and real-time updates, so that native preserves discussion behavior.
42. As a creator, I want my existing works, Chapter versions, draft metadata, language, and price management, so that I can manage my Studio workspace.
43. As a creator, I want native image selection/upload and existing publication/moderation transitions, so that I can deliver Chapters through the existing Studio workflow.
44. As a creator, I want existing creator account and earnings views, so that I can inspect my publishing identity and revenue.
45. As an authorized staff user, I want existing user/content/report management and transaction/audit views with unchanged permissions, so that native retains role-gated product capabilities.
46. As a maintainer, I want a reviewed full-parity checklist and signed APK device evidence before replacing the released app, so that phased delivery reaches the complete migration goal.
47. As a mobile user, I want supported incoming links and Android back navigation to retain native context, so that navigation does not unexpectedly open the embedded web product.
48. As a user, I want honest loading, offline-connection, empty, denied, and retry states, so that I can recover without fabricated data or false success.

### Implementation Decisions

- Implementation and project-specific configuration stay in the Mobile subsystem. Reuse the existing Expo project; do not create another client stack. Preserve Frontend, Backend, MIT, database contracts, and the shared mobile bridge consumed by Frontend.
- Native Navigation and Theme own screen routes, Android back handling, safe areas, loading/error states, and adaptation of the existing web mobile visual language. Preserve user-facing semantics while replacing browser-only interactions with native controls.
- Identity and Session expose sign-in, session restoration, current identity, refresh, TOTP completion, and logout through a small interface. Reuse the existing Supabase project and providers; later account-management slices migrate the existing registration, recovery, account-linking, and security flows.
- Backend Gateway owns absolute API/media origins, current Bearer token, existing Mobile Hardware ID and clearance headers, cancellation, normalized public errors, and authenticated SSE transport. Mobile does not depend on Next.js proxy routes or browser-dependent Frontend hooks.
- Protected Content and Captcha own a single pending system-browser challenge, a random one-time state, fixed captcha callback, clearance acquisition, and expiry recovery. Keep the challenge-page source in Mobile and host it on the user's existing HTTPS hosting using an allowed Turnstile hostname; the actual URL is deployment configuration.
- Captcha callbacks and OAuth callbacks are separate. The challenge page receives no user access token, refresh token, hardware identifier, or signing secret; native verifies callback correlation and performs the existing server verification. Public configuration never contains service-role or server signing secrets.
- Reading Session combines the existing catalog and published Chapter versions, source/language selection, backend availability, access state, page identity, and Chapter navigation. Render original Pages and translated Patches in one native transform using the source-image aspect ratio and normalized coordinates.
- Native Reader uses bounded page mounting/prefetching, paged and continuous reading, pinch/pan and double-tap behavior, page jumps, and Chapter navigation. The displayed HD/saver derivative must match the derivative submitted for translation; source URLs and display URLs retain their distinct purposes.
- Translation Session owns options, Patch Sets, successful/failed/pending Pages, stage/progress events, single-page requests, POST SSE batch requests, cancellation, and retry. Native sends a complete Chapter page list in canonical Chapter order for Batch Translation so Backend can apply its existing cache/context rules.
- Use the existing Source Language, Target Language, translator/model availability, and derivative contracts. Empty Patch Sets without errors are successful results; failed Pages and connection-level errors are not reported as translated. Deduplicate repeated events and ignore responses belonging to an old Chapter or identity.
- Phase 1 cancels the client's translation connection when the user cancels, leaves Reader, or backgrounds the app. The server cancels a Batch Job when its last listener leaves; an in-flight MIT Page can finish before cancellation takes effect. Single-page client abort is not a guarantee of server-side compute interruption.
- Returning to Reader does not automatically submit an expensive new translation. The user can restart with the existing configuration; Backend applies cache rules. With rolling context enabled, partial cache can require regeneration of the complete supplied Chapter; the current batch registry also has a 15-minute timeout that native must represent as incomplete/error with retry.
- Wallet Checkout exposes balance, published Chapter price and unlock status, purchase, topup creation, payment status, cancellation, and confirmation through existing APIs. Backend remains authoritative for ownership, current price, atomic debit/unlock, idempotency, payment confirmation, and creator revenue.
- Native persists minimal pending-payment identity and return context per account. On app foreground or relaunch, fetch payment status and current balance and reconnect only a pending payment stream; display confirmed server state before local countdown assumptions. Switching accounts clears or isolates the previous account's payment and reading state.
- Personal Data, Community, Creator Workspace, and Role-Gated Management are later domain modules that migrate existing public behavior through existing APIs. Preserve permissions, data ownership, moderation transitions, and real-time events; no role elevation, new payment rules, or backend feature work is implied.
- Create an explicit parity checklist from current product screens, actions, API contracts, and role behavior. Existing MDs and closed issues are evidence of prior delivery, but historical bare React Native and hybrid plans do not override the current Expo/native implementation direction.
- Existing protected assets must be reachable through a valid existing contract. Do not fabricate image tokens, expose server keys, disable captcha, or change other subsystems to mask a missing contract; record the exact prerequisite and keep the affected acceptance criterion open.
- APK beta delivery reuses the existing internal Expo build profiles. Product flows, error recovery, image/Patch correctness, and observed reader performance must be demonstrated on Android; native rendering alone is not evidence of a speed or memory improvement.

### Testing Decisions

- Use TDD for implementation: choose one observable behavior, run one test to a meaningful RED, write only enough implementation to reach GREEN, then refactor while GREEN and rerun affected tests. Never write all tests before all implementation; record RED/GREEN evidence for each implemented slice.
- The first tracer bullet is: a user signs in with the existing email/password flow and sees their authenticated account on a native screen. RED must demonstrate missing behavior rather than a broken test harness or import/config error; subsequent tests follow what each completed cycle reveals.
- Test integration-style through public domain interfaces or rendered native screens. Keep Mobile-owned modules real; mock only external Backend/provider APIs, operating-system/browser/storage boundaries, and time/randomness when needed. Do not mock internal collaborators, inspect private fields, or query the database to verify client behavior.
- Proposed priority 1: a user can sign in, restore a session, and sign out or switch accounts without seeing or modifying another account's state. Exercise Identity/Session with the real Mobile adapter and controlled external auth/API responses.
- Proposed priority 2: a reader can verify captcha, select MangaDex or an accessible published Studio Chapter, and see its Pages; a rejected/expired challenge or denied access cannot produce false reading success. Exercise Protected Content, Backend Gateway, and Reading Session together.
- Proposed priority 3: a successful Single-Page Translation stays aligned with the displayed Page through zoom, mode changes, and HD/saver selection; an empty successful Patch Set stays successful. Exercise the real Translation Session and Page/Patch rendering public behavior.
- Proposed priority 4: Batch Translation distinguishes progress, successful/failed Pages, and incomplete/connection errors; cancellation on Reader exit/background closes the client flow and an intentional restart preserves canonical complete-Chapter submission. Add split/duplicate-event and timeout tests one behavior at a time as the integration requires.
- Proposed priority 5: a paid Chapter unlock opens the Reader only after the server confirms access, and already-unlocked/insufficient/denied results remain truthful. Verify checkout through public actions and resulting balance/access rather than internal helper call counts or duplicated server debit logic.
- Proposed priority 6: a pending payment restored after a banking-app switch or process restart shows server-confirmed status/balance and returns to the intended Chapter without creating another payment. Test Wallet Checkout through its public flow with controlled payment responses and lifecycle/time boundaries.
- Keep deep interfaces small: observe account and perform login/logout; observe reading state and open/navigate a Chapter; observe translation state and translate/cancel; observe checkout state and purchase/create/resume/cancel a payment. Hide refresh, headers, SSE buffering, and retry details behind these domain interfaces; final signatures evolve through the tracer bullets.
- Later-phase tests follow the same RED-GREEN-refactor loop, prioritizing the principal user journey and permission/recovery risks of each migrated feature. Do not attempt exhaustive combinations, native-style snapshots, or speculative tests for undelivered features.
- Prior art includes existing mobile bridge, translation, Chapter access, topup hook, Backend batch/cancel/webhook, and Wallet/Unlock tests. Reuse their observable scenarios and contracts without importing browser-only implementations or changing other subsystems' suites.
- Each slice runs Mobile typecheck and its affected behavior tests. Release gates add signed APK installation and physical Android auth/captcha/reading/translation/payment verification; live money actions use an explicit test fixture rather than an incidental charge.

### Out of Scope

- Changes to Frontend, Backend, MIT, Cloudflare Worker, database schema/RPCs, root CI, payment-provider configuration, or existing server business rules are outside implementation scope. A discovered integration gap is documented for a separate owner decision rather than silently expanded into this migration.
- New on-device ML, direct Mobile-to-MIT processing, screen capture/translation overlays, offline downloads, and new push-notification infrastructure are not part of preserving existing product behavior.
- Durable background translation, lock-screen translation, automatic GPU-job resumption, multi-node batch coordination, and worker preemption are deferred follow-up design work; the current native migration does not promise them.
- iOS release acceptance, Google Play release/payment integration, replacement of OAuth providers, a product redesign, and migration of developer documentation or a separate observability application are outside this Android APK migration.

### Further Notes

- The user approved PRD/issue publication followed by phased TDD implementation and selected discovery with the existing mobile navigation as the next priority. Publication is complete; implementation and release acceptance are separate gates. This document does not record the complete native product as finished.
- The user has existing HTTPS hosting for the captcha handoff; the URL, allowed site key, and a physical test device are release prerequisites. Existing API access and provider credentials must be verified without publishing secrets.
- Native performance and compatibility remain unverified until the device gates run. The standalone earlier Phase 1 draft is superseded by this full-parity PRD, including both content sources, both translation modes, and the paid-reading flow.

### Source evidence

- [Current Expo hybrid client: PR #534](https://github.com/Slow-Inc/MangaDock/pull/534)
- [Mobile typecheck CI: issue #639 / PR #640](https://github.com/Slow-Inc/MangaDock/issues/639)
- [Historical hybrid-shell PRD #113 (prior direction)](https://github.com/Slow-Inc/MangaDock/issues/113)
- [Translation orchestration #142](https://github.com/Slow-Inc/MangaDock/issues/142)
- [Batch truthful error/progress #154](https://github.com/Slow-Inc/MangaDock/issues/154)
- [Page-boundary cancellation decision #129](https://github.com/Slow-Inc/MangaDock/issues/129)
- [Rolling-context cache safety #524](https://github.com/Slow-Inc/MangaDock/issues/524)
- [Paid Chapter unlock delivery #583](https://github.com/Slow-Inc/MangaDock/issues/583)
- [QR topup and banking-app return #317 / #319](https://github.com/Slow-Inc/MangaDock/issues/317)
- [Payment/topup/atomic unlock merged PR #341](https://github.com/Slow-Inc/MangaDock/pull/341)
- [Canonical terms](../../UBIQUITOUS_LANGUAGE.md)
- [MIT contract](../../MIT/CONTRACT.md)
- [Single-node batch decision ADR 002](../../docs/adr/002-drop-batch-redis-pubsub.md)
- [Batch transport ADR 017](../../docs/adr/017-mit-batch-transport-jobstate-seam.md)
- [Wallet hardening ADR 022](../../docs/adr/022-wallet-atomic-unlock-rpc-toctou-hardening.md)

---

## TH

### ปัญหา

แอป Android ของ MangaDock ปัจจุบันแสดงเว็บเดิมใน hybrid WebView shell ผู้อ่านและผู้ใช้อื่นต้องการ workflow ของ MangaDock เดิมเป็นหน้าจอ native บนมือถือ โดยยังใช้บัญชี การซื้อ เนื้อหา และบริการแปลเดิม

งานนี้คือการย้าย client ไม่ใช่ผลิตภัณฑ์ใหม่หรือการเขียนกฎธุรกิจใหม่ แอป native ที่เสร็จต้องรักษาความสามารถของผลิตภัณฑ์เดิม โดย phase กำหนดลำดับส่งมอบ ไม่ใช่การตัดฟีเจอร์ออกถาวร

### แนวทางแก้

เปลี่ยน UI ของแอป Android เป็นหน้าจอ Expo และ React Native โดยใช้ Backend APIs, Supabase Auth, MIT และข้อมูลฝั่ง server เดิม แอป native ไม่มี embedded WebView ส่วน OAuth และการยืนยัน Turnstile ใช้ auth session ใน browser ของระบบแล้วกลับเข้าแอป

Visual baseline (คำชี้แจงผู้ใช้): port layout responsive **mobile** เดิมจาก Frontend โดยใช้ `DESIGN.md` รากโปรเจคสำหรับอัตลักษณ์/tokens รักษา artwork ลำดับเนื้อหา ลำดับ navigation และ controls เฉพาะหน้าผ่าน native components การย้ายครั้งนี้ไม่ใช่การอนุมัติให้ออกแบบผลิตภัณฑ์ใหม่ ดู [mapping แหล่งอ้างอิงและข้อจำกัดการตรวจ](2026-10-02-native-responsive-design-parity.md) ใช้เกณฑ์นี้ทุก phase

Phase 1 ส่งมอบ APK beta สำหรับแจกภายใน: เข้าสู่ระบบ ค้นหา เลือก Chapter จาก MangaDex หรือ Studio ที่เผยแพร่แล้ว ปลดล็อกหรือเติมเงินเมื่อจำเป็น อ่านแบบ native และใช้ Single-Page Translation หรือ Batch Translation การแปลทำงานขณะแอปอยู่ด้านหน้าและเปิด Reader

Phase 2 ย้ายการค้นพบเนื้อหา คอลเลกชันและประวัติส่วนตัว การอ่านร่วมกับ social บัญชี ประวัติ Wallet และ Community ส่วน Phase 3 ย้าย Studio ของผู้สร้างและ workflow จัดการตามสิทธิ์เดิม แล้วตรวจ release ที่มีฟีเจอร์ครบเทียบระบบเดิม

แต่ละ beta ระบุชัดว่า workflow ใดส่งมอบแล้ว Workflow ของ phase ถัดไปไม่เปิดผ่านเว็บที่ฝังในแอป โดยการมีฟีเจอร์ครบเป็นเกณฑ์ก่อนนำไปแทนแอปที่เผยแพร่เดิม

### User Stories / เรื่องราวผู้ใช้

1. ในฐานะผู้ใช้มือถือ ฉันต้องการหน้าจอผลิตภัณฑ์ MangaDock ที่ render native โดยไม่มี embedded WebView เพื่อใช้แอปผ่าน control native
2. ในฐานะผู้ใช้เดิม ฉันต้องการรักษาบัญชี เนื้อหา การซื้อ ยอดเหรียญ และสิทธิ์ เพื่อการย้าย native ไม่สร้างบัญชีหรือข้อมูลแยก
3. ในฐานะผู้อ่าน ฉันต้องการเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน กู้ session และ refresh เพื่อกลับเข้าแอปโดยไม่ต้องเข้าสู่ระบบซ้ำโดยไม่จำเป็น
4. ในฐานะผู้ใช้ ฉันต้องการเข้าสู่ระบบ Google และ Facebook เดิมผ่าน browser ของระบบ เพื่อใช้ login provider ปัจจุบันต่อ
5. ในฐานะผู้ใช้ที่เปิด TOTP แล้ว ฉันต้องการทำ challenge ให้ครบก่อนใช้บัญชีที่ป้องกัน เพื่อ native เคารพข้อกำหนดยืนยันตัวตนเดียวกัน
6. ในฐานะผู้ใช้ ฉันต้องการให้ออกจากระบบและเปลี่ยนบัญชีแยกคำขอที่กำลังทำกับ state ผู้ใช้ในเครื่อง เพื่อเนื้อหาและสถานะชำระของบัญชีอื่นไม่ปรากฏใน session ของฉัน
7. ในฐานะผู้อ่าน ฉันต้องการยืนยัน captcha ใน browser ของระบบแล้วกลับหน้าจอ native ที่ตั้งใจ เพื่ออ่านเนื้อหาที่ป้องกันโดยไม่ใช้ browser ฝังในแอป
8. ในฐานะผู้อ่าน ฉันต้องการค้นหา แบ่งหน้า และสถานะว่าง/ผิดพลาดที่ตรงจริง เพื่อค้นหามังงะและกู้การค้นหาที่ล้มเหลว
9. ในฐานะผู้อ่าน ฉันต้องการ flow ค้นพบจากหน้าหลัก เรื่องใหม่ หมวด และมังงะเกี่ยวข้องเดิม เพื่อ native รักษาวิธีค้นพบมังงะที่ฉันใช้อยู่
10. ในฐานะผู้อ่าน ฉันต้องการรายละเอียดมังงะและข้อมูล Chapter ที่อ่านได้ เพื่อเลือกสิ่งที่จะอ่าน
11. ในฐานะผู้อ่าน ฉันต้องการแสดง Chapter จาก MangaDex และ Studio versions ที่เผยแพร่พร้อมภาษา availability และราคา เพื่อเลือกแหล่งเนื้อหาที่เหมาะสม
12. ในฐานะผู้อ่าน ฉันต้องการเปิด Chapter จาก MangaDex ใน native Reader เพื่อใช้ flow อ่านจาก catalog ภายนอกเดิม
13. ในฐานะผู้อ่าน ฉันต้องการเปิด Chapter ของ Studio ที่เผยแพร่และเข้าถึงได้แบบ native เพื่อรองรับเนื้อหาอัปโหลดควบคู่ MangaDex
14. ในฐานะผู้อ่าน ฉันต้องการอ่านทีละหน้าและต่อเนื่อง เพื่อรักษาโหมดอ่านเดิมที่ชอบ
15. ในฐานะผู้อ่าน ฉันต้องการ control pinch/pan และ double-tap ที่รักษาภาพกับตำแหน่ง Patch ให้ตรง เพื่ออ่านคำแปลที่ zoom ได้
16. ในฐานะผู้อ่าน ฉันต้องการข้อมูล Page ปัจจุบัน ข้ามหน้า เลือก Chapter และไป Chapter ก่อน/ถัดไป เพื่ออ่านต่อผ่านทั้งสองแหล่งเนื้อหา
17. ในฐานะผู้อ่าน ฉันต้องการให้ภาพและการแปลเคารพตัวเลือก HD/saver เดิม เพื่อ Patches ที่แปลตรงกับภาพที่เห็น
18. ในฐานะผู้อ่าน ฉันต้องการ Single-Page Translation ใน native Reader เพื่อแปล Page ปัจจุบัน
19. ในฐานะผู้อ่าน ฉันต้องการ Batch Translation ของ Chapter ทั้งหมด เพื่อ Page ที่แปลปรากฏตาม server เดิมประมวลผล
20. ในฐานะผู้อ่าน ฉันต้องการตัวเลือกภาษาต้นทาง/ปลายทางและ model ที่มีเดิม เพื่อ native ใช้ options การแปลที่ deployment รองรับ
21. ในฐานะผู้อ่าน ฉันต้องการ progress จริง ข้อมูล stage เมื่อมี และจำนวน Page สำเร็จ/ล้มเหลวแยกกัน เพื่อไม่แสดงงานล้มเหลวว่าแปลแล้ว
22. ในฐานะผู้อ่าน ฉันต้องการอธิบายการยกเลิกและพฤติกรรมเมื่อแอปไปเบื้องหลัง/ออก Reader อย่างถูกต้อง เพื่อเข้าใจว่าการยกเลิก server อาจรอ Page ปัจจุบัน
23. ในฐานะผู้อ่าน ฉันต้องการเริ่มการแปลที่ไม่ครบใหม่ด้วยกฎ cache/context เดิม เพื่อกู้ flow โดยไม่สมมติว่า Page ที่มี cache ทุกหน้าจะถูกข้ามเสมอ
24. ในฐานะผู้อ่าน ฉันต้องการกู้ captcha หมดอายุโดยรักษาตำแหน่ง Chapter/Page และให้ตั้งใจกดลองใหม่ เพื่ออ่านต่อโดยไม่ส่งคำขอที่ใช้ compute สูงซ้ำ
25. ในฐานะผู้อ่าน ฉันต้องการพฤติกรรมแสดงและเปรียบเทียบต้นฉบับ/คำแปลเดิม เพื่อดูต้นทางกับคำแปล
26. ในฐานะผู้อ่าน ฉันต้องการเห็นยอดเหรียญและยืนยันปลดล็อก Chapter แบบชำระเงินเดิม เพื่ออ่านเนื้อหาอัปโหลดที่มีราคา
27. ในฐานะผู้อ่าน ฉันต้องการจัดการสถานะปลดล็อกแล้ว เหรียญไม่พอ ถูกปฏิเสธ และซื้อไม่สำเร็จ เพื่อไม่ถูกชักนำให้ซื้อซ้ำ
28. ในฐานะผู้อ่าน ฉันต้องการจำนวนเติมเงินเดิมและหน้าจอ PromptPay QR native เพื่อเติมเหรียญผ่าน flow ชำระเดิม
29. ในฐานะผู้อ่าน ฉันต้องการกู้รายการชำระที่รอหลังเปิดแอปธนาคารหรือเปิด MangaDock ใหม่ เพื่อเห็นผลชำระที่ server ยืนยัน
30. ในฐานะผู้อ่าน ฉันต้องการสถานะชำระสำเร็จ/หมดอายุ/ยกเลิก ยอดใหม่ และกลับ Chapter ที่ตั้งใจ เพื่อจบ flow ซื้อไปอ่าน
31. ในฐานะผู้ทดสอบ beta ฉันต้องการ Android APK ที่ติดตั้งได้และ diagnostics ที่มีประโยชน์พร้อมรายการฟีเจอร์ที่ส่งมอบชัดเจน เพื่อทดสอบ flow อ่าน native และรายงานความผิดพลาด
32. ในฐานะผู้อ่าน ฉันต้องการ library, bookmarks ประวัติอ่าน และการอ่านต่อเดิม เพื่อข้อมูลอ่านส่วนตัวยังใช้งานได้ข้าม clients
33. ในฐานะผู้อ่าน ฉันต้องการ ratings, reviews, reader comments และ reports เดิม เพื่อร่วมการอ่านแบบ social จาก native
34. ในฐานะผู้ใช้ ฉันต้องการ public profiles และ follow actions เดิม เพื่อเข้าถึงความสัมพันธ์ทาง social ของฉันต่อ
35. ในฐานะผู้ใช้ ฉันต้องการ check-in รายวันและ notifications ภายในแอปเดิม เพื่อรับรางวัลและข้อมูลอัปเดตบัญชี/เนื้อหา
36. ในฐานะผู้ใช้ ฉันต้องการหน้าจอ profile, preferences สถิติ และ settings เดิม เพื่อจัดการประสบการณ์บัญชีปัจจุบัน
37. ในฐานะผู้ใช้ ฉันต้องการ flow สมัคร กู้บัญชี รหัสผ่าน เชื่อมบัญชี จัดการ TOTP, session และ action อันตรายของบัญชีเดิม เพื่อ lifecycle และความปลอดภัยบัญชีครบ
38. ในฐานะผู้ใช้ ฉันต้องการประวัติธุรกรรม Wallet เดิม เพื่อตรวจการซื้อและเติมเงินจาก native
39. ในฐานะผู้ใช้ Community ฉันต้องการ feeds, categories, trending กระทู้มังงะ และรายละเอียดโพสต์เดิม เพื่อดู Community แบบ native
40. ในฐานะผู้เขียนใน Community ฉันต้องการสร้างโพสต์ attachments แก้ไข และลบเดิม เพื่อเผยแพร่และดูแลเนื้อหาของฉัน
41. ในฐานะผู้ร่วม Community ฉันต้องการ replies, votes, reports และ real-time updates เดิม เพื่อ native รักษาพฤติกรรมการสนทนา
42. ในฐานะผู้สร้าง ฉันต้องการจัดการผลงาน Chapter versions metadata ของ draft ภาษา และราคาเดิม เพื่อจัดการ workspace ของ Studio
43. ในฐานะผู้สร้าง ฉันต้องการเลือก/อัปโหลดภาพ native และ transitions ของ publication/moderation เดิม เพื่อส่งมอบ Chapter ผ่าน workflow ของ Studio เดิม
44. ในฐานะผู้สร้าง ฉันต้องการมุมมองบัญชีผู้สร้างและรายได้เดิม เพื่อตรวจตัวตนการเผยแพร่และรายได้ของฉัน
45. ในฐานะผู้ใช้ staff ที่ได้รับสิทธิ์ ฉันต้องการจัดการผู้ใช้/เนื้อหา/reports และมุมมองธุรกรรม/audit เดิมด้วยสิทธิ์เดิม เพื่อ native รักษาความสามารถผลิตภัณฑ์ตาม role
46. ในฐานะผู้ดูแล ฉันต้องการ parity checklist ที่ review แล้วและหลักฐาน signed APK บนอุปกรณ์ก่อนแทนแอปที่เผยแพร่ เพื่อการส่งมอบเป็น phase ไปถึงเป้าหมายย้ายครบ
47. ในฐานะผู้ใช้มือถือ ฉันต้องการให้ incoming links ที่รองรับและปุ่มย้อนกลับ Android รักษาบริบท native เพื่อการนำทางไม่เปิดผลิตภัณฑ์เว็บฝังในแอปโดยไม่ตั้งใจ
48. ในฐานะผู้ใช้ ฉันต้องการสถานะโหลด การเชื่อมต่อ offline ว่าง ถูกปฏิเสธ และลองใหม่ที่ตรงจริง เพื่อกู้ flow โดยไม่มีข้อมูลสร้างขึ้นหรือรายงานสำเร็จผิด

### การตัดสินใจในการ implement

- การ implement และ config เฉพาะโครงการนี้อยู่ในส่วน Mobile ใช้โปรเจค Expo เดิม ไม่สร้าง client stack เพิ่ม และรักษา Frontend, Backend, MIT, database contracts และ shared mobile bridge ที่ Frontend ใช้อยู่
- Native Navigation and Theme ดูแล route ของหน้าจอ ปุ่มย้อนกลับ Android safe area สถานะโหลด/ผิดพลาด และการปรับระบบภาพของเว็บ mobile เดิม โดยรักษาความหมายต่อผู้ใช้และแทน interaction ที่ต้องใช้ browser ด้วย control native
- Identity and Session เปิดให้เข้าถึงการเข้าสู่ระบบ กู้ session ตัวตนปัจจุบัน refresh ทำ TOTP ให้ครบ และออกจากระบบผ่าน interface ขนาดเล็ก โดยใช้ Supabase project และ providers เดิม ส่วนงานจัดการบัญชีใน phase ถัดไปย้าย flow สมัคร กู้บัญชี เชื่อมบัญชี และความปลอดภัยเดิม
- Backend Gateway ดูแล origin แบบ absolute ของ API/media, Bearer token ปัจจุบัน, Mobile Hardware ID และ clearance headers เดิม การยกเลิก การปรับ public error และ SSE ที่ยืนยันตัวตน โดย Mobile ไม่พึ่ง proxy routes ของ Next.js หรือ hooks ของ Frontend ที่ขึ้นกับ browser
- Protected Content and Captcha ดูแล challenge เดียวที่กำลังรอใน browser ของระบบ random state แบบใช้ครั้งเดียว callback captcha ที่กำหนดไว้ การรับ clearance และกู้ flow เมื่อหมดอายุ โดยเก็บ source หน้า challenge ใน Mobile และโฮสต์บน HTTPS hosting เดิมของผู้ใช้ด้วย hostname ที่ Turnstile อนุญาต ส่วน URL จริงเป็น deployment configuration
- Callback ของ captcha แยกจาก callback OAuth โดยหน้า challenge ไม่รับ access token, refresh token, hardware identifier หรือ signing secret ของผู้ใช้ ฝั่ง native ตรวจความสัมพันธ์ของ callback และเรียกการยืนยัน server เดิม ทั้งนี้ public configuration ไม่มี service-role หรือ server signing secrets
- Reading Session รวม catalog และ Chapter versions ที่เผยแพร่เดิม การเลือกแหล่ง/ภาษา availability ของ backend สถานะสิทธิ์ ตัวตนของ Page และการเปลี่ยน Chapter โดยแสดง Page ต้นฉบับกับ Patches ที่แปลใน transform native เดียวกัน โดยใช้อัตราส่วนภาพต้นทางและพิกัด normalized
- Native Reader จำกัดจำนวน Page ที่ mount/prefetch รองรับการอ่านทีละหน้าและต่อเนื่อง pinch/pan และ double-tap การข้าม Page และเปลี่ยน Chapter โดย derivative HD/saver ที่แสดงต้องตรงกับที่ส่งแปล และรักษาหน้าที่แยกกันของ source URLs กับ display URLs
- Translation Session ดูแล options, Patch Sets, Page ที่สำเร็จ/ล้มเหลว/รอ events ของ stage/progress คำขอแปลหน้าเดียว คำขอ batch แบบ POST SSE การยกเลิก และลองใหม่ โดย native ส่งรายการ Page ของ Chapter ครบตามลำดับ Chapter สำหรับ Batch Translation เพื่อให้ Backend ใช้กฎ cache/context เดิม
- ใช้ contract เดิมของ Source Language, Target Language, availability ของ translator/model และ derivative โดย Patch Sets ว่างที่ไม่มี error ถือว่าสำเร็จ ส่วน Page ที่ล้มเหลวและ error ระดับการเชื่อมต่อไม่รายงานว่าแปลแล้ว ทั้งนี้กรอง event ซ้ำและไม่รับผลของ Chapter หรือตัวตนเก่า
- Phase 1 ยกเลิกการเชื่อมต่อแปลของ client เมื่อผู้ใช้กดยกเลิก ออกจาก Reader หรือส่งแอปไปเบื้องหลัง โดย server ยกเลิก Batch Job เมื่อ listener คนสุดท้ายออก และ Page ที่ MIT กำลังประมวลผลอาจทำจนจบก่อนการยกเลิกมีผล ทั้งนี้การ abort client ของหน้าเดียวไม่รับประกันการหยุด compute ฝั่ง server
- เมื่อกลับเข้า Reader แอปไม่ส่งงานแปลใหม่ที่ใช้ compute สูงโดยอัตโนมัติ โดยผู้ใช้เริ่มใหม่ด้วย config เดิมได้และ Backend ใช้กฎ cache ส่วนเมื่อเปิด rolling context cache บางส่วนอาจทำให้ต้องสร้างผลใหม่ของ Chapter ที่ส่งทั้งหมด และ batch registry ปัจจุบันมี timeout 15 นาทีซึ่ง native ต้องแสดงว่าไม่ครบ/ผิดพลาดพร้อมลองใหม่
- Wallet Checkout เปิดให้เข้าถึงยอดเหรียญ ราคาและสถานะปลดล็อก Chapter ที่เผยแพร่ การซื้อ สร้าง topup สถานะการชำระ ยกเลิก และยืนยันผ่าน APIs เดิม โดย Backend เป็นผู้ตัดสิน ownership ราคาปัจจุบัน debit/unlock แบบ atomic, idempotency การยืนยันชำระ และรายได้ผู้สร้าง
- Native เก็บตัวตนของรายการชำระที่รอและบริบทสำหรับกลับแบบน้อยที่สุดแยกตามบัญชี โดยเมื่อแอปกลับด้านหน้าหรือเปิดใหม่ให้ดึงสถานะชำระและยอดปัจจุบัน แล้วเชื่อม stream ใหม่เฉพาะรายการที่รอ ทั้งนี้แสดงสถานะที่ server ยืนยันก่อนสมมติฐานของ countdown ในเครื่อง และเมื่อเปลี่ยนบัญชีต้องล้างหรือแยกสถานะชำระและการอ่านของบัญชีก่อน
- Personal Data, Community, Creator Workspace และ Role-Gated Management เป็น domain modules ของ phase ถัดไปที่ย้ายพฤติกรรมสาธารณะเดิมผ่าน APIs เดิม โดยรักษาสิทธิ์ ownership ของข้อมูล transition การ moderation และ real-time events และไม่มีการยกระดับ role กฎการชำระใหม่ หรือเพิ่มฟีเจอร์ backend โดยนัย
- จัดทำ parity checklist ชัดเจนจากหน้าจอ action, API contracts และพฤติกรรมตาม role ของผลิตภัณฑ์ปัจจุบัน โดย MD และ issues ที่ปิดเป็นหลักฐานการส่งมอบเดิม แต่แผน bare React Native และ hybrid ในอดีตไม่แทนทิศทาง Expo/native ปัจจุบัน
- Protected assets เดิมต้องเข้าถึงผ่าน contract เดิมที่ถูกต้อง โดยไม่สร้าง image tokens ขึ้นเอง เปิดเผย server keys ปิด captcha หรือเปลี่ยน subsystem อื่นเพื่อกลบ contract ที่ขาด และต้องบันทึก prerequisite ที่ตรงจุดพร้อมคงเกณฑ์รับงานที่เกี่ยวข้องให้ยังไม่ผ่าน
- การส่ง APK beta ใช้ internal Expo build profiles เดิม โดยต้องสาธิต product flows การกู้ error ความถูกต้องของภาพ/Patch และ performance ของ Reader ที่สังเกตได้บน Android ซึ่งการ render native เพียงอย่างเดียวไม่เป็นหลักฐานว่าความเร็วหรือหน่วยความจำดีขึ้น

### การตัดสินใจในการทดสอบ

- ใช้ TDD สำหรับการ implement: เลือกพฤติกรรมที่สังเกตได้หนึ่งข้อ รันหนึ่ง test ให้ RED อย่างมีความหมาย เขียน implementation เท่าที่ทำให้ GREEN แล้ว refactor ขณะ GREEN และรัน tests ที่กระทบใหม่ ห้ามเขียน tests ทั้งหมดก่อน implementation ทั้งหมด โดยบันทึกหลักฐาน RED/GREEN ของแต่ละ slice ที่ implement
- Tracer bullet แรกคือ: ผู้ใช้เข้าสู่ระบบด้วย flow อีเมล/รหัสผ่านเดิมแล้วเห็นบัญชีที่ยืนยันตัวตนบนหน้าจอ native โดย RED ต้องแสดงพฤติกรรมที่ขาด ไม่ใช่ test harness พังหรือ import/config error และ tests ถัดไปตามสิ่งที่เรียนรู้จากแต่ละ cycle ที่เสร็จ
- ทดสอบแบบ integration-style ผ่าน public domain interfaces หรือหน้าจอ native ที่ render โดยใช้ modules ที่ Mobile ดูแลจริง และ mock เฉพาะ Backend/provider APIs ภายนอก ขอบระบบปฏิบัติการ/browser/storage และเวลา/randomness เมื่อจำเป็น ทั้งนี้ไม่ mock collaborators ภายใน ตรวจ private fields หรือ query database เพื่อยืนยันพฤติกรรม client
- ลำดับสำคัญที่เสนอ 1: ผู้ใช้เข้าสู่ระบบ กู้ session และออกจากระบบหรือเปลี่ยนบัญชีได้โดยไม่เห็นหรือแก้ state ของบัญชีอื่น โดยทดสอบ Identity/Session ด้วย Mobile adapter จริงและควบคุม auth/API responses ภายนอก
- ลำดับสำคัญที่เสนอ 2: ผู้อ่านยืนยัน captcha เลือก Chapter จาก MangaDex หรือ Studio ที่เผยแพร่และเข้าถึงได้ แล้วเห็น Pages โดย challenge ที่ถูกปฏิเสธ/หมดอายุหรือสิทธิ์ที่ถูกปฏิเสธไม่ทำให้แสดงสำเร็จในการอ่านผิด และทดสอบ Protected Content, Backend Gateway กับ Reading Session ร่วมกัน
- ลำดับสำคัญที่เสนอ 3: Single-Page Translation ที่สำเร็จยังตรงกับ Page ที่แสดงขณะ zoom เปลี่ยนโหมด และเลือก HD/saver โดย Patch Set ว่างที่สำเร็จยังถือว่าสำเร็จ และทดสอบพฤติกรรม public ของ Translation Session กับการ render Page/Patch จริง
- ลำดับสำคัญที่เสนอ 4: Batch Translation แยก progress, Pages สำเร็จ/ล้มเหลว และ incomplete/connection errors โดยยกเลิกเมื่อออก Reader/ไปเบื้องหลังปิด flow client และเริ่มใหม่อย่างตั้งใจรักษาการส่ง Chapter ครบตามลำดับ ทั้งนี้เพิ่ม tests ของ events แยก/ซ้ำกับ timeout ทีละพฤติกรรมตาม integration ที่จำเป็น
- ลำดับสำคัญที่เสนอ 5: การปลดล็อก Chapter แบบชำระเปิด Reader เมื่อ server ยืนยันสิทธิ์แล้วเท่านั้น และผล already-unlocked/insufficient/denied ตรงจริง โดยตรวจ checkout ผ่าน actions public กับยอด/สิทธิ์ที่เกิดขึ้น แทนจำนวนการเรียก helper ภายในหรือ logic debit ของ server ที่เขียนซ้ำ
- ลำดับสำคัญที่เสนอ 6: รายการชำระที่รอกู้หลังสลับแอปธนาคารหรือ process restart แสดงสถานะ/ยอดที่ server ยืนยันและกลับ Chapter ที่ตั้งใจโดยไม่สร้างรายการใหม่ โดยทดสอบ Wallet Checkout ผ่าน flow public ด้วย payment responses และขอบ lifecycle/time ที่ควบคุม
- รักษา deep interfaces ให้เล็ก: ดูบัญชีและทำ login/logout ดู reading state และเปิด/เปลี่ยน Chapter ดู translation state และแปล/ยกเลิก ดู checkout state และซื้อ/สร้าง/กู้/ยกเลิกรายการชำระ โดยซ่อนรายละเอียด refresh, headers, SSE buffering และ retry ไว้หลัง domain interfaces เหล่านี้ และ signatures สุดท้ายพัฒนาผ่าน tracer bullets
- Tests ใน phase ภายหลังใช้ RED-GREEN-refactor เดียวกัน โดยให้ความสำคัญกับเส้นทางผู้ใช้หลักและความเสี่ยงเรื่องสิทธิ์/การกู้ของฟีเจอร์ที่ย้ายแต่ละข้อ ทั้งนี้ไม่พยายามทดสอบทุก combinations, snapshots รูปแบบ native หรือ tests คาดเดาของฟีเจอร์ที่ยังไม่ส่งมอบ
- Prior art รวม tests ของ mobile bridge การแปล สิทธิ์ Chapter, topup hook, Backend batch/cancel/webhook และ Wallet/Unlock เดิม โดยใช้ scenarios และ contracts ที่สังเกตได้โดยไม่ import implementation เฉพาะ browser หรือเปลี่ยน suites ของ subsystem อื่น
- แต่ละ slice รัน Mobile typecheck และ behavior tests ที่กระทบ โดย release gates เพิ่มการติดตั้ง signed APK และตรวจ auth/captcha/reading/translation/payment บน Android จริง ทั้งนี้ action ที่ใช้เงินจริงใช้ test fixture ชัดเจนแทนการคิดเงินโดยไม่ตั้งใจ

### นอกขอบเขต

- การเปลี่ยน Frontend, Backend, MIT, Cloudflare Worker, database schema/RPCs, root CI, config payment provider หรือกฎธุรกิจ server เดิมอยู่นอก scope การ implement โดย integration gap ที่พบจะบันทึกให้เจ้าของตัดสินใจแยก ไม่ขยายเป็นงานย้ายนี้โดยไม่ระบุ
- ML ใหม่บนอุปกรณ์ การประมวลผลที่ Mobile ติดต่อ MIT โดยตรง screen capture/translation overlays, offline downloads และ infrastructure push notifications ใหม่ไม่ใช่ส่วนของการรักษาพฤติกรรมผลิตภัณฑ์เดิม
- การแปลเบื้องหลังที่ทำงานต่อแน่นอน การแปลขณะล็อกจอ resume GPU job อัตโนมัติ ประสาน batch หลาย node และ worker preemption เป็นงานออกแบบติดตามที่เลื่อนออก โดยงานย้าย native นี้ไม่รับประกันสิ่งเหล่านี้
- เกณฑ์รับ release iOS, การเผยแพร่/ผูกการชำระของ Google Play การเปลี่ยน OAuth providers การออกแบบผลิตภัณฑ์ใหม่ และย้าย developer documentation หรือแอป observability แยกอยู่นอกงานย้าย Android APK นี้

### หมายเหตุเพิ่มเติม

- ผู้ใช้อนุมัติเผยแพร่ PRD/issues แล้ว implement ด้วย TDD ตาม phase โดยเลือก discovery และ navigation mobile เดิมเป็นลำดับถัดไป การเผยแพร่เสร็จแล้ว ส่วน implementation และ acceptance release เป็นคนละเกณฑ์ เอกสารนี้ไม่บันทึกว่าผลิตภัณฑ์ native ทั้งหมดเสร็จแล้ว
- ผู้ใช้มี HTTPS hosting สำหรับ captcha handoff แล้ว โดย URL, site key ที่อนุญาต และอุปกรณ์ทดสอบจริงเป็น prerequisites ของ release ทั้งนี้ต้องตรวจ API access และ provider credentials เดิมโดยไม่เผยแพร่ secrets
- Performance และ compatibility ของ native ยังไม่ยืนยันจนกว่าจะรัน device gates โดยร่าง Phase 1 แยกก่อนหน้าถูกแทนด้วย PRD ที่รักษาฟีเจอร์ครบนี้ รวมทั้งสองแหล่งเนื้อหา สองโหมดแปล และ flow อ่านแบบชำระเงิน

### หลักฐานอ้างอิง

- [Current Expo hybrid client: PR #534](https://github.com/Slow-Inc/MangaDock/pull/534)
- [Mobile typecheck CI: issue #639 / PR #640](https://github.com/Slow-Inc/MangaDock/issues/639)
- [Historical hybrid-shell PRD #113 (prior direction)](https://github.com/Slow-Inc/MangaDock/issues/113)
- [Translation orchestration #142](https://github.com/Slow-Inc/MangaDock/issues/142)
- [Batch truthful error/progress #154](https://github.com/Slow-Inc/MangaDock/issues/154)
- [Page-boundary cancellation decision #129](https://github.com/Slow-Inc/MangaDock/issues/129)
- [Rolling-context cache safety #524](https://github.com/Slow-Inc/MangaDock/issues/524)
- [Paid Chapter unlock delivery #583](https://github.com/Slow-Inc/MangaDock/issues/583)
- [QR topup and banking-app return #317 / #319](https://github.com/Slow-Inc/MangaDock/issues/317)
- [Payment/topup/atomic unlock merged PR #341](https://github.com/Slow-Inc/MangaDock/pull/341)
- [Canonical terms](../../UBIQUITOUS_LANGUAGE.md)
- [MIT contract](../../MIT/CONTRACT.md)
- [Single-node batch decision ADR 002](../../docs/adr/002-drop-batch-redis-pubsub.md)
- [Batch transport ADR 017](../../docs/adr/017-mit-batch-transport-jobstate-seam.md)
- [Wallet hardening ADR 022](../../docs/adr/022-wallet-atomic-unlock-rpc-toctou-hardening.md)
