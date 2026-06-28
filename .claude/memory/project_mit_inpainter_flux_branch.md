---
name: project-mit-inpainter-flux-branch
description: Backend/.env MIT_INPAINTER=flux_klein only works on branches containing #277 (c31ff81); on main-based branches it 500s MIT — use lama_large
metadata:
  type: project
---

`Backend/.env` is gitignored and **shared across every branch/worktree** (one file, not per-branch). The
`MIT_INPAINTER=flux_klein` value comes from **#277 (commit `c31ff81`, "Flux Klein optional inpainter")**.

**Gotcha:** `flux_klein` is a valid `Inpainter` enum value ONLY on a branch that contains #277. On any branch
that does NOT (e.g. `main`, `feat/mit-lama-lum-reground`, anything based on main before #277 merges), MIT rejects
it at request time:

```
pydantic ValidationError for Config — input_value='flux_klein'
  (enum allows: default / lama_large / lama_mpe / none / original)
```

→ **every translate returns HTTP 500.** `/ready` and `mit-health` still say 200 (the model loads fine; the enum
only fails per-request), so it looks healthy until you actually translate.

**Fix on a non-#277 branch:** set `MIT_INPAINTER=lama_large` (the enum default). For the reground epic this is also
the *correct* path — reground (#268-271) targets the LaMa band; `lama_large` already fills caption boxes pure-white.

**When you switch back to the #277/flux branch** and want Flux, set `flux_klein` again (it busts the patch cache via
renderConfigHash). Don't assume `.env` reflects the current branch — it reflects whichever branch last edited it.
Related: [[project-mit-launch-env]], [[project-mit-translate-nondeterministic]].
