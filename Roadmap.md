<!-- lang:en -->
# MangaDock — Consolidated Architecture & Implementation Roadmap (V5 Master)

## Vision
MangaDock is a premium, decentralized manga platform that bridges the gap between AI-driven translation (MIT) and human creativity. It features a robust marketplace for translators and creators, a high-performance reading experience, and a deep community ecosystem.

---

## T4-STANDARD Engineering Pillars

1. **Idempotent Pipelines:** Every operation (Upload, Vote, Unlock) must be retry-safe with no duplicate data, even when running in parallel.
2. **Webhook Integrity:** All external communications (MIT, Payments) must include HMAC Signature to prevent forgery.
3. **Multi-Layer Cache (L1 In-Memory / L2 Redis / L3 Disk):** Truth hierarchy L1→L2→L3→Supabase supports Horizontal Scaling, Catastrophic Recovery, retry budget + dead-letter queue, cross-node invalidation via pub/sub with Graceful Shutdown Sync before process exits.
4. **Worker Memory Contract:** Heavy compute (AI) must always be delegated out of the Main Process.
5. **Zero-Trust Assets:** Protect images via Hardware ID and 1-Hour Verification Window.
6. **Observability:** Log every request as Structured JSON including IP and User-Agent for Audit Trail.
7. **Premium Design:** Enforce Liquid Glass Aesthetics and Zero-Emoji Policy at System UI level strictly.
8. **User-Centric UX & Empathy:** Every interaction must have Instant Feedback (Optimistic UI), Skeleton Loading, and clear Toast Notifications — designed for real users, not engineering convenience.

---

## Phase-by-Phase Implementation Plan (Phase 0 – Phase 5)

### Implementation Status Audit — 2026-10-22

Status is based on code in the default branch, dated engineering reports, and outstanding release acceptance—not on the previous roadmap labels alone. **Completed means core implementation exists, not that production is deployed or bug-free.** Test counts below come from dated repository reports; they were not rerun for this roadmap edit.

| Phase | Verified status | What the evidence supports |
| --- | --- | --- |
| **0–1: Core Foundation** | **COMPLETED (baseline)** | Web, Backend, MIT, authentication, reader, and cache foundations exist; further hardening is continuous. |
| **1.5: Creator Studio & Community** | **COMPLETED (core) / POLISHING** | Studio/uploads, forum, Supabase, SSE and wallet foundations exist; ongoing QA and bug fixes remain. |
| **2: Scaling & Cloud** | **WIP** | Multi-node cache/leader/queue exist. Xendit and R2 integrations have code, but production rollout/payment acceptance, GPU cloud and full device-security goals are not confirmed complete. |
| **3: Hybrid Mobile** | **COMPLETED (historical) / SUPERSEDED** | The WebView shell/bridge was the transitional solution. The current Mobile app uses native views; the hybrid is no longer the release target. |
| **4: Fully Native Mobile** | **WIP (code integrated, release pending)** | Native screens and Reader are on main without an embedded WebView. Physical-device, live-service, signing and release acceptance are still open. |
| **5: Retention & Community 2.0** | **NOT STARTED (dedicated Phase 5 scope)** | Existing follows and in-app notifications provide reusable foundations, not a personalized Following feed, shareable custom collections or OS push service. |

