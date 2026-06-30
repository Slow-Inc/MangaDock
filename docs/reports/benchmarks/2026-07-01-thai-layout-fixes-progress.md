# Thai EN→TH render fixes — work log / resume-here

**Started:** 2026-07-01 · **Branch:** `worktree-feat-mit-font-s1`
**Trigger:** full-chapter Gal Yome benchmark + user per-image defect review (see
`2026-07-01-full-chapter-onepunch-validation.md` and memory `feedback_benchmark_defect_checklist`).

This log is updated after **every** step so a fresh session can resume without re-deriving.

## Defect classes to fix (priority by impact × tractability)

1. **item 9 — Thai word-break** (mid-word split). PERVASIVE. — *in progress*
2. **item 2 — Thai under-fills big bubbles** (smaller than original). PERVASIVE. — coupled to #1
3. **item 3 — phantom "เงียบ"** (det_sfx non-ASCII false-positive escapes #278 gate). p09/p19.
4. **item 10/11** — patch pixelation (SFX), ghost original text (incomplete inpaint). Rarer.

## Done so far

- [x] Full-chapter benchmark (30 Gal Yome pages + One Punch) rendered & assessed → report
  committed `9954dcf`.
- [x] Benchmark checklist (memory) extended with 3 new classes (item 9/10/11) + instances →
  team copy committed `626713a`, personal copy synced.
- [x] Mapped render pipeline (Explore agent): wrap root = `text_render.py:_split_into_syllables`
  (`:665`); under-fill root = `rendering/__init__.py:_bubble_fit_layout` (`:76`).
- [x] Confirmed `_HAS_PYTHAINLP=True` in worker venv; `word_tokenize` segments correctly
  (keeps "ข้างนอก" whole, inserts ZWSP). `syllable_tokenize` NOT available in pythainlp 5.3.4.
- [x] **Reproduced bug #1 deterministically** (`calc_horizontal` on "ไปกินข้างนอกกันเถอะ"):
  - `mw ≥ longest_word_w` → correct word-boundary wrap (ข้างนอก stays whole).
  - `mw < longest_word_w` (e.g. 76 < 96px) → over-width pass char-splits mid-word.
  - **Root:** `_split_into_syllables:680-691` char-splits any word with no Latin hyphenator
    syllables; the greedy packer then breaks inside it only when the column is narrower than
    the word. So the visible bug = the bubble column is being squeezed narrower than the
    longest atomic Thai word (couples to #2 `_bubble_fit_layout` squeeze).

## Diagnosis update (root of #9 AND #2)

- `_bubble_fit_layout` (`rendering/__init__.py:76`) ALREADY guards against char-split: rejects
  fonts where longest word > column (`:110`), squeeze floor = longest word (`:122`). The two
  bubble-fit paths (`:316` sole-occupant, `:346` shared-balloon) use it → safe.
- The visible breaks come from dialogue **misrouted to `_clean_layout_dst`** (`:196`, the
  narration path) when `bubble_box is None` (det_bubble_seg misses egg/oval/heart bubbles) or
  `fills_bubble_width < 0.72`. That path: (a) small absolute font → **item 2 under-fill**;
  (b) `wrap_w` = source bbox width, NOT floored to longest word → **item 9 mid-word break**.
  The code at `:229-233` already widens wrap_w for big display captions but NOT for normal
  narration/dialogue.
- **Fix chosen (universal, low-risk):** floor `wrap_w` at the longest atomic-word width in
  `_clean_layout_dst` (mirror `_bubble_fit_layout`'s existing guard). Extract a pure helper
  `longest_token_width(text, font_size, lang)` for testability + DRY. This kills mid-word breaks
  on every path. (Font-size under-fill for misrouted dialogue = separate, deferred — root is the
  discriminator/detection; tracked as item 2 follow-up.)

## Done — item 9 fix (code, unit-verified)

- [x] TDD: added 4 tests to `test/test_thai_wrap.py` (`longest_token_width` word-atomic for
  Thai/Latin/empty; `_clean_layout_dst` keeps "ข้างนอก" intact in a narrow box). RED confirmed
  (AttributeError), then GREEN.
- [x] Added pure helper `text_render.longest_token_width(font_size, text, language)` — width of
  widest atomic (ZWSP-segmented) word.
- [x] `_clean_layout_dst` (`rendering/__init__.py:234`) now floors `wrap_w` at
  `longest_token_width` so a Thai/CJK word is never force-split mid-word on the clean-layout path.
- [x] Regression: `test_thai_wrap` 12/12, render suite 68 passed / 1 pre-existing async-infra fail
  (`test_default_renderer`, pytest-asyncio not installed — unrelated). **Characterization goldens
  PASS** → byte-identical for Latin + existing Thai golden.
- Worker runs Store-python311 but with MIT/.venv site-packages; `.venv` = torch 2.5.1+cu121, cuda
  True, pythainlp ok. Restart worker with `.venv` python to load the fix.

## Done — item 9 fix VISUALLY VERIFIED (commit 63ea441)

- [x] Restarted worker on MIT/.venv (cu121), re-rendered ds25 / ds18 / ds11 through the worker.
  - **ds25**: "ไปกินข้าว/นอกบ้าน/กันเถอะ" + bottom "เราไม่ได้/ไปกินข้าว/นอกบ้าน/มานาน/แล้ว" — every
    line breaks on a word boundary; no "ข้างนอก"→"ข้า/งนอก". Text also fills the bubble fuller.
  - **ds18**: "พยายาม" whole on one line (was "พยาย/ามให้"); "ไม่เป็นไร" whole (was "ไม่เป็/นไร");
    bottom bubbles word-boundary + large.
  - **ds11**: no mid-word breaks anywhere (top "นายทั้งสองรู้/ใช่ไหมว่า/ที่นี่ห้ามมี/ความรัก",
    mid "พวกเรายกย่อง/คนที่มีพรสวรรค์/อย่างพวกคุณ/ทั้งสอง"); Latin column unaffected.
  - Composites saved to `scratchpad/verify/v25.png|v18.png|v11.png`.
- **Verdict: item 9 (Thai/CJK mid-word break) FIXED on the clean-layout path. No Latin regression.**
  Side-effect: item 2 (under-fill) visibly improved on misrouted dialogue because the floored
  column lets the existing fitter use more width — but font sizing is unchanged, so a dedicated
  item-2 pass is still warranted.

## Remaining items — root cause + why each needs a DECISION (not just code)

Item 9 (the most tractable of the two pervasive classes) is **done + verified + DoD-closed**
(commit `ee2e512`). The rest were each investigated to root; none has a clean, low-risk,
language-agnostic fix that wouldn't trade one defect for a regression elsewhere. Concretely:

### item 2 — Thai dialogue under-fills big bubbles (PERVASIVE)
- **Root (confirmed in code):** dialogue is routed to `_clean_layout_dst` (small `clean_fs`)
  instead of `_bubble_fit_layout` (fills balloon) in two cases:
  1. `bubble_box is None` — `det_bubble_seg` missed the balloon (egg/oval/heart shapes). Fixing
     this is a **detection-model** change, out of render scope.
  2. `fills_bubble_width(rw, bw) < 0.72` — a dialogue line in a *round* balloon legitimately spans
     only ~0.60–0.85 of the (wide) bubble, so it falls under 0.72 → clean-layout → small.
- **Why it's a decision, not a patch:** the 0.72 threshold was *measured* to separate dialogue
  (rw/bw ≈0.88–0.90) from narration (≈0.40–0.59) and chosen to stop the One-Punch "THIS BRAT…"
  narration **ballooning up** (`render_overlap.py:120` docstring). Lowering it (e.g. → 0.62) to
  catch round-bubble dialogue re-opens that regression window (the 0.59–0.72 gap). The equivalent
  alternative (size clean-layout font by the bubble when `bubble_box` exists) carries the *same*
  trade-off. **Needs:** a user risk call + a fresh One-Punch + full-chapter A/B to confirm no
  narration re-balloon. Confounded by translate non-determinism → offline pixel-band A/B.

### item 3 — phantom "เงียบ" (det_sfx false-positive)
- **Root (confirmed):** a det_sfx false-positive whose 48px line-OCR read is **non-ASCII** passes
  `should_rescue_sfx` (the #278 gate drops only *ASCII*-readable reads — `ocr_vlm.py:64,793`), goes
  to the VLM, which **hallucinates** a silence SFX ("เงียบ", the Thai of しーん) instead of replying
  empty as the prompt asks. Kept + rendered over a notepad (p09) / dialogue (p19).
- **Why it's a decision:** the rescue EXISTS because real stylized SFX come back non-ASCII from the
  OCR — so "drop all non-ASCII reads" would kill legitimate SFX rescue. Distinguishing a
  false-positive from a real dropped glyph needs one of: a brittle token blocklist (special-cases
  Thai, violates the North Star), an ink/stroke-density heuristic (heavy, risky), or
  containment-in-dialogue (misses the p09 notepad). **No simple win.** Best partial candidate: drop
  a rescued SFX whose box is ≥X% contained in a *dialogue* region (catches p19, not p09).

### items 10 / 11 — rarer, deeper-stage
- **10 (SFX patch pixelation, "ฮึย"):** SFX keeps the legacy stylized warp path (not clean-layout);
  the supersampling that smooths dialogue glyphs isn't applied to the SFX patch → aliased edges.
  Fix is in `text_render` / patch supersampling — contained but must not change dialogue.
- **11 (ghost original text behind inpaint, p19/p27):** inpaint mask doesn't fully cover the source
  lettering (cursive "What…here?" on p27 untouched) → original bleeds behind the translation. Root
  is `mask_refinement` / `inpainting` coverage, not render. Likely a mask-dilation tune; needs a
  before/after on the inpaint mask, not the final composite.

## Decision requested (notified)
Items 2 & 3 carry real regression trade-offs only the user should weigh (One-Punch narration
re-balloon; dropping real SFX). Asked for direction: (A) item 2 threshold/sizing with a full
One-Punch A/B safety net, (B) item 3 partial containment gate, (C) item 10/11 first (contained, no
pervasive-regression risk), or (D) ship item 9 alone for now.

## Decisions / landmines

- Fix must stay **language-agnostic** (don't special-case Thai in a way that regresses Latin
  goldens in `test_calc_horizontal_characterization.py`).
- `_safe_char_split` is the correct *last resort* for a genuinely over-wide word (keeps Thai
  combining marks on base) — keep it for that case only.
- Worker on :5003 runs this branch's code from `D:/Github/MangaDock/MIT/.venv` (cu121).
