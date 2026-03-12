# MIT Service Overview and Integration

เอกสารฉบับนี้สรุปบทบาทของ Manga Image Translator (MIT) ภายในระบบ MangaDock และใช้อ้างอิงร่วมกับ [MIT README](../../MIT/README.md) ซึ่งเป็นเอกสารหลักของ service

## 1. Service Overview

MIT เป็น HTTP microservice สำหรับประมวลผลภาพและแปลหน้ามังงะ โดยทำหน้าที่รับรูปภาพจาก client หรือ backend แล้วส่งผ่าน translation pipeline ที่ประกอบด้วย detection, OCR, translation, inpainting และ rendering ก่อนคืนผลลัพธ์กลับมาในรูปแบบ JSON, binary, image หรือ patch data

สำหรับรายละเอียดเต็มของสถาปัตยกรรม, endpoint และคำสั่งรันระบบ ให้ใช้อ้างอิงจาก [MIT README](../../MIT/README.md)

## 2. Role of MIT in MangaDock

ภายในระบบ MangaDock บริการ MIT ไม่ได้เป็นส่วนหนึ่งของ NestJS backend โดยตรง แต่ทำงานในลักษณะ service แยกที่ backend เรียกใช้งานผ่าน HTTP ทำให้สามารถ deploy แยกเครื่อง แยก environment หรือแยกภาระงานประมวลผลออกจากระบบหลักได้

ประโยชน์ของการแยก service มีดังนี้

1. ลดภาระของ backend หลักที่ต้องรองรับงานประมวลผลภาพหนัก
2. เปิดโอกาสให้ MIT รันบนเครื่องที่มี GPU โดยเฉพาะ
3. ทำให้ระบบ MangaDock เปลี่ยนปลายทางของ translation service ได้ผ่าน config
4. ง่ายต่อการแยก deploy, maintenance และ scaling ในอนาคต

## 3. High-Level Integration Flow

```text
Frontend
  -> Backend API (NestJS)
  -> Translation endpoint in Books module
  -> MIT service (HTTP on port 5003)
  -> Response returned to Backend
  -> Backend forwards result to Frontend
```

ลักษณะการเชื่อมต่อดังกล่าวทำให้ frontend ไม่จำเป็นต้องรู้รายละเอียดภายในของ translation pipeline โดยตรง และสามารถใช้ backend เป็น orchestration layer ได้อย่างเป็นระบบ

## 4. Core Responsibilities of MIT

MIT รับผิดชอบงานหลักดังนี้

1. รับคำขอแปลภาพเดี่ยวหรือหลายภาพ
2. ประมวลผล OCR และ translation ตาม config ที่ระบุ
3. ส่งกลับรูปแปลแล้วหรือ patch overlay สำหรับ client-side composition
4. จัดการ worker process สำหรับงานประมวลผลหนัก
5. ให้ health endpoint สำหรับตรวจสอบความพร้อมของ service

หัวข้อ endpoint และ request format แบบเต็มอธิบายไว้แล้วใน [MIT README](../../MIT/README.md)

## 5. Runtime and Deployment Notes

MIT ถูกออกแบบให้รันได้หลายรูปแบบ เช่น local Windows launcher, direct Python execution, Docker และ docker-compose โดยมีการกำหนดค่าผ่าน `.env` และ environment variables ที่เกี่ยวข้องกับ translator และ runtime configuration

ในบริบทของ MangaDock แนวทางใช้งานที่แนะนำคือ

1. ให้ backend ชี้ไปยัง MIT ผ่าน `MANGA_TRANSLATOR_URL`
2. ให้ MIT รันบนเครื่องเดียวกันในช่วงพัฒนา หรือแยกเครื่องเมื่อมีภาระประมวลผลสูง
3. ใช้ health endpoint เพื่อตรวจสอบ readiness ก่อนส่งงานแปลจริง

รายละเอียดคำสั่งรันและ environment variables อ้างอิงได้จาก [MIT README](../../MIT/README.md)

## 6. Operational Considerations

ประเด็นที่ควรคำนึงถึงเมื่อใช้งาน MIT ในสภาพแวดล้อมจริง ได้แก่

1. เวลาเริ่มต้นอาจช้าเพราะ model ต้องโหลดเข้าหน่วยความจำ
2. ความพร้อมของ GPU, CUDA และ driver มีผลต่อประสิทธิภาพโดยตรง
3. external translator providers เช่น Gemini หรือ OpenAI มีผลต่อ latency และค่าใช้จ่าย
4. log และ result files ควรถูกเก็บแยกจาก source code และไม่ควรนำขึ้น Git
5. `.env` ต้องเก็บเป็นความลับและควรใช้ `.env.example` เป็น template สำหรับการแชร์ config structure

## 7. Relationship with Other Documents

- [MIT README](../../MIT/README.md): เอกสารหลักของ service
- [MIT_DOC_INDEX.md](MIT_DOC_INDEX.md): สารบัญของเอกสารในโฟลเดอร์นี้
- [../Frontend/FRONTEND_DOC_INDEX.md](../Frontend/FRONTEND_DOC_INDEX.md): เอกสารสรุปฝั่ง frontend ที่รับผลลัพธ์ผ่าน backend
- [../Backend/BACKEND_DOC_INDEX.md](../Backend/BACKEND_DOC_INDEX.md): เอกสารสรุปฝั่ง backend ที่เรียก MIT ผ่าน HTTP
- [../Software Engineer/SE_PHASE2_SRS_AND_SYSTEM_ANALYSIS.md](../Software%20Engineer/SE_PHASE2_SRS_AND_SYSTEM_ANALYSIS.md): เอกสารวิเคราะห์ระบบที่กล่าวถึง integration ของ MIT กับ MangaDock
- [../Software Engineer/SE_PHASE6_DEPLOYMENT_AND_GO_LIVE.md](../Software%20Engineer/SE_PHASE6_DEPLOYMENT_AND_GO_LIVE.md): เอกสาร deployment และ go-live ที่ควรอ้างอิงร่วมกัน

## 8. Summary

MIT เป็นบริการเฉพาะทางที่ทำหน้าที่สำคัญในระบบ MangaDock โดยเฉพาะในส่วนการแปลภาพมังงะ เอกสารฉบับนี้จึงทำหน้าที่เป็นสะพานเชื่อมระหว่าง README หลักของ service กับเอกสารเชิงโครงการ เพื่อให้ผู้อ่านเข้าใจทั้งมุมมองเชิงเทคนิคและมุมมองเชิงสถาปัตยกรรมของระบบร่วมกัน