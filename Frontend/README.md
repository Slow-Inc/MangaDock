# Frontend (Next.js + TailwindCSS)

Landing Page สำหรับ MetaBooks ในสไตล์ Netflix + Glassmorphism

## เทคโนโลยี

- Next.js (App Router)
- TailwindCSS v4
- TypeScript

## การตั้งค่า

1. ติดตั้งแพ็กเกจ

```bash
npm install
```

2. สร้างไฟล์ `.env`

```bash
cp .env.example .env
```

3. กรอกค่าที่จำเป็นใน `.env`

Firebase Web App config (ดูจาก Firebase Console → Project Settings → Your apps → Web app):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
```

ตั้งค่า backend URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4001
INTERNAL_API_URL=http://localhost:4001
```

4. รัน Frontend

```bash
npm run dev
```

เปิดเว็บที่ http://localhost:4000

## Authentication

Frontend ใช้ Firebase Client SDK สำหรับ authentication และส่ง Firebase ID token ไปยัง backend ที่แต่ละ request ผ่าน `Authorization: Bearer <token>` header
