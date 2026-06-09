<!-- lang:en -->
# Ubiquitous Language

Canonical term glossary for MangaDock. When a term appears in **bold**, use it exactly as written — in code identifiers, PR descriptions, issue titles, and team conversations.

---

## Manga Content

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Chapter** | A single installment of a manga title, identified by `chapterId` | Episode, Volume |
| **Page** | A single image within a **Chapter**, addressed by zero-based `pageIndex` | Frame, panel |
| **Source Language** | The language of the original manga text (e.g. `JPN`, `ENG`) | Original language, input language |
| **Target Language** | The language the user wants the manga translated into (e.g. `THA`) | Output language, translation language |

---

## Image Translation

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **MIT** | The Python ML inference server (Manga Image Translator) that detects, OCRs, and redraws text in manga pages | Translator, ML server, Python server |
| **Patch** | A cropped PNG image of a translated text region, positioned over the original **Page** using percentage coordinates | Overlay, translated region, bubble |
| **Patch Set** | The collection of all **Patches** for a single **Page** translation result | Page result, translated page |
| **Single-Page Translation** | Translating one **Page** at a time; driven by `translateCurrentPage()` on the frontend | Per-page translation |
| **Batch Translation** | Translating all **Pages** of a **Chapter** in a single MIT job; driven by `startTranslate()` | Episode translation, bulk translation, full translation |
| **Translation Mode** | The frontend toggle (on/off) that controls whether **Patches** are rendered over the original **Pages** | Show translation, overlay mode |

---

## Batch Job Lifecycle

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Batch Job** | A running **Batch Translation** request tracked server-side via `BatchJobState`, keyed by **Job Key** | Translation job, async job |
| **Job Key** | A composite string `chapterId:srcMIT:tgtMIT` that uniquely identifies a **Batch Job** across its lifetime | Task ID |
| **Primary Listener** | The SSE connection held by the caller who created the **Batch Job** | Original listener, first caller |
| **Latecomer Listener** | Any SSE connection that joins an already-running **Batch Job** | Secondary listener, late joiner |
| **Completed Pages** | The set of **Pages** for which a **Patch Set** has been saved and cached within a **Batch Job** | Done pages, finished pages |

---

## Webhook Delivery

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **MIT Webhook** | The HTTP `POST /webhooks/mit/callback` call that MIT sends to the Backend after each **Page** translation completes | Callback, notification |
| **MIT Callback Origin** | The base URL the Backend advertises to MIT as the destination for **MIT Webhooks** (`MIT_CALLBACK_ORIGIN` env var) | Callback URL, backend origin |
| **HMAC Signature** | A `sha256` hex digest in `x-mit-signature` header, computed by MIT over the webhook body | Token, auth header |

---

## Streaming

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **SSE** | Server-Sent Events — the unidirectional HTTP stream from Backend to Frontend that delivers **Patch Sets** as they complete | WebSocket, long-poll |
| **SSE Listener** | A `BatchPageListener` callback registered by an active SSE connection to receive **Patch Sets** | Subscriber, handler |

---

## Infrastructure

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Backend** | The NestJS 11 server on port 4001; owns business logic, job registry, and webhook endpoint | API server, Node server |
| **Frontend** | The Next.js 16 application on port 4000; owns all user interaction and rendering | Client, React app |
| **Backend Public Origin** | The publicly reachable base URL of the Backend (`BACKEND_PUBLIC_ORIGIN`) | Backend URL |
| **Cloudflare Tunnel** | The service that exposes the local dev Backend/Frontend at `*.hayateotsu.space` | ngrok, reverse proxy |

---

## Relationships

- A **Chapter** contains one or more **Pages**.
- A **Batch Job** is identified by exactly one **Job Key** and processes all **Pages** of one **Chapter** in one **Source Language** → one **Target Language** pair.
- A **Batch Job** has exactly one **Primary Listener** and zero or more **Latecomer Listeners**.
- Each **Page** produces one **Patch Set** (even on failure — the set may be empty with an `error` flag).
- A **Patch Set** is delivered to the **Primary Listener** directly and to all **Latecomer Listeners** via fan-out.

---

## Flagged ambiguities

- **"Episode" vs "Chapter"**: The function `translateMangaEpisode` and the UI copy "แปลทั้งตอน" use "episode"; route params and database keys use `chapterId`. Canonical term is **Chapter** in all code and technical discussion.

- **"taskId" vs "Job Key"**: MIT receives `taskId` in the form payload (which equals the **Job Key**). Internally the Backend always uses `jobKey`. Both refer to the same value — prefer **Job Key** in discussion.

- **"MIT Callback Origin" vs "Backend Public Origin"**: `BACKEND_PUBLIC_ORIGIN` is the public-facing URL used for browser-accessible image/patch URLs. `MIT_CALLBACK_ORIGIN` is the URL MIT uses for **MIT Webhooks** — these can differ (e.g. `localhost:4001` when MIT is co-located).
<!-- lang:end -->

<!-- lang:th -->
# Ubiquitous Language — คำศัพท์มาตรฐาน

Glossary ของคำศัพท์ canonical สำหรับ MangaDock เมื่อคำใดปรากฏเป็น **ตัวหนา** ให้ใช้คำนั้นตรงตามที่เขียนไว้ — ใน code identifier, PR description, issue title และการสนทนาในทีม

---

