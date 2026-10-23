# Fragment completion measured, and a frequent Thai typo fixed deterministically (แล่ว -> แล้ว)

- **Date:** 2026-10-23 · mining over stored payloads; code in `translation_quality.py`, cleanup wiring in
  `translators/common.py`, gate rule in `quality_gate.py`.

## Fragment completion: no guard

Mined all short all-caps fragments (`^[A-Z][A-Z'-]{1,4}[.-]*$`, 145 unique pairs). They are mostly **correct
elaborations** (`HERE.` -> `สถิตอยู่ที่นี่`, `WAIT...` -> `เดี๋ยวก่อน...`, `SKY` -> `ท้องฟ้า`), so a shape-based
"keep the cut" guard would fire on good lines. The genuinely bad cases are rare (`HEHE.` -> `เข่าเข่า.`).
**No fragment guard.**

## A frequent, unambiguous typo: `แล่ว` (45 occurrences)

The same mining surfaced a real, deterministic defect: **`แล่ว` appears 45 times** across stored outputs (mai ek
where `แล้ว` needs mai tho; `แลว` is not a Thai word at all). The judge had also flagged `ใช่แล่ว`.

Fix: `normalize_common_typos()` maps `แล่ว -> แล้ว` and `แลว -> แล้ว` in the final cleanup pass. It is
deterministic (no legitimate use of the wrong form), applies to every translated page, and needs no flag.

- Validation: **44 stored output regions** are fixed by the normalizer (45 occurrences, one region had it twice).
- `แล่ว` inside other words is unaffected (`เธออ่อนโยน...` stays `อ่อนโยน`).
- Gate: new `common_typo` rule flags any remaining occurrence (defence in depth for future regressions); old stored
  payloads now report it, as expected.
- Tests: normalizer cases + gate rule (translation-quality + gate suites 60 passed).