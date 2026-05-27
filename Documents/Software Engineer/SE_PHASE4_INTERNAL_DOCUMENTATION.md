# Phase 4: Internal Documentation and Versioning Control

เอกสารนี้จัดทำขึ้นสำหรับใช้ใน Paper วิชา Software Engineering โดยอธิบายงานในช่วง Phase 4 ซึ่งมุ่งเน้นการจัดทำเอกสารภายในทีมและการควบคุมเวอร์ชันของซอฟต์แวร์ให้เป็นระบบ

หมายเหตุ: ไฟล์นี้เป็นหนึ่งในชุดเอกสารแยกตาม phase ของรายงาน และควรใช้ร่วมกับ [SE_PHASE_INDEX.md](SE_PHASE_INDEX.md) และ [UML_REPORT.md](UML_REPORT.md)

## 1. วัตถุประสงค์ของ Phase 4

Phase 4 มีเป้าหมายเพื่อทำให้การพัฒนาระบบ MangaDock ดำเนินไปอย่างต่อเนื่อง ตรวจสอบย้อนหลังได้ และสามารถส่งต่องานระหว่างสมาชิกในทีมได้โดยไม่สูญเสียองค์ความรู้สำคัญของระบบ โดยกิจกรรมหลักในระยะนี้ประกอบด้วยการจัดทำเอกสารภายในโครงการ การกำหนดมาตรฐานการอธิบายโครงสร้างระบบ และการวางแนวทางควบคุมเวอร์ชันด้วย Git เพื่อให้ทุกการเปลี่ยนแปลงสามารถติดตาม ตรวจสอบ และ rollback ได้เมื่อเกิดปัญหา

## 2. Internal Documentation

เอกสารภายในถูกจัดทำขึ้นเพื่อให้สมาชิกในทีมเข้าใจภาพรวมของระบบและรายละเอียดเชิงเทคนิคได้ตรงกัน โดยเน้นให้เอกสารมีความกระชับ อัปเดตได้ง่าย และสอดคล้องกับโค้ดจริงมากที่สุด เอกสารในส่วนนี้ครอบคลุมหัวข้อสำคัญดังต่อไปนี้

1. เอกสารภาพรวมสถาปัตยกรรมระบบ เพื่ออธิบายความสัมพันธ์ระหว่าง Frontend, Backend, Database, Cache และ External Services
2. เอกสารโครงสร้างโมดูล เพื่อระบุหน้าที่ของแต่ละ module เช่น books, users, cache, supabase และ status
3. เอกสาร API และ data flow เพื่ออธิบาย request/response, endpoint สำคัญ, และลำดับการทำงานของระบบ
4. เอกสารการติดตั้งและการรันระบบ เพื่อให้สมาชิกสามารถ setup project, environment variables, และ service ที่เกี่ยวข้องได้อย่างถูกต้อง
5. เอกสารด้านการ deploy และ operation เพื่อใช้เป็นแนวทางในการรันระบบจริง, ตรวจสอบ health status, และจัดการ service ที่เชื่อมต่อภายนอก
6. เอกสารปัญหาและข้อจำกัดที่พบระหว่างพัฒนา เพื่อเก็บองค์ความรู้จากการทดลอง แก้ปัญหา และการตัดสินใจเชิงเทคนิคของทีม

ในเชิงปฏิบัติ เอกสารเหล่านี้ช่วยลดความเสี่ยงจากการพึ่งพาความรู้เฉพาะบุคคล ทำให้การ onboarding สมาชิกใหม่ทำได้รวดเร็วขึ้น และช่วยให้การตรวจสอบความถูกต้องของระบบในช่วงทดสอบและส่งมอบงานมีประสิทธิภาพมากขึ้น

ปัจจุบันเอกสารภายในของโครงการถูกจัดเป็นชุดอ้างอิงหลักดังนี้

1. [../Frontend/FRONTEND_DOC_INDEX.md](../Frontend/FRONTEND_DOC_INDEX.md) สำหรับเอกสารสรุประบบฝั่ง frontend
2. [../Backend/BACKEND_DOC_INDEX.md](../Backend/BACKEND_DOC_INDEX.md) สำหรับเอกสารสรุประบบฝั่ง backend
3. [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md) สำหรับเอกสารสรุประบบฝั่ง translation microservice
4. [UML_REPORT.md](UML_REPORT.md) สำหรับแผนภาพ UML และเอกสารออกแบบที่ใช้ร่วมในรายงาน
5. [SE_PHASE_INDEX.md](SE_PHASE_INDEX.md) สำหรับสารบัญเอกสารรายงานแยกตาม phase

## 3. ประเภทเอกสารที่ควรมีในโครงการ

สำหรับโครงการ MangaDock เอกสารภายในที่สำคัญสามารถสรุปได้ดังตารางต่อไปนี้

| ประเภทเอกสาร | วัตถุประสงค์ | ตัวอย่างเนื้อหา |
|---|---|---|
| Architecture Documentation | อธิบายภาพรวมระบบ | Frontend, Backend, Manga Translator, Supabase, Redis |
| Module Documentation | อธิบายหน้าที่ของแต่ละส่วน | Books Module, Users Module, Cache Module |
| API Documentation | อธิบายการใช้งาน service | endpoint, parameters, response, error cases |
| Setup Documentation | ใช้สำหรับติดตั้งและรันระบบ | environment variables, commands, dependencies |
| Deployment Documentation | ใช้สำหรับติดตั้งระบบใช้งานจริง | server config, port, health check, restart flow |
| Maintenance Notes | ใช้สำหรับบำรุงรักษาระยะยาว | known issues, workaround, service dependency |

