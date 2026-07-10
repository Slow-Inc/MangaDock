<!-- lang:en -->
# Qwen Delegation (claude-9arm)

Project-specific rules for offloading work in **this repo** to `claude-9arm` (a Qwen model run headless via Claude Code). The general mechanism — command syntax, prompt-writing rules, context-window limits, failure modes — lives in the `qwen-agent` skill (`~/.claude/skills/qwen-agent/SKILL.md`). Read that first; this doc only adds MangaDock-specific targets and guardrails, it doesn't repeat the mechanism.

**Not the same as `clink(cli_name="claude-9arm")`.** This doc covers the direct CLI form (`claude-9arm -p "..."` in Bash) for delegating mechanical work. The PAL `clink` tool's `claude-9arm` agent is a separate integration used for multi-agent brainstorming (second opinions alongside `antigravity`/Gemini) — different purpose, different skill (`clink-brainstorm`), don't conflate the two.

## Good delegation targets here

Mechanical, self-contained, low-blast-radius tasks with an obvious "done":

- Bulk rename of a symbol/identifier across Frontend/Backend/MIT once you've decided the new name
- Boilerplate scaffolding that copies an established pattern (e.g. a new NestJS `*.spec.ts` shell modeled on an existing sibling spec)
- Summarizing/condensing a long log file or MIT worker stack trace before you read it yourself
- Lint/format passes, import sorting, mechanical cleanup
- Grep-and-report sweeps ("find every call site of X, list file:line") across the three sub-projects

## Sizing tasks in this repo

The `qwen-agent` skill already covers the general 128k-context-window rule and how to write a detailed, self-contained prompt — follow those as written, don't re-derive them. What's specific to MangaDock is *where the natural chunk boundaries are*:

- **Chunk by sub-project.** Frontend/Backend/MIT are three separate stacks with separate conventions — never fold a cross-stack rename or sweep into one prompt; one `claude-9arm` run per sub-project.
- **Chunk MIT logs by time window/rotation, not whole-file.** MIT stack traces are path-heavy and often mix Thai/English strings, which tokenizes denser than the skill's ÷4 estimate — treat a MIT log segment as smaller than it looks and split earlier than you'd think necessary.
- **"Detailed requirement" here means:** absolute file paths + an explicit acceptance criterion + (if the task touches MIT worker restart, `cache:reset`, or disk headroom) pasting the matching rule from "Landmines" below verbatim into the prompt. Don't assume qwen infers a MangaDock-specific gotcha on its own.
- **If the task also invokes a skill (see "Handing qwen a skill" below), the skill's own size is part of the budget, not free.** Chunk the file footprint smaller than usual to leave room for it — see that section's numbers.

## Handing qwen a skill

