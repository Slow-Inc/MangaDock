# Post-mortem template (MangaDock)

> The canonical engineering record of a **fixed, validated bug**. Written *after* a fix lands, *for*
> other engineers + future-you. Code identifiers are first-class (function names, `file:line`, commit
> SHAs) — they are the index that lets the next person grep back to the change.
>
> **When to use:** closing a bug issue, or opening a PR that fixes a bug. **When NOT to use:** a
> feature / refactor (use the impact-report change record in `system-impact-report.md` instead — see
> the rule `feedback_impact_report`), a trivial one-liner (the PR description is enough), or a not-yet-
> validated fix (refuse — a post-mortem of a hypothesis is worse than none). A customer-visible outage
> needs a separate incident report, not this.
>
> Posted to a MangaDock issue/PR → **bilingual EN + full TH** (repo rule). Copy the block below, fill it,
> delete the guidance italics. Also drop a one-line pointer into `docs/reports/system-impact-report.md`.

## Required inputs — do not draft without all four
- [ ] **Reliable repro** exists (deterministic or high-rate, runnable by the next person).
- [ ] **Root cause known** (the mechanism, not a hypothesis).
- [ ] **Fix identified** (PR / commit / branch).
- [ ] **Fix validated** (the original repro now passes / the failing workload now succeeds).

If any is missing: list what's missing and stop.

---

## Template (fill, keep this order)

**Summary** *(mandatory)* — one paragraph: what broke (in user/workload terms), what fixed it (one sentence), issue #, PR #, owner. A reader who stops here has the right answer.

**Symptom** — what was actually observed: test output, error message, log line, perf number, screenshot. Concrete identifiers, not paraphrase.

**Root cause** *(mandatory)* — the actual mechanism. Code identifiers expected: function, `file:line`, branch condition, the commit SHA of the offending change. Walk the cause chain end-to-end. Most important section.

**Why it produced the symptom** — link cause → symptom when non-obvious (the bug is in X but the visible failure is Y, three frames later). Let a reader who only saw the symptom connect it back.

**Fix** *(mandatory)* — what changed and **why it addresses the root cause** (not hides the symptom). Link PR/commit. If a prior attempt papered over it, name it + what was wrong.

**How it was found** — the debugging path: the repro that made it deterministic; the tool that cracked it (debugger / source trace / knob enumeration / instrumentation); hypotheses tried + rejected (one-line reason each); the single experiment that confirmed it.

**Why it slipped through** — the real reason it reached the branch/release: CI gap (no test on this path), latent code (correct when written, broken by a later change elsewhere), workload gap, incomplete prior fix, or review miss. **Blameless** — describe the gap, never the person. If "no good reason, we should have caught this," say so.

**Validation** *(mandatory)* — how we know it works: original failing test now passes (name/link), benchmark/E2E now succeeds, perf number before → after, soak/stress clean. **State coverage honestly** — if only one config was tested, say so; never imply broader coverage than you have.

**Action items / follow-ups** — concrete next-steps not in the fix PR: regression test at `<seam>` (owner), refactor to prevent the class (owner, ticket), CI gap closed (owner), doc/runbook updated, related ticket filed. If none: write "None — the fix is sufficient." Don't manufacture items.

## Rules
- Refuse without all four required inputs. Never invent root cause / owner / validation / action items.
- Keep code identifiers — they are the index. (Leadership reframing is a separate `management-talk` job.)
- Blameless; active voice; no hedging ("we believe" / "appears to" → drop or prove).
- For the up-the-org version, hand the finished post-mortem to `management-talk`.
