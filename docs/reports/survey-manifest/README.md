# Survey Manifest — Central Knowledge Base (MoC Index)

> จุดประสงค์: เก็บ**ความรู้ที่สกัดจากการสำรวจ codebase/MD/issues/PR ทั้งหมด** ให้เอาไปใช้ได้กับทุก
> รูปแบบ report (สไลด์นำเสนอ, เล่มรายงาน SE_PHASE 1-7, ADR ใหม่ ฯลฯ) — **พร้อม provenance ที่ละเอียด
> พอจะ diff รอบต่อไปได้** ไม่ต้องอ่านซ้ำไฟล์/บรรทัด/PR ที่ไม่เปลี่ยนแปลง

---

## วิธีใช้ไฟล์นี้ (สำหรับ agent ที่ scan รอบถัดไป)

1. เปิด fragment ที่ตรงกับพื้นที่ที่จะอัปเดต (ดูตารางด้านล่าง)
2. เช็คว่าไฟล์/PR/issue ที่บันทึกไว้เปลี่ยนหรือไม่ **ก่อนอ่านซ้ำ**:
   - โค้ด: `git log -1 --format=%H -- <path>` แล้วเทียบกับ `last_commit` ที่บันทึกไว้ — ถ้าตรงกัน **ข้ามได้เลย ไม่ต้องอ่านไฟล์นั้นซ้ำ**
   - Issue/PR: `gh issue view <n> --json updatedAt` / `gh pr view <n> --json updatedAt` เทียบกับ `updated_at` ที่บันทึกไว้ — ถ้าตรงกัน ข้ามได้
3. ถ้าเปลี่ยน ให้อ่านเฉพาะ diff (`git diff <last_commit>..HEAD -- <path>`) ไม่ต้องอ่านทั้งไฟล์ใหม่ เว้นแต่ diff ใหญ่มาก
4. อัปเดต fragment เฉพาะส่วนที่เปลี่ยน + เปลี่ยน `last_commit`/`updated_at` เป็นค่าใหม่

## Schema ของแต่ละ entry

**โค้ด:**
```
### <file path>
- **last_commit:** <full SHA จาก `git log -1 --format=%H -- <path>`>
- **lines_covered:** <เช่น "1-450 (full)" หรือ "230-310, 500-620 (partial — DTO/boilerplate ข้าม)">
- **read_date:** <YYYY-MM-DD>
- **findings:** <bullet สั้นๆ พร้อมเลขบรรทัดอ้างอิง>
```

**Issue/PR:**
```
### Issue/PR #<n>
- **state:** open/closed/merged (ตอนอ่าน)
- **updated_at:** <ISO timestamp จาก gh>
- **read_date:** <YYYY-MM-DD>
- **findings:** <bullet สั้นๆ>
```

**MD/เอกสาร:**
```
### <file path>
- **last_commit:** <SHA>
- **coverage:** full / เฉพาะ header / เฉพาะบรรทัด N-M
- **read_date:** <YYYY-MM-DD>
- **findings:** <bullet>
```

---

## ดัชนี Fragment

| Fragment | ขอบเขต | สถานะ |
|---|---|---|
| [backend-remaining-modules.md](backend-remaining-modules.md) | Backend modules ที่ยังไม่เคย deep-read (books, forum, users, versions, common/storage, status, supabase, auth guards เต็ม) | ✅ เสร็จ (42 ไฟล์) |
| [frontend-remaining-areas.md](frontend-remaining-areas.md) | Frontend ที่ยังไม่ deep-read (reader/book components, community components, search, studio, hooks นอกเหนือ SSE) | ✅ เสร็จ (49 ไฟล์) |
| [mit-remaining-modules.md](mit-remaining-modules.md) | MIT modules ที่ยังไม่ deep-read (OCR, translators, rendering internals, config/textblock/generic utils) | ✅ เสร็จ (22 ไฟล์) |
| [github-issues.md](github-issues.md) | GitHub issues (355 total: 63 open/292 closed) — สกัด defect/feature narrative ที่ยังไม่อยู่ใน MD ไหน | ✅ เสร็จ (อ่านเต็ม 20) |
| [github-prs.md](github-prs.md) | GitHub PR body/description ฉบับเต็มของ PR สำคัญ (116 merged total) | ✅ เสร็จ (อ่านเต็ม 20) |
| [documents-full-content.md](documents-full-content.md) | Documents/ ที่เคยอ่านแค่บางส่วน (SE_PHASE2/5/7 เต็ม, UML_REPORT เต็ม, Backend/Frontend/MIT service overview เต็ม) | ✅ เสร็จ |
| [frontend-e2e-visual-survey.md](frontend-e2e-visual-survey.md) | Playwright E2E ผ่าน production tunnel — design/UX ที่เห็นได้จากการรันจริงเท่านั้น (reader translate, community, simulations hub, login) | ✅ เสร็จ |

**สิ่งที่สำรวจไปแล้วก่อนหน้านี้ (ไม่ต้องทำซ้ำ เว้นแต่จะ diff):**
- `docs/adr/` ทั้ง 30 ฉบับ (ADR 001-028 อ่านครบใน session ก่อนหน้า, ดู `docs/reports/presentation-master-outline.md` backup-slide #12-31 สำหรับ findings)
- `docs/research/` ทั้ง 11 ไฟล์
- `docs/reports/` + `docs/reports/benchmarks/` (ยกเว้นบางไฟล์ใน origin/main ที่ agent อ่านผ่านๆ — ดูรายละเอียดใน findings ก่อนหน้า)
- `docs/prd/` + `docs/superpowers/plans+specs/` (รวม main-only PRDs: mit-master-plan-2 series, account-linking, dashboard-live, en-source-wrap-parity)
- `Backend/src/cache/` (26 ไฟล์), `Backend/src/wallet/`, `Backend/src/upload/` — deep-read แล้ว
- `Frontend/app/hooks/useForumStream.ts`, `Frontend/app/lib/apiCache.ts`, `Frontend/app/docs/simulations/` — deep-read แล้ว
- `MIT/manga_translator/model_usage_tracker.py`, `model_unloader.py`, `model_reaper.py`, `memory_guard.py`, `server/worker_lifecycle.py`, `dispatch_registry.py` — deep-read แล้ว
- `Obsidian-MangaDock/` ทั้ง 30 note, root MD ทั้งหมด (รวม triage ไฟล์ scratch 17 ไฟล์ — ยืนยันเป็น Playwright dump ทิ้งได้)

ทั้งหมดนี้ผลลัพธ์อยู่ใน `docs/reports/presentation-master-outline.md` (ภาคผนวก Tier 1 #1-31) — ไม่ต้อง duplicate ที่นี่ ให้ลิงก์กลับแทน
