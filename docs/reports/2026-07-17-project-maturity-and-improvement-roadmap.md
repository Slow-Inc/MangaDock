# MangaDock Project Maturity Assessment & Improvement Roadmap

**Status:** SNAPSHOT  
**Assessment date:** 2026-07-17  
**Tracking issue:** [#641](https://github.com/Slow-Inc/MangaDock/issues/641)  
**Scope:** Repository architecture, implementation maturity, testing, security, delivery, operations, and maintainability

## Executive summary

MangaDock is best classified as an **advanced pre-production platform**. It is
well beyond a conventional CRUD application or typical university project:
the system combines a Next.js product surface, a modular NestJS backend,
distributed caching and coordination, and a Python GPU inference pipeline for
OCR, translation, inpainting, and text rendering.

The project has two different maturity levels that must not be conflated:

- **Technical sophistication: 8.5/10.** The architecture contains real
  distributed-system and ML-production concerns: signed webhooks, SSE,
  cancellation propagation, retry/dead-letter handling, worker readiness,
  multi-layer caching, leader election, crash recovery, and deterministic
  render benchmarks.
- **Production readiness: 5.5–6/10.** The main constraints are release
  convergence, deployment artifact drift, incomplete blocking CI, limited
  frontend and cross-service E2E coverage, unresolved money-path/security
  backstops, and a large dirty working tree on the production-oriented branch.
- **Overall maturity: approximately 7.5/10.**

The next phase should be **production convergence**, not another broad feature
campaign. The highest-value work is to establish one clean trunk and one
reproducible deployment path, make CI enforce the real release contract, close
the critical correctness/security backlog, and prove the complete browser →
backend → MIT → webhook/SSE → patch-overlay path under production-like
conditions.

## Assessment method and evidence

This assessment used repository evidence rather than feature-list counting:

- Architecture and contracts:
  `CONTEXT.md`, `MIT/ARCHITECTURE.md`, `MIT/CONTRACT.md`,
  `Frontend/app/api/proxy/[...path]/route.ts`,
  `Backend/src/app.module.ts`, `Backend/src/books/mit-client.ts`,
  `Backend/src/books/mit-translation.service.ts`,
  `Backend/src/books/mit-webhook.controller.ts`, and `MIT/server/main.py`.
- Reliability and security:
  `Backend/src/cache/`, `Backend/src/auth/auth.guard.ts`,
  `Backend/src/common/middleware/hardware-id.middleware.ts`,
  `MIT/server/webhook.py`, `MIT/server/readiness.py`, and representative tests.
- Delivery and operations:
  all three GitHub Actions workflows, Dockerfiles, Compose files,
  `docs/deploy/backend-vps.md`, `docs/OPEN-WORK-LEDGER.md`, and
  `docs/RECONCILIATION-PLAN.md`.
- Repository inventory:
  998 tracked files, approximately 71,300 source lines, approximately 17,900
  test lines, and 183 tracked test files at the time of inspection.
- Workspace state:
  branch `perf/mit-layout-fit-and-merge` was one commit ahead of its remote and
  had 326 status entries: 57 tracked changes and 269 untracked entries.

Representative smoke validation:

- Backend: `mit-client.spec.ts` and `redis.service.spec.ts` — **17/17 passed**.
- MIT: `test_patch_payload.py` and `test_readiness.py` — **6/6 passed**.
- Frontend tests were not executed because Bun was unavailable in the current
  shell.

This was not a release certification. The full Backend/Frontend/MIT suites,
browser E2E, production Docker build, live Redis/Supabase integration, and GPU
render/translation benchmark were not run as part of this snapshot.

## Current architecture and maturity

### End-to-end data flow

```text
Browser
  → Next.js catch-all server proxy
  → NestJS auth / Turnstile / HWID / orchestration
  → L1 + Redis L2 + disk L3 / Supabase persistence
  → MIT FastAPI front process
  → isolated loopback GPU worker
  → detection → OCR → translation → inpaint → render
  → signed webhook or NDJSON result stream
  → Backend persistence + SSE
  → translated PNG patches overlaid in the Reader
```

This is a legitimate multi-service platform. The implementation includes
non-trivial failure handling: client abort propagation, cooperative batch
cancellation, startup retries, worker reachability probes, webhook HMAC over
raw bytes, bounded webhook retries, dead-letter reporting, reliable Redis
queues, and crash recovery.

### Dimension scores

| Dimension | Score | Evidence-based assessment |
|---|---:|---|
| ML and translation pipeline | 9.0/10 | Full detection/OCR/translation/inpaint/render pipeline, patch output, GPU worker isolation, benchmark and golden-image discipline |
| Backend architecture | 8.5/10 | Modular NestJS boundary, MIT client seam, multi-layer cache, leader election, reliable dirty queue, webhook/SSE orchestration |
| Security design | 7.0/10 | Supabase JWT, Turnstile, HWID validation, raw-body HMAC, fail-closed production secrets; important DB/RLS/idempotency work remains |
| Frontend and product flow | 7.5/10 | Server proxy, chapter batch orchestration, progress/ETA, retry, cancellation, cache-aware patch display |
| Testing | 7.0/10 | Strong Backend unit/characterization density and import-light MIT tests; frontend, integration, and GPU gates are incomplete |
| CI/CD and operations | 5.0/10 | Path-filtered CI and deployment documentation exist, but release gates and deploy artifacts do not yet form one verified contract |
| Maintainability | 6.5/10 | ADRs, contracts, characterization tests, issue workflow, and decomposition records are strong; branch/WIP and MIT-core complexity remain high |

## Specific strengths to preserve

1. **Stable service seams.** `MitClient` centralizes the Backend→MIT HTTP
   boundary, while `normalize_patch_result` centralizes the MIT patch wire
   shape. Continue extracting small, dependency-light seams instead of growing
   the orchestration monolith.
2. **Characterization-first refactoring.** The MIT batch orchestration and
   render pipeline use behavior-locking tests before extraction. This is the
   correct approach for a high-risk ML pipeline.
3. **Failure-aware asynchronous design.** Cancellation, retry, dead-letter,
   readiness, and crash recovery are designed explicitly rather than treated
   as exceptional afterthoughts.
4. **Security controls at multiple boundaries.** JWT, Turnstile, HWID, webhook
   HMAC, raw-body verification, and production boot assertions provide a good
   base for defense in depth.
5. **Durable engineering records.** ADRs, benchmark reports, the Open Work
   Ledger, system impact reports, and issue-led work make complex decisions
   recoverable across agents and sessions.

## Improvement roadmap

### P0 — Establish one reproducible release truth

**Why this is first:** A sophisticated implementation cannot be operated
reliably while the production branch, main trunk, deployment files, and
deployment documentation describe different states.

Required work:

1. Complete the remaining human-gated branch reconciliation and promote the
   validated integration state to `main`; make the production branch a thin,
   clean deployment pointer rather than an app-frozen divergent trunk.
2. Freeze or classify the current WIP, remove generated screenshots/logs from
   the worktree, and ensure every retained change maps to an issue.
3. Reconcile `Backend/Dockerfile`, root `docker-compose.yml`,
   `Backend/bun.lock`/the stale npm lock, and `docs/deploy/backend-vps.md`.
   Today the runbook describes a three-stage Bun image and a Backend+Redis
   Compose topology, while the inspected tracked Dockerfile uses single-stage
   `npm ci` and the root Compose file only defines Redis.
4. Define one production command that builds and boots Frontend, Backend,
   Redis, and the configured MIT dependency from a clean checkout.

Completion evidence:

- Clean `main` checkout with no runtime WIP.
- `docker compose config` succeeds.
- Backend image builds using the maintained lockfile and reaches its health
  endpoint with Redis healthy.
- A documented rollback to the previous image/commit is exercised once.
- Deployment runbook commands match the exact committed artifacts.

### P0 — Make CI enforce the release contract

**Why this is first:** Current workflows prove selected unit behavior but do
not prevent build, lint, browser-flow, or GPU-pipeline regressions from merging.

Required work:

1. Frontend required checks: frozen install, unit tests, lint, production
   build, and Playwright smoke tests for the critical reader/auth/translation
   routes.
2. Backend required checks: frozen install, lint, build, unit suite, and E2E
   suite with Redis.
3. Split MIT tests into:
   - an import-light CPU suite that is fast and blocking;
   - a model/GPU suite that runs on an appropriate runner or is an explicit
     pre-deploy gate.
4. Remove `continue-on-error` from the blocking MIT tier.
5. Introduce practical coverage floors by subsystem, starting with changed-file
   or critical-path thresholds rather than chasing one misleading global
   percentage.

Completion evidence:

- Required GitHub branch protection checks cover build, lint, unit, and
  critical E2E.
- A deliberately broken build and a deliberately failing MIT lightweight test
  are both rejected by CI.
- GPU benchmark evidence is attached to every render/translation-affecting
  release.

### P1 — Close money-path and authorization backstops

**Why this is high priority:** Wallet and unlock defects have direct financial
and authorization impact. Application guards are not a substitute for database
invariants.

Required work:

1. Finish the payment/unlock correctness PRD: atomic revert/claim behavior and
   price re-read inside the purchase RPC.
2. Add and verify RLS policies for `unlocks`, wallet data, and other
   user-scoped records.
3. Move webhook idempotency from in-memory/process behavior to a database
   unique constraint or durable idempotency record.
4. Add a boot-time assertion for every production-critical secret and
   environment invariant.
5. Enforce MIT as an internal service at the network layer or add authentication
   to result-list/delete and other administrative endpoints. Wildcard CORS and
   unauthenticated result management are acceptable only when the network
   boundary is proven and documented.

Completion evidence:

- Concurrent purchase tests prove one debit and one unlock.
- Database policy tests prove cross-user reads/writes are denied.
- Replayed webhook payloads produce exactly one durable effect across process
  restarts.
- Production boot fails closed when any required security variable is missing.
- An external request cannot reach MIT administrative endpoints.

### P1 — Test complete user journeys and real integrations

**Why this matters:** Unit density is strong in the Backend, but the largest
remaining risks live between services and in browser state.

Required work:

1. Add Playwright coverage for:
   - login/expired-clearance recovery;
   - opening a chapter and displaying pages;
   - single-page translation;
   - batch translation progress and completion;
   - cancellation and retry;
   - switching original/translated content without a duplicate request.
2. Add Backend integration tests with real Redis for reliable queue, TTL,
   reconnect, and cache reset behavior.
3. Add contract tests generated from or shared against the Backend↔MIT payload
   schema, including malformed, partial, duplicate, and out-of-order events.
4. Add Supabase-backed tests for wallet/unlock/RLS in an isolated test project
   or local stack.
5. Maintain a small production-faithful GPU benchmark corpus covering dialogue,
   vertical text, SFX, narrow columns, large bubbles, and source-language
   variation.

Completion evidence:

- The critical browser path passes against real Backend and Redis services.
- Contract fixtures are consumed by both TypeScript and Python tests.
- Cache recovery is tested after an actual Redis restart.
- GPU benchmark output includes before/after images, text output, config,
  timing, VRAM, and defect checklist.

### P2 — Reduce MIT and configuration complexity

**Why this matters:** The ML subsystem is the technical differentiator and also
the largest maintenance and regression surface.

Required work:

1. Continue the byte-identical, characterization-first decomposition of
   `MangaTranslator`; keep orchestration thin and move stages behind stable,
   testable interfaces.
2. Remove eager heavyweight imports from pure-logic package boundaries so
   lightweight tests do not require the full Torch/model stack.
3. Make `MIT/manga_translator/config.py` and
   `Backend/src/books/mit-config.ts` one tested contract: every deployable flag
   must be mapped intentionally, typed, documented, and included in the cache
   version when it changes output.
4. Separate deterministic render validation from nondeterministic
   OCR/translation evaluation; pin seeds/sampling where supported and record
   unavoidable nondeterminism explicitly.
5. Delete or archive superseded experimental paths once their benchmark verdict
   is durable, so flags and dead helpers do not accumulate indefinitely.

Completion evidence:

- Import-light MIT tests run without Torch/model installation.
- Contract tests fail when Backend and MIT config keys drift.
- Each enabled render branch has a call-site, focused test, benchmark evidence,
  and owner; unused branches are removed.
- Render-only replay is byte-identical for unchanged inputs/configuration.

### P2 — Define operational SLOs and recovery runbooks

**Why this matters:** Existing metrics and retry logic are useful, but operators
still need explicit thresholds and actions.

Required work:

1. Define SLOs for API availability, translation success rate, cold-start time,
   page latency, queue depth, webhook delivery, and cache durability.
2. Correlate logs and metrics with `taskId`, `chapterId`, `pageIndex`, model,
   render version, and deployment commit without logging secrets or full user
   content.
3. Write runbooks for cache dead-letter replay, Redis loss/recovery, MIT worker
   death, GPU OOM, webhook backlog, disk-cap pruning, and rollback.
4. Add storage capacity/TTL pruning and alert before disk exhaustion.
5. Test backup and restore rather than documenting backup as an assumption.

Completion evidence:

- Every SLO has a dashboard signal, threshold, and named response.
- A game-day exercise successfully recovers one Redis failure, one dead MIT
  worker, and one failed deployment using the committed runbooks.
- Dead-letter entries can be inspected, replayed safely, and audited.

### P3 — Finish product-level quality gates

Required work:

1. Add accessibility checks for keyboard navigation, modals, menus, focus
   restoration, color contrast, and reader controls.
2. Establish performance budgets for initial page load, reader navigation,
   image memory, patch count, and long-chapter behavior.
3. Exercise degraded modes: MIT unavailable, partial batch failure, stale
   patches, slow network, Supabase timeout, and Redis unavailable.
4. Remove mock-only observability/product paths before presenting them as
   production functionality.

Completion evidence:

- Accessibility and performance budgets are blocking checks for affected
  surfaces.
- Degraded-mode tests show an actionable user state rather than a silent stall
  or false success.

## Recommended execution order

1. **Release convergence:** clean trunk, Docker/Compose/runbook parity.
2. **Blocking CI:** build/lint/unit/E2E plus a split MIT test strategy.
3. **Money/security:** atomic purchase invariants, RLS, durable idempotency,
   internal MIT boundary.
4. **Cross-service proof:** browser E2E, real Redis/Supabase integration, shared
   Backend↔MIT contracts.
5. **MIT maintainability:** continue decomposition and remove heavyweight
   import coupling.
6. **Operational readiness:** SLOs, capacity controls, game-day recovery.
7. **Product hardening:** accessibility, performance, and degraded-mode UX.

This sequence deliberately prioritizes confidence in what already exists over
adding more breadth. Once P0 and P1 are complete, MangaDock can reasonably move
from **advanced pre-production** to **production beta**. Reaching mature
production status requires repeated successful deploys, measured SLOs, tested
recovery, and closure of the critical security/correctness backlog.

## Known limitations of this assessment

- It is a point-in-time snapshot of a heavily modified workspace and may include
  local work not yet reconciled to the remote trunk.
- No full test suite, coverage report, production image build, or live
  deployment was executed.
- No live Supabase/RLS, Cloudflare/Vercel, production Redis, or public-network
  security test was performed.
- No GPU translation/render benchmark was run, so render quality and model
  readiness are taken from repository benchmark records rather than re-certified
  here.
- Frontend smoke tests remain unverified in this assessment because Bun was not
  available in the current shell.
