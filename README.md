<!-- lang:en -->
# MangaDock

<p align="center"><b>Read manga that has no Thai edition.</b> AI translates the text inside each page and sets the Thai back into the speech bubbles, right in the reader.<br>
<a href="https://hayateotsu.space">Live site</a> · <a href="https://hayateotsu.space/docs">Docs portal</a> · <a href="https://hayateotsu.space/docs/simulations">System simulations</a></p>

![An English page and the same page translated to Thai by MangaDock](docs/images/readme-en-th.png)

| | measured |
|---|---|
| Translation server, multi-GPU | 22 s → **4.36 s per page** (5 workers, −80 %) |
| A whole episode, translated async | first page readable at **~14 s** instead of ~43 s (14 pages) |
| Where a page's time goes | **83 %** is the LLM call (11.05 of 13.4 s); GPU work is ~17 % |
| Thai layout match (One-Punch Man pages) | **40–50 % → 90–95 %** with word-aware line breaking |
| Cache leader crash | stuck dirty queue **38 s → 17 s** |
| Tests passing | 1,014 backend (98 suites) · 235 mobile · 169 cache |

<sub>Measured on an RTX 4070 SUPER 12 GB + RTX 5060 Ti 16 GB, benchmarks of 2026-10-25 to 2026-10-27 in <code>docs/reports/benchmarks/</code>.</sub>

## What it is

A manga reading platform with in-page AI translation (English → Thai is the main pair), a community forum, a creator studio for translators and publishers, a coin wallet and an Android app. It started as MIT, a translator we wrote because the series we wanted had no Thai edition; MangaDock turns it into a place to read, where a page is translated while you read the one before it.

