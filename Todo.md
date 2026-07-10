<!-- REDIRECT: docs/OPEN-WORK-LEDGER.md -->
<!-- status: archived -->

> ⚠️ **SUPERSEDED** — historical checklist, kept for the completed-phase record only. Current open work → `docs/OPEN-WORK-LEDGER.md`; the phase roadmap → `Roadmap.md`. · เอกสารนี้ถูกแทนที่แล้ว — เก็บไว้เป็นบันทึกงานที่ทำเสร็จ; งานค้างปัจจุบันดูที่ `docs/OPEN-WORK-LEDGER.md`, roadmap ดูที่ `Roadmap.md`

<!-- lang:en -->
# MangaDock — Granular Todo List (V5 Master)

## Phase 0 - Phase 1: Core Foundation (COMPLETED)
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

## Phase 1.5: Stabilization & Creator Studio (COMPLETED / POLISHING)
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

## Phase 2: Architectural Scaling & Cloud Readiness (IN PROGRESS)
- [X]  **[Architecture]** Multi-factor Metrics Collection (MetricsService)
- [X]  **[Architecture]** Redis NX Lock-based Leader Election
- [X]  **[Architecture]** Reliable Write-behind Queue — RPOPLPUSH+LREM+Lua EVAL
- [X]  **[Architecture]** Workload-Aware Batching & Supabase Stats Flush
- [X]  **[Architecture]** Chapter-view Stats Pipeline — Redis → Supabase daily
- [X]  **[Architecture]** L2 Recovery on reconnect
- [X]  **[Architecture]** Cache Read Path — L1-first reads
- [X]  **[Architecture]** Cross-node L1 Invalidation via Redis pub/sub
- [X]  **[Architecture]** L2 Recovery Enhancement
- [X]  **[Architecture]** Catastrophic Recovery — L1+L2 both fail
- [X]  **[Frontend]** Pass `?mangaId=` param on chapter pages fetch
- [ ]  [Backend] Real-World Payment Gateway (QR/PromptPay)
- [ ]  **[Backend]** Atomic Revenue Split (Postgres Function)
- [ ]  [Infrastructure] Cloudflare R2 Migration & Workers CDN Buffer
- [ ]  [Infrastructure] MIT GPU Cloud Migration (On-Demand)
- [ ]  [Security] 2FA & Device Session Pinning

---

## Phase 3: Hybrid Mobile Framework (NEXT STEP)
- [ ]  [Mobile] React Native WebViewer Shell Initialization
- [ ]  [Mobile] Strategic Code Sharing Layer (Shared Types/Logic)
- [ ]  [Mobile] Native Authentication Bridge (Device Token Sync)
- [ ]  [Mobile] Core OS Permission Handling (Storage/Network)

---

## Phase 4: Native OS Power Features (R&D)
- [ ]  [Mobile] Android MediaProjection Native Module (Screen Capture)
- [ ]  [Mobile] WindowManager Overlay System (Floating Bubble)
- [ ]  [Mobile] Native Background Stream Worker (MIT Integration)

---

## Phase 5: Retention & Ecosystem (FUTURE)
- [ ]  [Backend/Frontend] Social Graph Engine (Follow System)
- [ ]  [Frontend] Personalized Reading Collections Sharing
- [ ]  [Backend/Mobile] Push Notification Framework (OS-Level)
<!-- lang:end -->

<!-- lang:th -->
# MangaDock — รายการสิ่งที่ต้องทำ (V5 Master)

## Phase 0 - Phase 1: รากฐานหลัก (เสร็จสมบูรณ์)
- [X]  [Backend] สถาปัตยกรรม Reverse Proxy Image
- [X]  [Backend] OAuth 2.0 Integration (Google/Facebook)
- [X]  [Backend] ยืนยัน Email & Reset Password
- [X]  [Backend] รูปโปรไฟล์ (อัปโหลดเองหรือจาก Third-party)
- [X]  [Backend] MIT Optimization ขั้นสูง (เฉพาะ Region + Gemini 3)
- [X]  [Backend] อัลกอริทึมตรวจจับข้อความซ้อนทับ
- [X]  [Backend] Intelligent Batching Fail-safe (L1 → L2 Redis)
- [X]  [Frontend] ลดขนาดรูปภาพแบบ On-the-fly
- [X]  [Frontend] หน้าจอ Mobile ที่รู้สึกเหมือน Native
- [X]  [Frontend] Reader Hardening (แก้รูปไม่ต่อเนื่อง + เลื่อนหน้าจอ)

