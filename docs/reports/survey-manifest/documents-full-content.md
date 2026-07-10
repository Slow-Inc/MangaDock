# Documents Full-Content Survey Manifest

Full (not excerpt) reads of 8 thesis-support files for SE_PHASE1-7 chapter drafting. All 8 files were short enough (62–262 lines) to read in a single pass — no truncation occurred on any file.

---

### Documents/Software Engineer/SE_PHASE2_SRS_AND_SYSTEM_ANALYSIS.md
- **last_commit:** b429175979b03429d327bba4e1a2a9e8e653f693
- **lines_covered:** 91, full
- **read_date:** 2026-07-04
- **findings:**
  - Structured as an IEEE-style SRS "Phase 2" doc, explicitly labeled "Updated Phase 1.5" — reflects Supabase Migration & Async Pipeline architecture, not the original submission.
  - §1.3 Definitions: 3 terms — Storage Adapter (disk/R2 abstraction), Async Webhook (non-blocking AI translate dispatch), Zero-Trust Enforcer (`x-hardware-id` header, reject 401 if missing).
  - §2.2 is a Mermaid fishbone/Ishikawa diagram titled "High Latency and Storage Lock-in" with 5 causal branches (Data Sources/Unstable Upstream APIs, System Integration/Synchronous AI Pipeline timeout risk, User Experience/no feedback when DB offline, Process/tight coupling with Local Disk, Technology/lack of structured observability). Note: section numbering skips §2.1 (starts at 2.2) — file has no §2.1 content, a doc-structure gap.
  - §3 Product Perspective: system framed as "Cloud-Ready Microservices" splitting Compute/Storage/Orchestration via standard interfaces.
  - §4 Functional Requirements "(Added)" — only 3 items, numbered 8–10 (implying items 1–7 exist in an earlier/base phase document not in this file): (8) Supabase Guard detection/alerting, (9) async pipeline for large image translation without disconnecting, (10) Hardware Fingerprinting for device identity.
  - §5 Non-Functional Requirements "(T4-Standard)": Idempotency (no duplicate resource use on repeat translate jobs), Observability (structured JSON logging per request), Resilience (Graceful Shutdown + 3x retry sync cache).
  - §6.2 is a Mermaid Context-Level DFD (Phase 1.5): User→Frontend(Next.js16)→Backend(NestJS11), Backend↔MangaDex API, Frontend↔Supabase (Auth/DB, bidirectional), Backend↔Supabase, Backend→MIT AI Server (Async Webhook), Backend↔2-Layer Cache (Redis/JSON), Backend↔Storage Provider (Local/Cloud). Section numbering again skips §6.1/6.3 — only 6.2 and 6.4 present.
  - §6.4 Data Dictionary — only 4 rows: User.uid (Supabase Auth ID), User.hardwareId (device fingerprint), ChapterVersion.taskId (webhook callback job ID), Storage.key (storage adapter file path, e.g. `uploads/avatars/...`). This is a very thin data dictionary for a full SRS — likely intended as a delta/addendum to a fuller base dictionary, not a complete one.
  - Overall: this is explicitly an incremental "Updated" doc layered onto an assumed base Phase 2 SRS — the numbering gaps (§2.1, §6.1, §6.3, FR items 1–7) confirm content was deliberately restricted to what changed in the Supabase/Async migration, not a full standalone SRS.

---