**Evidence:** [Native integration report](Mobile/docs/2026-10-22-main-integration.md), [Native status/acceptance audit](Mobile/docs/2026-10-16-native-status-audit.md), [test APK limitations](Mobile/docs/2026-10-20-test-apk.md), [cache leader](Backend/src/status/election.service.ts), [payment integration](Backend/src/wallet/xendit.service.ts), [R2 storage selection](Backend/src/common/storage/storage.module.ts), [user follows](Backend/src/user-follows/user-follows.service.ts), [in-app notifications](Backend/src/notifications/notifications.service.ts), and [Native release gate #753](https://github.com/Slow-Inc/MangaDock/issues/753).

---


### Phase 0 – Phase 1: Core Foundation & Intelligent Cache Hardening
**Status:** COMPLETED — Core foundation implemented (further hardening continues)

1. **Core Infrastructure & Image Proxy:** Full-stack setup (Next.js 16+ / NestJS 11+) with Reverse Proxy Image system from Phase 0 for maximum security and stability.
2. **Multi-Method Authentication (OAuth 2.0):** Multiple login methods including Google/Facebook OAuth with Profile Picture Integration — upload a custom avatar or use a photo from linked third-party accounts.
3. **Security Identity Verification:** Email verification via URL + complete Reset Password Flow via email.
4. **Advanced MIT Optimization & Parallel Engine:**
   - AI Pipeline optimized to render only Text Regions (not full page) to reduce workload, bandwidth, and maximize speed.
   - **Queue Optimization (Fire and Forget) — Architecture decided (Option A'):** Non-blocking translation queue. Backend fires and forgets; receives results via Webhook. Implementation: MIT webhook → `cache.set` + `redis.publish` → SSE listener (replaces in-memory job registry with 6 race conditions).
   - **Parallel Processing:** Algorithm processes multiple pages/jobs simultaneously for maximum throughput.
   - **Overlap Detection Algorithm:** Checks proximity of Text regions — merges overlapping regions into one block before translation.
   - **Context Upgrade:** Upgraded translation pipeline to Gemini 3 Flash Lite.
5. **Intelligent Cache Fail-safe (L1 In-Memory to L2 Redis Batching):**
   - L1 (In-Memory Cache): microsecond-level in-process access.
   - L2 (Redis): Distributed Cache for Horizontal Scaling.
   - Batching cycles per data type; critical/frequently-read data batched more often.
6. **Next.js High-Performance Rendering:** On-the-fly image resizing by screen size + Responsive Mobile Native-like View.
7. **Reader Core Hardening:** Fixed critical bugs (broken image continuity, cannot scroll to bottom) + improved Mobile Native Experience.

### Phase 1.5: System Stabilization & Creator Studio
**Status:** COMPLETED (core scope) / POLISHING — ongoing QA and fixes

1. **Manga Upload System & Studio:** Upload system for Translator/Creator with large file support + Studio Dashboard for stats management.
2. **Standard Database Migration:** Migrated from Firebase (NoSQL) to Supabase (Relational PostgreSQL) for higher throughput ceiling, RLS support, and cost efficiency.
3. **Reddit-Style Forum Hub:** Advanced community system with Nested Threads (Recursive Logic), Idempotent Voting, and in-post image uploads.
4. **Real-time & Performance (SSE & LRU Cache):** Server-Sent Events for real-time vote/comment updates + Frontend LRU Cache (500 entries) + SWR Pattern.
5. **HWID & Zero-Trust Gate:** Hardware ID middleware (`x-hardware-id`) + Cloudflare Turnstile to prevent Bot Farms.
6. **Creator Economy Foundation:** Wallet Ledger with automatic Revenue Split (70/30) + duplicate purchase prevention.
7. **Technical Debt Cleanup (Completed):** Removed all `GoogleBooksService` (Legacy) in favor of 100% dynamic MangaDex Service + prepared Forum Soft Deletion.

### Phase 2: Architectural Scaling & Cloud Readiness
**Status:** WIP — Cache architecture implemented; cloud, payment and security rollout not fully verified

**Audit (2026-10-22):** Cache leader election, write-behind queue, recovery and invalidation are implemented. Xendit/PromptPay and Cloudflare R2 adapters exist in source, but live payment acceptance and full production R2 migration are unverified. On-demand GPU cloud migration has no verified completion evidence. Native TOTP flows exist; full device-session pinning is unverified.


1. **Multi-Layer Cache Orchestration (T4-Standard Architecture):** Complete (PRs #16/#34/#39/#49/#50/#55/#70/#71)
   - **Truth Hierarchy:** L1 (in-memory latency) → L2 (Redis, runtime source of truth) → L3 (JSON disk, per-node backup) → Supabase (long-term authority)
   - **Leader Election:** Redis NX Lock (`SET cache:leader NX PX`) + Lua CAS renewal — prevents split-brain and leader thrashing
   - **Write-behind Queue:** `RPOPLPUSH` (atomic) → L3 sync → `LREM` ack; retry budget (MAX_RETRIES=5) + dead-letter queue (`cache:dead_letter`)
   - **Catastrophic Recovery:** Boot with Redis down → read L3 → compare timestamp with Supabase → fire-once reconnect callback push L2
   - **Cross-node L1 Invalidation:** Redis pub/sub `cache:invalidate`
   - **Observability:** `GET /status/cache` → `{ dirtyQueueDepth, processingQueueDepth, deadLetterCount, l3KeyCount, isLeader }`
   - **279 tests passing**
2. **Real-World Payment Gateway:** Connect to real Payment Provider (QR/PromptPay) with HMAC Webhook Validation.
3. **Global Asset Distribution (Multi-layer Buffering):**
   - **Cloudflare Worker Buffer:** Worker as front-line buffer before R2, reducing request rate and cost dramatically.
   - **Backend Cache Buffer:** Cache layer at Backend reduces external call load.
   - **R2 Migration:** Full migration of all asset storage to Cloudflare R2.
4. **MIT GPU Cloud Migration (On-Demand Strategy):**
   - Migrate compute to GPU Cloud that **runs only when traffic arrives** (On-demand Scaling).
   - Billed per actual usage time — lower cost than always-on standby.
5. **Advanced Identification:** Two-Factor Authentication (2FA) + Device Session Pinning that binds account to Hardware ID.

### Phase 3: Hybrid Mobile Framework (Minimum Development Time)
**Status:** COMPLETED (historical transition) / SUPERSEDED by Phase 4

**Audit (2026-10-22):** The former React Native WebView shell and native auth bridge were transitional. The current Mobile entry point mounts native React Native views; this hybrid phase is not the current release target.


1. **React Native WebViewer Shell:** React Native wrapper around existing Web App — reuses premium UI immediately.
2. **Strategic Code Sharing:** Share portions of Codebase (Shared Logic/Types) between Web and Mobile directly — dramatically reduces development time.
3. **Native Authentication Bridge:** Bridge connecting Token and Hardware ID from real device (Android ID/IDFV) into WebView.
4. **Core OS Permissions:** Manage basic system permissions via Native Code.

### Phase 4: Fully Native Mobile Application Development
**Status:** WIP — Native source integrated into main; physical-device and production release acceptance pending

**Audit (2026-10-22):** Mobile/App.tsx mounts NativeSessionView rather than a WebView. Native Reader, discovery, account, Community, Studio and staff flows exist. The [main integration report](Mobile/docs/2026-10-22-main-integration.md) records Mobile 235/235 and Backend 1,014/1,014 tests passing on its verified combined tree; this is **not** proof of accepted device behavior. Still required: APK rebuilt from accepted main, live MIT/payment/OAuth and device regressions, production signing/distribution ([issue #753](https://github.com/Slow-Inc/MangaDock/issues/753)); iOS release acceptance is also unverified.


**Goal:** Build a standalone Android/iOS application with its own native UI, navigation, and manga reader instead of rendering the existing website inside a WebView. Retain the shared MangaDock backend and MIT services; do not duplicate server-side business logic.

1. **Native Application Architecture:** Establish a React Native application with native screens, navigation, design system, state management, and a maintainable feature-based structure. Use native platform modules where needed.
2. **Native Manga Reading Experience:** Implement an image-based manga reader with smooth scrolling, chapter navigation, preloading, efficient image caching, reading progress, and responsive gestures without embedding web pages.
3. **Native Product Features & API Integration:** Rebuild the essential browsing, search, manga details, library, account, and community experiences as native screens, integrated with existing Backend/MIT APIs and shared contracts.
4. **Authentication, Security & OS Integration:** Implement secure OAuth/deep-link handling, token storage, session restoration, and appropriate Android/iOS integrations without relying on the Phase 3 WebView authentication bridge.
5. **Performance, Quality & Release Readiness:** Validate startup time, memory usage, scrolling performance, accessibility, offline/error states, automated tests, crash reporting, and Android/iOS release builds.

**Exit Criteria:** Core browsing, reading, and account journeys run in native screens without WebView dependency, while the web application continues to operate independently against the same backend.

### Phase 5: Retention Ecosystem & Community 2.0
**Status:** NOT STARTED (dedicated Phase 5 scope) — user follows and in-app notifications already exist as reusable foundations

**Audit (2026-10-22):** Current user_follows APIs and the in-app notifications service are not the planned personalized Following/ranked feed or OS-level push delivery. Existing favorites, followed series and reading history are not custom public/shareable collections. No end-to-end delivery of the new Phase 5 scope is claimed.


**Goal:** Improve reader retention and community engagement by reusing the existing NestJS, Supabase/PostgreSQL, Redis, and multi-node infrastructure. Avoid building a custom ML recommendation service or a new message broker.

1. **Lightweight Social Graph & Personalized Feed:**
   - Follow/unfollow users, translators, and creators.
   - Following Feed displays activity from followed accounts in chronological order.
   - Personalized Feed uses lightweight rule-based ranking (recency, engagement, and user interests) rather than a trained recommendation model.
   - Implement with existing NestJS, PostgreSQL, and Redis; no Graph Neural Network or dedicated ML infrastructure.
2. **Reading Collections Sharing:**
   - Create, edit, and delete personal manga collections.
   - Support public/private visibility and sharing via URL or mobile deep link.
   - Store collection data and enforce access controls through existing Supabase/PostgreSQL infrastructure.
3. **Multi-Node Push Notification Framework:**
   - Notify readers about new chapters and new followers on Android/iOS through Expo Push Service (FCM/APNs).
   - Use a dedicated Redis notification queue with multi-node workers, bounded retries, deduplication, and a dead-letter queue.
   - Reuse existing leader-election patterns only for singleton scheduling/coordination tasks; notification delivery must not depend on the cache leader or share the cache write-behind queue.
   - Use a PostgreSQL transactional outbox for durable notification events, with device-token lifecycle management, notification preferences, delivery receipts, and monitoring.
   - Treat push delivery as best-effort/at-least-once, not guaranteed exactly-once delivery.

**Suggested Implementation Order:** Collections Sharing → Social Graph & Feed → Push Notification integration.

**Exit Criteria:** Users can follow creators, browse their Following Feed, share manga collections, and receive relevant mobile push notifications, without a custom recommendation ML service or additional message broker.

<!-- lang:end -->

<!-- lang:th -->
# MangaDock — Consolidated Architecture & Implementation Roadmap (V5 Master)

## Vision
MangaDock is a premium, decentralized manga platform that bridges the gap between AI-driven translation (MIT) and human creativity. It features a robust marketplace for translators and creators, a high-performance reading experience, and a deep community ecosystem.

---

## แกนหลักปรัชญาวิศวกรรมโครงการ (T4-STANDARD Pillars)

1.  **Idempotent Pipelines:** ทุก Operation (Upload, Vote, Unlock) ต้อง Retry-safe ไม่เกิดข้อมูลซ้ำซ้อน แม้จะรันขนานกัน
2.  **Webhook Integrity:** ทุกการสื่อสารภายนอก (MIT, Payments) ต้องมี HMAC Signature เพื่อป้องกันการปลอมแปลง
3.  **Multi-Layer Cache (L1 In-Memory / L2 Redis / L3 Disk):** Truth hierarchy L1→L2→L3→Supabase รองรับ Horizontal Scaling, Catastrophic Recovery, retry budget + dead-letter queue, cross-node invalidation via pub/sub พร้อม Graceful Shutdown Sync ก่อนโปรเซสปิดตัว
4.  **Worker Memory Contract:** งานประมวลผลหนัก (AI) ต้องถูก Delegate ออกจาก Main Process เสมอ
5.  **Zero-Trust Assets:** ปกป้องรูปภาพผ่าน Hardware ID และ 1-Hour Verification Window
6.  **Observability:** บันทึกข้อมูลทุก Request เป็น Structured JSON รวม IP และ User-Agent เพื่อการทำ Audit Trail
7.  **Premium Design:** บังคับใช้ Liquid Glass Aesthetics และ Zero-Emoji Policy ในระดับ System UI อย่างเคร่งครัด
8.  **User-Centric UX & Empathy:** ทุก Interaction ต้องมี Instant Feedback (Optimistic UI), Skeleton Loading, และ Toast Notification ที่ชัดเจน — ออกแบบเพื่อผู้ใช้จริง ไม่ใช่เพื่อ Engineering Convenience

---

## รายละเอียดแผนการดำเนินงานรายเฟส (Phase 0 - Phase 5)

### สรุปสถานะตามหลักฐานจริง — 22 ตุลาคม 2026

ตรวจจาก Source Code บน Branch หลัก รายงานวิศวกรรมที่มีวันที่ และ Release Gates ที่ยังค้าง ไม่ยึดป้ายสถานะเดิมอย่างเดียว **Completed หมายถึง Core Implementation มีอยู่แล้ว ไม่ได้รับรองว่า Deploy Production หรือไม่มี Bug** ตัวเลข Tests เป็นผลจากรายงานใน Repository ไม่ใช่การรันทดสอบใหม่ในรอบแก้ Roadmap นี้

| Phase | สถานะที่ตรวจสอบได้ | หลักฐานและข้อจำกัด |
| --- | --- | --- |
| **0–1: Core Foundation** | **COMPLETED (Baseline)** | มี Web, Backend, MIT, Auth, Reader และ Cache พื้นฐานแล้ว ยังมีงาน Hardening ต่อเนื่อง |
| **1.5: Creator Studio & Community** | **COMPLETED (Core) / POLISHING** | มี Studio/Upload, Forum, Supabase, SSE และ Wallet แล้ว ยังต้อง QA และแก้ Bug ต่อ |
| **2: Scaling & Cloud** | **WIP** | Multi-node Cache/Leader/Queue มีโค้ดแล้ว มี Xendit และ R2 Integration แต่ยังไม่ยืนยัน Production Rollout/Payment จริง, GPU Cloud และ Device Security ครบ |
| **3: Hybrid Mobile** | **COMPLETED (เดิม) / SUPERSEDED** | WebView Shell/Bridge เป็นระบบช่วงเปลี่ยนผ่าน ปัจจุบันแอปใช้ Native Views แล้ว จึงไม่ใช่เป้าหมาย Release อีก |
| **4: Fully Native Mobile** | **WIP (รวมโค้ดแล้ว; Release ยังไม่ผ่าน)** | Native UI/Reader อยู่ใน main ไม่ฝัง WebView แต่ยังต้องรับผลเครื่องจริง บริการจริง การเซ็น และ Release |
| **5: Retention & Community 2.0** | **NOT STARTED (Scope Phase 5 ใหม่)** | มี Follow และ In-app Notifications เดิมเป็นฐาน แต่ยังไม่ได้ยืนยัน Personalized Following Feed, Custom Collections ที่แชร์ได้ และ OS Push |

**หลักฐาน:** [รายงาน Native Integration](Mobile/docs/2026-10-22-main-integration.md), [Native Status/Acceptance](Mobile/docs/2026-10-16-native-status-audit.md), [ข้อจำกัด Test APK](Mobile/docs/2026-10-20-test-apk.md), [Cache Leader](Backend/src/status/election.service.ts), [Payment Integration](Backend/src/wallet/xendit.service.ts), [R2 Storage](Backend/src/common/storage/storage.module.ts), [User Follows](Backend/src/user-follows/user-follows.service.ts), [In-app Notifications](Backend/src/notifications/notifications.service.ts) และ [Native Release Gate #753](https://github.com/Slow-Inc/MangaDock/issues/753)

---


### Phase 0 - Phase 1: Core Foundation & Intelligent Cache Hardening
**สถานะ:** COMPLETED — Core Foundation มีโค้ดแล้ว (ยังมี Hardening ต่อเนื่อง)

1.  **Core Infrastructure & Image Proxy:** จัดวางระบบแบบ Full-stack (Next.js 16+ / NestJS 11+) พร้อมระบบ **Reverse Proxy Image** ตั้งแต่ Phase 0 เพื่อความปลอดภัยและเสถียรภาพสูงสุดในการดึงรูปภาพหลบเลี่ยงข้อจำกัดภายนอก
2.  **Multi-Method Authentication (OAuth 2.0):** ติดตั้งระบบ Login หลากหลายรูปแบบ รวมถึง Google/Facebook OAuth และระบบ **Profile Picture Integration** ที่สามารถอัปโหลดรูปโปรไฟล์เอง หรือเลือกใช้รูปจากบัญชี Third-party ที่เชื่อมโยงไว้มาใช้งานได้ทันที
3.  **Security Identity Verification:** พัฒนาระบบยืนยันตัวตนผ่าน Email โดยการส่ง Verification URL ไปยัง Email ที่สมัครเพื่อให้ผู้ใช้กดเพื่อยืนยันตัวตน และระบบ **Reset Password Flow** ที่สมบูรณ์ผ่าน Email เช่นกัน
4.  **Advanced MIT Optimization & Parallel Engine:**
    *   ปรับปรุง AI Pipeline ให้ Render เฉพาะส่วน Text (Region-Specific) ไม่ต้อง Render ทั้งหน้า เพื่อลด Workload, Bandwidth และเพิ่มความเร็วสูงสุด
    *   **Queue Optimization (Fire and Forget) — ✅ Architecture decided (Option A'):** ออกแบบระบบคิวงานแปลแบบ Non-blocking โดย Backend จะส่งงานแล้วปล่อยทันที (Fire and Forget) และรอรับผลผ่าน Webhook — Implementation: MIT webhook → `cache.set` + `redis.publish` → SSE listener (แทน in-memory job registry เดิม ที่มี race condition 6 จุด)
    *   **Parallel Processing:** ปรับปรุงอัลกอริทึมให้สามารถประมวลผลงานแปลได้แบบขนาน (Parallel) พร้อมกันหลายหน้าหรือหลายงาน เพื่อเพิ่ม Throughput สูงสุด
    *   **Overlap Detection Algorithm:** ตรวจสอบความใกล้ชิดของ Text หากมี 2 ส่วนหรือมากกว่าอยู่ติดกันเกินไปจนเสี่ยงจะทับกันหลังแปล ให้ทำการรวมเป็น 1 ก้อนใหญ่ก่อนแปลเพื่อความสวยงามและถูกต้อง
    *   **Context Upgrade:** อัปเกรดท่อแปลภาษาเป็น **Gemini 3 Flash Lite** เพื่อความเข้าใจบริบทที่ลึกซึ้งกว่าเดิม
5.  **Intelligent Cache Fail-safe (L1 In-Memory to L2 Redis Batching):**
    *   **L1 (In-Memory Cache):** ใช้สำหรับการเข้าถึงข้อมูลความเร็วสูงระดับ Microsecond ภายในโปรเซส
    *   **L2 (Redis):** ใช้เป็น Distributed Cache เพื่อรองรับการทำ **Horizontal Scaling** ในอนาคต
    *   Optimize ระบบการซิงค์ข้อมูลจาก L1 ไปยัง L2 และ JSON Cache แบบเป็นรอบ (Batching Cycles) แยกตามประเภทของ Data
    *   **Data Prioritization:** หากเป็นข้อมูลที่ Critical และใช้บ่อย จะถูก Batch บ่อยกว่าปกติเพื่อเป็น Fail-safe อีกชั้น
6.  **Next.js High-Performance Rendering:** Optimize ระบบให้ทำการลด Pixel ของรูปภาพตามขนาดหน้าจอโดยอัตโนมัติ (On-the-fly Resizing) เพิ่มความเร็วในการโหลด พร้อมปรับจูน **Responsive Mobile Native-like View**
7.  **Reader Core Hardening:** แก้ไข Critical Bugs ในหน้าอ่านมังงะ (เช่น ปัญหาภาพไม่ต่อเนื่อง, ไม่สามารถเลื่อนลงสุดได้) พร้อมปรับปรุง UI ให้รองรับ Mobile แบบ Native Experience 100%

### Phase 1.5: System Stabilization & Creator Studio
**สถานะ:** COMPLETED (Scope หลัก) / POLISHING — ยังมี QA และงานแก้ไข

1.  **Manga Upload System & Studio:** พัฒนาระบบอัปโหลดมังงะสำหรับ Translator/Creator รองรับไฟล์ปริมาณมาก และเพิ่มหน้า **Studio Dashboard** สำหรับบริหารจัดการสถิติและผลงาน
2.  **Standard Database Migration:** สำเร็จการย้ายชุดข้อมูลจาก Firebase (NoSQL) สู่ Supabase (Relational PostgreSQL) เพื่อขยายเพดาน Throughput, รองรับ RLS, และ **ประหยัดต้นทุน (Cost-Effective)** เนื่องจาก Supabase มี Built-in Functions ที่ครอบคลุมกว่าและลดภาระในการเชื่อมต่อ Third-party
3.  **Reddit-Style Forum Hub:** ติดตั้งระบบคอมมูนิตี้ขั้นสูง รองรับ Nested Threads (Recursive Logic), Idempotent Voting และ Image Upload ภายในโพสต์
4.  **Real-time & Performance (SSE & LRU Cache):** ติดตั้งระบบ **Server-Sent Events (SSE)** สำหรับการอัปเดตคะแนนโหวตและคอมเมนต์แบบ Real-time พร้อมระบบ **Frontend LRU Cache** (500 entries) และ **SWR Pattern** เพื่อการตอบสนองที่รวดเร็วที่สุด
5.  **HWID & Zero-Trust Gate:** ติดตั้ง Middleware ตรวจสอบ Hardware ID (`x-hardware-id`) ร่วมกับ Cloudflare Turnstile เพื่อป้องกัน Bot Farm
6.  **Creator Economy Foundation:** พัฒนาระบบ Wallet Ledger รองรับการแบ่งรายได้อัตโนมัติ (Revenue Split 70/30) และระบบป้องกันการซื้อมังงะซ้ำ
7.  **✅ Technical Debt Cleanup (Completed):** ถอดถอน `GoogleBooksService` (Legacy) ออกทั้งหมด เพื่อใช้ MangaDex Service แบบ Dynamic 100% แล้ว และเตรียมเพิ่มระบบ Soft Deletion ใน Forum

### Phase 2: Architectural Scaling & Cloud Readiness
**สถานะ:** WIP — Cache Architecture ทำแล้ว แต่ Cloud, Payment และ Security ยังยืนยันเสร็จครบไม่ได้

**ผลตรวจ (2026-10-22):** Leader Election, Write-behind Queue, Recovery และ Invalidation มีโค้ดแล้ว Xendit/PromptPay และ Cloudflare R2 Adapter มี Implementation แต่ยังไม่พบหลักฐานรับผล Payment จริงและย้าย R2 ทั้งระบบบน Production สำเร็จ ไม่พบหลักฐานยืนยัน GPU Cloud On-demand Migration เสร็จ Native รองรับ TOTP แล้ว แต่ Device Session Pinning ยังยืนยันครบไม่ได้


1.  **Multi-Layer Cache Orchestration (T4-Standard Architecture):** ✅ Complete (PRs #16/#34/#39/#49/#50/#55/#70/#71)
    *   **Truth Hierarchy:** L1 (in-memory latency) → L2 (Redis, runtime source of truth) → L3 (JSON disk, per-node backup) → Supabase (long-term authority)
    *   **Leader Election:** Redis NX Lock (`SET cache:leader NX PX`) + Lua CAS renewal — ป้องกัน split-brain, leader thrashing
    *   **Write-behind Queue:** `RPOPLPUSH` (atomic) → L3 sync → `LREM` ack; retry budget (MAX_RETRIES=5) + dead-letter queue (`cache:dead_letter`)
    *   **Catastrophic Recovery:** Boot with Redis down → อ่าน L3 → compare timestamp กับ Supabase → fire-once reconnect callback push L2
    *   **Cross-node L1 Invalidation:** Redis pub/sub `cache:invalidate`
    *   **Observability:** `GET /status/cache` → `{ dirtyQueueDepth, processingQueueDepth, deadLetterCount, l3KeyCount, isLeader }`
    *   **279 tests passing**
2.  **Real-World Payment Gateway:** เปลี่ยนจาก Test Endpoint เป็นการเชื่อมต่อ Payment Provider จริง (QR/PromptPay) พร้อมระบบตรวจสอบ HMAC Webhook Validation
3.  **Global Asset Distribution (Multi-layer Buffering):**
    *   **Cloudflare Worker Buffer:** ใช้ Worker เป็น Buffer ด่านหน้าก่อนถึง R2 เพื่อลด Request Rate และค่าใช้จ่าย (Cost) ให้ต่ำกว่าปกติมหาศาล
    *   **Backend Cache Buffer:** ใช้ Cache ที่ Backend เป็น Buffer อีกชั้นเพื่อลดโหลดการติดต่อภายนอก
    *   **R2 Migration:** ย้ายการเก็บ Asset ทั้งหมดสู่ Cloudflare R2 อย่างเต็มรูปแบบ
4.  **MIT GPU Cloud Migration (On-Demand Strategy):**
    *   ย้ายระบบประมวลผลไปสู่ GPU Cloud ที่ **ทำงานเฉพาะตอนมี Traffic เข้ามาเท่านั้น** (On-demand Scaling)
    *   **Cost Reduction:** ลดต้นทุนได้มากกว่าการเปิด Standby ตลอดเวลา เนื่องจากคิดค่าบริการตามเวลาใช้งานจริง
5.  **Advanced Identification:** เพิ่มระบบยืนยันตัวตนสองชั้น (2FA) และระบบ Device Session Pinning ผูกบัญชีกับ Hardware ID

### Phase 3: Hybrid Mobile Framework (Shortest Workflow & Code Sharing)
**สถานะ:** COMPLETED (ระบบช่วงเปลี่ยนผ่านเดิม) / SUPERSEDED by Phase 4

**ผลตรวจ (2026-10-22):** WebView Shell และ Native Auth Bridge เป็นระบบเดิมช่วงเปลี่ยนผ่าน ปัจจุบัน Mobile Entry Point ใช้ React Native Views โดยตรงแล้ว ไม่ควรระบุเป็น Next Step หรือเป้าหมาย Release ใหม่


1.  **React Native WebViewer Shell:** ขึ้นโครง React Native เพื่อหุ้ม Web App เดิม ทำให้สามารถนำ UI พรีเมียมมาใช้งานได้ทันที
2.  **Strategic Code Sharing:** อนุญาตให้ **แบ่งปัน Codebase บางส่วน (Shared Logic/Types) ระหว่าง Web และ Mobile ได้โดยตรง** ลดระยะเวลาการพัฒนาลงมหาศาล
3.  **Native Authentication Bridge:** เขียน Bridge เชื่อมต่อ Token และ Hardware ID ของอุปกรณ์จริง (Android ID/IDFV) ส่งเข้า WebView
4.  **Core OS Permissions:** จัดการสิทธิ์การเข้าถึงระบบพื้นฐานผ่าน Native Code

### Phase 4: Fully Native Mobile Application Development (พัฒนาแอป Native เต็มรูปแบบ)
**สถานะ:** WIP — Native Source รวมเข้า main แล้ว แต่ Device และ Production Release Acceptance ยังไม่ผ่าน

**ผลตรวจ (2026-10-22):** Mobile/App.tsx เรียก NativeSessionView ไม่ได้ฝัง WebView มี Native Reader, Discovery, Account, Community, Studio และ Staff แล้ว [รายงาน Main Integration](Mobile/docs/2026-10-22-main-integration.md) ระบุ Mobile 235/235 และ Backend 1,014/1,014 Tests ผ่านบน Tree ที่ตรวจ แต่ **ยังไม่ใช่หลักฐานว่าใช้บนเครื่องจริงหรือพร้อม Production** ยังต้องสร้าง APK จาก main ที่รับแล้ว ตรวจ MIT/Payment/OAuth จริง ทดสอบ Device/UX เซ็น Production และรับผลการแจกจ่ายตาม [Issue #753](https://github.com/Slow-Inc/MangaDock/issues/753) รวมถึงยังไม่มีหลักฐานรับรอง iOS Release


**เป้าหมาย:** พัฒนาแอป Android/iOS ที่มี UI, Navigation และตัวอ่านมังงะเป็นของตัวเอง แทนการแสดงเว็บไซต์เดิมผ่าน WebView โดยใช้ Backend และ MIT Services ชุดเดียวกับ Web App เพื่อลดการทำ Business Logic ซ้ำซ้อน

1. **Native Application Architecture:** วางโครงสร้าง React Native พร้อมหน้าจอ Native, ระบบนำทาง, Design System, State Management และการแยกโมดูลตาม Feature โดยใช้ Native Platform Module เฉพาะส่วนที่จำเป็น
2. **Native Manga Reading Experience:** พัฒนาตัวอ่านมังงะแบบ Native รองรับการเลื่อนที่ลื่นไหล การเปลี่ยนตอน การโหลดภาพล่วงหน้า Image Cache การบันทึกความคืบหน้าการอ่าน และ Gesture โดยไม่ฝังหน้าเว็บ
3. **Native Product Features & API Integration:** พัฒนาหน้าค้นหา สำรวจมังงะ รายละเอียดเรื่อง คลังส่วนตัว บัญชีผู้ใช้ และ Community ด้วย Native UI เชื่อมต่อ Backend/MIT API และใช้สัญญาข้อมูลร่วมกับ Web App
4. **Authentication, Security & OS Integration:** จัดการ OAuth/Deep Link, Secure Token Storage, Session Restoration และการเชื่อมต่อ Android/iOS โดยไม่พึ่ง WebView Authentication Bridge ของ Phase 3
5. **Performance, Quality & Release Readiness:** ตรวจสอบเวลาเปิดแอป การใช้หน่วยความจำ ความลื่นไหลของตัวอ่าน Accessibility การทำงานเมื่อ Offline/เกิดข้อผิดพลาด Automated Tests ระบบรายงาน Crash และการ Build สำหรับ Android/iOS

**เกณฑ์เสร็จสิ้น:** ผู้ใช้สามารถสำรวจมังงะ อ่านมังงะ และจัดการบัญชีผ่านหน้าจอ Native ได้โดยไม่ต้องพึ่ง WebView ขณะที่ Web App ยังทำงานแยกต่างหากบน Backend เดียวกัน

### Phase 5: Retention Ecosystem & Community 2.0
**สถานะ:** NOT STARTED (ตาม Scope Phase 5 ใหม่) — มี Follow และ In-app Notifications เดิมให้ Reuse

**ผลตรวจ (2026-10-22):** มี user_follows API และ In-app Notifications จริง แต่ไม่ใช่ Personalized Following/Ranked Feed หรือ OS Push Notifications และ Favorites/Series Follows/Reading History ที่มีอยู่ไม่ใช่ Custom Collections ที่แชร์ Public Link ได้ตาม Phase 5 จึงยังไม่อ้างว่าส่งมอบ Phase 5 สำเร็จ


**เป้าหมาย:** เพิ่มการมีส่วนร่วมและการกลับมาใช้งานของผู้อ่าน โดยใช้ NestJS, Supabase/PostgreSQL, Redis และระบบ Multi-Node ที่มีอยู่แล้วให้มากที่สุด ไม่สร้าง ML Recommendation Service หรือ Message Broker ใหม่โดยไม่จำเป็น

1. **Lightweight Social Graph & Personalized Feed:**
   - ระบบ Follow/Unfollow ผู้ใช้ นักแปล และ Creator
   - Following Feed แสดงกิจกรรมจากบัญชีที่ติดตามโดยเรียงตามเวลา
   - Personalized Feed จัดอันดับด้วย Rule-based Ranking จากความใหม่ (Recency), Engagement และความสนใจของผู้ใช้ โดยไม่ต้องฝึก Recommendation Model
   - ใช้ NestJS, PostgreSQL และ Redis เดิม ไม่เพิ่ม Graph Neural Network หรือ ML Infrastructure แยกต่างหาก
2. **Reading Collections Sharing:**
   - สร้าง แก้ไข และลบคอลเลกชันมังงะส่วนตัว
   - กำหนดการมองเห็นแบบ Public/Private และแชร์ผ่าน URL หรือ Mobile Deep Link
   - จัดเก็บข้อมูลและควบคุมสิทธิ์ด้วย Supabase/PostgreSQL ที่มีอยู่แล้ว
3. **Multi-Node Push Notification Framework:**
   - แจ้งเตือน New Chapter และ New Follower บน Android/iOS ผ่าน Expo Push Service (FCM/APNs)
   - ใช้ Redis Notification Queue แยกจาก Cache Queue พร้อม Multi-Node Workers, Retry Budget, Deduplication และ Dead-letter Queue
   - Reuse รูปแบบ Leader Election เดิมเฉพาะงาน Scheduler/Coordination ที่ต้องมีตัวทำงานเพียงตัวเดียว โดยไม่ผูกการส่ง Notification กับ Cache Leader
   - ใช้ PostgreSQL Transactional Outbox บันทึก Event อย่างทนทาน พร้อมจัดการ Device Token Lifecycle, Notification Preferences, Delivery Receipts และ Monitoring
   - ออกแบบการส่งให้รองรับการส่งซ้ำและความล้มเหลวของบริการภายนอก ไม่สมมติว่าจะส่งถึงแบบ Exactly-once

**ลำดับการพัฒนาที่แนะนำ:** Collections Sharing → Social Graph & Feed → Push Notification Integration

**เกณฑ์เสร็จสิ้น:** ผู้ใช้ติดตาม Creator ดู Following Feed แชร์คอลเลกชัน และรับ Push Notification บนมือถือได้ โดยไม่ต้องสร้าง Recommendation ML Service หรือ Message Broker ใหม่

<!-- lang:end -->