---

## Phase 1.5: เสถียรภาพ & Creator Studio (เสร็จสมบูรณ์ / กำลัง polish)
- [X]  [Database] ย้ายฐานข้อมูลมาที่ Supabase (Relational + RLS)
- [X]  [Backend] ระบบอัปโหลดมังงะสำหรับ Translator
- [X]  [Frontend] Studio Dashboard & สถิติ
- [X]  [Backend] ฟอรั่มแบบ Reddit (Thread ซ้อนกัน + โหวต)
- [X]  [Real-time] SSE Redis Pub/Sub Bridge (ซิงค์โหวต/คอมเมนต์)
- [X]  [Frontend] LRU API Cache กับ SWR (500 entries)
- [X]  [Backend] บังคับใช้ HWID Middleware
- [X]  [Backend] Wallet Ledger & แบ่งรายได้ (70/30)
- [X]  [Backend] Creator Earnings API Endpoint
- [X]  **[หนี้ทางเทคนิค]** ลบ GoogleBooksService (เสร็จแล้ว)
- [X]  **[Backend]** Soft Deletion (`deleted_at`) ใน Forum Module
- [X]  **[Frontend]** Spoiler Blur / Click-to-reveal ใน Community

---

## Phase 2: การขยายสถาปัตยกรรม & ความพร้อมด้าน Cloud (กำลังดำเนินการ)
- [X]  **[สถาปัตยกรรม]** เก็บ Metrics หลายมิติ (MetricsService)
- [X]  **[สถาปัตยกรรม]** Leader Election ด้วย Redis NX Lock
- [X]  **[สถาปัตยกรรม]** Write-behind Queue ที่เชื่อถือได้ — RPOPLPUSH+LREM+Lua EVAL
- [X]  **[สถาปัตยกรรม]** Batching อิงตาม Workload & Flush สถิติไป Supabase
- [X]  **[สถาปัตยกรรม]** Pipeline สถิติการดู Chapter — Redis → Supabase รายวัน
- [X]  **[สถาปัตยกรรม]** L2 Recovery เมื่อ reconnect
- [X]  **[สถาปัตยกรรม]** Cache Read Path — อ่าน L1 ก่อน
- [X]  **[สถาปัตยกรรม]** L1 Invalidation ข้าม node ผ่าน Redis pub/sub
- [X]  **[สถาปัตยกรรม]** L2 Recovery ปรับปรุง
- [X]  **[สถาปัตยกรรม]** Catastrophic Recovery — L1+L2 ล่มพร้อมกัน
- [X]  **[Frontend]** ส่ง `?mangaId=` ตอน fetch chapter pages
- [ ]  [Backend] Payment Gateway จริง (QR/PromptPay)
- [ ]  **[Backend]** Revenue Split แบบ Atomic (Postgres Function)
- [ ]  [โครงสร้างพื้นฐาน] Cloudflare R2 Migration & Workers CDN Buffer
- [ ]  [โครงสร้างพื้นฐาน] MIT GPU Cloud Migration (On-Demand)
- [ ]  [ความปลอดภัย] 2FA & Device Session Pinning

---

## Phase 3: Hybrid Mobile Framework (ขั้นตอนถัดไป)
- [ ]  [Mobile] สร้าง React Native WebViewer Shell
- [ ]  [Mobile] ชั้นแชร์โค้ดเชิงกลยุทธ์ (Types/Logic ร่วมกัน)
- [ ]  [Mobile] Native Authentication Bridge (ซิงค์ Device Token)
- [ ]  [Mobile] จัดการ OS Permission หลัก (Storage/Network)

---

## Phase 4: Native OS Power Features (R&D)
- [ ]  [Mobile] Android MediaProjection Native Module (Screen Capture)
- [ ]  [Mobile] WindowManager Overlay System (Floating Bubble)
- [ ]  [Mobile] Native Background Stream Worker (MIT Integration)

---

## Phase 5: Retention & Ecosystem (อนาคต)
- [ ]  [Backend/Frontend] Social Graph Engine (ระบบ Follow)
- [ ]  [Frontend] แชร์คอลเล็กชันการอ่านส่วนตัว
- [ ]  [Backend/Mobile] Push Notification Framework (ระดับ OS)
<!-- lang:end -->
