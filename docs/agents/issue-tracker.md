<!-- lang:en -->
# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on `Slow-Inc/MangaDock`. Use the `gh` CLI for all operations.

## Language: bilingual bodies (English + Thai)

Every issue body and PR description must be **bilingual**:

- **Title**: English (conventional-commit style, e.g. `fix(MIT): ...`).
- **Body**: write each section in English first, then a mirrored Thai version — either as a `## สรุปภาษาไทย` section at the end covering the whole body, or as `EN / TH` paired paragraphs per section for long documents (PRDs).
- **Thai must mirror English exactly** — same level of detail, same sentence count, same depth. Never summarise, abbreviate, or omit information in the Thai version.
- Code identifiers, file names, log excerpts, and acceptance-criteria checkboxes stay in English; the Thai version explains them, never translates identifiers.
- Comments replying to reviews may be English-only; anything a human teammate reads to make a decision gets both languages.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
<!-- lang:end -->

<!-- lang:th -->
# Issue tracker: GitHub

Issue และ PRD ของ repo นี้อยู่ที่ GitHub issues บน `Slow-Inc/MangaDock` ใช้ `gh` CLI สำหรับทุกการดำเนินการ

## ภาษา: body สองภาษา (อังกฤษ + ไทย)

ทุก issue body และ PR description ต้อง **สองภาษา**:

- **Title**: ภาษาอังกฤษ (รูปแบบ conventional-commit เช่น `fix(MIT): ...`)
- **Body**: เขียนแต่ละ section เป็นภาษาอังกฤษก่อน แล้วตามด้วยภาษาไทยที่สะท้อนกัน — ไม่ว่าจะเป็น `## สรุปภาษาไทย` ตอนท้ายที่ครอบคลุมทั้ง body หรือย่อหน้าคู่ EN / TH ต่อ section สำหรับเอกสารยาว (PRD)
- **ภาษาไทยต้องสะท้อนภาษาอังกฤษทุกประการ** — รายละเอียดระดับเดียวกัน จำนวนประโยคเดียวกัน ความลึกเดียวกัน ห้ามสรุป ย่อ หรือละทิ้งข้อมูลในภาษาไทย
- Code identifier, ชื่อไฟล์, log excerpt และ checkbox acceptance-criteria คงเป็นภาษาอังกฤษ; ภาษาไทยอธิบายสิ่งเหล่านั้น ไม่แปล identifier
- คอมเมนต์ตอบรีวิวอาจเป็นภาษาอังกฤษอย่างเดียว; สิ่งที่เพื่อนร่วมทีมต้องอ่านเพื่อตัดสินใจต้องมีทั้งสองภาษา

## Conventions

- **สร้าง issue**: `gh issue create --title "..." --body "..."` ใช้ heredoc สำหรับ body หลายบรรทัด
- **อ่าน issue**: `gh issue view <number> --comments` กรอง comment ด้วย `jq`
- **แสดง issue**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
- **คอมเมนต์ issue**: `gh issue comment <number> --body "..."`
- **ใส่/ลบ label**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **ปิด**: `gh issue close <number> --comment "..."`

สรุป repo จาก `git remote -v` — `gh` ทำสิ่งนี้อัตโนมัติเมื่อรันใน clone

## เมื่อ skill บอกว่า "publish ไปที่ issue tracker"

สร้าง GitHub issue

## เมื่อ skill บอกว่า "fetch ticket ที่เกี่ยวข้อง"

รัน `gh issue view <number> --comments`
<!-- lang:end -->
