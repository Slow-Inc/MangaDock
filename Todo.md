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
- [ ]  **[Backend]** Soft Deletion (`deleted_at`) in Forum Module
- [ ]  **[Frontend]** Spoiler Blur / Click-to-reveal in Community

---

## 🔵 Phase 2: Architectural Scaling & Cloud Readiness (PLANNED 🔭)
- [ ]  **[Architecture]** L2-Centric Cache Refactor (Write-buffer logic)
- [ ]  **[Architecture]** Redis Pub/Sub L1 Mirroring Sync Engine
- [ ]  **[Architecture]** Workload-Aware Leader Election System
- [ ]  **[Architecture]** Intelligent Write-behind Batching (Redis -> JSON -> DB)
- [ ]  [Backend] Real-World Payment Gateway (QR/PromptPay)
- [ ]  **[Backend]** Atomic Revenue Split — ย้าย `processRevenueSplit` (spendCoins + addCoins) เข้าไปเป็น Postgres function เดียว เพื่อป้องกัน user เสียเงินโดยไม่ได้รับสิทธิ์ถ้า creator payout ล้มเหลวกลางทาง (ดำเนินการพร้อมกับ Payment Gateway เพราะ flow จะเปลี่ยน)
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