### Documents/Software Engineer/SE_PHASE5_TEST_SPECIFICATION_AND_UAT.md
- **last_commit:** 0a2d08250be545435badd2a72e8b5bbc07c3bcfe
- **lines_covered:** 65, full
- **read_date:** 2026-07-04
- **findings:**
  - §3 Test Specification Table: 8 test cases (TC-01..TC-08) covering login, register, search, book detail, manga chapter open, translate manga page (Backend→MIT round trip), add favorite, update profile. All are high-level one-line item/expected-result pairs — no test steps, preconditions, or test data specified.
  - §4 UAT Criteria: 4 acceptance conditions — no blocking errors on core flows; main screens render on desktop+mobile; correct response to core interactions (login/open detail/read chapter/translate); results consistent with prototype's business expectations.
  - §5 Sample UAT Result Summary table: 5 rows, all "Pass" except translate-manga-page = "Pass with observation" (remark: speed depends on MIT and external translator providers). This is presented as a **sample/illustrative** result table (title says "Sample UAT Result Summary"), not necessarily a verified/dated real UAT run — no tester names, dates, environment, or build version recorded anywhere in the file.
  - §6 Defect Recording: only 2 example defect rows (BUG-01 translation request timeout — Medium/Open-or-Fixed; BUG-02 mobile layout issue on account page — Low/Fixed). BUG-01's Status column literally reads "Open or Fixed" (a placeholder-style either/or value, not a concrete resolved state) — this is illustrative example data, not a live defect log with real IDs tied to actual issue tracker entries.
  - §7 Summary references companion docs FRONTEND_DOC_INDEX.md, BACKEND_DOC_INDEX.md, MIT_DOC_INDEX.md, and SE_PHASE6_DEPLOYMENT_AND_GO_LIVE.md.
  - Overall assessment: structurally complete (has all IEEE/UAT sections expected) but the actual content is thin/example-grade — 8 test cases and 2 defects for a system this size, and the "Sample" framing in section titles (§3 title doesn't say sample, but §5 and defect table explicitly do) suggests this needs real dated test-run evidence added before being presented as completed test specification, similar in spirit to the SE_PHASE7 placeholder problem (see below) though less severe since this file's example tables at least have plausible domain-specific content rather than generic score-range templates.

---

### Documents/Software Engineer/SE_PHASE7_QUALITY_ASSESSMENT_AND_PROCESS_EVIDENCE.md
- **last_commit:** cba7283130cd3793fd9bb512713c9b307e6b204a
- **lines_covered:** 67, full (note: file has a duplicated "## 5. Sample Result Summary" heading — appears twice, at line 55 and line 58 — a doc defect itself)
- **read_date:** 2026-07-04
- **findings — precise placeholder-vs-real breakdown:**
  - **REAL/specific content:** §4.3 "Defect Recording & Resolution Log" (lines 45–53) is genuine, specific project evidence — a 3-row table with real defect IDs DF-001/DF-002/DF-003 citing actual code identifiers (`@IsInt()` → `@IsNumber({ maxDecimalPlaces: 2 })`, `BatchSyncWorker.flush()`, `this.election.isLeader`, `onModuleInit()` async fix, TDD RED-cycle detection). This section is submission-ready and should be preserved/expanded.
  - **PLACEHOLDER — must be replaced before submission:**
    - §2 "Example Questionnaire Topics" (lines 9–15): heading literally says "Example" — 5 generic topics (ease of use, response speed, data accuracy, satisfaction with reading/translation, screen/navigation appropriateness) with **no actual questionnaire text, no respondent count, no distribution channel**.
    - §3 "Example Evaluation Table" (lines 17–25): heading literally says "Example" — table is just a generic Likert scale template: `| Ease of Use | 1-5 |`, `| Accuracy of Information | 1-5 |`, `| System Responsiveness | 1-5 |`, `| Design and Interface | 1-5 |`, `| Overall Satisfaction | 1-5 |` — **zero actual scores/data filled in, just the score *range* "1-5" repeated for every row.** This must be replaced with real collected survey results (actual N, actual mean/median scores per item) before this can be called a quality assessment.
    - §5 "Sample Result Summary" (second occurrence, lines 58–62): the literal placeholder prose that must be identified/replaced is quoted exactly here: *"จากการประเมินผู้ใช้กลุ่มตัวอย่าง พบว่าระบบ MangaDock มีคะแนนความพึงพอใจโดยรวมอยู่ในระดับดี โดยผู้ใช้ให้คะแนนสูงในด้านความสะดวกของการค้นหาและการเปิดดูรายละเอียดมังงะ ขณะที่ประเด็นที่ควรปรับปรุงเพิ่มเติมคือระยะเวลาการแปลหน้ามังงะในบางกรณีที่ขึ้นกับ service ภายนอก"* — this is generic boilerplate ("results were good overall, users rated search/detail-viewing convenience highly, translation duration is the improvement area") with **no actual numbers, no actual respondent sample size, no actual survey date** — it reads as a template sentence pattern, not a reported finding.
    - §4.1 CMMI-Oriented Evidence (lines 31–36) and §4.2 OWASP-Oriented Evidence (lines 37–43) are bullet lists of *categories of evidence one could cite* ("การวางแผนงานอย่างเป็นลำดับ phase", "การตรวจสอบ input validation" etc.) — these are meta-level pointers/suggestions for what evidence to attach, not the evidence itself. They function as a checklist/outline, not completed content.
  - **Structural defect:** duplicate "## 5. Sample Result Summary" heading (appears at both line 55 as a one-line pointer sentence, and again at line 58 as the actual placeholder paragraph) — indicates the doc was edited/merged carelessly and needs a heading-dedup pass regardless of content fixes.
  - **Verdict: SE_PHASE7 is NOT submission-ready.** Roughly half the document (questionnaire topics, evaluation table, and the closing "Sample Result Summary" paragraph) is explicit example/template text with literal "Example"/"Sample" labels and zero real collected data. Only the defect log (§4.3) is genuine. Before submission this file needs: (1) a real user questionnaire actually distributed with N responses, (2) the evaluation table filled with real per-item scores (not just "1-5" ranges), (3) a real summary paragraph derived from actual data, (4) the duplicate heading fixed.

---

### Documents/Software Engineer/UML_REPORT.md
- **last_commit:** 582bccbb9ee9890d52589d956bc695268bc6c3fe
- **lines_covered:** 262, full
- **read_date:** 2026-07-04
- **findings — all 6 diagrams' actual content:**
  1. **Use Case Diagram** (lines 9–43): 2 actors (Guest, Member), 11 use cases (UC1–UC11: Browse Home, Search, View Book Detail, Read Manga Chapter, Translate Manga Page, Login/Register, Manage Profile, Manage Favorites, Manage Liked Items, Manage Reading History, Verify Captcha). Guest can do UC1/2/3/6 only; Member additionally gets UC4/5/7/8/9/10. Relationships: UC4 `--include-->` UC11 (reading a chapter includes captcha verification), UC5 `--extend-->` UC4 (translate extends read-chapter).
  2. **Component Diagram** (lines 47–87), titled "Phase 1.5 Optimized": NextFrontend component (React19/Next.js16, Centralized Image Resolver, Supabase Guard, Hardware Fingerprinting) and NestBackend component (NestJS11, Structured Logging, Storage Adapter, Async Webhook Controller); services BooksService/UsersService/CacheOrchestrator/SupabaseService/StorageProvider(interface); externals MangaDexAPI, **GeminiAPI**, MITServer(FastAPI/Async), Supabase, Redis, LocalStorage. Notably BooksService is drawn with a direct edge labeled "Translation" straight to GeminiAPI — this is an architectural simplification/inaccuracy since per other docs, Gemini is actually called from inside MIT, not directly from BooksService (flagged separately below re: MIT doc correction).
  3. **Package Diagram (Backend)** (lines 91–125): classDiagram-style, AppModule imports StorageModule/CacheModule/SupabaseModule/BooksModule; StorageModule exposes StorageProvider interface + DiskStorageProvider; CacheModule exposes CacheOrchestratorService/RedisService/JsonCacheService/ImageCacheService; BooksModule exposes BooksController/MitWebhookController/BooksService.
  4. **Class Diagram (Core Services)** (lines 129–165): StorageProvider interface (put/get/delete/exists/list/deleteDir); BooksService (field `activeBatchJobs: Map`; methods getLandingBooks/translateMangaPagePatches/startOrAttachBatchJob/handleMitCallback(taskId,result)); MitWebhookController(handleCallback(signature,body)); AllExceptionsFilter(catch); StructuredLoggingInterceptor(intercept). Relations: BooksService ..> StorageProvider (uses), MitWebhookController --> BooksService (notifies).
  5. **Sequence Diagram: Async Manga Translation (T4-Standard)** (lines 169–192): User→FE Request Translation; FE→BE POST /batch-translate-patches (with x-hardware-id); BE→BS startOrAttachBatchJob(); BS→MIT POST /patches/batch (taskId, callback_url); MIT-->BS 202 Accepted (non-blocking); BS-->BE Job Started; BE-->FE SSE Stream Initialized; [MIT processes in background]; MIT->BE POST /webhooks/mit/callback (taskId, patches, HMAC); BE->BS handleMitCallback; BS saves patches via StorageProvider; BS->FE SSE Push (pageIndex, patchUrls); FE-->User render translated overlay.
  6. **Deployment Diagram** (lines 196–221) "Phase 1.5 Readiness" — dev/VPS topology: subgraph Local/VPS containing FE/BE/MIT/Redis containers + local disk `/uploads`; subgraph Cloud_Services containing SupabaseCloud and **Gemini API**; all services co-located on one VPS.
  - **§6.1 Target Production Deployment Topology (ADR 021)** (lines 229–262) is a *second*, explicitly-labeled-different deployment diagram appended after the 6-diagram set, described as the **real production topology** vs. §6 being "development topology". Key content: 3-tier split — VPS (always-on, ~0 marginal cost: FE, BE, Redis), Serverless GPU Cloud (on-demand: MIT), Managed/External (Supabase Auth+PostgreSQL, Cloudflare R2 free tier, and **"9arm Qwen3.6-35B in subscription — not Gemini"** explicitly labeled as the LLM). This directly contradicts the component diagram (#2 above) and the dev deployment diagram (#6 above) which both show Gemini API as the translation provider. The file itself flags this discrepancy via an explanatory note right before §6.1 (line 227): *"หมายเหตุ: แผนภาพด้านบนคือ development topology (ทุก service รันรวมกัน local/VPS) ส่วนแผน production จริง เป็นแบบ 2-tier on-demand ตาม ADR 021"* — i.e., the doc already self-documents that dev uses Gemini-labeled diagrams while real production per ADR 021 uses Qwen 9arm, matching exactly the correction the user flagged for the MIT doc.
  - Footer note (line 262) reiterates cost model: state (Supabase+R2) lives outside compute so FE/BE/MIT can be shut down when idle without data loss.

---

### Documents/Backend/BACKEND_SERVICE_OVERVIEW_AND_INTEGRATION.md
- **last_commit:** cba7283130cd3793fd9bb512713c9b307e6b204a
- **lines_covered:** 89, full
- **read_date:** 2026-07-04
- **findings:**
  - §1.2 Tech Stack: NestJS 11+, Supabase(PostgreSQL)+RLS, 2-Layer Cache (Memory+Redis) with Graceful Shutdown Sync ("T4 Pillar 3"), Asynchronous Webhook Flow for MIT ("T4 Pillar 2") — confirms this doc uses the same "T4-STANDARD"/"T4 Pillar N" terminology framework as SE_PHASE2 and the UML report.
  - §4 lists 10 backend modules with one-line responsibility each: `books/` (data + translation orchestration), `users/` (user APIs + avatar upload), `cache/` (2-tier abstractions + sync logic), `supabase/` (PG+RLS integration), `status/` (health/status endpoints; notably **MetricsService** — node heartbeat CPU/mem/latency → `cluster_metrics:{nodeId}`; and **ElectionService** — Redis NX-Lock leader election via `SET NX PX` acquisition + Lua compare-and-swap renewal/release, guarding against lock theft, used to pick the Leader Node for the write-behind queue), `forum/` (posts/nested comments/voting/image upload), `wallet/` (balance+ledger), `unlock/` (idempotent unlock economy flow), `upload/` (StorageModule, `@Global`, `STORAGE_PROVIDER` token abstraction), `versions/` (multi-translator chapter versions).
  - §5 MIT Integration Role (Asynchronous) — 4-step flow: (1) Backend sends job to MIT with `taskId` + `callback_url`; (2) MIT immediately returns 202 Accepted (non-blocking); (3) MIT fires webhook to `/webhooks/mit/callback` per finished page; (4) `MitWebhookController` verifies HMAC signature and updates job status.
  - §6 Runtime env vars: `MANGA_TRANSLATOR_URL` (MIT instance address), `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, `MIT_WEBHOOK_SECRET` (HMAC verification), `BACKEND_PUBLIC_ORIGIN` (used to build the callback URL sent to MIT). Explicit ordering note: backend should be started after MIT is ready if the test flow depends on translation.
  - Doc is a thin "bridge" overview (per its own §8 Summary) explicitly deferring full detail to Backend/README.md — does not duplicate deep implementation detail, consistent with its stated purpose.

---

### Documents/Frontend/FRONTEND_ARCHITECTURE_AND_RUNTIME.md
- **last_commit:** b429175979b03429d327bba4e1a2a9e8e653f693
- **lines_covered:** 82, full
- **read_date:** 2026-07-04
- **findings:**
  - §1.2 Tech Stack: Next.js 16+ (Turbopack), React 19, Tailwind CSS v4, Supabase Auth via `@supabase/ssr`, Next.js Fetch API with a global fetch interceptor implementing a "Supabase Connectivity Guard."
  - §2 Main Responsibilities item 5 explicitly names **SupabaseGuard**: checks DB availability and surfaces a Toast Notification if the Supabase project is paused — matches the "Zero-Trust Enforcer"/"Supabase Guard" concept named in SE_PHASE2 FR#8.
  - §3 High-Level Architecture: explicitly states Frontend does **not** call MIT directly in the main flow — Backend is always the intermediary ("Frontend ไม่เรียก MIT โดยตรงใน flow หลักของระบบ").
  - §4 Important Frontend Areas (7 items): `app/page.tsx` (landing), `app/components/` (incl. SupabaseGuard, MangaReader), `app/contexts/` (auth, toast), `app/api/` (proxy/server-side route handlers), `app/lib/` (Supabase setup utilities), `app/hooks/`, `app/community/` (Forum: Post Feed, Post Detail, Voting, Nested Comments, Image Upload), `app/studio/` (Creator/Translator Studio: Upload, Works Management, Manga Pages, Wallet).
  - §5 Runtime Configuration env vars: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `INTERNAL_API_URL` (server-side internal requests), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Cloudflare Turnstile).
  - §6 Integration Notes item 3: translation pipeline results are shown either via **Streaming (NDJSON)** or via backend status-update polling — two delivery mechanisms mentioned here, whereas the UML sequence diagram and backend doc describe SSE push; this doc adds NDJSON streaming as an alternative/additional delivery path not mentioned elsewhere, worth reconciling if inconsistent.
  - Same "bridge doc, defers to README" framing as the Backend overview doc (§7/§8).

---

### Documents/MIT/MIT_SERVICE_OVERVIEW_AND_INTEGRATION.md
- **last_commit:** 644465899dda5ff676dfd3c7f2e25403072b5c1b
- **lines_covered:** 62, full
- **read_date:** 2026-07-04
- **findings:**
  - §2 Main Responsibilities — 6-step pipeline: Text Detection → OCR (reads Japanese/original-language text) → Translation ("แปลข้อความที่อ่านได้เป็นภาษาไทย (ผ่าน Gemini API หรือผู้ให้บริการอื่น)" — translates to Thai via **Gemini API** or other providers) → Inpainting (remove original text, redraw background) → Rendering (write translated text back onto image) → Patch Generation (produce cropped patches sent back to Backend).
  - §4 Integration with Backend (Asynchronous Flow), "T4-STANDARD": (1) receives HTTP POST at `/translate/with-form/patches/batch` with images + `callback_url`; (2) responds `202 Accepted` immediately so the connection doesn't hang; (3) runs pipeline as a background task; (4) on completion of each page, POSTs back to Backend's `callback_url` with `taskId` and HMAC signature.
  - §5 Technology Stack explicitly lists: Python 3.12+, FastAPI/Uvicorn, PyTorch + manga-ocr + lama-inpainter, **"Translation: Gemini API (Google Generative AI)"**, httpx for sending webhooks.
  - §6 Runtime and Deployment: high compute/GPU requirement; can run local or on Cloud GPU e.g. RunPods; defers install/model details to MIT/README.md.
  - **Correction needed — confirmed per user's brief:** §2 step 3 and §5 both state the translation provider is **"Gemini API"** unconditionally, with no mention of Qwen. This is inaccurate/incomplete versus actual practice (Qwen 9arm in dev, Gemini in prod for cost reasons, per user) and versus the project's own later-written docs: UML_REPORT.md §6.1 (ADR 021 production topology, line ~248) explicitly labels the LLM as **"9arm Qwen3.6-35B in subscription — not Gemini"** and the Obsidian/user memory (`reference_antigravity_agy_clink.md`, `project_mit_inpainter_flux_branch.md`) also treats Qwen/9arm as a live production model choice. So MIT_SERVICE_OVERVIEW_AND_INTEGRATION.md §2/§5 is now stale/incomplete relative to the project's own more recent architecture note in UML_REPORT.md — **this file should be updated to describe both providers (Qwen 9arm for dev / cost-sensitive runs, Gemini for prod-quality runs, or whichever direction is currently true) rather than naming only Gemini**, to avoid contradicting UML_REPORT.md §6.1 which the same documentation set already ships.

---

### Documents/SYSTEM_ARCHITECTURE_OVERVIEW.md
- **last_commit:** cba7283130cd3793fd9bb512713c9b307e6b204a
- **lines_covered:** 87, full (whole "V5 Master" file — confirmed nothing beyond line 87; file is not actually very long despite the "Master" label)
- **read_date:** 2026-07-04
- **findings (sections beyond the previously-seen first ~50 lines):**
  - §1 High-Level Architecture Mermaid diagram: User Browser + Mobile App (Hybrid Shell, "Phase 3") both talk to Backend(NestJS11); Backend↔L1 Cache(in-memory)↔L2 Cache(Redis); Backend↔Supabase(PG+RLS); Backend↔MangaDex API; Backend↔MIT (GPU Cloud, On-Demand AI); Backend↔Cloudflare Worker (Buffer & Proxy)↔Cloudflare R2 (Object Storage).
  - §2.1 "Advanced 3-Layer Cache (Phase 2 — In Progress)" — this is the section past line 50 not previously read. Defines a **Truth Hierarchy**: L1 in-memory (`JsonCacheService`, latency-only, lost on restart) → L2 Redis (source of truth at runtime, enables horizontal scaling) → L3 JSON disk (`L3DiskService`, per-node backup / Leader buffer before Supabase write) → DB Supabase (long-term authoritative source). Detailed bullets:
    - L1: in-memory Map only, no disk I/O, writes alongside L2 on `set()` for in-process read consistency.
    - L2: Redis is *the* runtime source of truth, supports horizontal scaling, every `set()` writes L2 first.
    - L3: written by `L3BatchWriter` running on every node per a per-data-type flush frequency; the Leader does an L2→L3 re-sync before writing Supabase — explicitly marked **"(Issues #13–15 🔵 Planned)"**, i.e. not yet implemented at time of writing.
    - Redis NX Lock Leader Election: marked **✅ done** — `SET cache:leader NX PX` acquisition + Lua CAS renewal + `DEL` on shutdown, preventing split-brain/leader-thrashing/lock-theft.
    - Reliable Write-behind Queue: marked **✅ done** — `RPOPLPUSH` atomic move → L3 sync → `LREM` ack; crash recovery via `LRANGE` on startup.
    - Node Observability: marked **✅ done** — `MetricsService` heartbeat → `cluster_metrics:{nodeId}` (TTL 30s), explicitly monitoring-only, "ไม่ใช้ตัดสิน leadership" (not used to decide leadership).
    - Cross-node L1 Sync: marked **not yet implemented** — "Phase 3", intended via Redis Pub/Sub.
    - Recovery Hierarchy: L1 memory → compare L3 disk vs Supabase timestamp (newer wins) → fallback to Supabase only; stated to be implemented alongside the first Supabase handler.
  - §2.2 Frontend Optimizations: LRU API Cache (O(1), JS `Map`, 500-entry cap to prevent browser memory leak); Stale-While-Revalidate (shows stale cached data immediately = "zero-latency navigation", silently refetches with no skeleton loading); SSE Real-time Bridge (Redis Pub/Sub → SSE push for votes/comments, with exponential backoff on connection drop).
  - §2.3 Commercial-Grade Storage: Cloudflare Workers as a front-door buffer to cut request rate/cost hitting R2 directly; an Image Proxy layer doing image optimization + hotlink protection.
  - §2.4 On-Demand AI Pipeline: MIT migrated to GPU Cloud supporting parallel processing; on-demand/usage-based execution for max cost efficiency.
  - §2.5 Hybrid Mobile Strategy: React Native wrapping the premium web app, sharing logic/types as the "shortest workflow"; native OS bridge connects MediaProjection + WindowManager APIs via native modules.
  - §2.6 "Atomic Operations & Security Hardening (PR #8 Integration)" — 3 hardening items: (a) Database-Level Atomicity via PostgreSQL RPCs `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` — moves wallet-ledger and vote-recalculation math from app layer into DB layer specifically to eliminate TOCTOU (time-of-check-to-time-of-use) races and double-spending "100% เด็ดขาด" (absolutely/decisively); (b) Zero-Trust File Uploads — switched from trusting HTTP headers to deep magic-byte inspection via the `file-type` library; (c) XSS Sanitization — image URL/content sanitization blocking `javascript:` payloads at the frontend component level (matches the CLAUDE.md Image XSS guidance).
  - §3 Interaction Summary (4 one-liners) and §4 Responsibility by Layer (4 one-liners) close the doc — pure recap, no new content.
  - Confirms this file is the canonical "V5 Master" high-level architecture doc that the 3-layer cache design (L1/L2/L3), leader-election, and write-behind-queue mechanisms — referenced piecemeal in the Backend overview doc and in the project's own memory notes — are formally specified in.
