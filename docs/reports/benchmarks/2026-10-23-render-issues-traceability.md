# Old render-issue traceability (issue -> current test/evidence)

- **Date:** 2026-10-23 · quick audit of the still-open render issues against HEAD: which ones now have a pinned fix,
  which are already covered by tests, and which are still genuinely open.

| issue | status on HEAD | evidence |
|---|---|---|
| #791 rendered Thai drops every space | **covered by tests** | `test_thai_wrap.py` (13 `#791/#792/#793` tests pass) |
| #792 space after punctuation deleted | **covered by tests** | `compact_special_symbols('Well,I said.  so!Yes.')` returns the string unchanged; wrap tests pass |
| #793 tone marks vanish with the production font | **covered by tests** | `test_thai_wrap.py:364` (Prompt/OpenType path) |
| #842 numbers split by cleanup | **fixed in this loop** | number tokens are atomic in the wrap (47 Thai-wrap tests) |
| #844 Thai wrap cuts at a segmenter tie | **verified, test added** | `_insert_thai_word_breaks('นาทีละ ...')` -> `นาที\u200bละ` |
| #873 text near the page edge is cut off | **verified fixed on a real page** | Otome p0's gutter narration was clipped at x<0 before the page-bounds clamp; a fresh render at HEAD keeps it inside (crop checked 2026-10-23) |
| #876 neighbour balloon bbox cuts the interior | **mechanism pinned by tests** | `test_render_overlap.py` (`clamp_box_to_neighbors` cases incl. both sides + margin) |
| #899 outlined JP lettering averages to grey | **still open / not re-measured** | needs a contrast measurement on the JP page; not attempted here |
| #897 JP->TH production path unevaluated | **partially updated** | JP page audited: gate clean, judge 1.57/2; layout squeeze documented with an opt-in fix (#1006); the corpus only has **one** real JP page (uploaded twice) |

## Note

Most of these fixes landed before this loop and are only waiting for PR #794 to merge: the issues stay open by
convention (close on merge), not because the defect is still reproducible. #899 is the one worthwhile open item.