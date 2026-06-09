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

## Translation Pipeline (MIT stages)

The ordered stages **MIT** runs to turn a source **Page** into a **Patch Set**.

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Detection** | Locating the **Text Regions** on a **Page** (DBNet, plus optional **Bubble Segmentation** and **SFX Detection**) | Text finding, box detection |
| **OCR** | Reading the source text out of a detected **Text Region** | Recognition, text extraction |
| **Translation** | Converting a **Text Region's** source text into the **Target Language** via the configured translator | Conversion |
| **Inpainting** | Erasing the original text from the **Page** background so translated text can be drawn cleanly | Cleaning, text removal, redraw |
| **Rendering** | Typesetting the translated text onto the cleaned **Page** — the stage that produces the **Patch** | Drawing, typesetting, compositing |

---

## Page Anatomy

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Text Region** | One detected block of source text (a quadrilateral) — the unit **OCR**, **Translation**, and **Rendering** operate on | Textline, text block, region, box |
| **Speech Balloon** | The drawn bubble shape in the original art that contains **Dialogue** | Bubble (when it could mean **Patch**), word balloon |
| **Dialogue** | Spoken text inside a **Speech Balloon** | Speech, line |
| **SFX** | Stylized onomatopoeia / sound-effect text, usually drawn *outside* **Speech Balloons** | Sound text, onomatopoeia |
| **OSB Text** | Outside-Speech-Bubble text (**SFX** + captions) — the detection category the **AnimeText** model covers | Caption, free text |

---

## Typesetting & Render

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Bubble-fit** | Sizing the rendered font so the translated text fills its **Speech Balloon** (binary-search fit) | Auto-size, area fit |
| **Safe Area** | The **Speech Balloon's** inscribed interior that text wraps to — the **Narrow Column** — instead of the bounding box | Inner box, padding box |
| **Supersampling** | Rendering glyphs at N× then downscaling, for crisp edges and controlled weight | Antialiasing, oversampling |
| **Line Breaking** | Splitting translated text into lines: **Greedy** (current default) vs **Knuth-Plass** (globally balanced) | Wrapping, line wrap |
| **Comic Font** | The comic lettering face used for **ENG** targets (manga convention), e.g. ALL-CAPS | Manga font, EN font |

---

## Pipeline Config

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Knob** | An opt-in `MIT_*` env var that toggles one pipeline behavior; when absent the config is **Byte-identical** | Flag, setting, option |
| **Byte-identical** | A change that produces output indistinguishable from before when its **Knob** is off | No-op, unchanged |
| **Render Parity** | The initiative to bring **MIT's** render quality up to the **MangaTranslator** reference | Quality parity |
| **Benchmark Page** | The canonical One Punch-Man test **Page** used to verify **Render Parity** changes | Test page, sample page |

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
- For each **Page**, **MIT** runs **Detection** → **OCR** → **Translation** → **Inpainting** → **Rendering**, producing the **Patch Set**.
- A **Text Region** may be tagged with a **Speech Balloon**; a balloon-tagged region uses **Bubble-fit** + **Safe Area**, while **SFX** / **OSB Text** regions do not.
- Every **Render Parity** change is gated by a **Knob** and is **Byte-identical** when the **Knob** is off.

---

## Example dialogue

> **Dev:** "The `ぬ〜` **SFX** isn't translating — is **Detection** missing it?"
> **Domain expert:** "No, **SFX Detection** finds it as **OSB Text**, but **OCR** can't read the hand-drawn glyph, so the **Text Region** gets an empty **Translation** and **Rendering** skips it."
> **Dev:** "And the dialogue that overflowed its **Speech Balloon**?"
> **Domain expert:** "That's **Bubble-fit** off — without the **Knob** the renderer wraps to the bounding box, not the **Safe Area**. Turn it on and text wraps to the **Narrow Column** and fills the balloon."
> **Dev:** "Will that change the Thai pages?"
> **Domain expert:** "No — it's **Byte-identical** unless the **Knob** is set, and we proved it on the **Benchmark Page** plus the characterization net."

---

## Flagged ambiguities

- **"Episode" vs "Chapter"**: The function `translateMangaEpisode` and the UI copy "แปลทั้งตอน" use "episode"; route params and database keys use `chapterId`. Canonical term is **Chapter** in all code and technical discussion.

- **"taskId" vs "Job Key"**: MIT receives `taskId` in the form payload (which equals the **Job Key**). Internally the Backend always uses `jobKey`. Both refer to the same value — prefer **Job Key** in discussion.

