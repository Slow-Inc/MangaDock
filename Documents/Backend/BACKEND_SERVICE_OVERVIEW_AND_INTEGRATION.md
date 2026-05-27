# Backend Service Overview and Integration

เอกสารฉบับนี้สรุปบทบาทของ Backend ในระบบ MangaDock และใช้อ้างอิงร่วมกับ [Backend README](../../Backend/README.md) ซึ่งเป็นเอกสารหลักของฝั่ง NestJS backend

## 1. Backend Overview

Backend ของ MangaDock เป็น NestJS application ที่ทำหน้าที่เป็นศูนย์กลางของ application logic โดยรับคำขอจาก frontend, ติดต่อ external services, จัดการข้อมูลผู้ใช้ และ orchestrate งานแปลภาพผ่าน MIT microservice

Backend เป็นชั้นที่รวม business logic ของระบบไว้มากที่สุด เพื่อให้ frontend โฟกัสที่ประสบการณ์ผู้ใช้ และให้ MIT โฟกัสเฉพาะงานประมวลผลภาพและ translation pipeline

### 1.2 Tech Stack
*   **Framework:** NestJS 11+
*   **Database:** Supabase (PostgreSQL) + Row Level Security (RLS)
*   **Cache:** 2-Layer Cache (Memory + Redis) พร้อมระบบ Graceful Shutdown Sync (T4 Pillar 3)
*   **Integration:** Asynchronous Webhook Flow สำหรับ MIT Server (T4 Pillar 2)

## 2. Main Responsibilities

Backend รับผิดชอบงานหลักดังนี้

1. ให้บริการ API หลักของระบบ MangaDock
2. รวมข้อมูลหนังสือและมังงะจาก external sources
3. จัดการผู้ใช้ รายการโปรด likes และข้อมูลที่เกี่ยวข้องผ่าน Supabase
4. ใช้ 2-Layer Cache เพื่อลดต้นทุนของคำขอที่แพงและงานที่เรียกซ้ำบ่อย
5. ตรวจสอบและจัดการสถานะการเชื่อมต่อฐานข้อมูล (Global Exception Filter)
6. เรียก MIT microservice แบบ Asynchronous เพื่อประมวลผลและแปลภาพมังงะ

## 3. High-Level Architecture

```text
Frontend (Next.js)
  -> Backend API (NestJS)
      -> 2-Layer Cache (L1: Memory, L2: Redis)
      -> Supabase Service Role integration
      -> External content providers
      -> MIT microservice (Async Webhook)
```

แนวทางนี้ทำให้ backend เป็น orchestration layer ที่ควบคุม flow หลักของระบบ และแยกงานประมวลผลภาพหนักออกไปยัง MIT ได้อย่างชัดเจน

## 4. Important Backend Modules

โมดูลหลักที่ใช้งานใน backend ได้แก่

1. `books/` สำหรับข้อมูลหนังสือ มังงะ และ translation orchestration
2. `users/` สำหรับ user-facing APIs และข้อมูลผู้ใช้ รวมถึง avatar upload
3. `cache/` สำหรับ 2-tier cache abstractions และ sync logic
4. `supabase/` สำหรับ Supabase integration (PostgreSQL + RLS)
5. `status/` สำหรับ health และ status endpoints; `MetricsService` เก็บ node heartbeat (CPU/mem/latency → `cluster_metrics:{nodeId}`); `ElectionService` ทำ Redis NX Lock leader election (`SET cache:leader NX/XX PX`) เพื่อกำหนด Leader Node สำหรับ write-behind queue
6. `forum/` สำหรับ community forum — posts, nested comments, voting, image upload
7. `wallet/` สำหรับ wallet balance และ ledger
8. `unlock/` สำหรับ unlock economy (idempotent unlock flow)
9. `upload/` (StorageModule `@Global`) สำหรับ file storage abstraction ผ่าน `STORAGE_PROVIDER` token
10. `versions/` สำหรับ chapter versions (multi-translator support)

README หลักของ backend อธิบายโครงสร้างโฟลเดอร์และวิธีรันระบบเพิ่มเติมไว้แล้วที่ [Backend README](../../Backend/README.md)

## 5. MIT Integration Role (Asynchronous)

MIT ถูกใช้งานในฐานะ service แยกที่ backend เรียกผ่าน `MANGA_TRANSLATOR_URL` โดยเปลี่ยนจากการเรียกแบบ Synchronous เป็น **Async Fire-and-forget**:

1. Backend ส่งงานไปยัง MIT พร้อมแนบ `taskId` และ `callback_url`
2. MIT รับงานและตอบกลับ 202 Accepted ทันที (Non-blocking)
3. MIT ประมวลผลแต่ละหน้าเสร็จแล้วยิง Webhook กลับมาที่ `/webhooks/mit/callback`
4. Backend (MitWebhookController) ตรวจสอบ HMAC Signature และอัปเดตสเตตัสงาน

รายละเอียดของ service นี้ดูต่อได้จาก [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md) และ [MIT README](../../MIT/README.md)

## 6. Runtime and Environment Notes

ค่าที่สำคัญในการรัน backend ได้แก่

1. `MANGA_TRANSLATOR_URL`: ชี้ไปยัง MIT instance
2. `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY`: สำหรับต่อฐานข้อมูล
3. `MIT_WEBHOOK_SECRET`: สำหรับตรวจสอบความปลอดภัยของ Webhook (HMAC)
4. `BACKEND_PUBLIC_ORIGIN`: สำหรับสร้าง callback URL ให้ MIT

backend ควรถูกรันหลังจาก MIT พร้อมใช้งานแล้ว หาก flow ที่กำลังทดสอบต้องพึ่งงานแปลภาพ

## 7. Relationship with Other Documents

- [Backend README](../../Backend/README.md): เอกสารหลักของฝั่ง backend
- [BACKEND_DOC_INDEX.md](BACKEND_DOC_INDEX.md): สารบัญของเอกสารในโฟลเดอร์นี้
- [../Frontend/FRONTEND_DOC_INDEX.md](../Frontend/FRONTEND_DOC_INDEX.md): เอกสารสรุปฝั่ง frontend ที่เรียกใช้งาน backend
- [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md): เอกสารสรุปฝั่ง MIT ที่ backend ใช้งานผ่าน HTTP

## 8. Summary

Backend ของ MangaDock เป็นชั้นกลางที่รวม API, business logic, integration และ orchestration ของระบบทั้งหมด เอกสารนี้ช่วยอธิบายภาพรวมการทำงานและความสัมพันธ์กับ frontend และ MIT โดยไม่แทนที่รายละเอียดเชิงปฏิบัติการที่อยู่ใน [Backend README](../../Backend/README.md)
