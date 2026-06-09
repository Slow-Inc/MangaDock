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

### Phase 0 – Phase 1: Core Foundation & Intelligent Cache Hardening
**Status:** Completed

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
**Status:** Completed / Polishing

1. **Manga Upload System & Studio:** Upload system for Translator/Creator with large file support + Studio Dashboard for stats management.
2. **Standard Database Migration:** Migrated from Firebase (NoSQL) to Supabase (Relational PostgreSQL) for higher throughput ceiling, RLS support, and cost efficiency.
3. **Reddit-Style Forum Hub:** Advanced community system with Nested Threads (Recursive Logic), Idempotent Voting, and in-post image uploads.
4. **Real-time & Performance (SSE & LRU Cache):** Server-Sent Events for real-time vote/comment updates + Frontend LRU Cache (500 entries) + SWR Pattern.
5. **HWID & Zero-Trust Gate:** Hardware ID middleware (`x-hardware-id`) + Cloudflare Turnstile to prevent Bot Farms.
6. **Creator Economy Foundation:** Wallet Ledger with automatic Revenue Split (70/30) + duplicate purchase prevention.
7. **Technical Debt Cleanup (Completed):** Removed all `GoogleBooksService` (Legacy) in favor of 100% dynamic MangaDex Service + prepared Forum Soft Deletion.

### Phase 2: Architectural Scaling & Cloud Readiness
**Status:** In Progress (Cache Upgrade Complete — remainder Planned)

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
**Status:** Next Step (Maximum development time reduction strategy)

1. **React Native WebViewer Shell:** React Native wrapper around existing Web App — reuses premium UI immediately.
2. **Strategic Code Sharing:** Share portions of Codebase (Shared Logic/Types) between Web and Mobile directly — dramatically reduces development time.
3. **Native Authentication Bridge:** Bridge connecting Token and Hardware ID from real device (Android ID/IDFV) into WebView.
4. **Core OS Permissions:** Manage basic system permissions via Native Code.

### Phase 4: Native OS Power Features
**Status:** R&D Phase (specific points in Native Android / Java / Kotlin)

1. **Android MediaProjection Module:** Real-time screen capture module for other applications.
2. **WindowManager Overlay (Native):** Floating Bubble system that overlays translated text frames on other apps on-the-fly.
3. **Background Stream Worker:** Native-level background service for streaming image data without affecting main app performance.

### Phase 5: Retention Ecosystem & Community 2.0
**Status:** Final Goal (building a sustainable ecosystem)

1. **Social Graph Engine:** Advanced Follow System + personalized Feed.
2. **Reading Collections Sharing:** Personal manga collections sharable via link.
3. **Push Notification Framework:** OS-level notifications (New Chapter / Follower Update).
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

### Phase 0 - Phase 1: Core Foundation & Intelligent Cache Hardening
**สถานะ:** ✅ Completed

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
**สถานะ:** ✅ Completed / ⏳ Polishing

1.  **Manga Upload System & Studio:** พัฒนาระบบอัปโหลดมังงะสำหรับ Translator/Creator รองรับไฟล์ปริมาณมาก และเพิ่มหน้า **Studio Dashboard** สำหรับบริหารจัดการสถิติและผลงาน
2.  **Standard Database Migration:** สำเร็จการย้ายชุดข้อมูลจาก Firebase (NoSQL) สู่ Supabase (Relational PostgreSQL) เพื่อขยายเพดาน Throughput, รองรับ RLS, และ **ประหยัดต้นทุน (Cost-Effective)** เนื่องจาก Supabase มี Built-in Functions ที่ครอบคลุมกว่าและลดภาระในการเชื่อมต่อ Third-party
3.  **Reddit-Style Forum Hub:** ติดตั้งระบบคอมมูนิตี้ขั้นสูง รองรับ Nested Threads (Recursive Logic), Idempotent Voting และ Image Upload ภายในโพสต์
4.  **Real-time & Performance (SSE & LRU Cache):** ติดตั้งระบบ **Server-Sent Events (SSE)** สำหรับการอัปเดตคะแนนโหวตและคอมเมนต์แบบ Real-time พร้อมระบบ **Frontend LRU Cache** (500 entries) และ **SWR Pattern** เพื่อการตอบสนองที่รวดเร็วที่สุด
5.  **HWID & Zero-Trust Gate:** ติดตั้ง Middleware ตรวจสอบ Hardware ID (`x-hardware-id`) ร่วมกับ Cloudflare Turnstile เพื่อป้องกัน Bot Farm
6.  **Creator Economy Foundation:** พัฒนาระบบ Wallet Ledger รองรับการแบ่งรายได้อัตโนมัติ (Revenue Split 70/30) และระบบป้องกันการซื้อมังงะซ้ำ
7.  **✅ Technical Debt Cleanup (Completed):** ถอดถอน `GoogleBooksService` (Legacy) ออกทั้งหมด เพื่อใช้ MangaDex Service แบบ Dynamic 100% แล้ว และเตรียมเพิ่มระบบ Soft Deletion ใน Forum

### Phase 2: Architectural Scaling & Cloud Readiness
**สถานะ:** 🔵 In Progress (Cache Upgrade ✅ Complete — ส่วนที่เหลือ Planned)

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
**สถานะ:** 🚀 Next Step (ยุทธศาสตร์ลดเวลาการพัฒนาขั้นสูงสุด)

1.  **React Native WebViewer Shell:** ขึ้นโครง React Native เพื่อหุ้ม Web App เดิม ทำให้สามารถนำ UI พรีเมียมมาใช้งานได้ทันที
2.  **Strategic Code Sharing:** อนุญาตให้ **แบ่งปัน Codebase บางส่วน (Shared Logic/Types) ระหว่าง Web และ Mobile ได้โดยตรง** ลดระยะเวลาการพัฒนาลงมหาศาล
3.  **Native Authentication Bridge:** เขียน Bridge เชื่อมต่อ Token และ Hardware ID ของอุปกรณ์จริง (Android ID/IDFV) ส่งเข้า WebView
4.  **Core OS Permissions:** จัดการสิทธิ์การเข้าถึงระบบพื้นฐานผ่าน Native Code

### Phase 4: Native OS Power Features (ไม้ตายของระบบ)
**สถานะ:** 🚧 R&D Phase (เขียนโค้ดเจาะจงเฉพาะจุดด้วย Native Android / Java / Kotlin)

1.  **Android MediaProjection Module:** พัฒนาโมดูลดักจับภาพหน้าจอ (Screen Capture) จากแอปพลิเคชันอื่นแบบเรียลไทม์
2.  **WindowManager Overlay (Native):** สร้างระบบ Floating Bubble วาดกรอบคำแปลทับซ้อนหน้าจอแอปอื่นแบบ On-the-fly
3.  **Background Stream Worker:** เขียน Service เบื้องหลังระดับ Native เพื่อสตรีมข้อมูลภาพโดยไม่กระทบประสิทธิภาพแอปหลัก

### Phase 5: Retention Ecosystem & Community 2.0
**สถานะ:** 🏁 Final Goal (การสร้างระบบนิเวศที่ยั่งยืน)

1.  **Social Graph Engine:** ระบบ Follow System ขั้นสูง และหน้า Feed ที่ปรับแต่งเฉพาะบุคคล
2.  **Reading Collections Sharing:** ระบบจัดหมวดหมู่มังงะส่วนตัวที่สามารถแชร์ลิงก์ได้
3.  **Push Notification Framework:** ระบบแจ้งเตือนระดับ OS (New Chapter / Follower Update)
<!-- lang:end -->
