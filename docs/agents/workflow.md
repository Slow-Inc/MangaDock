<!-- lang:en -->
# Agent Workflow

How Claude approaches planning and implementation in this repo, and which skills to invoke automatically.

---

## Development workflow

When planning or implementing a feature, follow this order:

1. **`/grill-me`** — stress-test the concept first (interview-style)
2. **`/grill-with-docs`** — challenge the plan against existing ADRs in `docs/adr/`
3. **`/to-prd`** — create a PRD from the grilled plan
4. **`/to-issues`** — break the PRD into GitHub Issues on `Slow-Inc/MangaDock` with triage labels (see `triage-labels.md`)
5. **`/tdd`** — implement by writing tests first, then making them pass

---

## Auto-triggered skills

Skills that should be invoked automatically based on context without waiting for user instruction:

| Trigger | Skill | Condition |
|---|---|---|
| Bug / error / stack trace | `/debug-mantra` | Start a debug session every time |
| Complex debug / performance regression | `/diagnose` | reproduce → minimise → hypothesise → fix |
| After fixing a bug | `/post-mortem` | Record root cause + fix + validation |
| After writing or changing code | `/simplify` | Before committing — check for over-engineering |
| Editing UI / frontend | `/impeccable` | Every time a component or CSS is touched |
| New UI needs design brief | `/impeccable shape` | Plan UX before implementing |
| UI ready to ship | `/impeccable audit` + `/impeccable harden` | Check a11y/perf/responsive + edge cases |
| Before merge / ship | `/code-review` + `/scrutinize` | Check correctness + outsider perspective |
| Touching auth, token, wallet, secret | `/security-review` | Every time code affects a security boundary |
| After implementation | `/verify` | Confirm the feature actually works in the app |
| Exploring unfamiliar code | `/zoom-out` | Get high-level context before editing |
| Codebase growing more complex | `/improve-codebase-architecture` | Run every 2-3 days or after a major feature |
| User asks "is there a skill that can do X?" | `/find-skills` | Search for a skill before writing code yourself |

---

## PAL tool mapping

| Task type | PAL tool |
|---|---|
| Code review | `mcp__pal__codereview` |
| Debug / diagnose | `mcp__pal__debug` |
| Architecture review | `mcp__pal__analyze` |
| QA / test planning | `mcp__pal__testgen` |
| Refactor planning | `mcp__pal__refactor` |
| Security audit | `mcp__pal__secaudit` |
| Deep reasoning | `mcp__pal__thinkdeep` |

Available: `analyze`, `codereview`, `consensus`, `debug`, `refactor`, `secaudit`, `testgen`, `thinkdeep`, `planner`, `precommit`, `docgen`, `tracer`, `challenge`, `chat`

---

## impeccable — 23 commands

All commands via `/impeccable <command>`.

**Build**

| Command | What it does |
|---|---|
| `craft` | Full shape-then-build flow with visual iteration |
| `init` | One-time setup: PRODUCT.md, DESIGN.md, live mode |
| `document` | Generate DESIGN.md from existing project code |
| `extract` | Pull reusable components and tokens into design system |
| `shape` | Plan UX/UI before writing code |

**Evaluate**

| Command | What it does |
|---|---|
| `critique` | UX design review: hierarchy, clarity, emotional resonance |
| `audit` | Technical quality checks (a11y, performance, responsive) |

**Refine**

| Command | What it does |
|---|---|
| `polish` | Final pass, design system alignment, shipping readiness |
| `bolder` | Amplify boring designs |
| `quieter` | Tone down overly bold designs |
| `distill` | Strip to essence |
| `harden` | Error handling, i18n, text overflow, edge cases |
| `onboard` | First-run flows, empty states, activation paths |
| `animate` | Add purposeful motion |
| `colorize` | Introduce strategic color |
| `typeset` | Fix font choices, hierarchy, sizing |
| `layout` | Fix layout, spacing, visual rhythm |
| `delight` | Add moments of joy |
| `overdrive` | Add technically extraordinary effects |
| `clarify` | Improve unclear UX copy |
| `adapt` | Adapt for different devices |
| `optimize` | Performance improvements |
| `live` | Visual variant mode: iterate on elements in the browser |

---

## Skill libraries

