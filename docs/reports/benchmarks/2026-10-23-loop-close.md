# Quality loop close record (2026-10-23)

Final verified state of `feat/mit-quality-loop` (PR #794) at the end of the quality loop window. This is the page to read
before touching the branch; the detailed evidence lives in the reports linked below.

## Verified at close (commands re-run at this head)

```
HEAD        3fce711f docs(vault): record v6-v11 final state, latency win and new licences
tests       997 passed, 4 skipped (fast suite, torch-free stub)
checks      logic gate 1m48s | heavy ML 5m9s | backend 51s | Vercel deployment completed  -> all pass
#642        OPEN, draft, CONFLICTING (head d92f3b94) - the only external blocker
merge-tree  conflicts limited to DONE.md, docs/adr/README.md, docs/reports/system-impact-report.md
worktree    clean; branch in sync with origin
```

## End state

- **Quality**: sweeps v7-v11 all report dashboard page gate `{}` and leftover `{}`; judge raw **1.38-1.44/2**
  (window-dependent), strict-adjusted **1.53-1.60**, broken share **2.2-2.4 %**.
- **Latency**: SFX vision calls batched concurrently + 768 px JPEG uploads cut `textline_merge` from **32-37 s to 8.4 s**
  and an SFX-heavy page from **54-68 s to 26 s**; the A/B showed the upload change is quality-neutral.
- **Robustness**: OCR single-letter garble repair (`N`->`NOT`), series name memory token-level fix, precision licences
  (opinion tags, reader-site credits/URLs, digit-suffixed names, strong negation, Thai emphasis/question particles).
- **Generalisation**: 6 unseen series / 31 pages, **30/31 gated clean** (the exception is legitimate Latin proper names);
  two free-standing-text render spills logged on #642.
- **Tests**: 997 passing, including new unit tests for every guard licence and the pure stability/retry helpers.

## What remains (all external)

1. **#642** needs a docs-only union merge (commands in `2026-10-23-premerge-verification.md`); then retarget #794 to main
   and repeat the three-doc union merge there (runbook in the same file) and close the loop issues listed there.
2. **Vercel** build quota fluctuates externally; deployments have completed on several heads, so the docs-function fix
   (#1064) is verified.
3. Future quality campaign (needs a decision, not tuning): the remaining zero-score segments are model-sense errors and
   the identified next lever is a series-scoped term/register memory (queued with evidence in `next-loop-backlog.md`).

## Evidence index

`quality-loop-handoff.md` (one-page state) -> `final-quality-baseline.md` (every sweep/judge) ->
`quality-loop-final-report.md` (story) -> `guard-precision-licences.md`, `ocr-single-letter-garble.md`,
`sfx-vlm-prefetch.md`, `omission-verify-integration.md`, `new-manga-generalization.md`, `premerge-verification.md`,
`next-loop-backlog.md` (do-not-repeat list).