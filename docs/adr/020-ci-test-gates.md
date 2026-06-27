# ADR 020 — CI test gates: GitHub Actions per-service, Node 22 + bun, green-from-day-one skip-list

- **Status:** Accepted (2026-06-28) — implemented (#355). First CI in the repo; the 176 existing test files (Backend 70 · MIT 88 · Frontend 18) previously ran only when a dev remembered to.
- **Context:** the team is now two active self-merging devs (xenodeve + akkanop-x, who self-`/scrutinize`s and self-merges) with no automated gate. CodeQL was the only check. Follow-ups split out: dispatcher for safe required-checks (#356), CI hardening (#357), shrink the skip-list (#358), MIT torch lazy-import (#359).

## Context

There was no `.github/workflows/`. Quality rested entirely on personal discipline — fine while it held (revert rate 0.6 %, 100 % of closed issues completed), but unguarded against one tired late-night self-merge, and increasingly fragile as a second dev merges independently. The goal: run the tests that already exist, automatically, on every PR — without shipping a gate that is red on day one (a perpetually-red gate gets ignored, which is worse than none).

Three realities shaped the design, each discovered by running the suites rather than assuming:

1. **`npm ci` fails on `main`** — `Backend/package-lock.json` is stale vs `package.json` (aws-sdk drift). The repo is actually built with **bun** (`Backend/bun.lock` is the maintained lockfile, per the README).
2. **Backend has ~8 pre-existing-failing suites** (batch/cache, tied to the #143 NDJSON-batch decision) that fail even run in isolation — not flakiness.
3. **MIT couples torch into `manga_translator/__init__.py`**, so every test — even pure-logic ones — drags in the multi-GB ML stack; a few need models/GPU.

A fourth surfaced locally: **Jest 30 does not support Node ≥ 26** (`setTimeout` is undefined in its sandbox, crashing the orchestrator specs). The dev box ran Node 26.

## Decision

1. **Three path-filtered workflows, one per service** (`backend-ci`, `frontend-ci`, `mit-ci`), each gated on `on.pull_request.paths`. A Frontend-only PR does not pay for Backend/MIT. (Trade-off: this interacts badly with required status checks — addressed in #356 before branch protection is enabled.)

2. **Backend: bun install + jest under Node 22, `--runInBand`, with a Redis service container.** `bun install --frozen-lockfile` (not `npm ci` — the npm lockfile is stale), then `npx jest` on **Node 22** (Jest 30 supports 18/20/22, not 26). `--runInBand` keeps the Redis-backed specs deterministic. Dummy env vars prevent import-time config crashes.

3. **`Backend/jest.ci.config.js` inherits package.json's jest block and only adds a skip-list.** `const base = require('./package.json').jest; module.exports = { ...base, testPathIgnorePatterns: [...] }` — a single source of truth, so a future jest-config change never silently drifts CI from local `npm test`. The skip-list holds the documented pre-existing failures, each removed as its suite is fixed (TDD; `books-health.spec.ts` was the first — fetch mocked by assignment, not `spyOn` on the lazy global). The list must converge to zero; new skips require a tracking issue (#358).

4. **Frontend: bun test, excluding `*.integration.test.ts`** (those hit a live `:4000` dev server and belong in E2E, not unit CI). The naming convention auto-includes new unit tests and auto-excludes new integration tests.

5. **MIT: pytest report-only (`continue-on-error: true`) for now.** Until torch is lazy-imported (#359), a real gate would mean a multi-GB install per PR and uncertain green; report-only ships value without blocking on an unverified suite. The job name `pytest (report-only)` keeps the status honest.

## Alternatives considered

| Option | Verdict |
|---|---|
| **bun install for Backend** | **chosen** — matches how the repo is actually built; `npm ci` fails on the stale lockfile. |
| `npm ci` | rejected — `package-lock.json` is out of sync with `package.json` on main. |
| **Inherit jest config from package.json** | **chosen** — one source of truth; CI never drifts from local. |
| Copy the jest config into the CI file | rejected (scrutinize MAJOR 2) — two sources of truth, silent drift. |
| **Skip-list of pre-existing failures** | **chosen** — green day one; documented + tracked (#358); converges to zero. |
| Block on all suites immediately | rejected — gate red on day one from ~8 known-broken suites → ignored. |
| Fix all pre-existing failures first | rejected — bigger scope (some tie to the open #143 decision); blocks the gate landing. |
| **MIT report-only** | **chosen** for v1 — value now, no false-blocking; real gate after #359. |
| Single matrix workflow | rejected — per-service path-filtering is cleaner as separate files. |

## Consequences

- **Positive:** every PR touching a service now runs its unit suite automatically (backend 62 suites / 616 tests, frontend 120, both verified green on CI). Quality no longer rests solely on the discipline of two self-merging devs. The skip-list makes the known-debt visible and shrinking, not hidden.
- **Negative / costs:** path filters + required checks need the #356 dispatcher before branch protection, else cross-cutting/docs-only PRs stick on a never-running required check. MIT is effectively unguarded until #359 (documented, report-only). The dev box must use **Node 22** to run Backend tests locally — Node 26 crashes Jest 30 (nvm-windows + `nvm use 22.23.1`).
- **Follow-up:** #356 (safe required-checks → enable branch protection), #357 (pin bun-version + empty-files guard), #358 (shrink skip-list to zero), #359 (lazy-import torch → flip `mit-ci` to blocking).
