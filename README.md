# MetaBooks

MetaBooks เป็นระบบที่แยกออกเป็น 3 ส่วนหลัก:

1. Frontend: Next.js web app
2. Backend: NestJS API และ orchestration layer
3. MIT: Manga Image Translator microservice สำหรับงานแปลภาพ

ที่ root ของ repository นี้มี `docker-compose.yml` สำหรับรัน Redis ที่ backend ใช้งานเป็น cache

## Services and Default Ports

| Service | Path | Default URL |
|---|---|---|
| Frontend | `Frontend/` | `http://localhost:4000` |
| Backend | `Backend/` | `http://localhost:4001` |
| MIT | `MIT/` | `http://localhost:5003` |
| Redis | root `docker-compose.yml` | `localhost:6379` |

## Prerequisites

- Node.js และ bun สำหรับ Frontend และ Backend
- Python environment สำหรับ MIT
- Docker Desktop หรือ Docker Engine ถ้าต้องการรัน Redis หรือ MIT ผ่าน Docker
- Firebase project และ Firebase service account สำหรับ backend

## Recommended Startup Order

1. รัน Redis
2. รัน MIT
3. รัน Backend
4. รัน Frontend

## Quick Start

### 1. Start Redis

ที่ root ของ repository:

```bash
docker compose up -d
```

ไฟล์ compose ที่ root ใช้สำหรับ Redis เท่านั้น

### 2. Setup and Start MIT

เข้าโฟลเดอร์ `MIT/`

ถ้ารันบน Windows แบบ local ที่ง่ายที่สุด:

```bat
run-server.bat
```

MIT จะเปิดที่ `http://localhost:5003`

ตรวจสอบได้ด้วย:

```bash
curl http://localhost:5003/health
```

ถ้าต้องการรายละเอียดเพิ่มเติมดู [MIT/README.md](MIT/README.md)

### 3. Setup and Start Backend

เข้าโฟลเดอร์ `Backend/`

ติดตั้ง dependencies:

```bash
bun install
```

นำไฟล์ Firebase service account JSON มาวางในโฟลเดอร์ `Backend/`

ตัวอย่างชื่อไฟล์ที่ทีมใช้ระหว่างพัฒนา:

```text
Backend/metabooks-d3914-firebase-adminsdk-fbsvc-a87f27075e.json
```

จากนั้นสร้าง `.env` จาก template:

```bash
cp .env.example .env
```

แล้วกรอกค่าหลักอย่างน้อยดังนี้:

```env
# Gemini API (required for translation)
GEMINI_API_KEY=your-gemini-api-key

# Google Books API (required for book data)
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

ค่า Firebase ทั้ง 3 ตัวให้นำมาจาก field `project_id`, `client_email`, และ `private_key` ในไฟล์ service account JSON

รัน backend:

```bash
bun run start:dev
```

รายละเอียดเพิ่มเติมดู [Backend/README.md](Backend/README.md)

### 4. Setup and Start Frontend

เข้าโฟลเดอร์ `Frontend/`

ติดตั้ง dependencies:

```bash
bun install
```

สร้างไฟล์ `.env` จาก template:

```bash
cp .env.example .env
```

ตั้งค่า backend URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4001
```

รัน frontend:

```bash
bun run dev
```

Frontend ของ repo นี้รันที่ `http://localhost:4000`

รายละเอียดเพิ่มเติมดู [Frontend/README.md](Frontend/README.md)

## Verification Checklist

หลังจาก start ครบทุก service แล้ว ควรตรวจสอบขั้นต่ำดังนี้:

1. Frontend เปิดได้ที่ `http://localhost:4000`
2. Backend ตอบสนองที่ `http://localhost:4001`
3. MIT health check ผ่านที่ `http://localhost:5003/health`
4. Backend เชื่อม Redis ได้ที่ `localhost:6379`
5. Firebase credentials ถูกต้อง

## Related Docs

- [Documents/DOCUMENT_INDEX.md](Documents/DOCUMENT_INDEX.md)
- [Frontend/README.md](Frontend/README.md)
- [Backend/README.md](Backend/README.md)
- [MIT/README.md](MIT/README.md)