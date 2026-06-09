---
name: feedback-impact-report
description: After significant work, record system-impacting changes AND tech debt into docs/reports/system-impact-report.md (report-level), in addition to the DONE.md dev log.
metadata:
  type: feedback
---

Maintain a **report-level** record, not just the chronological dev log. After any significant batch of work, append to `docs/reports/system-impact-report.md`:
- **Changes that affect the running system** — what changed, the system impact, the controlling knob/flag, test status. Flag opt-in vs default-changing behaviour.
- **Tech debt** — issues filed (number, area, severity, status) and progress on in-flight refactors.
- Key operational findings (gating, gotchas), known gaps vs the target, and the commit hashes.

**Why:** the user pulls status reports from this (2026-06-09 request: "บันทึกการแก้ไขต่างๆที่สำคัญ ส่งผลต่อระบบ รวมถึง tech dept ไว้ด้วยเพื่อนำไปทำ report"). `DONE.md` is a terse chronological dev log; this is the curated, stakeholder-readable summary.

**How to apply:** keep entries terse + linkable (issue #, commit hash, file:line); one dated section per significant batch; tables for change/impact/test and the tech-debt register. This is in addition to — not a replacement for — `DONE.md` ([[feedback_md_history_log]]) and `MIT/PIPELINE.md §5`. Pairs with [[feedback-techdebt-all-scenarios]].