## เนื้อหามังงะ

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **Chapter** | ตอนเดียวของมังงะ ระบุด้วย `chapterId` | Episode, Volume |
| **Page** | รูปภาพเดียวใน **Chapter** ระบุด้วย `pageIndex` แบบ zero-based | Frame, panel |
| **Source Language** | ภาษาของข้อความมังงะต้นฉบับ (เช่น `JPN`, `ENG`) | Original language, input language |
| **Target Language** | ภาษาที่ผู้ใช้ต้องการแปลมังงะ (เช่น `THA`) | Output language, translation language |

---

## การแปลภาพ

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **MIT** | Python ML inference server (Manga Image Translator) ที่ตรวจจับ, OCR และวาดข้อความใหม่ในหน้ามังงะ | Translator, ML server, Python server |
| **Patch** | รูปภาพ PNG ที่ crop ออกมาของบริเวณข้อความที่แปลแล้ว วางทับ **Page** ต้นฉบับด้วยพิกัดเป็นเปอร์เซ็นต์ | Overlay, translated region, bubble |
| **Patch Set** | คอลเล็กชันของ **Patch** ทั้งหมดสำหรับผลการแปลใน **Page** เดียว | Page result, translated page |
| **Single-Page Translation** | แปลทีละ **Page** ขับเคลื่อนโดย `translateCurrentPage()` บน frontend | Per-page translation |
| **Batch Translation** | แปลทุก **Page** ของ **Chapter** ในงาน MIT เดียว ขับเคลื่อนโดย `startTranslate()` | Episode translation, bulk translation, full translation |
| **Translation Mode** | toggle บน frontend (เปิด/ปิด) ที่ควบคุมว่า **Patch** แสดงทับ **Page** ต้นฉบับหรือไม่ | Show translation, overlay mode |

---

## Batch Job Lifecycle

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **Batch Job** | คำขอ **Batch Translation** ที่กำลังรัน ติดตามฝั่ง server ผ่าน `BatchJobState` เป็น key ด้วย **Job Key** | Translation job, async job |
| **Job Key** | string ประกอบ `chapterId:srcMIT:tgtMIT` ที่ระบุ **Batch Job** อย่างไม่ซ้ำตลอดอายุ | Task ID |
| **Primary Listener** | การเชื่อมต่อ SSE ของผู้เรียกที่สร้าง **Batch Job** | Original listener, first caller |
| **Latecomer Listener** | การเชื่อมต่อ SSE ใดๆ ที่เข้าร่วม **Batch Job** ที่กำลังรันอยู่ | Secondary listener, late joiner |
| **Completed Pages** | ชุด **Page** ที่ **Patch Set** ได้รับการบันทึกและ cache แล้วใน **Batch Job** | Done pages, finished pages |

---

## การส่ง Webhook

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **MIT Webhook** | HTTP `POST /webhooks/mit/callback` ที่ MIT ส่งไปยัง Backend หลัง **Page** แต่ละหน้าแปลเสร็จ | Callback, notification |
| **MIT Callback Origin** | base URL ที่ Backend แจ้ง MIT เป็นปลายทางสำหรับ **MIT Webhooks** (env var `MIT_CALLBACK_ORIGIN`) | Callback URL, backend origin |
| **HMAC Signature** | hex digest `sha256` ใน header `x-mit-signature` คำนวณโดย MIT บน webhook body | Token, auth header |

---

## Streaming

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **SSE** | Server-Sent Events — HTTP stream ทิศทางเดียวจาก Backend ไปยัง Frontend ที่ส่ง **Patch Set** เมื่อเสร็จ | WebSocket, long-poll |
| **SSE Listener** | callback `BatchPageListener` ที่ลงทะเบียนโดยการเชื่อมต่อ SSE ที่ active เพื่อรับ **Patch Set** | Subscriber, handler |

---

## โครงสร้างพื้นฐาน

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **Backend** | NestJS 11 server บน port 4001; เป็นเจ้าของ business logic, job registry และ webhook endpoint | API server, Node server |
| **Frontend** | Next.js 16 application บน port 4000; เป็นเจ้าของ user interaction และ rendering ทั้งหมด | Client, React app |
| **Backend Public Origin** | base URL ของ Backend ที่เข้าถึงได้สาธารณะ (`BACKEND_PUBLIC_ORIGIN`) | Backend URL |
| **Cloudflare Tunnel** | service ที่เปิดเผย dev Backend/Frontend ที่ `*.hayateotsu.space` บน internet สาธารณะ | ngrok, reverse proxy |

---

## ความกำกวมที่ควรระวัง

- **"Episode" vs "Chapter"**: ฟังก์ชัน `translateMangaEpisode` และ UI copy "แปลทั้งตอน" ใช้ "episode"; route parameter และ database key ใช้ `chapterId` คำ canonical คือ **Chapter** ในโค้ดและการพูดคุยทางเทคนิคทั้งหมด

- **"taskId" vs "Job Key"**: MIT รับ `taskId` ใน form payload (ซึ่งเท่ากับ **Job Key**) ภายในฝั่ง Backend ใช้ `jobKey` เสมอ ทั้งสองอ้างถึงค่าเดียวกัน — ใช้ **Job Key** ในการสนทนา

- **"MIT Callback Origin" vs "Backend Public Origin"**: `BACKEND_PUBLIC_ORIGIN` เป็น URL สาธารณะสำหรับ URL รูปภาพที่เข้าถึงจาก browser `MIT_CALLBACK_ORIGIN` เป็น URL ที่ MIT ใช้สำหรับ **MIT Webhooks** — สองอย่างนี้อาจต่างกันได้ (เช่น `localhost:4001` เมื่อ MIT รันบนเครื่องเดียวกัน)
<!-- lang:end -->
