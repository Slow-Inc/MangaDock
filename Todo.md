# MangaDock — Granular Todo List (V5 Master)

## 🔹 Phase 0 - Phase 1: Core Foundation (COMPLETED ✅)
- [X]  [Backend] Reverse Proxy Image Architecture
- [X]  [Backend] OAuth 2.0 Integration (Google/Facebook)
- [X]  [Backend] Email Verification & Reset Password Flow
- [X]  [Backend] Profile Picture Integration (Local + Third-party)
- [X]  [Backend] Advanced MIT Optimization (Region-Specific + Gemini 3)
- [X]  [Backend] Overlap Detection Algorithm for Text Translation
- [X]  [Backend] Intelligent Batching Fail-safe (L1 to L2 Redis)
- [X]  [Frontend] Next.js On-the-fly Image Resizing
- [X]  [Frontend] Responsive Mobile Native-like View
- [X]  [Frontend] Reader Hardening (Continuous Image Fix + Scroll Fix)

---

## 🟡 Phase 1.5: Stabilization & Creator Studio (COMPLETED / POLISHING ⏳)
- [X]  [Database] Relational Migration to Supabase (Relational + RLS)
- [X]  [Backend] Manga Upload System for Translators
- [X]  [Frontend] Studio Dashboard & Stats
- [X]  [Backend] Reddit-Style Forum Hub (Nested Threads + Voting)
- [X]  [Real-time] SSE Redis Pub/Sub Bridge (Vote/Comment Sync)
- [X]  [Frontend] LRU API Cache with SWR (500 entries limit)
- [X]  [Backend] HWID Middleware Enforcement
- [X]  [Backend] Wallet Ledger & Revenue Split (70/30)
- [X]  [Backend] Creator Earnings API Endpoint
- [X]  **[Technical Debt]** GoogleBooksService Removal (Completed)
- [X]  **[Backend]** Soft Deletion (`deleted_at`) in Forum Module
- [X]  **[Frontend]** Spoiler Blur / Click-to-reveal in Community

---

## 🔵 Phase 2: Architectural Scaling & Cloud Readiness (IN PROGRESS 🔄)
- [X]  **[Architecture]** Multi-factor Metrics Collection (MetricsService — CPU/mem/latency heartbeat, PRs #16+#34)
- [X]  **[Architecture]** Redis NX Lock-based Leader Election (ElectionService NX mutex, PR #16)
- [X]  **[Architecture]** Reliable Write-behind Queue — `RPOPLPUSH`+`LREM`+Lua EVAL atomic recovery (PR #16)
- [X]  **[Architecture]** Workload-Aware Batching & Supabase Stats Flush (L3BatchWriter + StatsFlushWorker, PR #34)
- [X]  **[Architecture]** Chapter-view Stats Pipeline — Redis → Supabase daily (PR #34)
- [X]  **[Architecture]** L2 Recovery on reconnect (L2RecoveryService + onReconnect hook, PR #34)
- [X]  **[Architecture]** Cache Read Path — L1-first reads + on-L2-hit update L1 (PR #39)
- [X]  **[Architecture]** Cross-node L1 Invalidation via Redis pub/sub `cache:invalidate` (PR #39)
- [X]  **[Architecture]** L2 Recovery Enhancement — compare L1 vs L3 timestamps, pick newest per key → L2 (PR #39/#49)
- [X]  **[Architecture]** Catastrophic Recovery — L1+L2 both fail: compare L3 vs Supabase → bootstrap L2 → L1 (Phase 2.4, PR #70)
- [X]  **[Frontend]** Pass `?mangaId=` param on chapter pages fetch (manga_id currently stored as `''` in chapter_daily_stats)
- [ ]  [Backend] Real-World Payment Gateway (QR/PromptPay)
- [ ]  **[Backend]** Atomic Revenue Split (Postgres Function)
- [ ]  [Infrastructure] Cloudflare R2 Migration & Workers CDN Buffer
- [ ]  [Infrastructure] MIT GPU Cloud Migration (On-Demand)
- [ ]  [Security] 2FA & Device Session Pinning

---

## 📱 Phase 3: Hybrid Mobile Framework (NEXT STEP 🚀)
- [ ]  [Mobile] React Native WebViewer Shell Initialization
- [ ]  [Mobile] Strategic Code Sharing Layer (Shared Types/Logic)
- [ ]  [Mobile] Native Authentication Bridge (Device Token Sync)
- [ ]  [Mobile] Core OS Permission Handling (Storage/Network)

---

## 🚀 Phase 4: Native OS Power Features (R&D 🚧)
- [ ]  [Mobile] Android MediaProjection Native Module (Screen Capture)
- [ ]  [Mobile] WindowManager Overlay System (Floating Bubble)
- [ ]  [Mobile] Native Background Stream Worker (MIT Integration)

---

## 🤝 Phase 5: Retention & Ecosystem (FUTURE 🏁)
- [ ]  [Backend/Frontend] Social Graph Engine (Follow System)
- [ ]  [Frontend] Personalized Reading Collections Sharing
- [ ]  [Backend/Mobile] Push Notification Framework (OS-Level)
