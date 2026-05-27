# Phase 7: Quality Assessment and Process Evidence

เอกสารฉบับนี้จัดทำขึ้นเพื่อรองรับการประเมินคุณภาพซอฟต์แวร์จากผู้ใช้ และใช้เป็นหลักฐานประกอบด้านกระบวนการพัฒนา เช่น การประเมินตามแนวคิด CMMI หรือ OWASP ตามที่เหมาะสมกับขอบเขตของรายงาน

## 1. User Questionnaire Objective

แบบสอบถามใช้สำหรับประเมินคุณภาพของระบบในมุมมองผู้ใช้จริง โดยเน้นด้านความง่ายในการใช้งาน ความถูกต้อง ความพึงพอใจ และความเหมาะสมของการแสดงผลทั้งบน desktop และ mobile ครอบคลุมประสบการณ์ที่เกิดจากการทำงานร่วมกันของ Frontend (Next.js), Backend (NestJS) และ MIT (Manga Image Translator microservice) ในส่วนที่เกี่ยวข้องกับการแปลภาพ

## 2. Example Questionnaire Topics

1. ความง่ายในการใช้งานของระบบ
2. ความเร็วในการตอบสนองของระบบ
3. ความถูกต้องของข้อมูลที่แสดง
4. ความพึงพอใจต่อการอ่านมังงะและการแปลภาพ
5. ความเหมาะสมของหน้าจอและการนำทาง

## 3. Example Evaluation Table

| Evaluation Item | Score Range |
|---|---|
| Ease of Use | 1-5 |
| Accuracy of Information | 1-5 |
| System Responsiveness | 1-5 |
| Design and Interface | 1-5 |
| Overall Satisfaction | 1-5 |

## 4. Process Evidence Alternatives

หากรายงานต้องการเน้นมาตรฐานกระบวนการมากกว่าผลประเมินผู้ใช้ สามารถใช้เอกสารประกอบในรูปแบบต่อไปนี้แทนหรือใช้ร่วมกันได้

### 4.1 CMMI-Oriented Evidence

- การวางแผนงานอย่างเป็นลำดับ phase
- การควบคุม version และ traceability ของงาน
- การจัดทำเอกสาร requirement, design, test และ deployment
- การบันทึก defect และการแก้ไขอย่างเป็นระบบ
### 4.2 OWASP-Oriented Evidence

- การตรวจสอบ input validation
- การป้องกันการเปิดเผยข้อมูลสำคัญใน client
- การจัดเก็บ secret ผ่าน environment files
- การควบคุม access ของ API และ service ภายใน
- การจัดทำ checklist ความเสี่ยงเบื้องต้นด้าน security

### 4.3 Defect Recording & Resolution Log (Process Quality Evidence)

เพื่อให้สอดคล้องกับแนวคิด CMMI ด้านการบันทึกและแก้ไขข้อผิดพลาดอย่างเป็นระบบ โปรเจกต์ได้มีการจัดทำบันทึกรายการ Defect ที่สำคัญและการแก้ไข ดังตัวอย่างกรณีศึกษาด้านล่าง:

| Defect ID | Description | Root Cause | Resolution | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **DF-001** | ไม่สามารถบันทึกตำแหน่งแบนเนอร์ (Banner Position) ในหน้า Profile ได้ (Error 400) | **Type Mismatch:** Backend ใช้ `@IsInt()` บังคับเลขจำนวนเต็ม แต่ Frontend ส่งค่าทศนิยมจากการลากปรับตำแหน่ง (Drag-to-reposition) | 1. **Backend:** เปลี่ยน Validation เป็น `@IsNumber({ maxDecimalPlaces: 2 })`<br>2. **Frontend:** ใช้ `Math.round()` ก่อนส่งข้อมูลให้ตรงกับ DB Precision | ระบบทำงานได้ลื่นไหล รองรับการปรับตำแหน่งที่แม่นยำ และรักษามาตรฐาน Input Validation |
| **DF-002** | `BatchSyncWorker.flush()` ไม่ตรวจสอบ leader status เมื่อถูกเรียกโดยตรง — non-leader node อาจดึง dirty queue ได้หากเรียก `flush()` ภายนอก interval | **Guard placement:** เงื่อนไข `if (!isLeader) return` อยู่แค่ใน interval callback ไม่ได้อยู่ใน body ของ `flush()` เอง | ย้าย `if (!this.election.isLeader) return;` เข้าไปเป็น statement แรกของ `flush()` — TDD cycle ที่ 2 (RED) ตรวจพบก่อน merge | ป้องกัน concurrent drain จาก non-leader nodes ในสภาวะ multi-process; queue integrity สมบูรณ์ |
| **DF-003** | `BatchSyncWorker.onModuleInit()` ไม่รอ crash recovery เสร็จก่อนที่ interval จะเริ่ม — orphaned key อาจถูกประมวลผลซ้ำซ้อน | **Missing async:** `onModuleInit()` ประกาศเป็น `void` (sync) ทำให้ `recoverOrphans()` ซึ่งเป็น async ถูก fire-and-forget และ interval เริ่มทำงานก่อนที่ recovery จะเสร็จ | เปลี่ยน signature เป็น `async onModuleInit(): Promise<void>` และใช้ `await this.recoverOrphans()` — TDD cycle crash-recovery (RED) ตรวจพบ | รับประกันว่า orphaned key ถูก re-queue ทั้งหมดก่อนที่ flush cycle แรกจะทำงาน |

## 5. Sample Result Summary
หลักฐานเชิงกระบวนการในหัวข้อนี้สามารถผูกกับเอกสารระบบที่สร้างไว้แล้วได้โดยตรง เช่น เอกสาร setup และ runtime ของ Frontend, Backend และ MIT รวมถึง phase documentation ที่อธิบาย testing และ deployment

## 5. Sample Result Summary

ตัวอย่างการสรุปผลสามารถเขียนในลักษณะดังนี้

"จากการประเมินผู้ใช้กลุ่มตัวอย่าง พบว่าระบบ MangaDock มีคะแนนความพึงพอใจโดยรวมอยู่ในระดับดี โดยผู้ใช้ให้คะแนนสูงในด้านความสะดวกของการค้นหาและการเปิดดูรายละเอียดมังงะ ขณะที่ประเด็นที่ควรปรับปรุงเพิ่มเติมคือระยะเวลาการแปลหน้ามังงะในบางกรณีที่ขึ้นกับ service ภายนอก"

## 6. Summary

Phase 7 เป็นหลักฐานปลายทางที่แสดงให้เห็นว่าระบบไม่เพียงถูกพัฒนาครบตามแผน แต่ยังผ่านการประเมินทั้งในมุมมองผู้ใช้และมุมมองกระบวนการพัฒนา ซึ่งช่วยเสริมความสมบูรณ์ของรายงาน Software Engineering ในภาพรวม

หากต้องการเชื่อมผลประเมินกับโครงสร้างระบบจริง สามารถอ้างอิง [../DOCUMENT_INDEX.md](../DOCUMENT_INDEX.md) และชุดเอกสารของ [../Frontend/FRONTEND_DOC_INDEX.md](../Frontend/FRONTEND_DOC_INDEX.md), [../Backend/BACKEND_DOC_INDEX.md](../Backend/BACKEND_DOC_INDEX.md), และ [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md) ร่วมกัน