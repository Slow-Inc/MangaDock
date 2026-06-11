---
name: feedback_review_merge_policy
description: Tech-debt PR policy — auto-merge when green, but REVIEW FIRST with the /scrutinize skill (not an ad-hoc read)
metadata:
  type: feedback
---

Standing policy for the tech-debt batch (and similar agent-owned PRs), set by the dev 2026-06-11: **auto-merge a PR once CodeQL is green + 0 new test failures, but REVIEW it first** — and the review step **must use the `/scrutinize` skill**, not just an ad-hoc self-read.

**Why:** the dev wants momentum (no per-PR merge gate to babysit) but not blind merges; `/scrutinize` is the structured review gate. Copilot review is unavailable until 1 Jul 2026 ([[feedback_self_review]]), so `/scrutinize` is THE review.

**How to apply (per PR):**
1. Open the PR (bilingual EN+TH full Thai, 18-section impact report, self-review note).
2. Wait for CodeQL green + confirm 0 new test failures.
3. **Run `/scrutinize` to review the diff.** Address anything it surfaces (fix + re-test, or justify). **Post the `/scrutinize` findings on the PR bilingually (EN + full Thai)**, like the rest of the PR body — never English-only (dev rule 2026-06-11).
4. If clean → squash-merge → sync main → delete branch → notify the dev.
5. Never merge if `/scrutinize` finds a real blocker; surface it instead.

`/scrutinize` is a user/plugin skill (not in the repo `.claude/skills/`, which only has `frontend-testing`); invoke it via the Skill tool. See [[feedback_decomposition_method]] for the per-seam discipline this rides on.