- **"MIT Callback Origin" vs "Backend Public Origin"**: `BACKEND_PUBLIC_ORIGIN` is the public-facing URL used for browser-accessible image/patch URLs. `MIT_CALLBACK_ORIGIN` is the URL MIT uses for **MIT Webhooks** — these can differ (e.g. `localhost:4001` when MIT is co-located).

- **"Bubble" — Patch vs Speech Balloon**: the original glossary lists "bubble" only as an alias to avoid for **Patch**. But **Speech Balloon** is now a first-class term — the drawn balloon in the original art that **Detection** and **Bubble-fit** reason about. A **Patch** is the *translated overlay image* MIT outputs; a **Speech Balloon** is the *art element*. Never call a **Patch** a "bubble"; use **Speech Balloon** for the art.

- **"Region" / "textline" / "text block"**: all name one detected source-text block. Canonical term is **Text Region**.

- **"Translation" is overloaded**: the **Translation** *stage* (the LLM step), the *result* (a **Patch**), and **Translation Mode** (the UI toggle) are distinct — name the one you mean.
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

## Translation Pipeline (สเตจของ MIT)

ลำดับสเตจที่ **MIT** รันเพื่อเปลี่ยน **Page** ต้นฉบับให้เป็น **Patch Set**

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **Detection** | หาตำแหน่ง **Text Region** บน **Page** (DBNet + ตัวเลือก **Bubble Segmentation** และ **SFX Detection**) | Text finding, box detection |
| **OCR** | อ่านข้อความต้นฉบับออกจาก **Text Region** ที่ตรวจจับได้ | Recognition, text extraction |
| **Translation** | แปลข้อความต้นฉบับของ **Text Region** เป็น **Target Language** ด้วย translator ที่ตั้งไว้ | Conversion |
| **Inpainting** | ลบข้อความเดิมออกจากพื้นหลัง **Page** เพื่อให้วาดข้อความแปลทับได้สะอาด | Cleaning, text removal, redraw |
| **Rendering** | จัดเรียงข้อความแปลลงบน **Page** ที่ลบข้อความเดิมแล้ว — สเตจที่ผลิต **Patch** | Drawing, typesetting, compositing |

---

## Page Anatomy

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **Text Region** | บล็อกข้อความต้นฉบับที่ตรวจจับได้หนึ่งบล็อก (รูปสี่เหลี่ยม) — หน่วยที่ **OCR**, **Translation**, **Rendering** ทำงานด้วย | Textline, text block, region, box |
| **Speech Balloon** | รูปทรงบอลลูนในภาพต้นฉบับที่บรรจุ **Dialogue** | Bubble (เมื่ออาจหมายถึง **Patch**), word balloon |
| **Dialogue** | ข้อความบทพูดภายใน **Speech Balloon** | Speech, line |
| **SFX** | ข้อความเสียงประกอบ (onomatopoeia) ที่วาดแบบมีสไตล์ มักอยู่*นอก* **Speech Balloon** | Sound text, onomatopoeia |
| **OSB Text** | ข้อความนอกบอลลูน (**SFX** + คำบรรยาย) — หมวดที่ตรวจจับด้วยโมเดล **AnimeText** | Caption, free text |

---

## Typesetting & Render

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **Bubble-fit** | ปรับขนาดฟอนต์ให้ข้อความแปลเต็ม **Speech Balloon** (binary-search fit) | Auto-size, area fit |
| **Safe Area** | พื้นที่ภายในที่ inscribe ใน **Speech Balloon** ที่ข้อความ wrap ลงไป — **Narrow Column** — แทนที่จะใช้ bounding box | Inner box, padding box |
| **Supersampling** | render glyph ที่ N× แล้วย่อลง เพื่อขอบคมและคุมน้ำหนักตัวอักษร | Antialiasing, oversampling |
| **Line Breaking** | การตัดข้อความแปลเป็นบรรทัด: **Greedy** (default ปัจจุบัน) vs **Knuth-Plass** (สมดุลทั้งย่อหน้า) | Wrapping, line wrap |
| **Comic Font** | ฟอนต์ comic lettering สำหรับเป้าหมาย **ENG** (convention มังงะ) เช่น ALL-CAPS | Manga font, EN font |

---

## Pipeline Config

| คำ | นิยาม | คำที่ควรหลีกเลี่ยง |
|------|-----------|-----------------|
| **Knob** | env var `MIT_*` แบบ opt-in ที่เปิด/ปิดพฤติกรรมหนึ่งของ pipeline; เมื่อไม่ตั้งค่า config จะ **Byte-identical** | Flag, setting, option |
| **Byte-identical** | การเปลี่ยนแปลงที่ให้ผลลัพธ์แยกไม่ออกจากเดิมเมื่อ **Knob** ของมันปิด | No-op, unchanged |
| **Render Parity** | initiative ยกคุณภาพ render ของ **MIT** ให้เทียบเท่า reference **MangaTranslator** | Quality parity |
| **Benchmark Page** | **Page** ทดสอบมาตรฐาน (One Punch-Man) ที่ใช้ยืนยันการเปลี่ยนแปลง **Render Parity** | Test page, sample page |

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

