---
name: feedback_issue_ownership_scope
description: Only action issues we authored (xenodeve) or labeled ready-for-agent; akkanop-x / CableMoMo2027 issues are their own logs, not ours to implement
metadata:
  type: feedback
---

When picking up work, action **only** issues that are ours: authored by `xenodeve` **or** labeled `ready-for-agent` (the agent-to-do tag). Do **not** implement issues another team member opened as their own tracking/log, even if they fall in our nominal area (Frontend/Backend/MIT).

**Why:** the team shares one issue tracker but each owner files their own backlog. Implementing someone else's logged issue steps on their plan and crosses the area split ([[project_team_split]]). Confirmed 2026-06-11 by the dev.

**How to apply:**
- **NOT ours** (don't implement — badge / route to owner like we did for #214): the Frontend tech-debt ladder **#205 / #206 / #207 / #210 / #212** and **#177 "Fix Community Page"** — all authored by **akkanop-x**; R2/Worker flags (e.g. #214) — akkanop-x's Cloudflare area; anything Mobile — CableMoMo2027.
- **OURS** (29 open as of 2026-06-11, author `xenodeve`): MIT render-parity (PRD #178 → #179/#180/#181/#182/#183 + #166/#175/#176), MIT tech-debt (#186 in PR #216, #187/#188/#191/#192/#193), SFX & fidelity (PRD #169 → #168/#170/#172/#173/#174), context (PRD #155 → #159/#160/#161), and decision/design (#143 ADR, #140 design, #141 — need the dev's call first, don't batch into do-now work).
- Batch related OURS issues into one **epic-PR per category** (1 issue = 1+ commit, test each step, full suite + E2E before opening the PR), capped at ~2-4 issues/PR; never mix a decision/design issue into a do-now batch. See [[feedback_decomposition_method]].
