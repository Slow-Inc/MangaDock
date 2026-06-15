# Architecture Decision Records

Each ADR captures one significant, hard-to-reverse decision: its context, what was chosen, the
alternatives rejected, and the consequences. They document decisions **already in the codebase**
(unless marked *pending*), so a new maintainer — human or agent — can recover the *why* without
re-deriving it. New quality/perf-affecting or non-trivial decisions get an ADR; a decision that
overturns an earlier one marks the old ADR **Superseded**.

| # | Title | Area | Status |
|---|-------|------|--------|
| [001](001-cloudflare-r2-storage.md) | Cloudflare R2 storage backend (`StorageProvider`, `STORAGE_DRIVER`) | Backend | Accepted |
| [002](002-mit-inpaint-luminance-reground.md) | Per-pixel luminance re-grounding for clean text erasure | MIT | **Superseded by 003** (band) / folded into 005 (family) |
| [003](003-mit-flux-klein-optional-inpainter.md) | Flux.2 Klein-4B (GGUF Q4) optional VRAM-neutral inpainter | MIT | Accepted — **impl pending** (#272) |
| [004](004-mit-patch-based-rendering-pipeline.md) | Patch-based render pipeline over a byte-identical composite contract (#156) | MIT | Accepted |
| [005](005-mit-classical-cpu-inpaint-refinement-levers.md) | Classical CPU inpaint-refinement lever family (tighten/reground/seamless/feather/…) | MIT | Accepted (opt-in) |
| [006](006-mit-bubble-aware-detection-grouping.md) | Bubble-aware detection: YOLOv8-seg balloons + safe-area wrap + SFX rescue | MIT | Accepted (opt-in) |
| [007](007-mit-render-parity-clean-layout-narrow-column-supersampling.md) | Render parity: clean-layout, narrow-column, supersampling, EN comic font, ALL-CAPS | MIT | Accepted (opt-in) |
| [008](008-mit-god-object-characterization-byte-identical-seams.md) | God-object decomposition via characterization-first byte-identical seams (S1-S26) | MIT | Accepted |
| [009](009-mit-model-lifecycle-dispatch-registry-worker-guards.md) | Model lifecycle: DispatchRegistry + ModelLifecycle + worker port guards | MIT | Accepted |
| [010](010-cross-page-translation-context-bleed-boundary.md) | Cross-page translation context + per-batch bleed boundary (#136/#155) | MIT | Accepted |
| [011](011-three-tier-translation-patch-cache.md) | Three-tier translation-patch cache (L1/L2/L3) + render-config-hash key | Backend | Accepted |
| [012](012-mit-integration-security-boundary.md) | MIT integration security: HMAC-over-raw-bytes webhook + HWID + anti-corruption | Backend | Accepted |
| [013](013-service-role-supabase-authz-in-code.md) | Service-role Supabase singleton with authorization-in-code (RLS bypassed) | Backend | Accepted |
| [014](014-frontend-single-entry-proxy.md) | Frontend single-entry `/api/proxy` (token preservation, abort propagation, asset rewrites) | Frontend | Accepted |
| [015](015-frontend-auth-context-supabase-adapter.md) | Frontend auth context: AppUser adapter, OAuth popup, cross-user cache isolation | Frontend | Accepted |
| [016](016-staff-console-out-of-band-observability-aggregator.md) | Staff Console: out-of-band aggregator µservice + per-service event streams + zero-trust signed-claim auth | Full-stack | Accepted — **planned** (#279) |
| [017](017-mit-status-stream-forward-jwt-verification.md) | MIT `/status` + `/status/stream` hybrid SSE telemetry; forwarded-JWT verified via Supabase `getUser` (refines 016's PyJWT assumption) | MIT · Dashboard | Accepted — **implemented** (#279) |

## Conventions

- Filename: `NNN-kebab-title.md`, zero-padded number.
- Body: a title line, a status/context bullet block, then `## Context`, `## Decision`,
  `## Alternatives considered`, `## Consequences` (see [ADR 003](003-mit-flux-klein-optional-inpainter.md)).
- Ground every claim in the code as it is **now**; cite `file:line`.
- 004–015 were recovered in a 2026-06-14 codebase audit (a 6-reader discovery workflow → consolidated
  backlog → per-ADR draft + adversarial verification against the live code).
