# Phase 6: Deployment Plan, Go Live Preparation, and Manuals

เอกสารฉบับนี้รวบรวมการเตรียมความพร้อมก่อนนำระบบ MetaBooks ไปใช้งานจริงหรือสาธิตในสภาพแวดล้อมที่ใกล้เคียงการใช้งานจริง โดยครอบคลุมแผนการติดตั้ง การเตรียม hardware และ software คู่มือ installation คู่มือใช้งาน และคู่มือประจำระบบ

## 1. Deployment Objectives

1. เตรียมระบบให้พร้อมใช้งานในสภาพแวดล้อมจริงหรือสภาพแวดล้อมสาธิต
2. ลดความเสี่ยงระหว่างการติดตั้งและการเปิดใช้งานระบบ
3. จัดทำคู่มือสำหรับผู้ใช้และผู้ดูแลระบบอย่างครบถ้วน

## 2. Hardware and Software Preparation

### Hardware

- เครื่องสำหรับรัน Frontend และ Backend
- เครื่องหรือ environment สำหรับรัน MIT (Manga Image Translator microservice)
- พื้นที่เก็บข้อมูลสำหรับ cache และ uploads
- กรณีใช้งาน translation pipeline หนัก อาจต้องใช้ GPU

### Software

- Node.js and npm for frontend and backend
- Python environment for MIT service
- Redis สำหรับ cache
- Firebase project configuration
- Environment variables สำหรับ service ภายนอก

## 3. Go Live Checklist

1. ตรวจสอบ environment variables ครบถ้วน
2. ตรวจสอบ backend เชื่อมต่อ Redis, Firebase และ external APIs ได้
3. ตรวจสอบ MIT service พร้อมใช้งานที่ endpoint health
4. ตรวจสอบ frontend เรียก backend ได้ถูกต้อง
5. ตรวจสอบ flow สำคัญหลัง deploy เช่น login, search, open detail และ translate page
6. สำรองไฟล์ config สำคัญก่อนเปิดใช้งานจริง

ค่ารันระบบที่ควรตรวจสอบขั้นต่ำในสภาพแวดล้อมพัฒนา ได้แก่

1. Frontend ทำงานที่ `http://localhost:4000`
2. Backend ทำงานที่ `http://localhost:4001` หรือค่าที่ตั้งไว้จริงใน environment
3. MIT ทำงานที่ `http://localhost:5003`

## 4. Installation Guide Summary

### Frontend and Backend

1. ติดตั้ง dependencies
2. ตั้งค่า `.env`
3. รัน backend service
4. รัน frontend service

เอกสารอ้างอิงที่ควรใช้ร่วมกันคือ

1. [../Frontend/FRONTEND_DOC_INDEX.md](../Frontend/FRONTEND_DOC_INDEX.md)
2. [../Backend/BACKEND_DOC_INDEX.md](../Backend/BACKEND_DOC_INDEX.md)
3. [../../Frontend/README.md](../../Frontend/README.md)
4. [../../Backend/README.md](../../Backend/README.md)

### MIT Service

1. สร้างไฟล์ `.env` จาก `.env.example`
2. ติดตั้ง Python dependencies
3. เตรียม model และ environment ที่จำเป็น
4. รัน service และตรวจสอบ `/health`

เอกสารอ้างอิงที่ควรใช้ร่วมกันคือ

1. [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md)
2. [../../MIT/README.md](../../MIT/README.md)

## 5. User Manual Summary

คู่มือผู้ใช้ควรครอบคลุมหัวข้อสำคัญดังนี้

1. วิธีสมัครสมาชิกและเข้าสู่ระบบ
2. วิธีค้นหาหนังสือหรือมังงะ
3. วิธีเปิดดูรายละเอียดและอ่านมังงะ
4. วิธีแปลหน้ามังงะ
5. วิธีจัดการ favorites, liked items และประวัติการอ่าน
6. วิธีแก้ไขข้อมูลบัญชีผู้ใช้

## 6. System Operation Manual Summary

คู่มือประจำระบบสำหรับผู้ดูแลควรครอบคลุมหัวข้อดังนี้

1. วิธี start or stop services
2. วิธีตรวจสอบ log และ health status
3. วิธีจัดการ cache และผลลัพธ์แปลภาพ
4. วิธีเปลี่ยนค่า config และ environment variables
5. วิธีตรวจสอบปัญหาเบื้องต้นเมื่อ external service ล้มเหลว

ในโครงการปัจจุบัน คู่มือปฏิบัติการสามารถเริ่มอ่านจาก README และ documentation index ของแต่ละส่วนได้โดยตรง เพื่อหลีกเลี่ยงความซ้ำซ้อนและลดโอกาสที่คู่มือหลายชุดจะไม่ตรงกัน

## 7. Summary

Phase 6 เป็นการเชื่อมงานจากการพัฒนาและทดสอบไปสู่การใช้งานจริงอย่างเป็นระบบ เอกสารใน phase นี้ช่วยให้การติดตั้ง การสาธิต และการส่งมอบระบบเป็นไปอย่างราบรื่นมากขึ้น พร้อมลดความเสี่ยงจากความผิดพลาดเชิงปฏิบัติการ