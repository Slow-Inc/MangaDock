# Backend (NestJS API)

Backend สำหรับ MangaDock ใช้ NestJS เป็น API และ orchestration layer ของระบบ

## เทคโนโลยี

- NestJS
- Firebase Admin SDK
- Redis cache

## การตั้งค่า

1. ติดตั้งแพ็กเกจ

```bash
bun install
```

2. นำไฟล์ Firebase service account JSON มาวางในโฟลเดอร์ `Backend/`

ตัวอย่างไฟล์ที่ทีมใช้ระหว่างพัฒนา:

```text
Backend/metabooks-d3914-firebase-adminsdk-fbsvc-a87f27075e.json
```

ไฟล์นี้ควรเป็นไฟล์ credential ของโปรเจกต์ Firebase ที่ใช้จริง และไม่ควรถูก commit เข้า git

3. สร้างไฟล์ `.env`

```bash
cp .env.example .env
```

4. ใส่ค่าที่จำเป็นใน `.env`

Sensitive values ที่ต้องกรอกเอง:
- `GEMINI_API_KEY` — จาก Google AI Studio
- `GOOGLE_BOOKS_API_KEY` — จาก Google Cloud Console

Firebase credentials ให้นำมาจาก service account JSON:

- `project_id` -> `FIREBASE_PROJECT_ID`
- `client_email` -> `FIREBASE_CLIENT_EMAIL`
- `private_key` -> `FIREBASE_PRIVATE_KEY`

หมายเหตุ: ถ้าใส่ `FIREBASE_PRIVATE_KEY` ลง `.env` ให้เก็บ `\n` ไว้ในค่า string ตามรูปแบบตัวอย่างด้านล่าง

```env
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_BOOKS_API_KEY=your-google-books-api-key

PORT=4001
FRONTEND_ORIGIN=http://localhost:4000
MANGA_TRANSLATOR_URL=http://localhost:5003
REDIS_HOST=localhost
REDIS_PORT=6379

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-client-email
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

5. รัน Backend

```bash
bun run start:dev
```

API จะรันที่ http://localhost:4001

Backend จะ initialize Firebase Admin จากค่าที่อยู่ใน `.env` ไม่ได้อ่านไฟล์ JSON โดยตรงตอน runtime ดังนั้นการนำไฟล์มาวางไว้ในโฟลเดอร์ `Backend/` มีไว้เพื่อใช้อ้างอิงหรือคัดค่าลง environment เท่านั้น
