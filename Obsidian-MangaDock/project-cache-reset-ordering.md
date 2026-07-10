---
name: project-cache-reset-ordering
tags: ["project"]
description: Reader E2E of a CODE change needs cache:reset with the backend DOWN first — kill backend, then cache:reset, then relaunch — else the live L1 re-flushes the cleared L3.
metadata:
  type: project
---

A render/translation **code** change does NOT move `renderConfigHash` (it hashes `MIT_*` env vars, not source), so the translated-patch cache key is identical before/after. To see the change through the production Reader you must fully clear the cache — and **order matters**:

1. **Kill the backend first** (clears the in-memory L1).
2. **Then `npm run cache:reset`** (clears L3 `.cache/*.json` + `uploads/patches/*.png`).
3. **Then relaunch the backend.**

If you `cache:reset` while the backend is still running, its `L3BatchWriter` re-flushes the stale L1 back to L3 within ~60s, so the next translate returns a 3 ms cache HIT (old render) instead of a fresh ~30–40 s MIT render. The tell: a fresh translate-patches is ~30 s; a 3 ms response means it was cached.

Browser cache also bites: the patch URL (`.../ANY__CHS__default__p0__r0.png?v=<hash>`) carries a content-version `?v=`, so a genuinely fresh render gets a new `?v=` and the browser refetches — but only if the backend actually re-rendered. Confirmed 2026-06-14 driving the One-Punch benchmark Reader (the CHS render showed stale horizontal at 3 ms until the kill→reset→relaunch order forced a 41.8 s fresh render).

See [[project-benchmark-e2e-flow]] for the rest of the Reader E2E flow. Direct `/translate/with-form/image` (the [[project-mit-launch-env]] direct path) bypasses the backend cache entirely and is the fastest way to verify a render code change.
