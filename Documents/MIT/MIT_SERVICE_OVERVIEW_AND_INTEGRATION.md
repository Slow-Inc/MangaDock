# MIT Service Overview and Integration

เอกสารฉบับนี้สรุปบทบาทของ Manga Image Translator (MIT) ภายในระบบ MangaDock และใช้อ้างอิงร่วมกับ [MIT README](../../MIT/README.md) ซึ่งเป็นเอกสารหลักของ service

## 1. Service Overview

MIT เป็น microservice ที่พัฒนาด้วย Python (FastAPI) ทำหน้าที่เฉพาะทางในการประมวลผลและแปลภาษาจากภาพมังงะ โดยใช้เทคโนโลยี Computer Vision และ AI (ML Models)

ในระบบ MangaDock, MIT ถูกเรียกใช้งานโดย Backend (NestJS) เพื่อทำหน้าที่เป็นเครื่องมือหลักในส่วน Image Translation Pipeline

## 2. Main Responsibilities

MIT รับผิดชอบขั้นตอนใน pipeline ดังนี้

1. **Text Detection:** ตรวจสอบตำแหน่งของข้อความในภาพ
2. **OCR (Optical Character Recognition):** อ่านข้อความภาษาญี่ปุ่น/ต้นฉบับจากตำแหน่งที่พบ
3. **Translation:** แปลข้อความที่อ่านได้เป็นภาษาไทย (ผ่าน Gemini API หรือผู้ให้บริการอื่น)
4. **Inpainting:** ลบข้อความต้นฉบับออกจากภาพและวาดพื้นหลังทดแทน
5. **Rendering:** เขียนข้อความที่แปลแล้วลงบนภาพในตำแหน่งที่เหมาะสม
6. **Patch Generation:** สร้างภาพเฉพาะส่วน (Patches) เพื่อส่งกลับให้ Backend

## 3. High-Level Architecture

```text
Backend (NestJS)
  -> MIT Service (Python/FastAPI)
      -> ML Models (Local or GPU Cloud)
      -> Translation Provider (Gemini API)
```

## 4. Integration with Backend (Asynchronous Flow)

MIT ใน Phase 1.5 รองรับการทำงานแบบ **Asynchronous Webhook Callback** (T4-STANDARD):

1. **Request:** รับ HTTP POST ที่ `/translate/with-form/patches/batch` พร้อมรูปภาพและ `callback_url`
2. **Response:** ตอบกลับ `202 Accepted` ทันทีเพื่อไม่ให้ Connection ค้าง
3. **Processing:** รัน Pipeline ใน Background Task
4. **Callback:** เมื่อเสร็จสิ้นแต่ละหน้า จะยิง POST กลับไปที่ `callback_url` ของ Backend พร้อม `taskId` และ HMAC Signature

## 5. Technology Stack

*   **Language:** Python 3.12+
*   **Web Framework:** FastAPI / Uvicorn
*   **AI/ML:** PyTorch, manga-ocr, lama-inpainter
*   **Translation:** Gemini API (Google Generative AI)
*   **Communication:** httpx (สำหรับส่ง Webhook)

## 6. Runtime and Deployment

Service นี้ต้องการการประมวลผลที่สูง โดยเฉพาะการใช้ GPU สำหรับรันโมเดล ML สามารถรันได้ทั้งแบบ Local และบน Cloud GPU เช่น RunPods

README หลักของ MIT อธิบายขั้นตอนการติดตั้งและโมเดลที่จำเป็นไว้ที่ [MIT README](../../MIT/README.md)

## 7. Relationship with Other Documents

- [MIT README](../../MIT/README.md): เอกสารหลักของ service
- [MIT_DOC_INDEX.md](MIT_DOC_INDEX.md): สารบัญของเอกสารในโฟลเดอร์นี้
- [../Backend/BACKEND_DOC_INDEX.md](../Backend/BACKEND_DOC_INDEX.md): เอกสารสรุปฝั่ง backend ที่เรียกใช้งาน MIT

## 8. Summary

MIT เป็นบริการเฉพาะทางที่ทำหน้าที่สำคัญในระบบ MangaDock โดยเฉพาะในส่วนการแปลภาพมังงะ เอกสารฉบับนี้จึงทำหน้าที่เป็นสะพานเชื่อมระหว่าง README หลักของ service กับเอกสารเชิงโครงการ เพื่อให้ผู้อ่านเข้าใจทั้งมุมมองเชิงเทคนิคและมุมมองเชิงสถาปัตยกรรมของระบบร่วมกัน
