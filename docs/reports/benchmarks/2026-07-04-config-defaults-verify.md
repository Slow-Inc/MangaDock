# Config-defaults verify-and-close — detection/inpaint sizes at MIT's tuned values (Master Plan 2 P5)

**Defects (md, master-plan-2 §3):**
- **#13** `detection_size` overridden to 2048 (< tuned 2560) → ~36% fewer px, small/faint JP untranslated (**human-level blocker**).
- **#14** `inpainting_size` overridden to 1536 (< tuned 2048) → blurry erase / screentone halos.

**Cluster approach:** P5 Approach A — **verify-and-close, NO production code change.** The code fix already
landed (PR #252, commit `d6fca527`): config-building moved to `Backend/src/books/mit-config.ts`, made
env-overridable, and unit-locked. This pass verifies the deployed truth and ties each metric to its defect.

## Verification (deterministic, evidence-backed)

| check | evidence | result |
|---|---|---|
| default `detection_size` = tuned 2560 (not old 2048) | `mit-config.ts:234` `intEnv('MIT_DETECTION_SIZE', 2560)` | ✅ |
| default `inpainting_size` = tuned 2048 (not old 1536) | `mit-config.ts:264` `intEnv('MIT_INPAINTING_SIZE', 2048)` | ✅ |
| defaults unit-locked | `books-mit-config.spec.ts:73-74` assert `2560`/`2048` | ✅ |
| env-override still honored (tight-VRAM hosts) | spec:82-89 (`1536`→`1024`) + spec:116-117 | ✅ |
| **no stale low override in the deployed `.env`** | `grep -oE 'MIT_DETECTION_SIZE|MIT_INPAINTING_SIZE' Backend/.env` → **empty** | ✅ |
| full config suite green | `npx jest books-mit-config.spec.ts` → **34/34 pass** (11.1 s) | ✅ |

### Running-config snapshot (the defect's real re-regression risk)
Per master-plan §6 rule (a stale `.env` can silently re-regress on the VRAM-tight box), the deployed config is
built per-request by `mit-config.ts`. With **no `MIT_DETECTION_SIZE`/`MIT_INPAINTING_SIZE` in `Backend/.env`**,
every request carries `detection_size=2560`, `inpainting_size=2048` — the tuned defaults. Snapshot confirms the
defect (Backend pushing *below* MIT's own tuned sizes) is **not present** in the live deployment.

## Result — before → after (per defect)
| defect | before (the regression) | after (deployed today) | status |
|---|---|---|---|
| #13 detection | Backend emitted **2048** (~36% fewer px) → small/faint JP dropped pre-OCR | **2560** (tuned), env-overridable, no low override | ✅ resolved |
| #14 inpaint | Backend emitted **1536** → downscale-blur / screentone halo | **2048** (tuned) | ✅ resolved |

## Assessment
- **fix-root:** the "Backend silently below MIT's tuned defaults" regression is closed at the config layer and
  guarded by 34 unit locks; the deployed `.env` carries no re-regressing override. Ties directly to defects #13/#14.
- **no-regression:** env-override path preserved for legitimately tight-VRAM hosts (a hard clamp was rejected —
  they must be allowed lower or they OOM). `renderConfigHash` still folds the sizes (cache correctness intact).
- **honest limitation — pixel-confirmatory run deferred.** The stage-isolated pixel benchmark (detection
  region-count @2048 vs @2560; LaMa Laplacian-variance @1536 vs @2048) requires loading the detection/inpaint
  models in-process. This dev box is VRAM-tight and the MIT worker currently holds VRAM (serving on :5003), so a
  second model load risks OOM. Rather than fabricate metrics, the pixel numbers are **not** claimed here; the
  config-layer resolution above is fully evidenced. The pixel run is a confirmatory follow-up for a dedicated
  (worker-down) session. This does not block close: P5 is *verify-and-close* of an already-merged code fix, and
  the config truth — the thing that actually determines what the pipeline runs at — is verified.

**Verdict:** P5 config-defaults **verified & closed** at the config layer (defects #13/#14 resolved in the live
deployment); pixel-fidelity confirmation deferred to a worker-down session (documented, not faked).