Built by [T4 Labs](https://github.com/Slow-Inc) as a Special Project, Mathematics for Computer Science, Faculty of Applied Science, KMUTNB (academic year 2569): วรลภย์ ดอกคำ and ธีรุตม์ ดอกกฐิน, advised by Assoc. Prof. Dr. กนกวรรณ สิทธิเถกิงเกียรติ.

## How a page is translated

| # | stage | how |
|---|---|---|
| 1 | Detect | DBNet finds text, YOLOv8-seg finds the bubbles, AnimeText finds sound effects |
| 2 | Group | lines merged per bubble, read right-to-left, top-to-bottom |
| 3 | OCR | 48px OCR first; Hayai and a vision LLM recover handwriting and misreads |
| 4 | Translate | an LLM, one request per page; a glossary keeps names consistent; Pipeline Doctor checks every segment came back |
| 5 | Inpaint | LaMa on every page; FLUX.2 Klein only where the background is complex (hair, line art) |
| 6 | Render | Thai word segmentation (newmm), the largest font that fits, edges drawn at 4× and scaled down |

- **Patches, not pages.** Only the translated regions are sent, as PNG patches with coordinates normalised to 0–1, so they land in place at any screen size and every pixel outside the mask stays the original.
- **Async episodes.** The backend sends the uncached pages to MIT, gets `202 Accepted`, and each page arrives by webhook and reaches the reader over SSE as soon as it is done.
- **Translate once, share with everyone.** L1 in-process, L2 Redis as the source of truth, L3 disk as backup; a leader holds a Redis lock (12.5 s lease, renewed every 5 s) and flushes the dirty queue.
- **Coins that cannot be charged twice.** An unlock runs in one SQL function (`ON CONFLICT` → `already_unlocked`); Xendit top-ups are HMAC-checked, re-verified with Xendit, and unique per reference.

## Repository layout

MangaDock is split into 3 main parts:

1. Frontend: Next.js web app
2. Backend: NestJS API and orchestration layer
3. MIT: Manga Image Translator microservice for image translation

The repository also includes `Mobile/`, a React Native WebView shell for the existing web app. It keeps the web UI as the main experience while handling Google/Facebook OAuth through the native auth session, which avoids WebView popup/login limitations.

The root of this repository contains a `docker-compose.yml` for running the Redis instance used by the backend.

## Services and Default Ports

| Service | Path | Default URL |
|---|---|---|
| Frontend | `Frontend/` | `http://localhost:4000` |
| Backend | `Backend/` | `http://localhost:4001` |
| MIT | `MIT/` | `http://localhost:5003` |
| Mobile | `Mobile/` | Expo/Android development build |
| Redis | root `docker-compose.yml` | `localhost:6379` |

## Prerequisites

- Node.js and bun for Frontend and Backend
- Python environment for MIT
- Docker Desktop or Docker Engine if you want to run Redis or MIT via Docker
- Supabase project (URL + Service Role Key) for the backend

## Recommended Startup Order

1. Start Redis
2. Start MIT
3. Start Backend
4. Start Frontend

## Quick Start

### 1. Start Redis

From the root of the repository:

```bash
docker compose up -d
```

The compose file at root is for Redis only.

### 2. Setup and Start MIT

Go to the `MIT/` folder.

The easiest way to run on Windows locally:

```bat
run-server.bat
```

MIT will open at `http://localhost:5003`

Verify with:

```bash
curl http://localhost:5003/health
```

For more details see [MIT/README.md](MIT/README.md)

### 3. Setup and Start Backend

Go to the `Backend/` folder.

Install dependencies:

```bash
bun install
```

Create `.env` from template:

```bash
cp .env.example .env
```

Then fill in at least the following values:

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

# Supabase (Auth + Database) — see Supabase Dashboard → Project Settings → API
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Run the backend:

```bash
bun run start:dev
```

For more details see [Backend/README.md](Backend/README.md)

> **Debug tip:** when translations replay a stale result, run `npm run cache:reset` in `Backend/` to wipe the translated-patch caches (Redis + L3 disk + `uploads/patches`), then restart the backend. See [Backend/README.md](Backend/README.md#debugging--ล้าง-translated-patch-cache).

### 4. Setup and Start Frontend

Go to the `Frontend/` folder.

Install dependencies:

```bash
bun install
```

Create `.env` from template:

```bash
cp .env.example .env
```

Set the backend URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4001
```

Run the frontend:

```bash
bun run dev
```

Frontend runs at `http://localhost:4000`

For more details see [Frontend/README.md](Frontend/README.md)

### 5. Setup and Start Mobile

Go to the `Mobile/` folder.

Install dependencies:

```bash
npm install
```

Create `.env` from template and point it at the running frontend:

```bash
cp .env.example .env
```

For Android emulator use:

```env
EXPO_PUBLIC_WEB_URL=http://10.0.2.2:4000
```

For a physical device, use your LAN IP instead of `localhost`.

Run the Android development build:

```bash
npm run android
```

For OAuth, add `mangadock://auth/callback` to Supabase Auth redirect URLs. For more details see [Mobile/README.md](Mobile/README.md).

## Verification Checklist

After starting all services, verify at minimum:

1. Frontend accessible at `http://localhost:4000`
2. Backend responding at `http://localhost:4001`
3. MIT health check passes at `http://localhost:5003/health`
4. Backend connected to Redis at `localhost:6379`
5. Backend connected to Supabase (verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`)
6. Mobile development build opens the frontend WebView and native OAuth returns to `mangadock://auth/callback`

## Continuous Integration

GitHub Actions runs the unit suites on every PR from one workflow, `.github/workflows/ci.yml`, whose jobs are path-filtered and which ends in a single required `gate` check. [ADR 020](docs/adr/020-ci-test-gates.md) records the original decision (partly superseded, see its status line); `DONE.md` ("CI gates made real") records what replaced it.

| Job | What it runs |
|---|---|
| `backend (jest)` | `bun install` + `jest` on **Node 22** + a Redis service (`jest.ci.config.js`) |
| `frontend (bun test)` | `bun test` |
| `mobile (typecheck)` | mobile typecheck |
| `pytest (logic gate, torch-free)` | MIT logic suite without torch — **blocking**; heavy modules are skipped by `MIT/test/conftest.py` (#359) |
| `pytest (heavy ML, report-only)` | MIT suites that need the ML stack — `continue-on-error`, never blocks |
| `scripts (node --test)` | repo scripts |
| `gate` | the one required check: fails if any blocking job above failed |

**Run Backend tests locally on Node 22** (Jest 30 does not support Node 26):

```bash
cd Backend
npx jest -c jest.ci.config.js --runInBand   # the exact CI command
```

`jest.ci.config.js` inherits the `jest` block from `package.json` and adds a skip-list of documented pre-existing failures (#358) so the gate is green; remove an entry as its suite is fixed.
<!-- lang:end -->

<!-- lang:th -->
# MangaDock

<p align="center"><b>อ่านมังงะที่ไม่มีฉบับภาษาไทยได้ทันที</b> AI แปลข้อความในภาพแต่ละหน้า แล้ววางคำแปลไทยกลับลงในกรอบคำพูด ตรงในหน้าอ่านเลย<br>
<a href="https://hayateotsu.space">เว็บที่ใช้งานจริง</a> · <a href="https://hayateotsu.space/docs">Docs portal</a> · <a href="https://hayateotsu.space/docs/simulations">Simulation ของระบบ</a></p>

![หน้าต้นฉบับภาษาอังกฤษ และหน้าเดียวกันที่ MangaDock แปลเป็นภาษาไทย](docs/images/readme-en-th.png)

| | ผลที่วัดได้ |
|---|---|
| เซิร์ฟเวอร์แปล แบบ Multi-GPU | 22 วินาที → **4.36 วินาทีต่อหน้า** (5 worker, −80 %) |
| แปลทั้งตอนแบบ Async | อ่านหน้าแรกได้ที่ **~14 วินาที** แทนการรอ ~43 วินาที (ตอน 14 หน้า) |
| เวลาต่อหน้าหมดไปที่ไหน | **83 %** อยู่ที่การเรียก LLM (11.05 จาก 13.4 วินาที) ส่วนที่ใช้ GPU ราว 17 % |
| ความตรงของการจัดวางภาษาไทย (หน้า One-Punch Man) | **40–50 % → 90–95 %** ด้วยการตัดบรรทัดตามคำ |
| Leader ของ Cache ล่ม | Dirty Queue ค้าง **38 → 17 วินาที** |
| ชุดทดสอบที่ผ่าน | Backend 1,014 รายการ (98 suites) · Mobile 235 · Cache 169 |

<sub>วัดบน RTX 4070 SUPER 12 GB + RTX 5060 Ti 16 GB จาก benchmark วันที่ 2026-10-25 ถึง 2026-10-27 ใน <code>docs/reports/benchmarks/</code></sub>

## MangaDock คืออะไร

แพลตฟอร์มอ่านมังงะที่แปลข้อความในภาพด้วย AI (คู่ภาษาหลักคืออังกฤษ → ไทย) พร้อมฟอรัมชุมชน Creator Studio สำหรับนักแปลและผู้เผยแพร่ ระบบเหรียญ และแอป Android จุดเริ่มต้นคือ MIT ระบบแปลที่เราเขียนเองเพราะเรื่องที่อยากอ่านไม่มีฉบับไทย แต่ใช้ยาก MangaDock จึงทำให้เป็นที่อ่านในที่เดียว และแปลหน้าถัดไประหว่างที่ผู้อ่านอ่านหน้าก่อนหน้าอยู่

พัฒนาโดย [T4 Labs](https://github.com/Slow-Inc) เป็นโครงงานพิเศษ สาขาวิชาคณิตศาสตร์เชิงวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ประยุกต์ มจพ. ปีการศึกษา 2569 คณะผู้จัดทำ วรลภย์ ดอกคำ และธีรุตม์ ดอกกฐิน อาจารย์ที่ปรึกษา รศ.ดร.กนกวรรณ สิทธิเถกิงเกียรติ

## การแปลหนึ่งหน้า

| # | ขั้น | วิธี |
|---|---|---|
| 1 | Detect | DBNet หาข้อความ, YOLOv8-seg หากรอบคำพูด, AnimeText หา SFX |
| 2 | Group | รวมบรรทัดในกรอบเดียวกัน เรียงขวา→ซ้าย บน→ล่าง |
| 3 | OCR | ใช้ OCR 48px เป็นหลัก แล้วให้ Hayai กับ Vision-LLM กู้ตัวเขียนมือและคำที่อ่านผิด |
| 4 | Translate | แปลด้วย LLM ส่งทั้งหน้าในคำขอเดียว ใช้ Glossary คุมชื่อเฉพาะ และ Pipeline Doctor ตรวจว่าได้คำแปลครบทุก segment |
| 5 | Inpaint | ลบข้อความด้วย LaMa ทุกหน้า ใช้ FLUX.2 Klein เฉพาะจุดที่พื้นหลังซับซ้อน (เส้นผม ลายเส้น) |
| 6 | Render | ตัดคำไทยด้วย newmm เลือกขนาดตัวอักษรใหญ่ที่สุดที่พอดีกรอบ วาดบน Canvas ใหญ่ 4 เท่าแล้วย่อเพื่อให้ขอบคม |

- **ส่ง Patch ไม่ใช่ทั้งหน้า** ส่งเฉพาะบริเวณที่แปลเป็น PNG พร้อมพิกัดสัดส่วน 0–1 จึงวางตรงที่เดิมได้ทุกขนาดจอ และพิกเซลนอก mask เหมือนต้นฉบับทุกไบต์
- **แปลทั้งตอนแบบ Async** Backend ส่งเฉพาะหน้าที่ยังไม่มีใน cache ให้ MIT ซึ่งตอบ `202 Accepted` ทันที หน้าไหนแปลเสร็จก็ส่งกลับผ่าน webhook และถึงผู้อ่านผ่าน SSE
- **แปลครั้งเดียว ผู้อ่านทุกคนใช้ร่วมกัน** L1 อยู่ใน process, L2 Redis เป็นแหล่งข้อมูลหลัก, L3 Disk เป็นสำรอง โดยมี Leader ถือ Redis lock (อายุ 12.5 วินาที ต่ออายุทุก 5 วินาที) คอย flush Dirty Queue
- **หักเหรียญซ้ำไม่ได้** การปลดล็อกทำใน SQL function เดียว (`ON CONFLICT` → `already_unlocked`) การเติมเหรียญผ่าน Xendit ตรวจ HMAC ถาม Xendit ซ้ำว่าจ่ายจริง และ reference ต้องไม่ซ้ำ

## โครงสร้าง Repository

MangaDock เป็นระบบที่แยกออกเป็น 3 ส่วนหลัก:

1. Frontend: Next.js web app
2. Backend: NestJS API และ orchestration layer
3. MIT: Manga Image Translator microservice สำหรับงานแปลภาพ

Repository นี้มี `Mobile/` เพิ่มเติม เป็น React Native WebView shell สำหรับหุ้ม web app เดิม โดยยังใช้ UI เว็บเป็นหลัก แต่ให้ Google/Facebook OAuth ทำงานผ่าน native auth session เพื่อเลี่ยงข้อจำกัด popup/login ใน WebView

ที่ root ของ repository นี้มี `docker-compose.yml` สำหรับรัน Redis ที่ backend ใช้งานเป็น cache

## Services และ Port เริ่มต้น

| Service | Path | URL เริ่มต้น |
|---|---|---|
| Frontend | `Frontend/` | `http://localhost:4000` |
| Backend | `Backend/` | `http://localhost:4001` |
| MIT | `MIT/` | `http://localhost:5003` |
| Mobile | `Mobile/` | Expo/Android development build |
| Redis | root `docker-compose.yml` | `localhost:6379` |

## ข้อกำหนดเบื้องต้น

- Node.js และ bun สำหรับ Frontend และ Backend
- Python environment สำหรับ MIT
- Docker Desktop หรือ Docker Engine ถ้าต้องการรัน Redis หรือ MIT ผ่าน Docker
- Supabase project (URL + Service Role Key) สำหรับ backend

## ลำดับการเริ่มต้นที่แนะนำ

1. รัน Redis
2. รัน MIT
3. รัน Backend
4. รัน Frontend

## Quick Start

### 1. เริ่ม Redis

ที่ root ของ repository:

```bash
docker compose up -d
```

ไฟล์ compose ที่ root ใช้สำหรับ Redis เท่านั้น

### 2. ตั้งค่าและเริ่ม MIT

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

รายละเอียดเพิ่มเติมดู [MIT/README.md](MIT/README.md)

### 3. ตั้งค่าและเริ่ม Backend

เข้าโฟลเดอร์ `Backend/`

ติดตั้ง dependencies:

```bash
bun install
```

สร้าง `.env` จาก template:

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

# Supabase (Auth + Database) — ดูจาก Supabase Dashboard → Project Settings → API
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

รัน backend:

```bash
bun run start:dev
```

รายละเอียดเพิ่มเติมดู [Backend/README.md](Backend/README.md)

> **Debug tip:** ถ้าการแปล replay ผลเก่า ให้รัน `npm run cache:reset` ใน `Backend/` เพื่อล้าง translated-patch cache (Redis + L3 disk + `uploads/patches`) แล้ว restart backend ดู [Backend/README.md](Backend/README.md#debugging--ล้าง-translated-patch-cache)

### 4. ตั้งค่าและเริ่ม Frontend

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

### 5. ตั้งค่าและเริ่ม Mobile

เข้าโฟลเดอร์ `Mobile/`

ติดตั้ง dependencies:

```bash
npm install
```

สร้าง `.env` จาก template แล้วชี้ไปที่ frontend ที่กำลังรัน:

```bash
cp .env.example .env
```

สำหรับ Android emulator ใช้:

```env
EXPO_PUBLIC_WEB_URL=http://10.0.2.2:4000
```

สำหรับเครื่องจริง ให้ใช้ LAN IP แทน `localhost`

รัน Android development build:

```bash
npm run android
```

สำหรับ OAuth ให้เพิ่ม `mangadock://auth/callback` ใน Supabase Auth redirect URLs รายละเอียดเพิ่มเติมดู [Mobile/README.md](Mobile/README.md)

## Checklist ตรวจสอบ

หลังจาก start ครบทุก service แล้ว ควรตรวจสอบขั้นต่ำดังนี้:

1. Frontend เปิดได้ที่ `http://localhost:4000`
2. Backend ตอบสนองที่ `http://localhost:4001`
3. MIT health check ผ่านที่ `http://localhost:5003/health`
4. Backend เชื่อม Redis ได้ที่ `localhost:6379`
5. Backend เชื่อม Supabase ได้ (ตรวจสอบ `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY`)
6. Mobile development build เปิด frontend WebView ได้ และ native OAuth กลับมาที่ `mangadock://auth/callback`
<!-- lang:end -->
