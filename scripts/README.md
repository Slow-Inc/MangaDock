# scripts/ — workflow guards & tooling

Guards that enforce the workflow the team adopted (2026-07-05 multi-agent brainstorm) to stop
the three recurring failures: **features colliding**, **features/plans getting lost**, and
**silent quality regressions**. See `docs/OPEN-WORK-LEDGER.md` for the full plan; the load-bearing
invariant is:

> **Every session starts with a clean tree · every piece of work has a GitHub issue · code reaches
> prod only through a merge from a named branch, never from a dirty working tree.**

## Guards (pure logic in `lib/`, unit-tested with `node --test`)

| Script | Guards against | Rule |
|---|---|---|
| `check-worktree-budget.mjs` | dirty-WIP re-accumulating on a shared branch (the 312-file WIP that blocked Stage B) | fail if > 25 tracked or > 50 untracked files, or any build artifact (logs, `_render_dump/`, `test-results/`, `.playwright-mcp/`, stray images outside `docs/reports/benchmarks/`). `wip/*` branches bypass the **count** gate (freeze escape hatch) but never the **artifact** gate. |
| `check-issue-ref.mjs` | work with no GitHub issue (MD-only work agents miss) | fail if no `#NNN` in the branch name (`fix/358-…`), PR body, or any commit. `wip/*` branches are exempt. |
| `check-scrutinize.mjs` | merging a PR whose `/scrutinize` pass no longer covers its final state (the #550 lapse: reviewed once, then the PR grew) | fail unless the PR body carries `<!-- scrutinize verdict=ship commit=<sha> -->` with an accepted verdict (`ship`/`fix-then-ship`, not `rework`/`reject`) **and** the recorded commit matches current HEAD (a verdict against an older commit is stale). `wip/*` branches are exempt. |
| `check-append-only.mjs` | a stale-base clobber silently dropping merged entries from the shared changelogs (the #553 clobber → #608) | fail if a PR **removes an existing `## ` section header** from `DONE.md` or `docs/reports/system-impact-report.md`. Compares the base-blob vs HEAD-blob header **multiset** (not a diff) so moves/edits/code-fences/CRLF don't false-positive. `[log-trim]` in the PR title exempts intentional curation. |

Run the unit tests:

```bash
node --test scripts/lib/*.test.mjs
```

## Enabling enforcement

**Local (pre-push hook)** — opt in per clone (does nothing until enabled, so it won't block while
the current `perf` WIP still exists):

```bash
git config core.hooksPath scripts/git-hooks
```

**CI (recommended)** — add to the consolidated CI workflow, wired to the required `gate` job:

```yaml
- run: node scripts/check-worktree-budget.mjs
- run: PR_BODY="$(gh pr view "$PR" --json body -q .body)" node scripts/check-issue-ref.mjs
  env: { BASE_REF: origin/${{ github.base_ref }} }
- run: PR_BODY="$(gh pr view "$PR" --json body -q .body)" node scripts/check-scrutinize.mjs
  env: { HEAD_SHA: ${{ github.event.pull_request.head.sha }} }
- run: PR_TITLE="$(gh pr view "$PR" --json title -q .title)" node scripts/check-append-only.mjs
  env: { BASE_REF: origin/${{ github.base_ref }} }
```

**Defense-in-depth (repo setting):** also enable branch protection **"Require branches to be up to
date before merging"**. It catches the *overlapping-edit* half of a stale-base clobber (where the PR
and main touched the same lines); `check-append-only.mjs` catches the *disjoint* half (main added
entries the PR's old base never saw) on the changelog files. Neither alone is sufficient — the
brainstorm (antigravity + codex + claude-9arm) converged that you want both.

**Human pre-merge step (backs the setting; required for `gh`/CLI merges the GitHub button can't gate):**
before merging any PR, `git fetch origin main` and check whether main advanced past the PR's branch
point — `git merge-base --is-ancestor origin/main HEAD` (non-zero exit = main moved), or
`git log --oneline origin/main ^HEAD`. If it moved, **rebase onto latest main, re-run the tests, and
re-run `/scrutinize` (re-stamp the marker — HEAD moved) before merging.** The branch-protection setting
enforces this on the GitHub merge button; this is the same discipline for a local/CLI merge. Skipping it
is exactly how #553 shipped a stale-base clobber onto `main`.

The append-only guard is CI-only (needs the base + HEAD blobs + PR title). Core-**code** clobber is
guarded per-seam by AST wiring tests (e.g. `MIT/test/test_stage_c_wiring.py` from #608), not this
generic guard.

The scrutinize gate is **not** in the local pre-push hook — it needs the PR body + HEAD SHA,
which only exist on the PR. It is a CI-only guard (like `check-issue-ref.mjs`). To record a
verdict, run `/scrutinize` on the final state and paste the marker into the PR body:

```
<!-- scrutinize verdict=ship commit=<full HEAD sha> -->
```

## Not yet wired (follow-ups)

- Add all three checks to `.github/workflows/ci.yml` (on the `ci/dispatcher-gate` branch / PR #361).
- Cross-manga render-regression gate (Fix 3): deterministic dump/replay over a golden corpus via
  `MIT/eval/render_defects.py`, failing a PR whose defect scorecard worsens. Tracked separately.
- Ledger reconciliation check (fail a PR that leaves a `🔴 UNTRACKED` row or a closed issue in an
  open row).
