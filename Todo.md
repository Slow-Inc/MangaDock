# MangaDock Phase 1.5 & Readiness Todo List

รายการงานสำหรับการปรับปรุงระบบ (Optimization) และการวางโครงสร้างเพื่อรองรับ Third-party Services ในอนาคต (R2/Workers) ตามมาตรฐาน **T4-STANDARD**

---

## 🏗️ 1. Infrastructure Readiness (เตรียมความพร้อมโครงสร้าง)

- [x] **[Backend] Storage Adapter Pattern:**
    - [x] สร้าง `StorageProvider` interface สำหรับจัดการไฟล์ (put, get, delete)
    - [x] Implement `DiskStorageProvider` (ใช้งานปัจจุบัน)
    - [x] Refactor `UploadService` และ `BooksService` ให้เรียกใช้ Provider แทน `fs` โดยตรง
    - [x] *เป้าหมาย:* เพื่อให้สลับไปใช้ `R2StorageProvider` ได้ทันทีในอนาคต

- [x] **[Frontend] Centralized Image Resolver:**
    - [x] รวม Logic การสร้าง Image URL ไว้ที่เดียวใน `lib/imgUrl.ts`
    - [x] รองรับการสลับ Source ระหว่าง Backend Proxy และ Cloudflare Worker URL ผ่าน Config
    - [x] *เป้าหมาย:* เปลี่ยนทิศทางรูปทั้งเว็บได้จากการแก้จุดเดียว

- [x] **[Security] Fingerprinting Stub:**
    - [x] [Frontend] เตรียมฟังก์ชันสร้าง Hardware ID และส่งแนบใน Header `x-hardware-id`
    - [x] [Backend] เตรียม Middleware สำหรับรับและ Log ค่า Hardware ID
    - [x] *เป้าหมาย:* วางรากฐานสำหรับระบบ Zero-Trust ใน Phase 2

---

## 🛠️ 2. Tech Debt & Optimization (ลดหนี้ทางเทคนิค)

- [x] **[Backend] Structured Logging (T4 Pillar 6):**
    - [x] สร้าง `LoggingInterceptor` เพื่อแปลง Log ทุก Request/Response เป็น JSON Format
    - [x] ปรับปรุงการ Log ในการติดต่อข้าม Service (MIT, Supabase) ให้มี Context ครบถ้วน
    - [x] *เป้าหมาย:* พร้อมสำหรับการวิเคราะห์ Log ระดับสูง (Observability)

- [x] **[Backend] Environment Validation:**
    - [x] ใช้ `class-validator` ตรวจสอบความถูกต้องของ `.env` ตั้งแต่เริ่มรันระบบ (Startup)
    - [x] *เป้าหมาย:* ป้องกันระบบพังระหว่างรันจากค่า Config ที่ผิดพลาด

- [x] **[Unified] Shared Type Safety:**
    - [x] จัดระเบียบ Type Interfaces ระหว่าง Frontend และ Backend ให้ซิงค์กัน (เช่น `MangaDetail`, `ChapterPage`)
    - [x] *เป้าหมาย:* ลด Runtime Error จากข้อมูลที่ไม่ตรงกัน

---

## ✅ 3. Completed (เสร็จสิ้นแล้ว)

- [x] **[Backend] Graceful Shutdown (T4 Pillar 3):** เปิดใช้งาน Shutdown Hooks และระบบ Retry Sync Cache
- [x] **[Backend] Async MIT Pipeline (T4 Pillar 2):** เปลี่ยนการคุยกับ AI เป็น Webhook Callback (Non-blocking)
- [x] **[Backend] Global Exception Filter:** ดักจับและแจ้งเตือน Supabase Connection Error
- [x] **[Frontend] Supabase Connection Guard:** แสดง Popup เมื่อฐานข้อมูลเข้าถึงไม่ได้ (Paused Project)
- [x] **[MIT Server] Webhook Support:** รองรับการส่งผลลัพธ์กลับแบบ Asynchronous
