# MangaDock Phase 2: Mobile OS-Level Integration & Advanced Features

รายการงานสำหรับการพัฒนาแอปพลิเคชันมือถือ (Mobile App) และการขยายขีดความสามารถของระบบตามแผนงานระดับสูง

---

## 📱 1. Mobile App Development (React Native Shell)

- [ ] **[Mobile] Project Initialization:**
    - [ ] ขึ้นโครงสร้างโปรเจกต์ React Native (TypeScript) ในโฟลเดอร์ `Mobile/`
    - [ ] ติดตั้งและตั้งค่า `react-native-webview`
    - [ ] *เป้าหมาย:* มีแอปที่สามารถเปิด Web App ของเราขึ้นมาแสดงผลได้

- [ ] **[Mobile] Auth & Deep Linking:**
    - [ ] ตั้งค่า URL Scheme สำหรับทำ Deep Linking (เช่น `mangadock://`)
    - [ ] จัดการระบบ Authentication Bridge เพื่อส่ง Token จาก Browser เข้ามาในแอป
    - [ ] *เป้าหมาย:* ผู้ใช้สามารถ Login ผ่านแอปได้อย่างไร้รอยต่อ

- [ ] **[Mobile] Native Zero-Trust Integration:**
    - [ ] ดึงรหัสอุปกรณ์ (Android ID / IDFV) จากฝั่ง Native
    - [ ] ส่งค่า ID จริงแนบไปใน Header `x-hardware-id` ของทุก Request ใน WebView
    - [ ] *เป้าหมาย:* ยกระดับความปลอดภัยจาก Fingerprint Stub เป็น Native Hardware ID

---

## 🚀 2. Advanced OS-Level Features (ไม้ตายเฟส 2)

- [ ] **[Mobile] Screen Capture Pipeline:**
    - [ ] เรียกใช้ **MediaProjection API** (Android) เพื่อขอสิทธิ์บันทึกภาพหน้าจอ
    - [ ] เขียน Bridge เพื่อส่งสตรีมภาพหน้าจอไปประมวลผลที่ MIT Server
    - [ ] *เป้าหมาย:* เตรียมความพร้อมสำหรับระบบแปลหน้าจอเรียลไทม์

- [ ] **[Mobile] Real-time Translation Overlay:**
    - [ ] พัฒนา **UI Overlay (WindowManager)** เพื่อวาดกรอบคำแปลทับซ้อนแอปอื่น
    - [ ] ปรับจูนประสิทธิภาพ (Throttling) เพื่อไม่ให้กินแบตเตอรี่และ RAM เกินความจำเป็น
    - [ ] *เป้าหมาย:* ฟีเจอร์แปลมังงะในแอปอื่นได้โดยไม่ต้องสลับหน้าจอ

---

## 🏛️ 3. Community Forum (Reddit-like) - COMPLETED ✅

- [x] **[Database] Forum Schema Migration:**
    - [x] เพิ่มตาราง `forum_posts`, `forum_comments`, `forum_votes` ลงใน `supabase-migration.sql`
    - [x] *สถานะ:* โค้ด Migration พร้อมแล้ว (ต้องการการรันบน Supabase Dashboard)

- [x] **[Backend] Forum Orchestration:**
    - [x] สร้าง `ForumModule` พร้อมระบบ Hot/New sorting และ Pagination
    - [x] Implement Voting logic พร้อมป้องกันการปั๊มโหวต
    - [x] *สถานะ:* API พร้อมใช้งาน

- [x] **[Frontend] Community UI:**
    - [x] **Navbar Integration:** เพิ่มลิงก์ "Community" ในแถบเมนูหลัก
    - [x] สร้างหน้า `/community` และ `/community/p/[id]`
    - [x] พัฒนา Components: `PostCard`, `CommentThread`, `VoteButtons`
    - [x] *สถานะ:* UI พร้อมใช้งานและเชื่อมต่อกับ Backend แล้ว

---

## ✅ 4. Completed (เสร็จสิ้นแล้ว)

### Phase 1.5: System Optimization & Readiness
- [x] **[Backend] Storage Adapter Pattern:** แยกตัวจัดการไฟล์ (put, get, delete) สลับไปใช้ R2 ได้ทันที
- [x] **[Backend] Async MIT Pipeline:** เปลี่ยนการคุยกับ AI เป็น Asynchronous Webhook (T4-Standard)
- [x] **[Backend] Structured Logging:** ปรับปรุง Log ทุก Request เป็น JSON Format
- [x] **[Backend] Graceful Shutdown:** ระบบ Retry Sync Cache ก่อนปิดเครื่อง
- [x] **[Frontend] Centralized Image Resolver:** รวมศูนย์ Logic การสร้าง URL รูปภาพ
- [x] **[Frontend] Supabase Connectivity Guard:** แจ้งเตือน DB Offline ผ่าน Popup
- [x] **[Unified] Shared Type Safety:** จัดระเบียบ Type Interfaces ข้ามฝั่ง FE/BE
- [x] **[Documentation] Architecture Sync:** อัปเดต UML และเอกสารสถาปัตยกรรม 100%
