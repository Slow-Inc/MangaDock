<!-- lang:en -->
# Triage Labels

This file defines the full label taxonomy used in `Slow-Inc/MangaDock`. Labels fall into five groups: **triage state**, **component**, **issue type**, **severity**, and **lifecycle state**.

---

## Triage State

The skills speak in terms of five canonical triage roles.

| Label in mattpocock/skills | Label in our tracker | Meaning |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

---

## Component

Which part of the codebase owns this issue. Apply exactly one component label per issue.

| Label      | Meaning |
| ---------- | ------- |
| `Frontend` | Next.js 16 + React 19 app (port 4000) |
| `Backend`  | NestJS 11 API server (port 3001/4001) |
| `MIT`      | Python ML inference server — text detection, OCR, inpainting, rendering |
| `Mobile`   | Mobile client (owned by CableMoMo2027) |
| `Infra`    | Cloudflare R2/Worker, CI/CD, Docker, deployment (owned by akkanop-x) |
| `Docs`     | Documentation, CLAUDE.md, DONE.md, agent guides |

---

## Issue Type

What kind of work this is. Apply one or more type labels per issue.

| Label        | Meaning |
| ------------ | ------- |
| `Bug`        | Something is broken or behaves incorrectly |
| `tech-debt`  | Code that works but is fragile, over-complex, or hard to maintain |
| `security`   | Vulnerability, auth bypass, injection risk, data exposure |
| `Optimization` | Performance, VRAM, latency, throughput, or resource usage improvement |
| `Cleanup`    | Dead code removal, formatting, dependency trimming — no behaviour change |
| `Feature`    | Net-new user-facing capability |
| `Test`       | Adding or fixing tests with no production code change |

---

## Severity

How much does this hurt. Apply exactly one severity label per Bug or Security issue; optional for others.

| Label      | Meaning |
| ---------- | ------- |
| `critical` | Data loss, security breach, or complete feature unavailability in production |
| `Major`    | Core workflow broken; significant user impact; no workaround |
| `Minor`    | Degraded experience; workaround exists; affects a subset of users |

---

## Lifecycle State

Issues that are known but deliberately not acted on yet.

| Label     | Meaning |
| --------- | ------- |
| `Latent`  | Bug exists in code but has not yet manifested in production |
| `Dormant` | Issue is real but deprioritised; will not be scheduled in the near term |

---

## Conventions

- Every issue must have at least one **triage state** label and one **component** label.
- `Bug` + `Critical` / `Major` issues should always be assigned to a human or agent immediately.
- `Latent` bugs that become active must be upgraded to a full Bug issue with severity.
- `Dormant` issues are revisited during quarterly planning.
- `security` issues must be labelled `critical` or `Major` — a `Minor` security label is not valid.
<!-- lang:end -->

<!-- lang:th -->
# Label สำหรับ Triage

ไฟล์นี้กำหนด taxonomy ของ label ทั้งหมดที่ใช้ใน `Slow-Inc/MangaDock` Label แบ่งเป็น 5 กลุ่ม: **triage state**, **component**, **ประเภท issue**, **ความรุนแรง**, และ **lifecycle state**

---

## Triage State

Skills ใช้ 5 roles triage canonical

| Label ใน mattpocock/skills | Label ใน tracker ของเรา | ความหมาย |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer ต้องประเมิน issue นี้  |
| `needs-info`               | `needs-info`         | รอข้อมูลเพิ่มเติมจากผู้รายงาน |
| `ready-for-agent`          | `ready-for-agent`    | ระบุครบถ้วนแล้ว พร้อมสำหรับ agent แบบ AFK  |
| `ready-for-human`          | `ready-for-human`    | ต้องการมนุษย์มา implement            |
| `wontfix`                  | `wontfix`            | จะไม่ดำเนินการ                     |

---

## Component

ส่วนใดของ codebase ที่รับผิดชอบ issue นี้ ใส่ label component เพียง 1 label ต่อ issue

| Label      | ความหมาย |
| ---------- | ------- |
| `Frontend` | Next.js 16 + React 19 app (port 4000) |
| `Backend`  | NestJS 11 API server (port 3001/4001) |
| `MIT`      | Python ML inference server — ตรวจจับข้อความ, OCR, inpainting, rendering |
| `Mobile`   | Mobile client (ดูแลโดย CableMoMo2027) |
| `Infra`    | Cloudflare R2/Worker, CI/CD, Docker, deployment (ดูแลโดย akkanop-x) |
| `Docs`     | เอกสาร, CLAUDE.md, DONE.md, คู่มือ agent |

---

## ประเภท Issue

งานประเภทใด ใส่ label ประเภทได้ 1 หรือมากกว่า 1 label ต่อ issue

| Label        | ความหมาย |
| ------------ | ------- |
| `Bug`        | บางอย่างพังหรือทำงานผิดปกติ |
| `tech-debt`  | โค้ดที่ทำงานได้แต่เปราะบาง ซับซ้อนเกิน หรือบำรุงรักษายาก |
| `security`   | ช่องโหว่ความปลอดภัย, auth bypass, injection risk, data exposure |
| `Optimization` | ปรับปรุง performance, VRAM, latency, throughput หรือการใช้ทรัพยากร |
| `Cleanup`    | ลบ dead code, จัดรูปแบบ, ลด dependency — ไม่เปลี่ยน behavior |
| `Feature`    | ความสามารถใหม่ที่ผู้ใช้เห็นได้ |
| `Test`       | เพิ่มหรือแก้ test โดยไม่เปลี่ยน production code |

---

## ความรุนแรง

ส่งผลกระทบมากแค่ไหน ใส่ label ความรุนแรงเพียง 1 label ต่อ issue Bug หรือ Security; เลือกใส่สำหรับประเภทอื่น

| Label      | ความหมาย |
| ---------- | ------- |
| `critical` | สูญเสียข้อมูล, ละเมิดความปลอดภัย หรือ feature ไม่สามารถใช้งานได้ใน production |
| `Major`    | core workflow พัง; กระทบผู้ใช้อย่างมีนัยสำคัญ; ไม่มีทางเลี่ยง |
| `Minor`    | ประสบการณ์ลดลง; มีทางเลี่ยง; กระทบผู้ใช้บางส่วน |

---

## Lifecycle State

Issue ที่รู้จักแต่ยังไม่ดำเนินการโดยตั้งใจ

| Label     | ความหมาย |
| --------- | ------- |
| `Latent`  | Bug มีอยู่ใน code แต่ยังไม่แสดงออกใน production |
| `Dormant` | Issue มีอยู่จริงแต่ไม่ได้จัดลำดับความสำคัญ; จะไม่มีในแผนระยะใกล้ |

---

## Conventions

- ทุก issue ต้องมี **triage state** อย่างน้อย 1 label และ **component** 1 label
- Issue `Bug` + `Critical` / `Major` ควรมอบหมายให้มนุษย์หรือ agent ทันที
- Bug `Latent` ที่เริ่มแสดงออกต้องอัปเกรดเป็น Bug issue เต็มรูปแบบพร้อมความรุนแรง
- Issue `Dormant` จะทบทวนในช่วงวางแผนรายไตรมาส
- Issue `security` ต้องติด label `critical` หรือ `Major` เท่านั้น — `Minor` + security ไม่ถูกต้อง
<!-- lang:end -->
