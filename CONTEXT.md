# MangaDock System Context

## Cache Architecture (Phase 2)

### L2-Centric Architecture
โครงสร้างการจัดการสถานะที่ถือว่า **Redis (L2)** เป็น "แหล่งข้อมูลที่ถูกต้องที่สุด" (Source of Truth) ในระดับ Runtime ข้อมูลทุกอย่างที่เกิดขึ้นในระบบจะถูกบันทึกลง L2 ก่อนเป็นอันดับแรก

### L1 Read Mirror
การสำรองข้อมูลในหน่วยความจำ (In-Memory) ของแต่ละ Application Node เพื่อความเร็วสูงสุด โดยจะซิงค์ข้อมูลกับ L2 ผ่านระบบ Redis Pub/Sub เมื่อมีการเปลี่ยนแปลง

### Dynamic Batching Tiers
กลยุทธ์การบันทึกข้อมูลจาก Redis ลงสู่ Local Storage (JSON) หรือ Database โดยมีความถี่แปรผันตาม **ความสำคัญ** และ **ความถี่ในการใช้งาน** ของข้อมูลนั้นๆ (เช่น ข้อมูล Wallet จะมี Tier ความถี่สูงสุด)

### Redis Lock-based Election (Mutex)
ระบบการคัดเลือกโหนดประมวลผลหลัก (Leader) โดยใช้คำสั่ง **SET NX PX** ใน Redis เพื่อให้แน่ใจว่าจะมีโหนดเดียวเท่านั้นที่ได้รับสิทธิ์ความเป็น Leader (Mutex) ในช่วงเวลาที่กำหนด วิธีนี้ช่วยป้องกันปัญหา Split-brain และแก้ปัญหา Leader Flapping ได้อย่างเด็ดขาด

### Node Heartbeat & Observability
ข้อมูลสุขภาพของ Application Node (CPU, Memory, Supabase Latency) จะถูกส่งไปยัง Redis เพื่อจุดประสงค์ในการ **เฝ้าสังเกตการณ์ (Monitoring)** และแสดงผลบน Dashboard ในอนาคตเท่านั้น ไม่ถูกนำมาใช้เป็นปัจจัยในการตัดสินใจเลือก Leader

### Consolidated Batching (Write-behind)
กระบวนการที่ Leader Node (ผู้ถือ Lock) รวบรวมข้อมูลที่มีการเปลี่ยนแปลง (Dirty Data) จาก Redis มาจัดกลุ่มเป็นก้อนเดียว ก่อนจะทำการอัปเดตลง Supabase ในครั้งเดียว เพื่อลด Database Overhead

### Dirty Key List / Queue
บัญชีรายชื่อของข้อมูลใน Redis ที่มีการแก้ไขและยังไม่ได้ทำการบันทึกลงฐานข้อมูลหลัก (Supabase) ทำหน้าที่เป็นตัวเชื่อมระหว่างระบบ Cache และระบบ Persistence
