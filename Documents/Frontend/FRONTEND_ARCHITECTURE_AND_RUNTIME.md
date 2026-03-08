# Frontend Architecture and Runtime

เอกสารฉบับนี้สรุปบทบาทของ Frontend ในระบบ MetaBooks และใช้อ้างอิงร่วมกับ [Frontend README](../../Frontend/README.md) ซึ่งเป็นเอกสารหลักสำหรับการติดตั้งและรันระบบ

## 1. Frontend Overview

Frontend ของ MetaBooks เป็น Next.js application ที่ทำหน้าที่เป็น user-facing interface สำหรับการค้นหา ดูรายละเอียด และจัดการรายการหนังสือหรือมังงะ รวมถึงประสบการณ์ผู้ใช้ด้านบัญชี การอ่านต่อ และการเรียกใช้งานฟีเจอร์แปลภาพจาก backend

ฝั่งนี้เป็นชั้น presentation และ interaction ของระบบ โดยรับผิดชอบทั้ง server-rendered pages, client-side interactions, UI state และ route handlers ที่ใช้เป็น proxy บางจุดในการคุยกับ backend

## 2. Main Responsibilities

Frontend รับผิดชอบงานหลักดังนี้

1. แสดงหน้า landing, search, categories, my list, account และหน้า detail ต่าง ๆ
2. จัดการประสบการณ์ผู้ใช้ทั้ง desktop และ mobile
3. เชื่อมต่อ Firebase client-side สำหรับ authentication-related flows
4. เรียก backend API เพื่อดึงข้อมูลหนังสือ มังงะ รายการโปรด และผลลัพธ์การแปล
5. จัดการ local UI utilities เช่น toast, auth context, dev toggles และ caching helpers

## 3. High-Level Architecture

```text
User Browser
  -> Frontend (Next.js on port 4000)
  -> Backend API (NestJS on port 4001)
  -> MIT microservice when backend triggers manga translation
```

Frontend ไม่เรียก MIT โดยตรงใน flow หลักของระบบ แต่ใช้ backend เป็นตัวกลางเพื่อรวม business logic, caching และ orchestration ไว้ที่ฝั่ง server

## 4. Important Frontend Areas

โครงสร้างหลักของ frontend ประกอบด้วย

1. `app/page.tsx` สำหรับหน้า landing และการดึงข้อมูลเริ่มต้น
2. `app/components/` สำหรับ UI components เช่น navbar, rows, modal และ carousel
3. `app/contexts/` สำหรับ shared state เช่น auth และ toast
4. `app/api/` สำหรับ route handlers ที่ทำ proxy หรือช่วยงานฝั่ง server
5. `app/lib/` สำหรับ utility integrations เช่น Firebase setup
6. `app/hooks/` สำหรับ reusable client-side behavior

## 5. Runtime Configuration

ค่าที่สำคัญในการรัน frontend ได้แก่

1. `NEXT_PUBLIC_API_BASE_URL` สำหรับชี้ไปยัง backend API
2. `INTERNAL_API_URL` สำหรับ server-side requests ภายใน Next.js
3. Firebase public config เช่น `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` และค่าที่เกี่ยวข้อง
4. optional dev flags เช่น `NEXT_PUBLIC_IMAGE_CACHE_DEV_TOOLS` และ `NEXT_PUBLIC_AUTH_DEBUG`

โครงสร้างตัวอย่างของ environment สามารถอ้างอิงจาก `.env.example` ในโฟลเดอร์ frontend และรายละเอียดการรันดูได้ที่ [Frontend README](../../Frontend/README.md)

## 6. Integration Notes

Frontend เชื่อมต่อกับระบบอื่นในโปรเจ็กต์ดังนี้

1. เชื่อมต่อ backend สำหรับข้อมูลหนังสือ มังงะ ผู้ใช้ และ translation workflows
2. เชื่อมต่อ Firebase client SDK สำหรับ authentication context และ account linking flows
3. แสดงผลลัพธ์จาก translation pipeline ที่ backend และ MIT ช่วยประมวลผลมาให้

แนวทางนี้ทำให้ frontend คงบทบาทเป็น presentation layer และไม่แบกรับ logic เชิงระบบที่ควรอยู่ใน backend

## 7. Relationship with Other Documents

- [Frontend README](../../Frontend/README.md): เอกสารหลักของฝั่ง frontend
- [FRONTEND_DOC_INDEX.md](FRONTEND_DOC_INDEX.md): สารบัญของเอกสารในโฟลเดอร์นี้
- [../Backend/BACKEND_DOC_INDEX.md](../Backend/BACKEND_DOC_INDEX.md): เอกสารสรุปฝั่ง backend ที่ frontend พึ่งพา
- [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md): เอกสารสรุปฝั่ง MIT microservice ที่ backend ใช้เป็นตัวแปลภาพ

## 8. Summary

Frontend ของ MetaBooks เป็นชั้นที่ผู้ใช้โต้ตอบโดยตรงและทำหน้าที่เชื่อมประสบการณ์ใช้งานเข้ากับ backend และบริการประกอบอื่น ๆ เอกสารนี้จึงช่วยสรุปบทบาทเชิงสถาปัตยกรรมของ frontend โดยไม่แทนที่รายละเอียดการติดตั้งและรันที่อยู่ใน [Frontend README](../../Frontend/README.md)