ในสถานะปัจจุบันของโครงการ ตารางนี้สามารถ map กับเอกสารจริงได้ดังนี้

1. Architecture Documentation: `Documents/Frontend/`, `Documents/Backend/`, `Documents/MIT/`, และ `UML_REPORT.md`
2. Module Documentation: README และเอกสาร overview ของ backend และ frontend
3. Setup Documentation: `Frontend/README.md`, `backend/README.md`, และ `MIT/README.md`
4. Deployment Documentation: [SE_PHASE6_DEPLOYMENT_AND_GO_LIVE.md](SE_PHASE6_DEPLOYMENT_AND_GO_LIVE.md)

## 4. Versioning Control

การควบคุมเวอร์ชันของโครงการใช้ Git เป็นเครื่องมือหลัก เพื่อให้ทุกการเปลี่ยนแปลงในซอร์สโค้ดสามารถติดตามได้อย่างเป็นระบบ โดยแนวคิดสำคัญคือการแยกงานออกเป็นชุดการเปลี่ยนแปลงขนาดเล็กที่มีความหมายชัดเจน และบันทึกลง repository อย่างสม่ำเสมอ แนวทางนี้ช่วยให้ทีมสามารถตรวจสอบย้อนหลังได้ว่าใครแก้ไขอะไร เมื่อใด และมีผลต่อส่วนใดของระบบ

หลักการของ Versioning Control ในโครงการนี้ประกอบด้วย

1. ใช้ repository เป็นศูนย์กลางในการเก็บ source code และเอกสารที่เกี่ยวข้องกับระบบ
2. แยกการทำงานออกเป็น branch ตามขอบเขตของงาน เช่น feature, fix, refactor หรือ documentation
3. ตั้งชื่อ commit ให้สื่อความหมายของการเปลี่ยนแปลงอย่างชัดเจน เพื่อให้สามารถอ่านประวัติการพัฒนาได้ง่าย
4. ตรวจสอบผลกระทบของการเปลี่ยนแปลงก่อน merge เข้าสู่ branch หลัก
5. ใช้ tag หรือ release label เมื่อระบบอยู่ในจุดที่สามารถอ้างอิงย้อนหลังได้ เช่น demo version, testing version หรือ submission version

## 5. แนวทางการตั้งชื่อ Branch และ Commit

เพื่อให้การทำงานร่วมกันมีมาตรฐานเดียวกัน สามารถกำหนดแนวทางเบื้องต้นได้ดังนี้

- Branch สำหรับฟีเจอร์ใหม่: `feature/<feature-name>`
- Branch สำหรับแก้บั๊ก: `fix/<issue-name>`
- Branch สำหรับปรับโครงสร้าง: `refactor/<scope>`
- Branch สำหรับเอกสาร: `docs/<topic>`

ตัวอย่างชื่อ commit ที่เหมาะสม เช่น

- `feat: add manga translation endpoint`
- `fix: correct account modal mobile navigation`
- `refactor: separate translator service configuration`
- `docs: update deployment and environment guide`

แนวทางนี้ช่วยให้ประวัติการพัฒนามีความเป็นระเบียบ และทำให้ผู้ตรวจหรือสมาชิกในทีมสามารถเข้าใจพัฒนาการของระบบได้ง่ายโดยไม่ต้องเปิดดูโค้ดทุกไฟล์

## 6. ประโยชน์ที่ได้รับจากการทำ Documentation และ Versioning

การจัดทำ Internal Documentation ควบคู่กับ Versioning Control ส่งผลโดยตรงต่อคุณภาพของโครงการในหลายด้าน ได้แก่

1. ทำให้การสื่อสารภายในทีมมีความชัดเจนและลดความคลาดเคลื่อนในการพัฒนา
2. ช่วยให้ตรวจสอบและติดตามการเปลี่ยนแปลงของระบบได้ง่าย
3. ลดความเสี่ยงเมื่อเกิดข้อผิดพลาด เพราะสามารถย้อนกลับไปยังเวอร์ชันก่อนหน้าได้
4. สนับสนุนการทดสอบ การแก้บั๊ก และการส่งมอบงานอย่างเป็นระบบ
5. เพิ่มความพร้อมของโครงการสำหรับการบำรุงรักษาและการพัฒนาต่อในอนาคต

## 7. สรุป Phase 4

Phase 4 เป็นช่วงที่ทำให้โครงการมีความเป็นวิศวกรรมซอฟต์แวร์มากขึ้นอย่างชัดเจน เพราะไม่เพียงมุ่งเน้นการพัฒนา feature เท่านั้น แต่ยังให้ความสำคัญกับการจัดเก็บองค์ความรู้ของระบบและการควบคุมการเปลี่ยนแปลงอย่างเป็นระบบ เอกสารภายในช่วยให้ทีมเข้าใจระบบตรงกัน ขณะที่ Versioning Control ช่วยให้การพัฒนาเป็นไปอย่างปลอดภัย ตรวจสอบได้ และพร้อมต่อยอดในระยะยาว