# Phase 5: Test Specification and UAT

เอกสารฉบับนี้จัดทำขึ้นเพื่ออธิบายแผนการทดสอบของระบบ MetaBooks ทั้งในระดับ test specification และผลการทดสอบ User Acceptance Test (UAT)

## 1. Test Objectives

1. ตรวจสอบว่าฟังก์ชันหลักของระบบทำงานตรงตาม requirement
2. ตรวจสอบความถูกต้องของ flow การใช้งานหลักของผู้ใช้
3. ตรวจสอบการทำงานร่วมกันของ Frontend (Next.js), Backend (NestJS) และ MIT (Manga Image Translator microservice)
4. ยืนยันว่าระบบพร้อมสำหรับการสาธิตและส่งมอบ

## 2. Test Scope

- Authentication and account management
- Search and browse books or manga
- Book detail and manga detail flow
- Reader flow and reading history
- Manga page translation flow
- Favorites, liked items และ profile update

## 3. Test Specification Table

| Test ID | Test Item | Expected Result |
|---|---|---|
| TC-01 | Login with valid account | ผู้ใช้เข้าสู่ระบบสำเร็จ |
| TC-02 | Register with valid data | สร้างบัญชีใหม่ได้สำเร็จ |
| TC-03 | Search manga by keyword | ระบบคืนผลลัพธ์ที่เกี่ยวข้อง |
| TC-04 | Open book detail | ระบบแสดงรายละเอียดหนังสือหรือมังงะได้ |
| TC-05 | Open manga chapter | ระบบเปิดหน้าอ่านมังงะได้ |
| TC-06 | Translate manga page | ระบบส่งคำขอไปยัง Backend (NestJS) และแสดงผลแปลจาก MIT ได้ |
| TC-07 | Add favorite | ระบบบันทึกรายการโปรดให้ผู้ใช้ได้ |
| TC-08 | Update profile | ระบบบันทึกข้อมูลบัญชีใหม่ได้ |

## 4. UAT Criteria

เกณฑ์การยอมรับระบบของผู้ใช้กำหนดจากเงื่อนไขหลักต่อไปนี้

1. ผู้ใช้สามารถทำงานหลักของระบบได้โดยไม่เกิด error ที่ขัดขวางการใช้งาน
2. หน้าใช้งานหลักต้องแสดงผลได้ทั้ง desktop และ mobile
3. ระบบต้องตอบสนองต่อ interaction หลักได้ถูกต้อง เช่น login, open detail, read chapter และ translate page
4. ผลลัพธ์ที่แสดงต้องสอดคล้องกับความคาดหวังเชิงธุรกิจของระบบต้นแบบ

## 5. Sample UAT Result Summary

| UAT Case | Result | Remark |
|---|---|---|
| User can search books | Pass | ผลลัพธ์ตรงคำค้นส่วนใหญ่ |
| User can open manga detail | Pass | แสดงข้อมูลและปกได้ครบ |
| User can read chapter | Pass | reader เปิดใช้งานได้ |
| User can translate manga page | Pass with observation | ความเร็วขึ้นกับ MIT และ external translator providers |
| User can manage account | Pass | profile, password, linked accounts ใช้งานได้ |

## 6. Defect Recording

เมื่อพบข้อผิดพลาดระหว่างการทดสอบ ควรบันทึกอย่างน้อยในรูปแบบต่อไปนี้

| Defect ID | Description | Severity | Status |
|---|---|---|---|
| BUG-01 | Translation request timeout in some pages | Medium | Open or Fixed |
| BUG-02 | Mobile layout issue in account page | Low | Fixed |

## 7. Summary

Phase 5 มีบทบาทสำคัญในการยืนยันว่าระบบ MetaBooks ไม่เพียงพัฒนาได้ครบตาม requirement แต่ยังสามารถใช้งานได้จริงในมุมมองของผู้ใช้ปลายทาง โดยผล UAT เป็นหลักฐานสำคัญก่อนเข้าสู่การเตรียม deployment และ go-live

เอกสารประกอบที่ควรใช้อ้างอิงร่วมกับ phase นี้ ได้แก่ [../Frontend/FRONTEND_DOC_INDEX.md](../Frontend/FRONTEND_DOC_INDEX.md), [../Backend/BACKEND_DOC_INDEX.md](../Backend/BACKEND_DOC_INDEX.md), [../MIT/MIT_DOC_INDEX.md](../MIT/MIT_DOC_INDEX.md) และ [SE_PHASE6_DEPLOYMENT_AND_GO_LIVE.md](SE_PHASE6_DEPLOYMENT_AND_GO_LIVE.md)