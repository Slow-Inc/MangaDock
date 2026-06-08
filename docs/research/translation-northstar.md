<!-- lang:th -->
# North Star: แปลให้เหมือนคนแปลมากที่สุด

> ตั้งเป็นทิศทางสาย translation pipeline เมื่อ 2026-06-08
> **"ทำให้ผลแปลใกล้เคียงนักแปลมนุษย์มากที่สุด คุณภาพสูงสุด — ยอมเพิ่มความซับซ้อนเฉพาะจุดที่คุ้ม"**

## คลี่ความขัดแย้งกับ Engineering North Star เดิม (CLAUDE.md)

CLAUDE.md บอก "logic เรียบง่ายที่สุด · ลบความซับซ้อน" — ฟังดูขัด แต่ **คนละ scope**:

| | คุมอะไร | กฎ |
|---|---|---|
| **CLAUDE.md north star** | โครงสร้างโค้ด/สถาปัตยกรรม (service, plumbing, state) | เรียบง่ายเสมอ ลบความซับซ้อน |
| **North star นี้** | คุณภาพ output การแปล (detection/OCR/sizing/context) | ยอมเพิ่ม stage/โมเดล/ML ถ้ายกคุณภาพจริง |

**กฎประนีประนอม — ความซับซ้อนเชิงคุณภาพต้องห่อด้วยโครงสร้างเรียบง่าย:**
1. โมเดล/stage ใหม่อยู่หลัง **registry seam เดิม** (ไม่รื้อ pipeline)
2. **opt-in env** — ปิด = byte-identical กับวันนี้
3. logic การตัดสินใจเป็น **pure helper เทสต์ได้** (ไม่ลาก ML)
4. **วัดผล before/after จริง**บนหน้าอ้างอิง — ไม่เพิ่มเพราะ "น่าจะดี"
5. คุ้ม **VRAM/latency/ต้นทุน** บนเครื่องจริง (12GB co-residency)

→ "complexity for its own sake" ยังห้ามเหมือนเดิม; "complexity ที่ยกคุณภาพแบบวัดได้ + ห่อดี" คืออนุญาต

## "เหมือนคนแปล" ย่อยเป็นมิติอะไรบ้าง

คนแปลมังงะทำสิ่งเหล่านี้ — แต่ละข้อ map กับสภาพเรา ([[pipeline-baseline]]) และเป้าหมาย ([[mangatranslator-internals]]):

| มิติที่คนทำ | เราตอนนี้ | issue/แผน |
|---|---|---|
| **เห็นภาพ ไม่ใช่แค่ข้อความ** (เข้าใจฉาก/อารมณ์/ผู้พูด) | ส่งแต่ text ให้ LLM | multimodal OCR (ส่งภาพ crop+ทั้งหน้า) — idea backlog |
| **อ่านทั้งตอน/ทั้งเรื่องก่อนแปล** (สรรพนาม, callback) | series context (#157✓) + rolling page (#159) | PRD #155 |
| **จำ glossary + เสียงตัวละคร** (ชื่อ→ทับศัพท์, น้ำเสียงคงที่) | mit_glossary.txt มีแต่ยังไม่ feed | #160/#161 + glossary ที่มีอยู่แล้ว |
| **เห็นบับเบิล จัดขนาดตัวอักษรให้พอดี-สวย** | fit textline box → จิ๋ว/ล้น | #170 (bubble mask) → #166 (sizing) |
| **แปล SFX/เสียงประกอบ** | detect ไม่เจอ ทิ้งไว้ | #168 |
| **คงการเน้น** (ตัวหนา/เอียง/ตะโกน) | ทิ้ง emphasis หมด | idea backlog (emphasis markers) |
| **ตรวจทานรอบสอง** (QA จับ hallucination/ผิดบริบท) | post-translation check (ตัวซ้ำ+สัดส่วนภาษา) เปิดอยู่ | มีบางส่วน — proofread เชิงความหมายยังไม่มี issue |
| **honorific/วัฒนธรรม** (-kun→-คุง, นาย/คุณ) | LLM เดาเอง | glossary (#160) หรือ instruction ใน gpt_config |

## 2 PRD ที่ขับ north star นี้

- **PRD #155** — context-aware (เห็นบริบท: series/rolling/memory) → "อ่านทั้งเรื่องเหมือนคนแปล"
- **PRD #169** — SFX & display-text fidelity (#170→#168→#166→P3) → "เห็นภาพ+จัดตัวอักษรเหมือนคนแปล"

มิติที่**ยังไม่มี PRD/issue** (ผู้สมัครงานอนาคต): multimodal OCR, emphasis markers end-to-end, semantic proofread pass

---

<!-- lang:en -->
# North Star: translate as close to a human translator as possible

> Set 2026-06-08 as the direction for the translation pipeline.
> **"Get the output as close to a human translator as possible, highest quality — accept added complexity only where it pays off."**

## Resolving the tension with the existing Engineering North Star (CLAUDE.md)

CLAUDE.md says "simplest logic that works · remove complexity." This looks contradictory but the **scope differs**: that north star governs **code structure / architecture** (service, plumbing, state) — still always simple. This one governs **translation output quality** (detection/OCR/sizing/context) — added stages/models/ML are acceptable when they measurably raise quality.

**Reconciliation rule — quality complexity must be wrapped in simple structure:**
1. New model/stage behind the **existing registry seam** (no pipeline rewrite).
2. **Env opt-in** — disabled = byte-identical to today.
3. Decision logic as a **pure, testable helper** (no ML imports).
4. **Measured before/after** on reference pages — never added on a hunch.
5. Pays its way in **VRAM/latency/cost** on the real box (12 GB co-residency).

"Complexity for its own sake" stays banned; "measured-quality complexity, well-wrapped" is allowed.

## Decomposing "like a human translator"

| What a human does | Us today | Issue/plan |
|---|---|---|
| Sees the art, not just text (scene, mood, speaker) | text-only to LLM | multimodal OCR — backlog |
| Reads the whole chapter/series first (pronouns, callbacks) | series context (#157✓) + rolling (#159) | PRD #155 |
| Keeps a glossary + character voice | glossary file exists, not fed | #160/#161 |
| Sees the balloon, sizes lettering to fit naturally | fit-to-textline → tiny/overflow | #170 → #166 |
| Translates SFX | not detected | #168 |
| Preserves emphasis (bold/italic/shout) | emphasis dropped | backlog (emphasis markers) |
| Proofreads (catch hallucination/context errors) | repetition + lang-ratio check ON | partial — semantic proofread = no issue yet |
| Honorifics/cultural register | LLM guesses | glossary (#160) / gpt_config instruction |

## The two PRDs driving this

- **PRD #155** context-aware (see context) → "reads the whole story like a translator."
- **PRD #169** SFX & display-text fidelity (#170→#168→#166→P3) → "sees the art & sets type like a translator."

Dimensions with **no PRD/issue yet** (future candidates): multimodal OCR, end-to-end emphasis markers, a semantic proofread pass.
