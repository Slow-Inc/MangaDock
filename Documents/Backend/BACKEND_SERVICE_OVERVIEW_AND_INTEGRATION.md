# Backend Service Overview and Integration

เอกสารฉบับนี้สรุปบทบาทของ Backend ในระบบ MetaBooks และใช้อ้างอิงร่วมกับ [Backend README](../../Backend/README.md) ซึ่งเป็นเอกสารหลักของฝั่ง NestJS backend

## 1. Backend Overview

Backend ของ MetaBooks เป็น NestJS application ที่ทำหน้าที่เป็นศูนย์กลางของ application logic โดยรับคำขอจาก frontend, ติดต่อ external services, จัดการข้อมูลผู้ใช้ และ orchestrate งานแปลภาพผ่าน MIT microservice

Backend เป็นชั้นที่รวม business logic ของระบบไว้มากที่สุด เพื่อให้ frontend โฟกัสที่ประสบการณ์ผู้ใช้ และให้ MIT โฟกัสเฉพาะงานประมวลผลภาพและ translation pipeline

## 2. Main Responsibilities

Backend รับผิดชอบงานหลักดังนี้

1. ให้บริการ API หลักของระบบ MetaBooks
2. รวมข้อมูลหนังสือและมังงะจาก external sources
3. จัดการผู้ใช้ รายการโปรด likes และข้อมูลที่เกี่ยวข้อง
4. ใช้ cache เพื่อลดต้นทุนของคำขอที่แพงและงานที่เรียกซ้ำบ่อย
5. เชื่อมต่อ Firebase Admin สำหรับงานฝั่ง server
6. เรียก MIT microservice เพื่อประมวลผลและแปลภาพมังงะ

## 3. High-Level Architecture

```text
Frontend (Next.js)
  -> Backend API (NestJS)
      -> Cache layer
      -> Firebase Admin integration
      -> External content providers
      -> MIT microservice (HTTP)
```

แนวทางนี้ทำให้ backend เป็น orchestration layer ที่ควบคุม flow หลักของระบบ และแยกงานประมวลผลภาพหนักออกไปยัง MIT ได้อย่างชัดเจน

## 4. Important Backend Modules

โมดูลหลักที่ใช้งานใน backend ได้แก่

1. `books/` สำหรับข้อมูลหนังสือ มังงะ และ translation orchestration
2. `users/` สำหรับ user-facing APIs และข้อมูลผู้ใช้
3. `cache/` สำหรับ cache abstractions และ helper logic
4. `firebase/` สำหรับ Firebase Admin integration
5. `status/` สำหรับ health และ status endpoints

README หลักของ backend อธิบายโครงสร้างโฟลเดอร์และวิธีรันระบบเพิ่มเติมไว้แล้วที่ [Backend README](../../Backend/README.md)

## 5. MIT Integration Role

MIT ถูกใช้งานในฐานะ service แยกที่ backend เรียกผ่าน `MANGA_TRANSLATOR_URL` ทำให้ backend สามารถเลือกได้ว่าจะใช้ MIT ที่ bundled มากับ repository หรือจะชี้ไปยัง deployment ภายนอกที่รันอยู่คนละเครื่องก็ได้

ข้อดีของแนวทางนี้คือ

1. backend ไม่ต้องบรรจุ image translation pipeline ไว้ใน process เดียวกัน
2. สามารถแยก deploy และ scale งานแปลภาพได้อิสระ
3. ทำให้ frontend ไม่ต้องรู้รายละเอียด implementation ของ translation service

รายละเอียดของ service นี้ดูต่อได้จาก [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md) และ [MIT README](../../MIT/README.md)

## 6. Runtime and Environment Notes

ค่าที่สำคัญในการรัน backend ได้แก่

1. `MANGA_TRANSLATOR_URL` สำหรับชี้ไปยัง MIT instance
2. Firebase Admin credentials เช่น `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
3. cache-related configuration ตาม environment ที่ใช้จริง

ในการ setup เครื่องพัฒนา ทีมสามารถนำไฟล์ Firebase service account JSON มาวางไว้ในโฟลเดอร์ `Backend/` เพื่อใช้อ้างอิงค่าที่ต้องใส่ใน `.env` ได้ แต่โค้ด backend ปัจจุบันจะอ่าน credential จาก environment variables เท่านั้น ไม่ได้โหลดไฟล์ JSON โดยตรงตอน runtime

backend ควรถูกรันหลังจาก MIT พร้อมใช้งานแล้ว หาก flow ที่กำลังทดสอบต้องพึ่งงานแปลภาพ

## 7. Relationship with Other Documents

- [Backend README](../../Backend/README.md): เอกสารหลักของฝั่ง backend
- [BACKEND_DOC_INDEX.md](BACKEND_DOC_INDEX.md): สารบัญของเอกสารในโฟลเดอร์นี้
- [../Frontend/FRONTEND_DOC_INDEX.md](../Frontend/FRONTEND_DOC_INDEX.md): เอกสารสรุปฝั่ง frontend ที่เรียกใช้งาน backend
- [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md): เอกสารสรุปฝั่ง MIT ที่ backend ใช้งานผ่าน HTTP

## 8. Summary

Backend ของ MetaBooks เป็นชั้นกลางที่รวม API, business logic, integration และ orchestration ของระบบทั้งหมด เอกสารนี้ช่วยอธิบายภาพรวมการทำงานและความสัมพันธ์กับ frontend และ MIT โดยไม่แทนที่รายละเอียดเชิงปฏิบัติการที่อยู่ใน [Backend README](../../Backend/README.md)