---
name: feedback-impact-report
description: Every change that affects the system goes into docs/reports/system-impact-report.md with the FULL field set (what/where, why, before→after, perf Δ, quality, validation, risk) so a whole-system report can be pulled from it. Plus the MIT tech-debt register.
metadata:
  type: feedback
---

Maintain a **report-level** record the user can pull a whole-system report from — richer than the `DONE.md` dev log. After any significant batch, append to `docs/reports/system-impact-report.md`.

**Every system-affecting change must record ALL of these fields** (post-mortem-grade; write "not measured" / "N/A" honestly rather than guessing — never fabricate numbers):
- **What & where** — the change + component / file:line / module.
- **Why** — the problem or goal it serves.
- **Before → After** — the concrete observable difference (state it both ways).
- **Performance Δ** — quantified if measured (latency / VRAM / throughput / tokens); else "not measured".
- **Quality** — correctness / render-fidelity / UX impact; how it compares to the target/reference.
- **Validation** — how it was verified (unit tests, E2E, benchmark page, golden/characterization).
- **Risk / rollback** — opt-in? byte-identical when off? controlling knob/flag; how to revert.
- **Links** — issue #, commit hash.

**Feature / refactor / tech-debt PR — the canonical 18-section template (required, 2026-06-11).** When writing a PR write-up AND the `system-impact-report.md` entry for a feature/refactor, cover ALL of these (use the headings; write "N/A" / "byte-identical 0%" honestly, never fabricate):
1. **What changed** (แก้ไขอะไรไปบ้าง)
2. **Results / outcome** (ได้ผลลัพธ์ยังไง)
3. **Expected performance gain %** (คาดว่า performance ดีขึ้นกี่% — for a byte-identical refactor state "0% runtime, maintainability-only"; never invent a number)
4. **Benefits** (ข้อดี)
5. **Purpose — what the refactor is for** (ทำเพื่ออะไร)
6. **Why we changed it + architectural impact** (ทำไมเปลี่ยน + ผลกระทบเชิงสถาปัตยกรรม)
7. **Problems before the refactor** (ก่อน refactor มีปัญหาอะไร)
8. **Goals** (เป้าหมาย)
9. **Architecture Before**
10. **Architecture After**
11. **Refactor list** (รายการ refactor — seam/commit table)
12. **Metrics** (LOC Δ, dedup ratio, test counts, timings)
13. **Technical Debt Removed**
14. **Risk Reduction**
15. **Developer Experience Impact**
16. **Future Opportunities**
17. **Lessons Learned**
18. **KPI**

Also keep a **tech-debt register** (issues filed: number/area/severity/status) and progress on in-flight refactors, plus key operational findings (gating, gotchas) and known gaps vs the target.

**Why:** the user writes whole-system reports from this (2026-06-09: "เราต้องเขียน report ทั้งระบบ เช่น before vs after ตรงไหนแก้เพื่ออะไร ประสิทธิภาพเพิ่มขึ้นแค่ไหน คุณภาพเป็นยังไง"). A change logged without before→after / perf / quality / validation is incomplete for reporting.

**How to apply:** terse + linkable; one dated section per batch; a per-change block or table carrying the fields above. In addition to — not instead of — `DONE.md` ([[feedback_md_history_log]]) + `MIT/PIPELINE.md §5`. Pairs with [[feedback-techdebt-all-scenarios]].

**ADR is mandatory for any quality-affecting or non-trivial change (2026-06-14).** When a change affects render/translation **quality**, VRAM/perf, or makes a non-small architectural/design decision, write an **ADR** in `docs/adr/NNN-*.md` (status · context · decision · alternatives-considered · consequences) **in addition to** the report. When a decision overturns or replaces an earlier one, mark the old ADR **Superseded by NNN** and have the new one state what it overturns (e.g. ADR 003 Flux-Klein overturned ADR 002's "Flux = OOM" assumption). Trivial one-liners are exempt. If updating ADRs to reflect the codebase would need a broad multi-area scan, say so — the user enables Ultracode (sub-agent codebase scan) for that.

**Trigger — closing an issue OR opening a PR: always write a report.** Pick the right artifact:
- **Bug fix** → fill `docs/reports/post-mortem-template.md` (Summary / Symptom / Root cause / Why-it-produced-the-symptom / Fix / How-found / Why-it-slipped / Validation / Action-items). Refuse to draft until the four required inputs are met (reliable repro · root cause known · fix identified · fix validated). Post bilingual EN+TH on the issue/PR.
- **Feature / refactor / tech-debt** → use the full-field change record above (what/where · why · before→after · perf Δ · quality · validation · risk).
- Either way also drop the entry into `docs/reports/system-impact-report.md`, and **never close an issue or merge without the user's explicit confirmation** ([[feedback_self_review]]).
- Skip the ceremony only for a trivial one-liner (the PR/commit message is the record).