`claude-9arm` runs on the same harness as this session, so it can invoke skills from `~/.claude/skills/` too — proven in practice to raise the quality of what it produces (the `qwen-agent` skill's own benchmark found skill-guided qwen stayed on the correct structure and honest about missing facts, where unguided qwen drifted and fabricated). Default to **Option A** ("name it, let qwen invoke") for MangaDock delegations, rather than inlining the guidance yourself:

```
claude-9arm -p "Use the Skill tool to invoke 'karpathy-guidelines', then <task>." --allowedTools Skill Read Edit Write Bash Glob Grep
```

`--allowedTools` must include `Skill` plus every tool the invoked skill itself calls, or qwen stalls mid-skill waiting for approval.

**Skills worth handing off for MangaDock mechanical tasks** (procedural, apply cleanly even to a literal small model):
- `karpathy-guidelines` — any delegated code edit where the prompt can't fully pin down scope
- `tdd` — delegated bugfix / small-feature edits, test-first
- `simplify` — a pass on a delegated edit before calling it done
- `post-mortem` — writing up a delegated bugfix's root cause

**Keep these to yourself even when the surrounding task is delegated** — they need judgment this conversation has and qwen doesn't: `scrutinize`, `architecture-review`, `debug-mantra`, `code-review`/`review`, `security-review`, `qa`. Handing these to qwen defeats their purpose — a literal small model applies judgment-based gating confidently and wrongly.

**Option A has a real, measured cost, not just a caveat.** Checked on this machine: `karpathy-guidelines` SKILL.md is ~2.6KB (~650 tokens), `tdd` (superpowers) is ~9.9KB (~2.5k tokens), `post-mortem` is ~13.6KB (~3.4k tokens) — and that's before qwen reads a single project file, and before counting any reference files a skill tells it to open on top of its own SKILL.md. That cost stacks with the task's own file footprint from "Sizing tasks" above, inside the same 128k window.

Rule of thumb: if the task's own file footprint already runs past roughly half of a rough 128k budget, don't also pay for Option A on top of it — fall back to Option B (inline just the relevant rule) instead of stacking both costs. Reserve Option A for chunks that are already small (a single file, one bounded edit, a short log segment) where the skill's judgment/gating is worth the tokens it costs.

## Do NOT delegate

Repo-specific stakes that need judgment a literal small model doesn't have:

- Anything touching `auth`, `wallet`, or `unlock` modules — security boundary (see CLAUDE.md Auth section)
- MIT core-pipeline / seam decomposition work — needs the seam judgment the core-boundary rule requires
- Authoring or editing bilingual issue/PR bodies — the Thai mirror must match the English **exactly** (same depth, same bullet count); a small model's default failure mode is to shorten or drift, which silently breaks that rule
- Render-quality / benchmark verdicts — these need visual judgment against the defect checklist, not a text summary
- Anything requiring this conversation's context or an actual design decision

## Landmines to hand qwen up front

If a delegated task touches these areas, paste the relevant rule into the prompt — qwen has no memory of prior sessions and will otherwise trip on them:

- MIT worker process is `python3.11.exe`, not `python` — stop/restart by killing the **port owner** on 5003/5004, not by process name, or you leave an orphan worker serving stale code
- `npm run cache:reset` ordering: kill the backend **before** running `cache:reset`, then relaunch — otherwise the in-memory L1 re-flushes the L3 you just cleared
- This dev machine needs headroom before touching MIT/Qwen3 translator loads — under ~15GB free it fails with a silent `OSError`, not a clear error message

## Verifying delegated output

The `qwen-agent` skill says "verify yourself" in general terms; in this repo that means actually running the sub-project's own check for whatever qwen touched, not just eyeballing the diff:

- Frontend edits — `bun lint` and, if behavior changed, `bun test`
- Backend edits — `npx jest <affected-spec> --no-coverage`
- MIT edits — re-run the relevant script/test under `MIT/` for the touched module

A qwen-delegated change is not exempt from this repo's existing verification bar just because a model did the mechanical part.

## Issue tracking still applies

Delegating the mechanical work to `claude-9arm` doesn't exempt the change from CLAUDE.md's Definition-of-Done gate — it still needs a GitHub issue on `Slow-Inc/MangaDock` before a PR (PRD → issue → PR), and the issue still must be one you're allowed to work (authored by us, or labeled `ready-for-agent`). "I only delegated it to qwen" is not a reason to skip issue tracking.

## Setup

No MangaDock-specific configuration. Use the `claude-9arm` alias and `--allowedTools` flag exactly as the `qwen-agent` skill documents.
<!-- lang:end -->

<!-- lang:th -->
# มอบหมายงานให้ Qwen (claude-9arm)

กฎเฉพาะของ repo นี้สำหรับการมอบหมายงานให้ `claude-9arm` (โมเดล Qwen ที่รันแบบ headless ผ่าน Claude Code) กลไกทั่วไป — syntax คำสั่ง, กฎการเขียน prompt, ข้อจำกัด context window, failure mode — อยู่ใน skill `qwen-agent` (`~/.claude/skills/qwen-agent/SKILL.md`) อ่านตัวนั้นก่อน เอกสารนี้เพิ่มแค่เป้าหมายงานและ guardrail เฉพาะของ MangaDock ไม่ซ้ำกลไกเดิม

**ไม่ใช่ตัวเดียวกับ `clink(cli_name="claude-9arm")`** เอกสารนี้พูดถึงรูปแบบ CLI ตรง (`claude-9arm -p "..."` ใน Bash) สำหรับมอบหมายงานเชิงกลไก ส่วน `claude-9arm` agent ใน PAL `clink` tool เป็นการเชื่อมต่ออีกแบบที่ใช้สำหรับ multi-agent brainstorming (ขอความเห็นที่สองคู่กับ `antigravity`/Gemini) — คนละวัตถุประสงค์ คนละ skill (`clink-brainstorm`) อย่าปนกัน

## เป้าหมายงานที่มอบหมายได้ดีใน repo นี้

งานเชิงกลไก, self-contained, blast-radius ต่ำ ที่มีเกณฑ์ "เสร็จ" ชัดเจน:

- Bulk rename symbol/identifier ข้าม Frontend/Backend/MIT เมื่อตัดสินใจชื่อใหม่แล้ว
- Scaffold boilerplate ที่ copy pattern ที่มีอยู่แล้ว (เช่น `*.spec.ts` ใหม่ของ NestJS ที่ model ตาม spec ข้างเคียงที่มีอยู่)
- สรุป/ย่อ log file ยาวๆ หรือ stack trace ของ MIT worker ก่อนที่คุณจะอ่านเอง
- Lint/format pass, เรียง import, cleanup เชิงกลไก
- Grep-and-report sweep ("หาทุกจุดที่เรียก X แล้ว list file:line") ข้ามทั้งสาม sub-project

## การกะขนาดงานใน repo นี้

skill `qwen-agent` มีกฎเรื่อง context window 128k และวิธีเขียน prompt ให้ self-contained ละเอียดอยู่แล้ว — ทำตามที่เขียนไว้ตรงๆ ไม่ต้อง derive ใหม่ สิ่งที่เฉพาะของ MangaDock คือ *ขอบเขตการซอยงานตามธรรมชาติของ repo นี้*:

- **ซอยตาม sub-project** Frontend/Backend/MIT เป็นคนละ stack คนละ convention — ห้ามรวม rename หรือ sweep ข้าม stack ไว้ prompt เดียว ให้รัน `claude-9arm` แยกต่อ sub-project
- **ซอย log ของ MIT ตามช่วงเวลา/rotation ไม่ใช่ทั้งไฟล์** stack trace ของ MIT มี path เยอะและมักปนข้อความไทย/อังกฤษ ซึ่ง tokenize หนักกว่าที่ skill ประมาณด้วย ÷4 — ให้มองว่า log segment ของ MIT "หนัก" กว่าที่เห็น แล้วซอยให้เล็กกว่าที่คิดว่าจำเป็น
- **"Requirement ละเอียด" ในที่นี้หมายถึง:** absolute file path + acceptance criterion ที่ชัดเจน + (ถ้างานแตะ MIT worker restart, `cache:reset`, หรือ disk headroom) paste กฎที่ตรงกันจาก "กับดัก" ด้านล่างลงใน prompt แบบคำต่อคำ อย่าคิดว่า qwen จะเดากับดักเฉพาะของ MangaDock เองได้
- **ถ้างานนั้นเรียกใช้ skill ด้วย (ดู "ให้ qwen เรียกใช้ skill เอง" ด้านล่าง) ขนาดของ skill เองก็เป็นส่วนหนึ่งของ budget ไม่ใช่ของฟรี** ให้ซอย file footprint ให้เล็กกว่าปกติเพื่อเผื่อที่ไว้ — ดูตัวเลขใน section นั้น

## ให้ qwen เรียกใช้ skill เอง

`claude-9arm` รันบน harness เดียวกับ session นี้ จึงเรียกใช้ skill จาก `~/.claude/skills/` ได้เหมือนกัน — พิสูจน์แล้วในทางปฏิบัติว่าช่วยยกระดับคุณภาพผลลัพธ์จริง (benchmark ของ skill `qwen-agent` เองพบว่า qwen ที่ได้ skill guide ยัง structure ถูกต้องและซื่อตรงเรื่อง fact ที่ขาดหาย ในขณะที่ qwen ที่ไม่มี guide drift แล้ว fabricate) ให้ใช้ **Option A** ("name it, let qwen invoke") เป็นค่าเริ่มต้นสำหรับงานมอบหมายของ MangaDock แทนการ inline guidance เอง:

```
claude-9arm -p "Use the Skill tool to invoke 'karpathy-guidelines', then <task>." --allowedTools Skill Read Edit Write Bash Glob Grep
```

`--allowedTools` ต้องมี `Skill` รวมกับทุก tool ที่ skill ที่เรียกใช้เองต้องใช้ ไม่งั้น qwen จะค้างกลางทางรอ approval

**Skill ที่ควรส่งให้สำหรับงานเชิงกลไกของ MangaDock** (เป็น procedural ใช้กับ model เล็กแบบตรงตัวได้ดี):
- `karpathy-guidelines` — งานแก้ code ที่มอบหมายซึ่ง prompt pin scope ได้ไม่เต็มร้อย
- `tdd` — งานแก้ bugfix/feature เล็กที่มอบหมาย เขียน test ก่อน
- `simplify` — pass ตรวจก่อนถือว่างานที่มอบหมายเสร็จ
- `post-mortem` — เขียนสรุป root cause ของ bugfix ที่มอบหมายไป

**สิ่งที่ต้องเก็บไว้ทำเองแม้ว่างานรอบข้างจะ delegate ไปแล้ว** — ต้องใช้ judgment ที่ session นี้มีแต่ qwen ไม่มี: `scrutinize`, `architecture-review`, `debug-mantra`, `code-review`/`review`, `security-review`, `qa` ส่งสิ่งเหล่านี้ให้ qwen จะทำลายจุดประสงค์ของมันเอง — model เล็กแบบตรงตัวจะใช้ judgment-based gating อย่างมั่นใจแต่ผิด

**Option A มีต้นทุนจริงที่วัดได้ ไม่ใช่แค่คำเตือนลอยๆ** เช็คบนเครื่องนี้แล้ว: `karpathy-guidelines` SKILL.md ~2.6KB (~650 token), `tdd` (superpowers) ~9.9KB (~2.5k token), `post-mortem` ~13.6KB (~3.4k token) — และนั่นคือก่อนที่ qwen จะอ่านไฟล์ project แม้แต่ไฟล์เดียว ยังไม่นับไฟล์ reference อื่นที่ skill อาจสั่งให้เปิดเพิ่มนอกเหนือจาก SKILL.md เอง ต้นทุนนี้บวกซ้อนกับ file footprint ของงานเองจาก "การกะขนาดงาน" ด้านบน อยู่ใน context window 128k เดียวกัน

กฎคร่าวๆ: ถ้า file footprint ของงานเองกินไปเกินครึ่งของ budget 128k โดยประมาณอยู่แล้ว อย่าจ่ายเพิ่มด้วย Option A ซ้อนเข้าไปอีก ให้ fallback ไป Option B (inline แค่กฎที่เกี่ยวข้อง) แทนการซ้อนต้นทุนทั้งสองอย่าง เก็บ Option A ไว้ใช้กับ chunk ที่เล็กอยู่แล้ว (ไฟล์เดียว, การแก้ที่ bound ไว้ชัด, log segment สั้นๆ) ที่ judgment/gating ของ skill คุ้มกับ token ที่เสียไป

## ห้ามมอบหมาย

จุดที่มี stake เฉพาะของ repo ต้องใช้ judgment ที่ model เล็กแบบตรงตัวไม่มี:

- อะไรก็ตามที่แตะ module `auth`, `wallet`, หรือ `unlock` — security boundary (ดู section Auth ใน CLAUDE.md)
- งาน decomposition core-pipeline/seam ของ MIT — ต้องใช้ judgment เรื่อง seam ตามกฎ core-boundary
- เขียนหรือแก้ body ของ issue/PR แบบสองภาษา — ภาษาไทยต้องสะท้อนภาษาอังกฤษ **ทุกประการ** (ความลึกเท่ากัน จำนวน bullet เท่ากัน) failure mode ปกติของ model เล็กคือย่อหรือ drift ซึ่งจะแอบทำลายกฎนั้น
- คำตัดสินเรื่อง render-quality/benchmark — ต้องใช้ visual judgment เทียบ defect checklist ไม่ใช่แค่สรุปข้อความ
- อะไรก็ตามที่ต้องการ context ของบทสนทนานี้หรือการตัดสินใจเชิง design จริงๆ

## กับดักที่ต้องบอก qwen ล่วงหน้า

ถ้างานที่มอบหมายแตะพื้นที่เหล่านี้ ให้ paste กฎที่เกี่ยวข้องลงใน prompt — qwen ไม่มี memory ของ session ก่อนหน้าและจะพลาดกับดักเหล่านี้ถ้าไม่บอก:

- process ของ MIT worker คือ `python3.11.exe` ไม่ใช่ `python` — หยุด/restart ต้อง kill โดย **port owner** บน 5003/5004 ไม่ใช่ตาม process name ไม่งั้นจะเหลือ orphan worker เสิร์ฟโค้ดเก่า
- ลำดับของ `npm run cache:reset`: kill backend **ก่อน** รัน `cache:reset` แล้วค่อย relaunch ไม่งั้น L1 ใน memory จะ re-flush L3 ที่เพิ่งล้างไป
- เครื่อง dev นี้ต้องมี headroom ก่อนแตะ MIT/Qwen3 translator load — ถ้าเหลือว่างต่ำกว่า ~15GB จะพังด้วย `OSError` แบบเงียบ ไม่ใช่ error message ที่ชัดเจน

## การ verify ผลจาก delegation

skill `qwen-agent` บอกแค่ "verify เอง" แบบกว้างๆ ใน repo นี้หมายถึงต้องรันเช็คจริงของ sub-project ที่ qwen แตะ ไม่ใช่แค่ดู diff ด้วยตา:

- แก้ Frontend — `bun lint` และถ้า behavior เปลี่ยน `bun test`
- แก้ Backend — `npx jest <spec ที่เกี่ยวข้อง> --no-coverage`
- แก้ MIT — รัน script/test ที่เกี่ยวข้องใต้ `MIT/` ของ module ที่แตะซ้ำอีกครั้ง

งานที่มอบหมายให้ qwen ไม่ได้รับการยกเว้นมาตรฐาน verification ของ repo นี้ เพียงเพราะ model เป็นคนทำส่วนกลไก

## Issue tracking ยังต้องมีเหมือนเดิม

การมอบหมายงานเชิงกลไกให้ `claude-9arm` ไม่ได้ยกเว้นงานนั้นจาก Definition-of-Done gate ใน CLAUDE.md — ยังต้องมี GitHub issue บน `Slow-Inc/MangaDock` ก่อนเปิด PR (PRD → issue → PR) และ issue นั้นต้องเป็นอันที่เราได้รับอนุญาตให้ทำ (เราเปิดเอง หรือ tag `ready-for-agent`) "แค่มอบหมายให้ qwen ทำ" ไม่ใช่เหตุผลที่จะข้าม issue tracking ได้

## Setup

ไม่มี configuration เฉพาะของ MangaDock ใช้ alias `claude-9arm` และ flag `--allowedTools` ตามที่ skill `qwen-agent` ระบุไว้ตรงๆ
<!-- lang:end -->