| Library | Install | Key skills |
|---|---|---|
| **[mattpocock/skills](https://github.com/mattpocock/skills)** | `npx skills@latest add mattpocock/skills` | grill-me, grill-with-docs, tdd, to-prd, to-issues, diagnose, improve-codebase-architecture, zoom-out, prototype |
| **[thananon/9arm-skills](https://github.com/thananon/9arm-skills)** | `npx skills add thananon/9arm-skills` | debug-mantra, post-mortem, scrutinize, management-talk |
| **[pbakaus/impeccable](https://github.com/pbakaus/impeccable)** | `npx impeccable skills install` | 23 commands — see section above |
<!-- lang:end -->

<!-- lang:th -->
# กระบวนการทำงาน Agent

วิธีที่ Claude เข้าถึงการวางแผนและ implementation ใน repo นี้ และ skill ใดที่ควร invoke อัตโนมัติ

---

## กระบวนการพัฒนา

เมื่อต้องวางแผนหรือ implement feature ให้ทำตามลำดับนี้:

1. **`/grill-me`** — stress-test แนวคิดก่อน (รูปแบบ interview)
2. **`/grill-with-docs`** — challenge แผนกับ ADR ที่มีอยู่ใน `docs/adr/`
3. **`/to-prd`** — สร้าง PRD จากแผนที่ผ่านการ grill แล้ว
4. **`/to-issues`** — แตก PRD เป็น GitHub Issues บน `Slow-Inc/MangaDock` พร้อม triage label (ดู `triage-labels.md`)
5. **`/tdd`** — implement โดยเขียน test ก่อน แล้วทำให้ผ่าน

---

## Skills ที่ trigger อัตโนมัติ

Skills ที่ควร invoke อัตโนมัติตาม context โดยไม่ต้องรอให้ user สั่ง:

| Trigger | Skill | เงื่อนไข |
|---|---|---|
| มี bug / error / stack trace | `/debug-mantra` | เริ่ม debug session ทุกครั้ง |
| debug ซับซ้อน / performance regression | `/diagnose` | reproduce → minimise → hypothesise → fix |
| แก้ bug เสร็จแล้ว | `/post-mortem` | บันทึก root cause + fix + validation |
| เขียนหรือแก้ code เสร็จ | `/simplify` | ก่อน commit — ตรวจ over-engineering |
| แก้ไข UI / frontend | `/impeccable` | ทุกครั้งที่แตะ component หรือ CSS |
| UI ใหม่ต้องการ design brief | `/impeccable shape` | วาง UX ก่อน implement |
| UI พร้อม ship | `/impeccable audit` + `/impeccable harden` | ตรวจ a11y/perf/responsive + edge cases |
| ก่อน merge / ship | `/code-review` + `/scrutinize` | ตรวจ correctness + outsider perspective |
| แตะ auth, token, wallet, secret | `/security-review` | ทุกครั้งที่ code กระทบ security boundary |
| implement เสร็จ | `/verify` | ยืนยันว่า feature ทำงานจริงใน app |
| explore code ที่ไม่คุ้นเคย | `/zoom-out` | ขอ high-level context ก่อนแก้ |
| codebase ซับซ้อนขึ้นเรื่อยๆ | `/improve-codebase-architecture` | รันทุก 2-3 วัน หรือหลัง feature ใหญ่ |
| user ถาม "มี skill ไหนทำ X ได้บ้าง" | `/find-skills` | ค้นหา skill ก่อนเขียน code เอง |

---

## PAL tool mapping

| ประเภทงาน | PAL tool |
|---|---|
| Code review | `mcp__pal__codereview` |
| Debug / diagnose | `mcp__pal__debug` |
| Architecture review | `mcp__pal__analyze` |
| QA / test planning | `mcp__pal__testgen` |
| Refactor planning | `mcp__pal__refactor` |
| Security audit | `mcp__pal__secaudit` |
| Deep reasoning | `mcp__pal__thinkdeep` |

ที่มีให้ใช้: `analyze`, `codereview`, `consensus`, `debug`, `refactor`, `secaudit`, `testgen`, `thinkdeep`, `planner`, `precommit`, `docgen`, `tracer`, `challenge`, `chat`

---

## impeccable — 23 คำสั่ง

ทุกคำสั่งผ่าน `/impeccable <command>`

**Build**

| คำสั่ง | ทำอะไร |
|---|---|
| `craft` | Flow shape-then-build เต็มรูปแบบพร้อม visual iteration |
| `init` | Setup ครั้งเดียว: PRODUCT.md, DESIGN.md, live mode |
| `document` | สร้าง DESIGN.md จาก project code ที่มีอยู่ |
| `extract` | ดึง component และ token ที่ใช้ซ้ำได้เข้า design system |
| `shape` | วาง UX/UI ก่อนเขียน code |

**Evaluate**

| คำสั่ง | ทำอะไร |
|---|---|
| `critique` | UX design review: ลำดับชั้น, ความชัดเจน, emotional resonance |
| `audit` | ตรวจคุณภาพทางเทคนิค (a11y, performance, responsive) |

**Refine**

| คำสั่ง | ทำอะไร |
|---|---|
| `polish` | Pass สุดท้าย, align กับ design system, ความพร้อม ship |
| `bolder` | ขยาย design ที่น่าเบื่อ |
| `quieter` | ลด design ที่ bold เกินไป |
| `distill` | ตัดให้เหลือแต่สาระสำคัญ |
| `harden` | Error handling, i18n, text overflow, edge case |
| `onboard` | First-run flow, empty state, activation path |
| `animate` | เพิ่ม motion ที่มีเจตนา |
| `colorize` | เพิ่มสีแบบมีกลยุทธ์ |
| `typeset` | แก้ font, ลำดับชั้น, ขนาด |
| `layout` | แก้ layout, spacing, visual rhythm |
| `delight` | เพิ่มช่วงเวลาแห่งความสุข |
| `overdrive` | Push เกินขีดจำกัดปกติ |
| `clarify` | ปรับปรุง UX copy ที่ไม่ชัดเจน |
| `adapt` | ปรับสำหรับอุปกรณ์ต่างๆ |
| `optimize` | ปรับปรุง performance |
| `live` | Visual variant mode: iterate บน element ใน browser |

---

## Skill libraries

| Library | ติดตั้ง | Skills หลัก |
|---|---|---|
| **[mattpocock/skills](https://github.com/mattpocock/skills)** | `npx skills@latest add mattpocock/skills` | grill-me, grill-with-docs, tdd, to-prd, to-issues, diagnose, improve-codebase-architecture, zoom-out, prototype |
| **[thananon/9arm-skills](https://github.com/thananon/9arm-skills)** | `npx skills add thananon/9arm-skills` | debug-mantra, post-mortem, scrutinize, management-talk |
| **[pbakaus/impeccable](https://github.com/pbakaus/impeccable)** | `npx impeccable skills install` | 23 commands — ดู section ด้านบน |
<!-- lang:end -->
