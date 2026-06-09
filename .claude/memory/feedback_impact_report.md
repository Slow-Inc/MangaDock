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

Also keep a **tech-debt register** (issues filed: number/area/severity/status) and progress on in-flight refactors, plus key operational findings (gating, gotchas) and known gaps vs the target.

**Why:** the user writes whole-system reports from this (2026-06-09: "เราต้องเขียน report ทั้งระบบ เช่น before vs after ตรงไหนแก้เพื่ออะไร ประสิทธิภาพเพิ่มขึ้นแค่ไหน คุณภาพเป็นยังไง"). A change logged without before→after / perf / quality / validation is incomplete for reporting.

**How to apply:** terse + linkable; one dated section per batch; a per-change block or table carrying the fields above. In addition to — not instead of — `DONE.md` ([[feedback_md_history_log]]) + `MIT/PIPELINE.md §5`. Pairs with [[feedback-techdebt-all-scenarios]].

**Trigger — closing an issue OR opening a PR: always write a report.** Pick the right artifact:
- **Bug fix** → fill `docs/reports/post-mortem-template.md` (Summary / Symptom / Root cause / Why-it-produced-the-symptom / Fix / How-found / Why-it-slipped / Validation / Action-items). Refuse to draft until the four required inputs are met (reliable repro · root cause known · fix identified · fix validated). Post bilingual EN+TH on the issue/PR.
- **Feature / refactor / tech-debt** → use the full-field change record above (what/where · why · before→after · perf Δ · quality · validation · risk).
- Either way also drop the entry into `docs/reports/system-impact-report.md`, and **never close an issue or merge without the user's explicit confirmation** ([[feedback_self_review]]).
- Skip the ceremony only for a trivial one-liner (the PR/commit message is the record).
