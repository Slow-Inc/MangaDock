---
name: Home
tags: ["moc"]
---

# 🗂️ MangaDock Agent Knowledge Base

Obsidian vault ที่รวม MD ทั้งหมดที่ agent ต้องอ่านตอนพัฒนา — ย้ายมาจาก `.claude/memory/` (canonical; single source of truth ตาม [[feedback-md-update-every-change]]).

> [!info] วิธีใช้
> - เปิด **Graph View** เพื่อเห็นความสัมพันธ์ระหว่าง memory (ลิงก์ที่ยังไม่มีไฟล์ = จุดที่ควรเขียนเพิ่ม)
> - แต่ละ note = ข้อเท็จจริงเดียว มี frontmatter (`type`, `description`) + `[[wikilinks]]` เชื่อมเรื่องที่เกี่ยวข้อง
> - **type**: `feedback` (วิธีทำงานที่ user กำหนด) · `project` (สถานะงาน/ข้อจำกัด) · `concept` (hub ความรู้เชิงหัวข้อ ที่ compile จากหลายโน้ตให้ค้นทีเดียวเจอ) · `reference` (ตัวชี้ทรัพยากรภายนอก)

## 🧭 Feedback — วิธีทำงาน (กฎที่ต้องตามทุก task)

- [[feedback-benchmark-patch-not-image-endpoint]] — Benchmark MIT render via `/translate/with-form/patches` (production, tags bubbles), NEVER `/translate/with-form/image` (never tags bubbles → under-fill/oversize artifacts). 2026-07-02 lesson.
- [[feedback-benchmark-confirms-md-defect-fixed]] — A defect in an md (checklist/master-plan/issue) isn't "done" until a benchmark ties back to THAT defect and proves the documented symptom is gone (before=symptom, after=gone) — not just "looks better".
- [[feedback-clear-cache-before-test]] — ก่อน test การแปลทุกครั้งต้องล้าง cache ก่อน — และหลัง deploy fix ต้องล้าง L3 + reload browser ด้วย
- [[feedback-log-every-experiment-to-md]] — เขียนทุกอย่างที่ลอง/ทำ (รวม dead-end + การวัด) ลง MD เป็น knowledge เสมอ — กัน session ถัดไปไล่ผีซ้ำ
- [[feedback-core-boundary]] — New features attach at a stage/module seam with a stable interface + tests — never grow the core monolith (MangaTranslator orchestrator / shared modules) or copy per-model/per-translator boilerplate. The antidote to compounding tech debt.
- [[feedback-decomposition-method]] — Why the MIT god-object decomposition is done byte-identical / characterization-first / one-seam-per-commit, with the measured benefit — keep doing it this way
- [[feedback-impact-report]] — Every change that affects the system goes into docs/reports/system-impact-report.md with the FULL field set (what/where, why, before→after, perf Δ, quality, validation, risk) so a whole-system report can be pulled from it. Plus the MIT tech-debt register.
- [[feedback-issue-ownership-scope]] — Only action issues we authored (xenodeve) or labeled ready-for-agent; akkanop-x / CableMoMo2027 issues are their own logs, not ours to implement
- [[feedback-md-history-log]] — ทุกครั้งที่แก้โค้ด/ทำ feature เสร็จ ให้บันทึกลง MD (DONE.md) เป็น history เสมอ
- [[feedback-md-update-every-change]] — อัปเดต MD (DESIGN/spec + "Resume here" note) ทุกครั้งที่แก้ เพื่อ session ใหม่เปิดมาทำงานต่อได้ทันที
- [[feedback-notify-on-done-or-question]] — ยิง PushNotification ทุกครั้งที่งานเสร็จหรือมีเรื่องต้องถาม user จะได้ไม่ต้องเฝ้า terminal
- [[feedback-review-merge-policy]] — Tech-debt PR policy — auto-merge when green, but REVIEW FIRST with the /scrutinize skill (not an ad-hoc read)
- [[feedback-techdebt-all-scenarios]] — When refactoring tech debt in shared/core modules, enumerate and characterization-test EVERY scenario you can imagine BEFORE touching code — a refactor error there breaks the whole system.
- [[feedback-test-every-round]] — ทำงานเสร็จทุกครั้งต้อง test ครบทุกรอบ รวม frontend E2E (Playwright ผ่าน tunnel) ไม่ใช่แค่ unit
- [[feedback-verify-before-claiming]] — ห้ามเคลม "แก้แล้ว" จนกว่าจะ eyeball render จริงเทียบ target + SendUserFile ให้ user confirm; test/replay ผ่าน ≠ verified; metric ต้องครอบทั้ง over/under
- [[feedback-update-readme-on-command-change]] — แก้อะไรที่กระทบ command/script หรือเพิ่ม tool ใหม่ ต้องอัปเดต README.md ด้วยทุกครั้ง

## 🧠 Concept — hub ความรู้เชิงหัวข้อ (compile จากหลายโน้ต/ADR/report ให้ค้นทีเดียวเจอ)

- [[concept-mit-render-pipeline]] — Everything about MIT render/inpaint: pipeline stages, the `MIT_*` knob set that gates quality, the lama↔flux inpainter tradeoff, parity direction, and the open render defects — with links out to every scattered note/ADR/benchmark

## 🚧 Project — สถานะงาน & ข้อจำกัด

