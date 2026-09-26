# MangaDock — Master Presentation Outline (สอบจบ)

> รวม 4 เอกสารเตรียมสอบ (`agentic-workflow-presentation.md`, `mit-presentation-defense.md`,
> `positioning-differentiation-legal.md`, `bug-case-catalog.md`) เป็น**โครงนำเสนอเดียว** — ลำดับสไลด์
> + เวลา + เนื้อหาหลักที่จะพูด เอกสารนี้เป็น "สคริปต์ประกอบ" ไม่ใช่สไลด์เอง — แต่ละหัวข้ออ้างกลับไปที่
> ไฟล์ต้นทางสำหรับรายละเอียดเต็ม เพื่อไม่ต้อง copy ซ้ำ

**สมมติฐานเวลา:** งบเวลานำเสนอ **~25 นาที** (ไม่รวม Q&A) — ปรับสัดส่วนตามเวลาจริงที่ได้รับแจ้งจากกรรมการ
สไลด์ที่ทำเครื่องหมาย **[ตัดได้]** คือจุดแรกที่ควรตัดถ้าเวลาน้อยกว่านี้

**สเกลจริงของโปรเจกต์ (นับจาก `origin/main`, ไม่รวม test เว้นระบุ, 2026-07-04):** Backend ~12,777 บรรทัด
(91 ไฟล์) · Frontend ~29,984 บรรทัด (143 ไฟล์) · MIT ~38,783 บรรทัด source (214 ไฟล์) + 9,400 บรรทัด test
(102 ไฟล์) · รวมแกนหลัก ≈ 81,500 บรรทัด (ไม่รวม test เต็ม/Cloudflare-Worker/vendor fork ที่ดันไปแตะหลักแสน)
· **ADR 30 ฉบับ** กระจายทั้ง 3 service ไม่ใช่แค่ MIT — **ตัวเลขนี้คือเหตุผลที่ต้องมีสไลด์ #4 (Scope & Scale)
ก่อนดำดิ่งเข้า MIT** อย่าให้ Frontend/Backend หายไปเงียบๆ ทั้งที่ Frontend มีโค้ดเยอะกว่า Backend เกือบเท่าตัว

