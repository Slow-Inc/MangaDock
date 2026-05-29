# PRD: Community Forum (Phase 7.1) — ฉบับอัปเดตระบบจริง

## 1. ข้อมูลทั่วไป (Overview)
ระบบ Community Forum เป็นหัวใจสำคัญของ MangaDock ในการสร้าง User Engagement และเป็นพื้นที่ให้ Creators/Translators ได้สื่อสารกับผู้อ่านโดยตรง โดยเน้นประสบการณ์การใช้งานที่พรีเมียม ลื่นไหล และทันสมัย (Modern Reddit-like Experience)

## 2. กลุ่มเป้าหมาย (Target Users)
- **ผู้อ่าน (Manga Readers):** แลกเปลี่ยนความคิดเห็น รีวิว และติดตามข่าวสารมังงะ
- **ผู้สร้าง/นักแปล (Creators & Translators):** ประกาศอัปเดตงานแปล, ชี้แจงรายละเอียดตอนใหม่ และรับ Feedback จากผู้อ่าน

## 3. คุณสมบัติของระบบ (Functional Requirements)

### 3.1 ระบบโพสต์และการจัดหมวดหมู่ (Hybrid Structure)
- **หมวดหมู่หลัก (Global Categories):** ทั่วไป (General), ประกาศ (Announcements), สปอยล์ (Spoiler) และอัปเดตมังงะ
- **Manga Tags:** สามารถผูกโพสต์เข้ากับมังงะเรื่องใดเรื่องหนึ่งได้ โดยแสดงชื่อและรูปปกมังงะในโพสต์โดยอัตโนมัติ
- **View Modes:**
    - **Card View:** แสดงผลแบบตารางสี่เหลี่ยมจัตุรัส เน้นความสวยงาม (Facebook-style)
    - **Compact View:** แสดงผลแบบแถบแนวนอนความหนาแน่นสูง เน้นการกวาดตาอ่านเร็ว

### 3.2 ระบบความคิดเห็น (Nested Threads)
- รองรับการตอบกลับแบบลึก (Parent-Child Relationships)
- ระบบโหลดข้อมูลแบบ Lazy Loading เพื่อประสิทธิภาพสูงสุด

### 3.3 ระบบโหวต (Idempotent Voting)
- ผู้ใช้สามารถ Upvote หรือ Downvote ได้เพียงครั้งเดียวต่อหนึ่ง Content
- ระบบป้องกันการโหวตซ้ำ (Idempotency) ที่ระดับ Backend

### 3.4 ระบบจัดการสื่อ (Image Upload)
- รองรับการอัปโหลดรูปภาพหลายรูปต่อหนึ่งโพสต์
- ระบบแสดงผลรูปภาพแบบ Grid ที่ปรับตามจำนวนรูป (1-3+ รูป) พร้อมระบบ Lightbox

## 4. มาตรฐาน UI/UX (Design Specifications)

### 4.1 งานออกแบบ (META-DESIGN)
- **Liquid Glass Aesthetics:** ใช้ความโปร่งแสง (`bg-white/10`), การเบลอพื้นหลัง (`backdrop-blur-md`) และเส้นขอบจางๆ
- **Zero-Emoji Policy:** ห้ามใช้ Emoji ใน UI หลัก (ยกเว้นเนื้อหาที่ผู้ใช้พิมพ์) ให้ใช้ Premium SVGs ที่มี Glow Effect แทน
- **Multi-instance Smooth Scrolling:** ติดตั้งระบบ **Lenis** แยกอิสระระหว่าง Sidebar และ Feed เพื่อความลื่นไหลระดับ Native App

### 4.2 การนำทาง (Navigation)
- **Reddit-style Sidebar:** แถบนำทางด้านข้างที่แสดง Trending Manga (คำนวณจากกิจกรรม 7 วันล่าสุด) และหมวดหมู่
- **Sticky Sub-Navbar:** แถบปุ่มย้อนกลับที่ฉลาด โดยจะแสดงชื่อหัวข้อกระทู้เมื่อผู้ใช้เลื่อนหน้าจอลงมา (Context Awareness)

## 5. สถาปัตยกรรมทางเทคนิค (Technical Architecture)

### 5.1 ฐานข้อมูล (Supabase/PostgreSQL)
- `forum_posts`: เก็บเนื้อหาหลัก, ผู้เขียน, และอาเรย์ของ URL รูปภาพ
- `forum_comments`: เก็บความเห็นและ `parent_id` สำหรับทำ Nested Threads
- `forum_votes`: เก็บประวัติการโหวตรายบุคคลเพื่อบังคับใช้กฎ 1 คน 1 โหวต

### 5.2 การประมวลผล (NestJS Backend)
- **Recursive Logic:** จัดการโครงสร้างความเห็นแบบ Tree ที่ Application Layer เพื่อความยืดหยุ่น
- **Trending Algorithm:** คำนวณความนิยมมังงะจากจำนวนการติด Tag ในโพสต์ย้อนหลัง 7 วัน

## 6. การรับรองคุณภาพ (Verification)
- **Unit Tests:** ครอบคลุมระบบโหวต (Idempotency), ระบบการเงิน (Revenue Split) และระบบความปลอดภัย (HWID Binding)
- **Zero-Trust Enforcement:** ทุก Request ใน Forum ต้องมีการยืนยัน Hardware ID (`x-hardware-id`) เพื่อป้องกัน Bot Farm
