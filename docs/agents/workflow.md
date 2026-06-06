# Agent Workflow

How Claude approaches planning and implementation in this repo, and which skills to invoke automatically.

---

## Development workflow

เมื่อต้องวางแผนหรือ implement feature ให้ทำตามลำดับนี้:

1. **`/grill-me`** — stress-test แนวคิดก่อน (interview-style)
2. **`/grill-with-docs`** — challenge plan กับ ADRs ที่มีอยู่ใน `docs/adr/`
3. **`/to-prd`** — สร้าง PRD จากแผนที่ผ่านการ grill แล้ว
4. **`/to-issues`** — แตก PRD เป็น GitHub Issues บน `Slow-Inc/MangaDock` พร้อม triage labels (ดู `triage-labels.md`)
5. **`/tdd`** — implement โดยเขียน test ก่อน แล้วทำให้ผ่าน

---

## Auto-triggered skills

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

| งานประเภทนี้ | PAL tool |
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

7 domain references loaded on every command: `typography`, `color-and-contrast`, `spatial-design`, `motion-design`, `interaction-design`, `responsive-design`, `ux-writing`

---

## Skill libraries

| Library | Install | Skills หลัก |
|---|---|---|
| **[mattpocock/skills](https://github.com/mattpocock/skills)** | `npx skills@latest add mattpocock/skills` | grill-me, grill-with-docs, tdd, to-prd, to-issues, diagnose, improve-codebase-architecture, zoom-out, prototype |
| **[thananon/9arm-skills](https://github.com/thananon/9arm-skills)** | `npx skills add thananon/9arm-skills` | debug-mantra, post-mortem, scrutinize, management-talk |
| **[pbakaus/impeccable](https://github.com/pbakaus/impeccable)** ([docs](https://impeccable.style/docs/)) | `npx impeccable skills install` | 23 commands — ดู section ด้านบน |