> ⚠️ **สถานะ branch (สำคัญมาก — เช็คก่อนสอบทุกครั้ง):** ตัวเลขข้างต้นนับจาก `origin/main` เพราะ main
> คือสถานะที่ใกล้เคียงของจริงที่สุด (มี Master Plan 2 P0-P9 merge เข้าไปแล้ว) **ไม่ใช่จาก branch
> `perf/mit-layout-fit-and-merge`** ที่ใช้ทำงานเอกสารชุดนี้ — สอง branch diverged กันจริง (origin/main
> นำ 123 commit, perf นำ 25 commit จาก merge-base เดียวกัน) เอกสารสอบทั้ง 5 ไฟล์ในชุดนี้ (รวมไฟล์นี้)
> **ยังอยู่แค่ใน working tree ของ branch `perf/mit-layout-fit-and-merge` แบบยังไม่ commit** ต้อง commit +
> ตัดสินใจว่าจะ merge เข้า main หรือย้ายไปทำต่อบน main โดยตรง ก่อนวันสอบจริง ไม่งั้นเอกสารชุดนี้จะหายไป
> ถ้าสลับไปทำงานบน main เพื่อเตรียม demo · ข่าวดี: L2 hyphenator-memoize optimization (หัวข้อ war-story
> หลักที่เลือกไว้) **มีอยู่บน main แล้วจริง** ผ่าน hotfix แยก (`ce9bfcd8` #496) — เคสนี้ยังใช้ได้ไม่ว่าจะ
> demo จาก branch ไหน · **Simulations Hub** (`Frontend/app/docs/simulations/`) ก็มีอยู่แล้วจริงบน
> branch นี้ (ไม่ใช่แค่ PRD) — เช็คว่า commit เข้า main ครบก่อนสอบเช่นกัน

> 🚨 **Critical corrections จากการสำรวจเอกสารทั้งหมด (2026-07-04) — ต้องรู้ก่อนสอบ ห้ามพูดผิด:**
> 1. **SE_PHASE7 (quality assessment) เป็น template ไม่มีตัวเลขจริง** — ห้ามอ้าง satisfaction score/NFR
>    percentage ใดๆ จากไฟล์นี้เด็ดขาด ถ้าถูกถามให้บอกตรงว่าเป็น process evidence (CMMI/OWASP checklist
>    style) ไม่ใช่ผลสำรวจผู้ใช้จริงที่มี N/คะแนน
> 2. **UML Component/Package/Class diagram เป็น stub บาง ไม่ได้ reverse-engineer จากโค้ดจริง**
>    (`BooksService` โชว์แค่ 4 method, ไม่มี attribute/relationship/cardinality) — ใช้ได้แค่ conceptual
>    overview เท่านั้น ต่างจาก Use Case/Sequence/Deployment diagram ที่ตรงกับพฤติกรรมจริงและใช้ได้เต็มที่
> 3. ~~เอกสารขัดแย้งกันเรื่อง LLM~~ **[แก้แล้ว]** `MIT_SERVICE_OVERVIEW.md` (Gemini) vs `UML_REPORT.md`
>    §6.1/ADR 021 (Qwen 9arm) ไม่ใช่ข้อผิดพลาด — เป็นการสลับ provider ตาม environment โดยตั้งใจ: **Dev
>    Phase ใช้ 9arm (Qwen3.6-35B) เพราะไม่มีค่าใช้จ่าย** ระหว่างพัฒนา/ทดสอบ ส่วน **Production จริงใช้
>    Gemini API** — เป็นเรื่อง cost management ที่ตั้งใจ พูดในสไลด์ #4/#30 ได้เลยว่านี่คือ trade-off
>    ที่คิดมา ไม่ใช่ความไม่สอดคล้องของเอกสาร (แต่ควรอัปเดต `MIT_SERVICE_OVERVIEW_AND_INTEGRATION.md`
>    ให้ระบุทั้งสอง mode ชัดเจนกันกรรมการงงถ้าเปิดอ่านเอง)
> 4. **MIT Master Plan 2 ส่วนใหญ่ยังเป็น planning/open ไม่ใช่ของที่ทำเสร็จ** — ถ้าพูดถึงต้องบอกว่าเป็นแผน
>    ที่มี methodology ที่ดี (deterministic benchmark ผูกกับ defect) ไม่ใช่ผลลัพธ์ที่จบแล้ว
> 5. **R2 Global Asset Distribution**: storage backend (`STORAGE_DRIVER=r2`) เสร็จจริงแล้ว แต่
>    edge-Worker HMAC asset-token layer ที่ PRD อธิบายไว้**ยังไม่ได้ wire** — พูดแยกสองส่วนให้ชัด
> 6. **Account-linking-conflict-resolution และ PRD-en-source-wrap-parity เป็น draft เท่านั้น** ไม่มี
>    commit implementation จริง — อย่าเอามาพูดเป็นของที่ทำเสร็จ

---

## ตารางลำดับสไลด์

| # | หัวข้อ | เวลา | แหล่งเนื้อหา |
|---|---|---|---|
| 0 | Title / ทีม | 0.5 นาที | — |
| 1 | ปัญหา + Product thesis | 1.5 นาที | `positioning-differentiation-legal.md` §0 |
| 2 | Landscape — ใครทำอะไรอยู่บ้าง | 1.5 นาที | `positioning-differentiation-legal.md` §1 |
| 3 | จุดต่างของ MangaDock (thesis) | 1.5 นาที | `positioning-differentiation-legal.md` §2 |
| 4 | System Scope & Scale — ระบบทั้งหมด ก่อนซูมเข้า MIT | 1.5 นาที | ตัวเลขด้านบน + `docs/adr/README.md` + `Documents/SYSTEM_ARCHITECTURE_OVERVIEW.md` |
| **5** | **Live System Simulation Hub — พิสูจน์ ไม่ใช่แค่อ้าง** | **2 นาที** | `Frontend/app/docs/simulations/` + `docs/prd/interactive-flow-simulations.md` |
| 6 | บทบาทนักพัฒนา: Coder → Systems Architect (HITL) | 2.5 นาที | `agentic-workflow-presentation.md` §0, §1 |
| 7 | Multi-Agent Brainstorm Framework **[ตัดได้]** | 1.5 นาที | `agentic-workflow-presentation.md` §2, §2.1, §6 |
| 8 | MIT — pipeline 6 stage (**ทำไมได้เวลาพิเศษ**) | 2 นาที | `mit-presentation-defense.md` §1–2 |
| **9** | **MIT Optimization Month — 1 เดือน ยืนยันด้วย git/PR จริง** | **1.5 นาที** | git log + gh PR data (ด้านล่าง) |
| 10 | Live demo — **simulation ก่อน, GPU จริงเป็น bonus** | 2.5 นาที | `mit-presentation-defense.md` §6 + สไลด์ #5 |
| 11 | Novel vs ไม่ novel (honest framing) | 1.5 นาที | `mit-presentation-defense.md` §3 |
| 12 | Engineering war stories — **กระจายข้าม service** (เลือก 4-5) | 3 นาที | `bug-case-catalog.md` + ดูหัวข้อ "การเลือกเคส" ด้านล่าง |
| 13 | ข้อจำกัด & แผนต่อไป | 1.5 นาที | `mit-presentation-defense.md` §4, `positioning...` §3.3, `agentic-workflow...` §7 |
| 14 | กฎหมาย & โมเดลธุรกิจ **[ตัดได้]** | 1.5 นาที | `positioning-differentiation-legal.md` §5 |
| 15 | Roadmap & ปิดท้าย | 1 นาที | `positioning-differentiation-legal.md` §7 (ข้อ 8), `Documents/Plan/Plan.md` |

รวม ≈ 26.5 นาที (ตัด #7 และ #14 เหลือ ≈ 23.5 นาที ถ้าต้องกระชับ)

---

## เนื้อหาหลักต่อสไลด์ (พูดอะไร ไม่ใช่อ่านทั้งไฟล์)

**#0 Title/ทีม** — เพิ่มบริบทที่เมา Obsidian vault (`project-community-forum.md`): วิชาเดิมชื่อ
**"MetaBooks"**, มหาวิทยาลัย**พระจอมเกล้าพระนครเหนือ (KMUTNB)**, ทีมเดิม 4 คนตอนเริ่ม เหลือ 2 คน
(คุณ = Tech Lead) ตอนทำปีนี้ — พูดสั้นๆ ว่าทีมเล็กลงแต่ scope ไม่ได้เล็กลงตาม (โยงไปสไลด์ #6 เรื่อง
บทบาท HITL ทำไมทีมเล็กแต่ยังรับ scope ขนาดนี้ได้)

**#1 ปัญหา + thesis** — พูดสั้น: manga demand >> licensed-translation supply, piracy เติมช่องว่างแบบไม่มีคุณภาพ/ไม่ถูกกฎหมาย จบด้วยประโยค one-liner จาก positioning §2: *"เราไม่ได้สร้างโมเดลแปลที่ดีกว่า Mantra เราสร้างแพลตฟอร์มอ่าน+แปล+community ที่เปิด on-demand ซึ่งโมเดล B2B แบบ Mantra เป็นไม่ได้"*

**#2 Landscape** — โชว์ตาราง 3 แถวพอ (Mantra/Orange/INKR) + งานวิจัย Hinami 2021 — ปิดด้วย "เราอยู่ตรงไหนที่ไม่มีใครอยู่" (§1 ท้ายตาราง)

**#3 จุดต่าง** — 3 ข้อพอ: on-demand reader-integrated, human-first+AI-fallback, patch-based byte-identical (เกริ่นไว้ก่อนขยายใน #8-10)

**#4 System Scope & Scale** — โชว์ไดอะแกรม 3 service (Frontend/Backend/MIT) พร้อมตัวเลข LOC จริงต่อ service + จำนวน module/ADR ต่อ service **ใช้ตัวอย่างที่เจาะจงแทนคำกว้างๆ** เช่น "Backend cache module เดียวมี 26 ไฟล์ — คือระบบ disaster-recovery (`catastrophic-recovery.service.ts`, `l2-recovery.service.ts`) ไม่ใช่ cache ธรรมดา" / "Payment webhook ตรวจ 2 ชั้น + re-fetch จาก Xendit มา reconcile ก่อนเชื่อ" / "MIT มี TTL reaper ปลด GPU model เองพร้อม bug ที่รู้ตัวและบันทึกไว้ตั้งใจ" — ตัวอย่างจำเพาะแบบนี้น่าเชื่อกว่า "เรามีระบบซับซ้อน" ลอยๆ มาก ปิดสไลด์ด้วยประโยคเชื่อมไปสไลด์ถัดไป: *"ทั้ง 3 service มีวิศวกรรมจริงเบื้องหลัง แต่ที่จะขอเจาะลึกที่สุดคือ MIT เพราะเป็นจุดที่อาจารย์ที่ปรึกษาระบุว่าอยากเห็นรายละเอียด — ไม่ใช่เพราะอีก 2 service ไม่มีอะไรให้พูด และเรามีวิธีพิสูจน์ให้ดูสดๆ ไม่ใช่แค่พูดเฉยๆ ด้วย"* (โยงเข้า #5 ทันที)

**#5 Live System Simulation Hub (สไลด์ใหม่ — ตัวพิสูจน์ scope ที่แรงที่สุด):** เปิดเว็บ `/docs` จริงต่อหน้ากรรมการ ไปที่ tab **Simulations** — คลิกผ่าน scenario สดๆ 2-3 อันจาก 9 domain / 25 scenario ที่มีจริง (Cache Read/Write, Translation, Auth, Chapter Unlock, Real-Time SSE, Asset Serving, Upload, MIT ML Pipeline) แต่ละ scenario แสดง node (Browser/Frontend/Backend/MIT/Supabase/Redis/R2/Worker) ไล่ step พร้อมคำอธิบายสองภาษา **ข้อดีที่ต้องพูดตรงๆ:**
  - ไม่ใช่ live data (hardcoded illustrative) — บอกตรงๆ ว่านี่คือ**เครื่องมือสอนสถาปัตยกรรม** ไม่ใช่การ demo production traffic จริง แต่โครงสร้าง node/flow ตรงกับของจริง
  - **ศูนย์ความเสี่ยง** ต่างจาก live GPU translate (#10) — ไม่ต้องพึ่ง GPU/network เลย เหมาะเป็นจุดเปิดก่อนค่อยลอง live จริง
  - เลือกโชว์ scenario ที่ผูกกับ war-story ใน #12 ได้เลย (เช่น Chapter Unlock "HWID mismatch"/"Insufficient coins" คู่กับเคส Wallet TOCTOU, Upload "Extension spoof" คู่กับเคส MIME spoofing) — เปลี่ยนจาก "เล่าเฉยๆ" เป็น "คลิกให้ดูจริง"
  - ถ้ากรรมการถามว่า "ตรวจสอบได้ยังไงว่าไม่ได้ปั้นมาเฉพาะสอบ" → ชี้ commit history จริง + PRD `docs/prd/interactive-flow-simulations.md` ที่มี Status/testing decision ครบ (unit/integration/E2E ตาม PRD)

**#6 บทบาทนักพัฒนา** — ใช้ reframe เต็มจาก §0: **ห้ามพูด "5%" แล้วจบ** ต้องต่อด้วยประโยค HITL ทันที ดูสคริปต์เต็มใน `agentic-workflow-presentation.md` §0 — ท่องให้ขึ้นใจเพราะเป็นจุดที่กรรมการน่าจะสวนกลับทันทีถ้าพูดไม่ครบ

**#7 Multi-Agent Brainstorm [ตัดได้]** — ถ้ามีเวลา โชว์ diagram จาก §2 + หลักการ 5 ข้อจาก §2.1 แบบย่อ (แค่ Delphi-inspired aggregation + adversarial round พอ ไม่ต้องอ่านครบ 5 ข้อ) ถ้าตัด ให้เอาไปตอบใน Q&A แทนถ้ากรรมการถามว่า "ใช้ AI ตัวเดียวหรือหลายตัว"

**#8 MIT pipeline** — วาด diagram 6 stage จาก §2 พร้อม one-liner ต่อ stage (มีสคริปต์คำต่อคำอยู่แล้วใน mit-presentation-defense.md §2) เปิดด้วยการโยงกลับ #4: "นี่คือ service ที่ใหญ่ที่สุดใน 3 ตัว (~38.8k บรรทัด) และเป็นจุดที่มีนวัตกรรมทางวิศวกรรมที่สุด"

**#9 MIT Optimization Month (สไลด์ใหม่ — หลักฐาน individual contribution ที่แน่นที่สุด):** ยืนยันด้วยตัวเลขจริงจาก git/GitHub ไม่ใช่คำพูดลอยๆ ว่า "ทำงานหนัก":
  - **173 จาก 180 commit ที่เคยแตะ MIT ตลอดประวัติศาสตร์ (96%) เกิดขึ้นใน 35 วันล่าสุด** — 15 วันที่มีการ commit จริง เฉลี่ย ~11.5 commit/วันทำงาน ตรงกับ "8-9 ชม./วัน เกือบเดือน"
  - **45 PR merged เฉพาะ MIT** ในช่วงเดียวกัน (จาก 102 PR merged ทั้งโปรเจกต์ — เกือบครึ่ง) + 225 issue ปิด
  - ครบ 4 มิติพร้อมกัน ไม่ใช่แค่ perf: **Performance** (`perf(MIT): fix render layout_fit — 24x hot path #496`, PNG-write parallelize, torch lazy-import), **Quality** (SFX rescue #168, patch-seam feathering #173, anti-overlap layout, Flux Klein inpainter #277), **Architecture** (`refactor(MIT): remove vendored SD/LDM + ctd/YOLOv5 detector #191, -14.4k LOC`, god-object decompose S2-S26), **Process** (CI gate, deterministic benchmark rule)
  - **จุดที่ดีที่สุดสำหรับพูดเรื่องความซื่อสัตย์**: `revert(MIT): roll back content-shaped patch alpha (#266) — measured ineffective` — ลองทำ feature ใหม่ วัดผลจริงแล้วไม่ดีขึ้น เลย**ถอยเอง** เป็นหลักฐาน "วัดก่อนเชื่อ" ที่แรงกว่าคำพูด เพราะยอม revert งานตัวเอง
  - ปิดด้วย: "นี่คือเหตุผลที่ MIT ได้เวลาเจาะลึกพิเศษในสไลด์นี้ — ไม่ใช่แค่เพราะอาจารย์บอกให้โฟกัส แต่เพราะมันคือจุดที่ลงแรงมากที่สุดจริงๆ วัดได้จาก git ไม่ใช่แค่คำบอกเล่า"

**#10 Live demo — ลำดับใหม่: simulation ก่อน, GPU จริงเป็น bonus:**
  1. เปิด scenario "MIT Full Run" ใน Simulations hub ก่อน (ปลอดภัย 100%, อธิบาย stage detect→ocr→translate→inpaint→render ผ่าน node ที่ highlight ทีละ step)
  2. **ถ้าเวลา/สภาพแวดล้อมเอื้อ** ค่อยต่อด้วย live translate จริงบน pre-warmed cached example (script เดิมใน §6 ของ mit-presentation-defense.md) — **ต้องมี screen-recording backup เสมอ** เพราะ GPU cold-start เสี่ยงพังกลางสอบ (30-40s ถ้า fresh)
  3. การสลับลำดับนี้ทำให้ต่อให้ live GPU demo ล่ม ก็ยังมี "การ demo" ที่ใช้งานได้แล้วจากขั้นตอนที่ 1 ไม่ต้อง improvise หน้ากรรมการ

**#11 Novel vs ไม่ novel** — พูดทั้งสองด้านเสมอ (§3) ปิดด้วยประโยค "เราไม่ได้ประดิษฐ์โมเดล เราวิศวกรรมให้เป็นบริการ" ก่อนกรรมการจะจับได้เอง

**#12 War stories — การเลือกเคส (กระจายข้าม service + ผูกกับ simulation ที่มีจริง):**
  1. **L2 mis-analysis** (`docs/reports/benchmarks/2026-07-03-mit-layout-fit-and-merge-optimize.md` บรรทัด 48) — [MIT/HITL] AI วิเคราะห์ perf ผิด + รอบ AI ค้าน AI ก็ยังผิด จนวัดจริงถึงจับได้
  2. **Wallet double-spend → atomic PostgreSQL RPC** (bug-case-catalog.md A1) — [Backend] TOCTOU บนเงินจริง — **เปิด Chapter Unlock scenario "Insufficient coins"/"HWID mismatch" คู่กันได้เลย** จาก Simulations hub เพื่อโชว์ flow จริง ไม่ใช่แค่เล่า
  3. **Upload MIME spoofing** (bug-case-catalog.md B1) — [Backend security] — **เปิด Upload scenario "Extension spoof (magic-byte reject)" คู่กัน**
  4. **Serena symbolic-edit ทำไฟล์พังเงียบ** (`docs/reports/system-impact-report.md` seam S6) — [Process/HITL] เครื่องมือ AI ทำผิดเงียบๆ จับได้ด้วย grep ทันที
  5. **[ทางเลือกแรง — SFX hallucination cascade]** (ADR 026) — [MIT/AI-causes-AI-bug] AI ตัวหนึ่ง (detector) ทำให้ AI อีกตัว (vision-rescue) หลอนแปลบทพูดจริงเป็น SFX มั่ว: `W`→"party", `THE`→"deafening noise" — ภาพชัดมาก แนะนำใช้แทนเคส #5 เดิมถ้าต้องการความ vivid กว่า (Spoiler-blur/Modal ยังใช้ได้เป็นตัวเลือกสำรอง)

**#13 ข้อจำกัด** — รวม 3 แหล่ง: gap ด้าน translation-accuracy benchmark (mit-presentation-defense.md §4), VRAM trade-off (positioning §3.3), correlated blind spot ของ multi-agent (agentic-workflow-presentation.md §7) — เพิ่ม 1 ข้อใหม่: **Simulations hub เป็น illustrative data ไม่ใช่ live production traffic** — พูดก่อนกรรมการถามเสมอ

**#14 กฎหมาย [ตัดได้]** — พูดแค่ 1 ประโยคสรุปถ้าเวลาน้อย: "โมเดล Webtoon/KDP ไม่ใช่ scanlation รายละเอียดเต็มพร้อมตอบถ้ากรรมการถาม" (§5 มีคำตอบเต็มพร้อม)

**#15 Roadmap** — เอา 2-3 ข้อจาก SWOT "Opportunities" (positioning §6) พอ

---

## Master Q&A Bank (รวมทุกไฟล์ เรียงตามความเสี่ยง)

อ่านเต็มที่ `mit-presentation-defense.md` §5 (คำถามเกี่ยวกับ MIT ทั้งหมดอยู่ที่นั่นแล้ว) เพิ่มเติมเฉพาะคำถามที่ยังไม่มีที่ไหนตอบไว้:

- **"แล้ว contribution ของนักศึกษาคืออะไร ถ้า AI เขียนโค้ด 95%?"** → ตอบด้วย reframe เต็มใน §0 ของ agentic-workflow-presentation.md (Systems Architect + HITL + artifact เป็นหลักฐาน)
- **"ทำไมเน้น MIT อย่างเดียว Backend/Frontend ทำอะไรบ้าง?"** → ชี้กลับสไลด์ #4 (ตัวเลข LOC + ADR จริง) + เปิด Simulations hub (#5) โชว์ domain Auth/Unlock/SSE/Asset/Upload สดๆ + เคส Wallet TOCTOU/MIME spoofing ใน #12
- **"Simulation นี้คือของจริงหรือปั้นมาเฉพาะสอบ?"** → ชี้ git commit history จริง (`e52b7125`, `74364d08`, `ed4a3c06` และอื่นๆ) + PRD ที่มี testing decision ครบ (unit/integration/E2E) — ไม่ใช่ static mockup ทำข้ามคืน
- **"ถ้า `/grill-me` ถามคำถามผิดทิศทางตั้งแต่ต้น จะเกิดอะไรขึ้น?"** → PRD ผิดทิศ → issues ผิดทิศ → แต่ TDD gate ที่ระดับงานย่อยจะจับได้ก่อนถึง merge เพราะ spec แคบพอจะเทียบ pass/fail ชัดเจน (จุดอ่อนที่แท้จริง: ถ้า *สมมติฐาน* เชิงธุรกิจผิดตั้งแต่ PRD TDD จะช่วยไม่ได้ — เป็น gap ที่ควรยอมรับตรงๆ ถ้าถูกไล่ต่อ)
- **"ทำไมเชื่อว่า TDD ป้องกัน hallucination ได้จริง มีหลักฐานไหม?"** → ชี้ไปที่เคส denominator typo (bug-case-catalog.md E3) เป็นตัวอย่างที่ไม่มี test ครอบ aggregate value เลยหลุดผ่าน — คือหลักฐานเชิงลบว่า "ไม่มี TDD gate ตรงไหน AI พลาดตรงนั้น"
- **"ทีมกี่คน ถ้าคนเดียว/สองคน review เอง ไม่มี bias หรือ?"** → ตอบตรงไปตรงตรง (ใส่จำนวนจริงตอนซ้อม) + ชี้ไปที่ correlated blind spot limitation ใน §7 ว่ารู้ตัวว่าเป็นความเสี่ยงที่ยังไม่มี mitigation เป็นระบบ

---

## ภาคผนวก (Backup Deck) — ลึกได้ไม่จำกัดเวลา เปิดเฉพาะตอนถูกถาม

หลักการ: สไลด์หลักด้านบน (~25 นาที) ต้อง**ตื้นพอ**ที่จะครอบทั้งระบบในเวลาที่มี ส่วนความลึกที่โชว์ความเจ๋งจริงๆ
อยู่ที่นี่ — ไม่พูดถ้าไม่มีใครถาม แต่เปิดได้ทันทีถ้าถูกถามตรงจุด จัดเป็น **presenter-mode hyperlink** หรือ
"Appendix" section ท้ายไฟล์สไลด์ พร้อม **สไลด์ index หน้าเดียว** (ลิงก์ไปแต่ละ backup slide) กันหาไม่เจอตอน
ถูกถามสด — **หรือแทนสไลด์ backup หลายอันด้วยการเปิด Simulations hub สดแล้วเลือก domain ที่ถูกถามได้เลย**
เพราะครอบคลุม 9 domain อยู่แล้ว (เร็วกว่าและน่าเชื่อกว่าสไลด์ static)

### Tier 1 — ทำเป็นสไลด์จริง (โอกาสถูกถามสูง, ~15 สไลด์)

**กลุ่ม MIT (จาก mit-presentation-defense.md §5 — เนื้อหาเขียนไว้แล้ว แค่ตัดลงสไลด์):**
1. ทำไม LLM ไม่ใช่ Google Translate/DeepL
2. ทำไม LaMa ไม่ใช่ Flux (VRAM trade-off + ตัวเลข ~6GB vs ~10GB)
3. ทำไม DBNet ไม่ใช่ YOLO/SAM stack เต็ม
4. Scale/concurrency ทำงานยังไง (semaphore, webhook HMAC, SSE) — **หรือเปิด SSE domain ใน Simulations hub แทน**
5. ลบข้อความต้นฉบับสะอาดยังไง (mask + LaMa + ICC profile)
6. เป็น monolith หรือเปล่า (microservice + เรื่อง decompose god object 3,040→21 module)
7. ทำไมไม่ใช้ Mantra API ตรงๆ (B2B tool vs consumer on-demand)

**กลุ่ม Bug/War-story ที่เหลือจาก Top 8 (ไม่ได้โชว์สดใน #12):**
8. R2 list-call cost bleed (A3) — overfetch/cost ที่มองไม่เห็นจนวัด — **เปิด Asset Serving domain คู่กันได้**
9. MIT worker orphan/stale code (D1) — process lifecycle, atexit backstop
10. Node 26×Jest 30 toolchain mismatch (D2) — CI/environment war story
11. Global `MODEL` concurrency hazard (E2) — async correctness

**กลุ่ม ADR (จัดเป็น cluster ไม่ใช่ 30 สไลด์แยก):**
12. Cache/render-config-hash cluster (ADR 004, 006, 007, 011) — **เปิด Cache Read/Write domain คู่กันได้**
13. Security cluster (ADR 012, 013, 016, **022**) — MIT integration boundary, service-role authz, MIME validation, wallet TOCTOU hardening
14. Frontend architecture cluster (ADR 014, 015) — single-entry proxy, auth adapter — **เปิด Auth domain คู่กันได้**

**กลุ่ม Workflow/Methodology:**
15. Decomposition method วัดผลได้จริง (god object 3,040→2,235 บรรทัด, -26.5%, test +77%)

**กลุ่มที่เพิ่งสำรวจเจอ (2026-07-04 deep-dive — คำตอบต่อ "แค่ MIT/Cache ก็ Advanced แล้ว"):**

16. **"Payment ไม่เชื่อ webhook เฉยๆ"** (Backend security) — 2 ชั้นตรวจสอบก่อนเติมเงิน: static token compare + HMAC-SHA256 บน raw body (`timingSafeEqual`, `wallet.service.ts:331-354`) แล้วยัง **re-fetch สถานะจริงจาก Xendit API มา reconcile** ก่อนเติม (`wallet.service.ts:393-421`) — ไม่เชื่อ payload แม้ signature ผ่านแล้ว; fail-closed ที่ boot ถ้า secret หาย (`xendit-webhook.config.ts:29-40`)
17. **"TOCTOU hardening รอบสอง"** (ADR 022, wallet-atomic-unlock-rpc-toctou-hardening) — unlock เดิมอ่านราคา/สถานะนอก RPC แล้วส่งเข้าไป (ช่องให้ราคาถูกเปลี่ยนระหว่างอ่าน-เขียน) แก้เป็น RPC 4-arg ที่อ่านราคา/สถานะ/ผู้สร้าง**ในธุรกรรมเดียวกัน** — เป็น TOCTOU fix รอบที่ 2 ของระบบเดียวกัน (รอบแรกคือ A1 ใน bug-case-catalog)
18. **"Rate-limit ที่เลือก fail-open โดยตั้งใจ"** (`TopupThrottleGuard`) — จำกัด 5 ครั้ง/60s ผ่าน Redis atomic incr+TTL แต่**ถ้า Redis ล่ม ปล่อยผ่านแทนที่จะบล็อก** — ตัวอย่าง trade-off ที่ตั้งใจเลือก (infra ล่มต้องไม่ปิดกั้นการจ่ายเงินจริงของลูกค้า) ไม่ใช่ default ที่ไม่ได้คิด
19. **"Model ที่ไม่ได้ใช้ปลด GPU เองผ่าน TTL reaper — พร้อม bug ที่รู้ตัวและเก็บไว้โดยตั้งใจ"** (MIT) — `model_reaper.py` polling ทุก 1s ปลด model ที่หมดอายุ; **L1 key-drift**: key ที่ tracker บันทึก (`'colorizer'`/`'textline_merge'`) กับ key ที่ unloader route (`'colorization'`/`'detection'`) ไม่ตรงกัน ทำให้บาง model ไม่ถูกปลดจริง (แค่ `empty_cache()` ยิงเฉยๆ) — **byte-identical refactor policy เลือกบันทึก bug นี้ไว้แทนที่จะแก้เงียบๆ** เป็นจุดพูดที่ดีเรื่องความซื่อสัตย์ทางวิศวกรรม
20. **"Semaphore กัน GPU OOM + memory-pressure guard"** (MIT) — `PATCH_CONCURRENCY=3` จำกัด concurrent GPU inpaint ต่อ patch group, CPU render/encode วิ่งขนานนอก semaphore ได้; `psutil` เช็ค RAM >85% ถึงจะ trigger `release_memory()` (gc.collect+empty_cache) — **ระวัง:** "VRAM-leak telemetry" ที่เอกสารเก่าอ้างถึงจริงๆ อยู่ที่ Dashboard/Dev-console แยกต่างหาก ไม่ใช่ instrumentation ใน MIT เอง ต้องพูดให้ตรงถ้าถูกถามลึก
21. **"SSE reconnect มี distributed dedup ข้าม instance"** (Frontend+Backend) — client `EventSource` reconnect แบบ exponential backoff (1s→cap 30s, retry cap 6, `useForumStream.ts`) ไม่ใช่แค่นั้น — backend แท็ก `instanceId` ต่อ event (`forum-events.service.ts`) กัน multi-instance deployment echo event ของตัวเองกลับมาซ้ำผ่าน Redis pub/sub — เป็น distributed-systems dedup จริง ไม่ใช่แค่ client-side guess
22. **"apiCache เป็น LRU+SWR เขียนเอง ไม่ใช่ library"** (Frontend) — `apiCache.ts`: JS `Map` เป็น LRU จริง (evict คีย์เก่าสุด O(1)), stale-while-revalidate จริง (คืนค่าเก่าทันทีถ้ายังไม่หมดอายุ, ยิง background refetch ถ้าเลย 67% ของ TTL) + tag-based invalidation — แสดงว่าเข้าใจ cache invalidation trade-off โดยไม่พึ่ง React Query/SWR library (ตรงกับหลัก dependency-light ของโปรเจกต์)
23. **"Mobile ยังเป็นแค่ POC — พูดตรงๆ"** — `Documents/Mobile/MOBILE_ARCHITECTURE_AND_INTEGRATION.md` ระบุชัดว่า "Phase 3 — Future Scaling Goal / proof-of-concept" ยังไม่ shipped จริง ถ้าถูกถามเรื่อง native mobile ต้องตอบตรงว่ายังเป็นแผน ไม่ใช่ของที่ทำเสร็จแล้ว (ซื่อสัตย์ดีกว่าโดนจับได้ว่าพูดเกิน)

**กลุ่มที่เพิ่งสำรวจเจอรอบ 2 (2026-07-04 full-doc sweep — docs/ + Documents/ + Obsidian + root):**

24. **"Backend Audit Remediation — 31 defect เจอเป็นระบบ ไม่ใช่สุ่มเจอ"** (`docs/prd/backend-audit-remediation.md`, origin/main) — audit อ่านอย่างเดียว 90 ไฟล์ ~12k บรรทัด เจอ 31 defect (money-loss, blocking I/O, cache drift) ตั้งชื่อ FR-1..FR-31 ทำเป็น PR แยก merge ได้อิสระ — ยืนยันผ่าน git log จริงว่า land ครบ (เช่น `f8edadf1 fix(unlock): read price/status inside purchase_unlock_atomic (FR-2)`) — **ตัวอย่างที่ดีที่สุดของ "หาบั๊กอย่างเป็นระบบ" ในโปรเจกต์**
25. **"MIT มี hallucination-guard วิ่งอยู่เงียบๆ มาตลอด — ทีมเพิ่งรู้ตอน audit"** (`docs/research/mit-hidden-capabilities.md`) — `enable_post_translation_check` default=True ตรวจ repetition-hallucination + language-ratio + auto-retry 3 รอบ ทุก patch translation ที่ผ่านมา — "ระบบป้องกันตัวเองมากกว่าที่ diagram แสดง"; และ glossary pipeline (`OPENAI_GLOSSARY_PATH`) มีอยู่แล้วสมบูรณ์แค่ไม่ได้ต่อสายจาก Backend — แก้ honorific ผิดได้วันนี้เลย ไม่ต้องรอ roadmap
26. **"Quality gap ส่วนใหญ่เป็นความผิดเราเอง ไม่ใช่โมเดลแย่กว่า"** (`docs/research/mit-vs-upstream-quality-divergence.md`) — ยืนยันแล้วว่า OCR/detection/default-render **byte-identical กับ upstream**; ที่ต่างคือ (a) cross-page context ปิดโดยตั้งใจเพื่อ multi-tenant safety ทำให้ terminology drift ข้ามหน้า (b) `detection_size`/`inpainting_size` ที่ Backend ส่งมาต่ำกว่าค่าที่ MIT เองแนะนำ (2048 vs 2560, 1536 vs 2048) — **1 บรรทัดแก้ได้ ไม่ใช่ข้อจำกัดโมเดล**
27. **"วัดก่อนเชื่อ เกิดขึ้น 2 รอบ ไม่ใช่ครั้งเดียว"** (`docs/reports/2026-07-02-mit-speedup-study.md` + `-e2e-measurements.md`) — รอบแรกวิเคราะห์ (21-agent) ว่า 4× supersampling คือคอขวด รอบวัดจริงพบว่าผิด — ตัวจริงคือ `resize_regions_to_font_size` กิน 12-14s ต่อ region ไม่ใช่ supersampling (~1s) — เสริม pattern เดียวกับ L2 mis-analysis ให้แน่นขึ้นเป็น 2 เคส
28. **"Deterministic replay harness — วิธี test ระบบที่ไม่ deterministic"** (ADR 028) — OCR/LLM non-deterministic ทำให้ A/B benchmark เชื่อไม่ได้ + เคยรัน benchmark ผ่าน endpoint ที่ไม่ tag bubble มาก่อน (ทำให้ผลลัพธ์ผิดทั้งชุด) แก้ด้วยการ serialize sizing-state ไว้ replay ซ้ำได้ — **methodology contribution จริง ไม่ใช่แค่ bug fix** เหมาะเป็น "meta" backup slide
29. **"Staff console: who watches the watchmen"** (ADR 018/019) — Dev console แยกเป็น microservice **นอก failure domain ของ Backend โดยตั้งใจ** (เกิดจากเหตุการณ์จริง: gateway ขึ้น model ค้าง 90s ไม่มีใครเห็น) + ต่อมาแก้วิธี verify JWT จาก local crypto เป็นเรียก Supabase `/auth/v1/user` ตรงๆ เพราะ key แบบใหม่ verify local ไม่ได้ — ตัวอย่าง ADR ที่ถูก**แก้ไขจริงตามข้อจำกัดที่เจอ** ไม่ใช่เขียนทีเดียวจบ
30. **"Production topology: ephemeral serverless, ไม่ใช่ always-on GPU"** (ADR 021 / UML §6.1) — VPS (Frontend+Backend+Redis, always-on cost ต่ำ) เรียก Serverless GPU Cloud ที่ปลุก MIT เฉพาะตอนมี request; state (Supabase/R2/LLM) อยู่นอก compute ทั้งหมด — ปิดได้ทั้ง stack ระหว่างไม่ demo แล้วเปิดกลับมาไม่เสียข้อมูล — **บวก LLM provider สลับตาม environment เพื่อคุมต้นทุน: Dev = 9arm (Qwen3.6-35B, ฟรี), Production = Gemini API** — รวมเป็น cost-engineering story ที่ครบทั้ง compute + model layer ไม่ใช่แค่ GPU
31. **"Empirically-measured discriminator ไม่ใช่เดา"** (`Obsidian-MangaDock/project-mit-175-dialogue-path.md`) — แยก dialogue-ที่ต้องเต็มบับเบิล กับ narration-ที่ต้อง wrap แคบ ด้วยอัตราส่วน text-footprint/bubble-width ที่วัดจริง (dialogue ~0.88-0.90, narration ~0.40-0.59) ไม่ใช่ threshold เดา — ตัวอย่าง "rigorous empirical debugging" ที่ดี

### Tier 2 — ไม่ทำสไลด์ เปิดไฟล์จริงแทน (โอกาสถูกถามต่ำ/เจาะจงมาก)

- ADR ที่เหลือทั้งหมด (`docs/adr/` — เปิด README แล้วสกอลล์หาเลขที่ถูกถาม)
- เคส bug ที่เหลือ (`docs/reports/bug-case-catalog.md` — 19 เคสเต็ม เปิด ctrl+F หาได้เร็ว)
- รายละเอียดกฎหมาย/ธุรกิจเจาะลึก (`docs/reports/positioning-differentiation-legal.md` §5 เต็ม)
- domain/scenario ใดๆ ใน Simulations hub ที่ไม่ได้เตรียมพูดไว้ล่วงหน้า — เปิดสดได้ทันที ไม่ต้องเตรียม

**ข้อดีของ Tier 2 ที่มากกว่าแค่ประหยัดเวลาเตรียม:** เห็นเอกสาร/ระบบทำงานจริง (ไม่ใช่สไลด์ที่ปั้นมาเฉพาะวันสอบ) มักน่าเชื่อกว่าในสายตากรรมการที่จับผิดเก่ง — เป็นหลักฐานว่าของพวกนี้มีมาก่อนวันสอบ ไม่ใช่เขียนย้อนหลังเพื่อสอบผ่าน

---

## หมายเหตุวันสอบ (ไม่ใช่แผนหลายวัน — แค่เช็คลิสต์ก่อนขึ้นเวที)

- [ ] pre-warm cached demo example (อย่าพึ่ง fresh translate สดหน้ากรรมการ — 30-40s + เสี่ยง GPU cold)
- [ ] เปิดไฟล์ทั้ง 4 ต้นทางไว้ในแท็บสำรอง เผื่อกรรมการขอดูรายละเอียดเจาะลึกเคสใดเคสหนึ่ง
- [ ] ท่องสไลด์ #6 (reframe 5%→HITL) ให้ลื่นที่สุด เพราะเป็นจุดที่พลาดแล้วเสียเครดิตทั้งงานได้
- [ ] เช็คตัวเลข LOC ในสไลด์ #4 ให้ตรงกับ `git ls-files` รอบล่าสุดก่อนสอบจริง (โค้ดเปลี่ยนทุกวัน ตัวเลขนี้จะล้าสมัยเร็ว)
- [ ] **[Blocker]** ตัดสินใจ + ดำเนินการเรื่อง branch: commit เอกสารสอบ 5 ไฟล์นี้ แล้ว merge เข้า main (หรือย้ายไปทำต่อบน main โดยตรง) ก่อนวันสอบ — ไม่งั้นความเสี่ยงคือเอกสารหายถ้าต้อง checkout ไป main เพื่อ demo
- [ ] เช็ค external link ทุกอันใน positioning-differentiation-legal.md §1 ว่ายังเปิดได้จริง (อ้างงานวิจัยที่ตายลิงก์ = เสียเครดิต)
- [ ] ทำสไลด์ index หน้าเดียวของ backup deck (Tier 1 ทั้ง 15 หัวข้อ) + ลองกดลิงก์ข้ามไปแต่ละสไลด์จริงก่อนสอบ อย่าให้เจอตอนกรรมการถามสดแล้วหาไม่เจอ
- [ ] เปิดแท็บ `docs/adr/README.md` + `docs/reports/bug-case-catalog.md` ค้างไว้เผื่อ Tier 2 (ไม่ต้องสไลด์ แค่ต้องหาไวตอนถูกถาม)
- [ ] **ทดสอบ `/docs` → Simulations tab ให้ลื่นก่อนสอบจริง** เช็คว่า deploy ล่าสุดของ main มี Simulations hub ครบ (`?sim=<scenarioId>` deep-link ใช้ได้), เตรียม scenario ที่จะกดไว้ล่วงหน้า 2-3 อัน ไม่ใช่หากดสดตอนสอบ
