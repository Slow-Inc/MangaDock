<!-- lang:en -->
# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: Single-context

This is a single-context repo. One `CONTEXT.md` at the root covers all sub-projects (Frontend, Backend, MIT).

```
/
├── CONTEXT.md          ← domain glossary for the whole codebase
├── docs/adr/           ← architectural decision records
└── src/
```

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — authoritative domain glossary (L1/L2/L3 Cache, Dirty Key, Dirty Queue, Leader, Write-behind, Flush Frequency, etc.)
- **`docs/adr/`** — read ADRs that touch the area you're about to work in before proposing alternatives

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

Key avoid-list (from CONTEXT.md):
- Say **L1 Cache** not "local cache", "memory cache", or "JSON cache"
- Say **L2 Cache** not "Redis cache", "distributed cache", or "remote cache"
- Say **L3 Cache** not "JSON cache", "disk cache", "file cache", or "L1 disk"
- Say **Dirty Key** not "stale key", "unsynced key", or "pending key"
- Say **Dirty Queue** not "sync queue", "work queue", or "flush queue"
- Say **Leader** not "master", "primary", or "coordinator"
- Say **Write-behind** not "write-through", "async write", or "lazy persist"
- Say **Flush Frequency** not "batch interval", "sync rate", or "TTL"

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (L3 written by periodic batch only) — but worth reopening because…_
<!-- lang:end -->

<!-- lang:th -->
# เอกสาร Domain

วิธีที่ engineering skills ควรใช้เอกสาร domain ของ repo นี้เมื่อสำรวจ codebase

## โครงสร้าง: Single-context

นี่คือ repo แบบ single-context `CONTEXT.md` ไฟล์เดียวที่ root ครอบคลุมทุก sub-project (Frontend, Backend, MIT)

```
/
├── CONTEXT.md          ← glossary domain สำหรับ codebase ทั้งหมด
├── docs/adr/           ← Architectural Decision Records
└── src/
```

## ก่อนสำรวจ ให้อ่านสิ่งเหล่านี้

- **`CONTEXT.md`** ที่ root ของ repo — glossary domain ที่เป็น authoritative (L1/L2/L3 Cache, Dirty Key, Dirty Queue, Leader, Write-behind, Flush Frequency ฯลฯ)
- **`docs/adr/`** — อ่าน ADR ที่เกี่ยวข้องกับพื้นที่ที่กำลังจะทำงานก่อนเสนอทางเลือกอื่น

หากไฟล์เหล่านี้ไม่มีอยู่ **ดำเนินการต่อโดยไม่แจ้ง** ไม่ต้องบ่งชี้การขาดหายไป ไม่ต้องเสนอสร้างล่วงหน้า skill ผู้ผลิต (`/grill-with-docs`) จะสร้างแบบ lazy เมื่อ term หรือการตัดสินใจเกิดขึ้นจริง

## ใช้คำศัพท์จาก glossary

เมื่อผลลัพธ์ของคุณตั้งชื่อ concept ของ domain (ในชื่อ issue, ข้อเสนอ refactor, hypothesis, ชื่อ test) ใช้ term ตามที่กำหนดใน `CONTEXT.md` อย่าเปลี่ยนไปใช้คำพ้องความหมายที่ glossary ห้ามไว้โดยเฉพาะ

รายการห้ามใช้ (จาก CONTEXT.md):
- ใช้ **L1 Cache** ไม่ใช่ "local cache", "memory cache", หรือ "JSON cache"
- ใช้ **L2 Cache** ไม่ใช่ "Redis cache", "distributed cache", หรือ "remote cache"
- ใช้ **L3 Cache** ไม่ใช่ "JSON cache", "disk cache", "file cache", หรือ "L1 disk"
- ใช้ **Dirty Key** ไม่ใช่ "stale key", "unsynced key", หรือ "pending key"
- ใช้ **Dirty Queue** ไม่ใช่ "sync queue", "work queue", หรือ "flush queue"
- ใช้ **Leader** ไม่ใช่ "master", "primary", หรือ "coordinator"
- ใช้ **Write-behind** ไม่ใช่ "write-through", "async write", หรือ "lazy persist"
- ใช้ **Flush Frequency** ไม่ใช่ "batch interval", "sync rate", หรือ "TTL"

หาก concept ที่ต้องการยังไม่อยู่ใน glossary นั่นเป็นสัญญาณ — ไม่ว่าจะเป็นเพราะคุณกำลังสร้างภาษาที่ project ไม่ใช้ (ควรพิจารณาใหม่) หรือมีช่องว่างจริง (จดบันทึกไว้สำหรับ `/grill-with-docs`)

## แจ้ง ADR conflicts

หากผลลัพธ์ขัดแย้งกับ ADR ที่มีอยู่ ให้ระบุอย่างชัดเจนแทนที่จะ override แบบเงียบๆ:

> _ขัดแย้งกับ ADR-0001 (L3 เขียนโดย periodic batch เท่านั้น) — แต่ควรพิจารณาใหม่เพราะ…_
<!-- lang:end -->
