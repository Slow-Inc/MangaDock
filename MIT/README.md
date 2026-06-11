# Manga Image Translator Microservice

ไมโครเซอร์วิส HTTP สำหรับแปลภาพและมังงะ  
รับรูปภาพเข้าไป ประมวลผลผ่าน translation pipeline แบบเต็มชุด และส่งผลลัพธ์กลับผ่าน REST API

พัฒนาต่อยอดจาก [`zyddnys/manga-image-translator`](https://github.com/zyddnys/manga-image-translator) โดยตัดส่วนที่ไม่จำเป็นออก, Optimized(เพิ่ม Crop text region + Process only region + Queue Management)และจัดรูปแบบใหม่ให้ใช้งานเป็น service แยกได้โดยตรง  
ทุกโปรเจกต์ที่เรียก HTTP ได้สามารถใช้งาน service นี้ได้ โดย MetaBooks เป็นเพียงหนึ่งในผู้ใช้งานเท่านั้น

## สถาปัตยกรรม

```text
┌──────────────────────────┐
│ HTTP Client (ทุกระบบ)    │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│ server/main.py (FastAPI) │  Port 5003
│ - จัดการ REST API        │
│ - จัดการคิวงาน           │
│ - ควบคุม worker          │
└────────────┬─────────────┘
             │
     ┌───────▼────────┐
     │ Worker Process │  Port 5004
     │ (shared mode)  │
     │ ML pipeline    │
     └────────────────┘
```

**หมายเหตุเรื่อง Port:** Port 5003 คือ FastAPI server ที่รับ request จากภายนอก Port 5004 คือ worker process ที่รัน ML pipeline จริงๆ โดย server จะ **spawn worker อัตโนมัติ** ตอนเริ่มต้น (`port + 1` ของ port ที่ตั้งไว้) ไม่ต้องเปิด port นี้เองหรือตั้งค่าเพิ่มเติม ถ้าเห็น log `Uvicorn running on http://0.0.0.0:5004` แสดงว่า worker พร้อมทำงานแล้ว และเป็นพฤติกรรมปกติ

ลำดับการทำงานหลักของ pipeline คือ detection → OCR → translation → inpainting → rendering

## โครงสร้างไดเรกทอรี

```text
server/            FastAPI app, endpoint ต่าง ๆ, และการจัดการ worker
manga_translator/  แกนหลักของ translation pipeline และโมเดล ML
front/             UI สำหรับทดสอบผ่านเบราว์เซอร์ (ไม่บังคับ)
examples/          ตัวอย่าง request/config และรูปแบบ response
fonts/             ฟอนต์ที่ใช้ในการเรนเดอร์ข้อความ
dict/              dictionary ก่อนและหลังการแปล
models/            model weights ที่ดาวน์โหลดตอน runtime
result/            ไฟล์ผลลัพธ์ที่สร้างจากการแปล
test/              unit tests
```

## เริ่มต้นใช้งานอย่างรวดเร็ว

### Windows แบบ local

```bat
run-server.bat
```

ตัว launcher รองรับ environment variables เพื่อให้ย้ายไปรันอีกเครื่องได้ง่ายขึ้น เช่น:

```bat
set MIT_HOST=0.0.0.0
set MIT_PORT=5003
set MIT_USE_GPU=1
set MIT_PYTHON=C:\python-envs\mit\Scripts\python.exe
run-server.bat
```

### รันเองโดยตรง

```bash
python server/main.py --host 0.0.0.0 --port 5003 --use-gpu --start-instance
```

### Worker lifecycle (โมเดลสองพอร์ต) — #193

`--start-instance` รันสองโปรเซส: **front server** บน `--port` (เช่น 5003) และ **worker** บน `port+1` (5004) front รับ HTTP แล้ว dispatch งานให้ worker (worker bind `127.0.0.1` เท่านั้นด้วยเหตุผลความปลอดภัย #103)

**Restart ต้องปิดทั้งสองพอร์ต** — kill แค่ front (5003) จะทิ้ง worker (5004) ค้าง (orphan) ที่ยังเสิร์ฟโค้ดเก่าต่อ:

```powershell
# Windows: ปิดทั้ง front + worker
Get-NetTCPConnection -LocalPort 5003,5004 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

front จะ cleanup worker ให้เองเมื่อปิดแบบ **graceful** (Ctrl+C / SIGTERM — ผ่าน `atexit` + signal handler + `__main__` finally) แต่ **force-kill (`-Force` / SIGKILL) จับไม่ได้** จึงต้องปิดทั้งสองพอร์ตเองในกรณีนั้น

ถ้าพอร์ต worker (5004) ถูกใช้อยู่แล้วตอนสตาร์ท front จะ **fail ทันทีพร้อมข้อความชัดเจน** (เดิมจะค้างรอ `/register` ที่ไม่มีวันมา):

```
RuntimeError: MIT worker port 5004 is already in use - ... a restart must free BOTH ...
```

แปลว่ามี worker เก่า orphan ค้างอยู่ — ปิดมันก่อน (คำสั่งด้านบน) แล้วสตาร์ทใหม่ ตอน front สตาร์ทจะ print PID ของทั้ง front + worker ไว้ให้ตามเก็บได้

> เช็คความพร้อมด้วย `http://127.0.0.1:5003/ready` (worker พร้อมจริง) ไม่ใช่ `/health` (แค่ front ขึ้น)

### Docker

```bash
# Build
docker build -t manga-image-translator .

# Run with GPU
docker run --gpus all -p 5003:5003 --env-file .env \
  -v ./result:/app/result -v ./models:/app/models \
  manga-image-translator

# หรือใช้ docker-compose
docker compose up -d
```

### รันบนเครื่องอื่นเพื่อแบ่ง workload

แนวทางใช้งานจริง:

1. ติดตั้ง service นี้บนเครื่องแยก
2. เปิดพอร์ตที่ต้องการ เช่น `5003`
3. ตั้งค่า `MANGA_TRANSLATOR_URL` ของ MangaDock backend ให้ชี้ไปยังเครื่องนั้น
4. ถ้าใช้ front utility ให้ตั้ง `MIT_API_TARGET` ให้ชี้ไปยัง service เดียวกัน

ตัวอย่าง:

```env
MANGA_TRANSLATOR_URL=http://10.0.0.25:5003
```

```bash
MIT_API_TARGET=http://10.0.0.25:5003 npm run dev
```

### ตรวจสอบว่า service พร้อมใช้งาน

```bash
curl http://localhost:5003/health
# {"status":"ok","workers":1,"free_workers":1,"busy_workers":0,"queue_size":0}
```

หลังจาก service เริ่มทำงานแล้ว:

| URL | รายละเอียด |
|-----|-------------|
| `http://localhost:5003/` | Web UI สำหรับทดลองแปลแบบ interactive |
| `http://localhost:5003/manual` | หน้า manual สำหรับทดสอบ API |
| `http://localhost:5003/docs` | OpenAPI / Swagger UI |
| `http://localhost:5003/redoc` | เอกสาร API แบบ ReDoc |
| `http://localhost:5003/health` | endpoint สำหรับ health check |

## API Endpoints

### Health และสถานะระบบ

| Method | Path | รายละเอียด |
|--------|------|-------------|
| GET | `/health` | ตรวจสอบสถานะ service, worker, และ queue |
| POST | `/queue-size` | ดูจำนวนงานที่รออยู่ในคิว |

### แปลภาพด้วย JSON body

| Method | Path | Response |
|--------|------|----------|
| POST | `/translate/json` | โครงสร้าง JSON |
| POST | `/translate/bytes` | ข้อมูลแบบ binary |
| POST | `/translate/image` | รูป PNG |
| POST | `/translate/json/stream` | JSON แบบ stream |
| POST | `/translate/bytes/stream` | binary แบบ stream |
| POST | `/translate/image/stream` | PNG แบบ stream |

### แปลภาพด้วย multipart form

| Method | Path | Response |
|--------|------|----------|
| POST | `/translate/with-form/json` | โครงสร้าง JSON |
| POST | `/translate/with-form/bytes` | ข้อมูลแบบ binary |
| POST | `/translate/with-form/image` | รูป PNG |
| POST | `/translate/with-form/patches` | patch รายพื้นที่ |
| POST | `/translate/with-form/patches/batch` | patch แบบ batch ในรูป NDJSON |
| POST | `/translate/with-form/json/stream` | JSON แบบ stream |
| POST | `/translate/with-form/bytes/stream` | binary แบบ stream |
| POST | `/translate/with-form/image/stream` | PNG แบบ stream |
| POST | `/translate/with-form/image/stream/web` | PNG แบบ stream ที่ optimize สำหรับเว็บ |

### แปลภาพแบบ batch

| Method | Path | Response |
|--------|------|----------|
| POST | `/translate/batch/json` | array ของผลลัพธ์ JSON |
| POST | `/translate/batch/images` | ZIP archive |

### จัดการผลลัพธ์

| Method | Path | รายละเอียด |
|--------|------|-------------|
| GET | `/result/{folder}/final.png` | ดึงรูปผลลัพธ์ |
| GET | `/results/list` | ดูรายการโฟลเดอร์ผลลัพธ์ |
| DELETE | `/results/clear` | ลบผลลัพธ์ทั้งหมด |
| DELETE | `/results/{folder}` | ลบผลลัพธ์เฉพาะโฟลเดอร์ |

ดู schema แบบเต็มและลองเรียก API ได้ที่ `/docs`

## ตัวอย่างการใช้งาน

**แปลรูปหนึ่งรูปและรับผลเป็น PNG:**

```bash
curl -X POST "http://localhost:5003/translate/with-form/image" \
  -F "image=@page.jpg" \
  -F 'config={"translator":{"translator":"gemini","target_lang":"THA"}}'
```

**ขอ patch overlay เพื่อไปประกอบฝั่ง client:**

```bash
curl -X POST "http://localhost:5003/translate/with-form/patches" \
  -F "image=@page.jpg" \
  -F 'config={"translator":{"translator":"gemini","target_lang":"THA"},"inpainter":{"inpainter":"lama_large"}}'
```

**ตรวจสอบ health:**

```bash
curl http://localhost:5003/health
# {"status":"ok","workers":1,"free_workers":1,"busy_workers":0,"queue_size":0}
```

## การตั้งค่า

### Environment Variables

service จะโหลด `.env` อัตโนมัติ ให้กำหนด key ตาม translator ที่ใช้งาน:

เริ่มต้นได้ง่ายที่สุดโดย copy `.env.example` เป็น `.env` แล้วค่อยกรอกเฉพาะค่าที่ใช้งานจริง

```env
# Gemini (เส้นทางหลักของ MangaDock)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# OpenAI / Custom OpenAI
OPENAI_API_KEY=
CUSTOM_OPENAI_API_BASE=http://localhost:11434/v1
CUSTOM_OPENAI_MODEL=

# DeepL
DEEPL_AUTH_KEY=
```

### Request Config

ทุกคำขอแปลจะมี `config` ในรูป JSON:

```json
{
  "detector": { "detector": "default", "detection_size": 1536 },
  "translator": { "translator": "gemini", "target_lang": "THA" },
  "inpainter": { "inpainter": "lama_large" },
  "render": { "direction": "auto" }
}
```

### Server Arguments

```text
--host            ที่อยู่สำหรับ bind server (ค่าเริ่มต้น: 0.0.0.0)
--port            port ที่ใช้ listen (ค่าเริ่มต้น: 5003)
--use-gpu         เปิดใช้งาน GPU acceleration
--start-instance  สั่งให้ spawn worker process อัตโนมัติ
--verbose         เปิด debug logging และเก็บ intermediate images
--models-ttl      อายุของ model ในหน่วยวินาที (0 = ค้างไว้ตลอด)
--pre-dict        ไฟล์ dictionary ก่อนการแปล
--post-dict       ไฟล์ dictionary หลังการแปล
```

## การเชื่อมต่อใช้งาน

### เรียกจาก HTTP client ใดก็ได้

```python
import requests

resp = requests.post("http://localhost:5003/translate/with-form/image",
    files={"image": open("page.jpg", "rb")},
    data={"config": '{"translator":{"translator":"gemini","target_lang":"THA"}}'})

with open("translated.png", "wb") as f:
    f.write(resp.content)
```

### เรียกจาก MangaDock (NestJS backend)

กำหนด `MANGA_TRANSLATOR_URL=http://localhost:5003` ในไฟล์ `.env` ของ NestJS  
backend จะเรียก service นี้ผ่าน translation service ใน books module

ถ้า service อยู่คนละเครื่อง ให้เปลี่ยนเป็น URL ของเครื่องปลายทาง เช่น:

```env
MANGA_TRANSLATOR_URL=http://10.0.0.25:5003
```

## การแก้ปัญหาเบื้องต้น

| ปัญหา | วิธีตรวจสอบ / วิธีแก้ |
|-------|------------------------|
| แปลไม่สำเร็จ | ตรวจสอบว่า API key ใน `.env` ตรงกับ translator ที่เลือก |
| คำขอแรกช้า | เป็นพฤติกรรมปกติ เพราะ model จะถูกโหลดครั้งแรก |
| ได้ 500 ตอนเริ่มระบบ | worker อาจยังโหลด model ไม่เสร็จ ควรมี retry logic |
| มีปัญหา GPU | ตรวจสอบ CUDA, driver, และ VRAM |
| health ขึ้นว่า `status: "starting"` หรือ `workers = 0` | worker อาจยังไม่ register, ล้มระหว่างบูต, หรือรันโดยไม่ได้ส่ง `--start-instance` |

ให้ปรับ translator และ target language ตามความต้องการของโปรเจกต์ที่นำไปใช้งาน

## การอ้างอิงต้นทาง

- Upstream repository: `https://github.com/zyddnys/manga-image-translator`
- License: MIT

repository นี้เป็น customized operational build พร้อมชุดเอกสารสำหรับนำ upstream codebase ไปใช้งานในรูปแบบ microservice