- [[project-animetext-approved]] — User approved downloading the AnimeText YOLO model (deepghs/AnimeText_yolo) for #168 SFX detection on 2026-06-09 — the .pt security gate is cleared for this model
- [[project-backend-pre-existing-test-failures]] — Backend books suite has 14 pre-existing test failures (pubsub suite only) unrelated to feature work
- [[project-cache-phase2]] — "Multi-layer cache hardening phases 2.1–2.3 — what's done, what's pending"
- [[project-cache-quality-gaps]] — Known quality gaps in the Multi-Layer Cache implementation — areas not yet covered that should be addressed before production
- [[project-cache-reset-ordering]] — Reader E2E of a CODE change needs cache:reset with the backend DOWN first — kill backend, then cache:reset, then relaunch — else the live L1 re-flushes the cleared L3.
- [[project-community-forum]] — Community forum + image upload system; SE project background and team info
- [[project-dev-commit-memory]] — เครื่อง dev commit memory ตึง — Qwen3 โหลดไม่ขึ้น (OSError 1455) ถ้าไม่ปิดโปรแกรมอื่นก่อน
- [[project-mit-175-dialogue-path]] — #175 dialogue-too-small + ปาร์ตี้ล้น แก้แล้วด้วย bubble_area_fit(bounded)+display_sfx; One-Punch benchmark หลอกตา
- [[project-mit-launch-env]] — MIT inference server must launch on MIT/.venv (cu121 CUDA torch), NOT the Store python (cpu torch) — restart recipe
- [[project-mit-refactor-resume]] — The MIT god-object decomposition (#187/#188) is tracked in docs/reports/mit-refactor-progress.md — the single resume point. Read it first to continue without re-exploring.
- [[project-render-knob-gating]] — In-app translation render quality depends on the FULL set of MIT_* env knobs on the backend; MIT_BUBBLE_AREA_FIT gates the #166/#179 anti-overflow + narrow-column path
- [[project-render-parity-direction]] — ทิศทางที่ตัดสินแล้ว (2026-06-08) ให้ MIT render เหมือน MangaTranslator — narrow-column + supersampling + vertical จริง + SFX
- [[project-mit-translate-nondeterministic]] — MIT translate ไม่ deterministic (OCR-VLM/LLM sampling) → รัน 2 ครั้งได้ text+geometry ต่างกัน; in-app render A/B confounded — วัด pixel ด้วย offline dump, in-app E2E ใช้ verify wiring เท่านั้น


## 📚 Reference — ตัวชี้ทรัพยากรภายนอก

- [[reference-external-docs-index]] — Catalog of knowledge-bearing MD files OUTSIDE the vault (resume points, benchmark reports, ADRs, PRDs, DONE/PIPELINE logs) — read these too; reconcile new ones in so nothing is missed

---

## Definition of Done (gate ทุก task)

ดู [[feedback-impact-report]] · [[feedback-test-every-round]] · [[feedback-review-merge-policy]] · [[feedback-issue-ownership-scope]] — code+test+E2E+scrutinize+DONE.md+impact-report+ADR+notify ครบทุกครั้ง ไม่งั้นยังไม่ done.

**GitHub Issues = ระบบกำกับ task (source of truth):** งานทุกชิ้นที่แตะ code map กับ issue หนึ่งใบ (`Slow-Inc/MangaDock`) — issue บอก *จะทำอะไร* (pick เฉพาะ author เรา/`ready-for-agent` — [[feedback-issue-ownership-scope]]) + *สถานะ* (open/closed+reason). local todo = session working-memory เท่านั้น ต้อง reconcile กลับเข้า issue ก่อนจบ session. **Why (ทีมหลายคน):** โอน task ให้คนอื่นได้ทันที (todo ตายไปกับ session) + กัน code ชนกัน (ทุกคนเห็นว่าใครถือ task ไหน จึงไม่แตะงานที่คนอื่นกำลังทำ).

**Issue lifecycle (bookend — ล้มบ่อยเพราะกฎซ่อนใน `/to-prd` skill ที่ load เฉพาะตอน invoke):**
- **ก่อนเปิด PR:** งานแตะ code ต้องมี issue tracking ก่อน — ordering **PRD → issues → PR** (ห้าม PR ไม่มี issue อ้างอิง); body bilingual EN+Thai; label `ready-for-agent`.
- **ระหว่างทำ:** งานคืบหน้า (scope/สถานะ/decision เปลี่ยน) → **update body ของ issue ให้ current** (ไม่ใช่แค่ comment) เพื่อโอนงานไร้รอยต่อ — อ่าน body ใบเดียวรู้สถานะล่าสุด; body ที่ update ต้อง bilingual EN+Thai เหมือนกัน. comment=event/หลักฐาน, body=สถานะปัจจุบัน (source of truth).
- **หลัง merge/เสร็จ:** ปิด issue (`gh issue close <n> --comment`) พร้อม impact-report — งานเสร็จแต่ issue ยังเปิด = **ยังไม่ done**.
- **ปิดทุกครั้งต้องระบุ REASON** (ห้ามปิดเงียบ): completed (+หลักฐาน) / cancelled-superseded (โดยอะไร) / duplicate (#NNN) / wontfix / stale — คนอ่านย้อนต้องเข้าใจทันทีโดยไม่เดา.
- ต้นเหตุที่ลืม: ordering rule อยู่ใน `/to-prd` skill (on-demand) + "close" อยู่ใน `docs/agents/issue-tracker.md` เป็นแค่คำสั่ง ไม่ใช่ gate → ย้ายขึ้น DoD ที่ always-loaded (2026-07-05, user ทัก 2 ครั้ง).
