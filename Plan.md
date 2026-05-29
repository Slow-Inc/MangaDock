# MangaDock Project Roadmap (V5 Master)

## Vision
MangaDock is a premium, decentralized manga platform that bridges the gap between AI-driven translation (MIT) and human creativity. It features a robust marketplace for translators and creators, a high-performance reading experience, and a deep community ecosystem.

---

## ✅ Phase 1: Core Foundation & Intelligent Infrastructure
- **Backend Migration:** Migrated from Firebase to Supabase forRelational PostgreSQL & RLS.
- **Multi-Auth:** OAuth 2.0 (Google/Facebook) + Email Verification & Reset Flow.
- **MIT Optimization:** Region-Specific Rendering + Parallel Engine + Overlap Detection + Gemini 3.
- **Cache Hardening:** Intelligent Batching Fail-safe (L1 to L2 Redis).
- **UI/UX Optimization:** Next.js Image Resizing + Responsive Native-like View.

---

## ✅ Phase 1.5: Studio Redesign & Community Hub
- **Manga Studio:** Upload System for Translators + Studio Dashboard & Statistics.
- **Reddit-style Forum:** Nested Threads (Recursive CTE), Idempotent Voting, and Image Uploads.
- **Zero-Trust Security:** HWID Middleware Enforcement + Cloudflare Turnstile Guard.
- **Creator Economy:** Revenue split (70/30), wallet ledger, and creator earnings API.
- ✅ **Completed:** Technical Debt cleanup (GoogleBooks removal). Forum soft deletion (Completed).

---

## 🔭 Phase 2: Architectural Scaling & Cloud Readiness
- **2-Layer Cache Upgrade:** L2-Centric Architecture + Redis Pub/Sub Sync + Leader Election.
- **Commercial Gateway:** Real-World Payment Gateway (QR/PromptPay) with HMAC Webhooks.
- **Storage Scaling:** Cloudflare R2 Migration + Multi-layer Workers CDN Buffering.
- **AI Infrastructure:** MIT GPU Cloud Migration (On-Demand Usage-based Scaling).
- **Security:** Two-Factor Authentication (2FA) & Device Session Pinning.

---

## 🚀 Phase 3: Hybrid Mobile Framework (Shortest Workflow)
- **WebViewer Shell:** React Native wrap for Next.js UI (Liquid Glass) to reuse codebase.
- **Strategic Code Sharing:** Shared logic, API methods, and types between Web & Mobile.
- **Native Bridge:** Android MediaProjection (Screen Capture) & WindowManager (Overlay).
- **Auth Bridge:** Native identity & Token exchange for seamless login.

---

## Future Features (Phase 4 & Beyond)
- **Native OS Power:** R&D for deep-level OS translation features.
- **Retention Graph:** Social Follow System + Personal Collections Sharing.
- **Push Engine:** OS-level Push Notifications (FCM/Expo).
