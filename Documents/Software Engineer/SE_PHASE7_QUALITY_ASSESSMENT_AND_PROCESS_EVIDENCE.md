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

หลักฐานเชิงกระบวนการในหัวข้อนี้สามารถผูกกับเอกสารระบบที่สร้างไว้แล้วได้โดยตรง เช่น เอกสาร setup และ runtime ของ Frontend, Backend และ MIT รวมถึง phase documentation ที่อธิบาย testing และ deployment

## 5. Sample Result Summary

ตัวอย่างการสรุปผลสามารถเขียนในลักษณะดังนี้

"จากการประเมินผู้ใช้กลุ่มตัวอย่าง พบว่าระบบ MetaBooks มีคะแนนความพึงพอใจโดยรวมอยู่ในระดับดี โดยผู้ใช้ให้คะแนนสูงในด้านความสะดวกของการค้นหาและการเปิดดูรายละเอียดมังงะ ขณะที่ประเด็นที่ควรปรับปรุงเพิ่มเติมคือระยะเวลาการแปลหน้ามังงะในบางกรณีที่ขึ้นกับ service ภายนอก"

## 6. Summary

Phase 7 เป็นหลักฐานปลายทางที่แสดงให้เห็นว่าระบบไม่เพียงถูกพัฒนาครบตามแผน แต่ยังผ่านการประเมินทั้งในมุมมองผู้ใช้และมุมมองกระบวนการพัฒนา ซึ่งช่วยเสริมความสมบูรณ์ของรายงาน Software Engineering ในภาพรวม

หากต้องการเชื่อมผลประเมินกับโครงสร้างระบบจริง สามารถอ้างอิง [../DOCUMENT_INDEX.md](../DOCUMENT_INDEX.md) และชุดเอกสารของ [../Frontend/FRONTEND_DOC_INDEX.md](../Frontend/FRONTEND_DOC_INDEX.md), [../Backend/BACKEND_DOC_INDEX.md](../Backend/BACKEND_DOC_INDEX.md), และ [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md) ร่วมกัน