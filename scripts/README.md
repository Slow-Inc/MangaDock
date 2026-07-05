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
```

## Not yet wired (follow-ups)

- Add both checks to `.github/workflows/ci.yml` (on the `ci/dispatcher-gate` branch / PR #361).
- Cross-manga render-regression gate (Fix 3): deterministic dump/replay over a golden corpus via
  `MIT/eval/render_defects.py`, failing a PR whose defect scorecard worsens. Tracked separately.
- Ledger reconciliation check (fail a PR that leaves a `🔴 UNTRACKED` row or a closed issue in an
  open row).
