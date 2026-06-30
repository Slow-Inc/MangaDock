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

## Next

- [ ] VISUAL verify (verify-before-claiming): restart worker on `.venv`, re-render ds25/ds18/ds11,
  confirm mid-word breaks gone. If a flagged bubble routes through bubble_fit (not clean_layout)
  the break would persist → would mean hypothesis wrong, iterate.
- [ ] item 2 (under-fill) — deferred; root is discriminator/detection routing dialogue to
  clean-layout. Higher risk.
- [ ] item 3 phantom เงียบ; items 10/11.
- [ ] TDD: failing test in `test/test_thai_wrap.py` (or calc_horizontal characterization) asserting
  a Thai word that fits the column is never split mid-word.
- [ ] Fix `_split_into_syllables` to keep no-hyphenation words atomic (split only when the word
  itself overflows), + ensure `_bubble_fit_layout` never squeezes below longest-word width.
- [ ] Re-run characterization goldens; update any that legitimately change.
- [ ] Re-benchmark affected pages; update validation report; commit.

## Decisions / landmines

- Fix must stay **language-agnostic** (don't special-case Thai in a way that regresses Latin
  goldens in `test_calc_horizontal_characterization.py`).
- `_safe_char_split` is the correct *last resort* for a genuinely over-wide word (keeps Thai
  combining marks on base) — keep it for that case only.
- Worker on :5003 runs this branch's code from `D:/Github/MangaDock/MIT/.venv` (cu121).
