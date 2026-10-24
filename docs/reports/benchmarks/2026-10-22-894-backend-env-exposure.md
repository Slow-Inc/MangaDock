# Backend env exposure for the two unreachable MIT levers (#894)

- **Date:** 2026-10-22 · **Issue:** #894 · **Change:** `Backend/src/books/mit-config.ts` (+ spec).
- **Why:** the config audit (#893) found two MIT features the Backend could never enable:
  `detector.det_bubble_synth` (#170/#178 synthesized balloons) and `render.fit_below_floor` (#883's overlap
  opt-in).

## Change

| env (unset → payload byte-identical) | payload |
|---|---|
| `MIT_BUBBLE_SYNTH=1` (needs `MIT_BUBBLE_SEG`) | `detector.det_bubble_synth: true` |
| `MIT_FIT_BELOW_FLOOR=1` | `render.fit_below_floor: true` |

Both follow the existing `flagEnv(...)` pattern; the env list doc block in `mit-config.ts` now documents them.
`renderConfigHash` already hashes every `MIT_*` env key, so patch-cache keys roll automatically when either is
switched.

## Verification

| check | result |
|---|---|
| new spec tests (synth on, fit_below_floor on, both absent when unset) | 3 added |
| `npx jest src/books/books-mit-config.spec.ts` | **45 passed** |
| MIT side | unchanged — both Pydantic fields already existed |

`npx tsc --noEmit` on the whole Backend reports pre-existing errors in other spec files (`llm.service.spec.ts`,
`patch-store.spec.ts`) that this change does not touch; `nest build` excludes specs.

## Result

Every MIT quality lever shipped in this loop now has a path from the Backend: the two dead keys from #892/#893
are fixed and the two unreachable features are exposed.