## ความสัมพันธ์

- **Chapter** มีหนึ่งหรือหลาย **Page**
- สำหรับแต่ละ **Page**, **MIT** รัน **Detection** → **OCR** → **Translation** → **Inpainting** → **Rendering** ได้ผลเป็น **Patch Set**
- **Text Region** อาจถูก tag ด้วย **Speech Balloon**; region ที่ tag แล้วใช้ **Bubble-fit** + **Safe Area** ส่วน **SFX** / **OSB Text** ไม่ใช้
- ทุกการเปลี่ยนแปลง **Render Parity** ถูก gate ด้วย **Knob** และเป็น **Byte-identical** เมื่อ **Knob** ปิด

---

## ตัวอย่างบทสนทนา

> **Dev:** "SFX `ぬ〜` ไม่ถูกแปล — **Detection** พลาดมันหรือเปล่า?"
> **Domain expert:** "ไม่ใช่ **SFX Detection** เจอมันเป็น **OSB Text** แต่ **OCR** อ่าน glyph ที่วาดมือไม่ออก **Text Region** เลยได้ **Translation** ว่าง แล้ว **Rendering** ก็ข้ามมันไป"
> **Dev:** "แล้ว dialogue ที่ล้น **Speech Balloon** ล่ะ?"
> **Domain expert:** "นั่นคือ **Bubble-fit** ปิดอยู่ ถ้าไม่เปิด **Knob** renderer จะ wrap ตาม bounding box ไม่ใช่ **Safe Area** เปิดแล้วข้อความจะ wrap ลง **Narrow Column** และเต็มบอลลูน"
> **Dev:** "แล้วมันจะกระทบหน้าภาษาไทยไหม?"
> **Domain expert:** "ไม่ — มัน **Byte-identical** ถ้าไม่ตั้ง **Knob** และเราพิสูจน์บน **Benchmark Page** + characterization net แล้ว"

---

## ความกำกวมที่ควรระวัง

- **"Episode" vs "Chapter"**: ฟังก์ชัน `translateMangaEpisode` และ UI copy "แปลทั้งตอน" ใช้ "episode"; route parameter และ database key ใช้ `chapterId` คำ canonical คือ **Chapter** ในโค้ดและการพูดคุยทางเทคนิคทั้งหมด

- **"taskId" vs "Job Key"**: MIT รับ `taskId` ใน form payload (ซึ่งเท่ากับ **Job Key**) ภายในฝั่ง Backend ใช้ `jobKey` เสมอ ทั้งสองอ้างถึงค่าเดียวกัน — ใช้ **Job Key** ในการสนทนา

- **"MIT Callback Origin" vs "Backend Public Origin"**: `BACKEND_PUBLIC_ORIGIN` เป็น URL สาธารณะสำหรับ URL รูปภาพที่เข้าถึงจาก browser `MIT_CALLBACK_ORIGIN` เป็น URL ที่ MIT ใช้สำหรับ **MIT Webhooks** — สองอย่างนี้อาจต่างกันได้ (เช่น `localhost:4001` เมื่อ MIT รันบนเครื่องเดียวกัน)

- **"Bubble" — Patch vs Speech Balloon**: glossary เดิมระบุ "bubble" เป็นแค่คำที่ควรเลี่ยงสำหรับ **Patch** แต่ตอนนี้ **Speech Balloon** เป็นคำ first-class แล้ว — คือรูปบอลลูนในภาพต้นฉบับที่ **Detection** และ **Bubble-fit** ใช้คิด **Patch** คือ*รูป overlay ที่แปลแล้ว*ที่ MIT ผลิต ส่วน **Speech Balloon** คือ*องค์ประกอบในภาพ* ห้ามเรียก **Patch** ว่า "bubble"; ใช้ **Speech Balloon** สำหรับองค์ประกอบในภาพ

- **"Region" / "textline" / "text block"**: ทั้งหมดหมายถึงบล็อกข้อความต้นฉบับที่ตรวจจับได้หนึ่งบล็อก คำ canonical คือ **Text Region**

- **"Translation" มีหลายความหมาย**: สเตจ **Translation** (ขั้นตอน LLM), *ผลลัพธ์* (**Patch**) และ **Translation Mode** (toggle บน UI) เป็นคนละอย่าง — ระบุให้ชัดว่าหมายถึงอันไหน
<!-- lang:end -->
