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
## Extension: missing-mark tokens (ไม -> ไม่, ให -> ให้, ไมใช -> ไม่ใช่)

Dictionary-based mining (pythainlp, 15.6k stored regions) surfaced three recurring invalid tokens: **ไม x100**,
**ให x75**, **ไมใช x36** — all missing a tone/ending mark. All sampled contexts were the misspelling, and because
the fix runs at **token level** (with `keep_whitespace=True`), real words that contain the same letters are untouched:
`ไหน`, `ไม้`, `ให้` stay as-is.

- Corpus validation: **219 of 15,590 regions (1.4 %)** are corrected by the normalizer (the earlier `แล่ว` 44 plus
  these tokens); sampled diffs are all clear fixes (`มันไมใช่!` -> `มันไม่ใช่!`, `ทำให` -> `ทำให้`, `ขอให` -> `ขอให้`).
- Cost: **0.04 ms/segment** (tokenizer is already loaded for Thai wrapping).
- Tests cover the new mappings and the untouched real words; the gate's `common_typo` rule uses the same normalizer,
  so a regression is reported deterministically.
## Adjacent duplicate tokens: measured, rejected

Mining adjacent identical Thai tokens (length >= 2) over the stored corpus found 18 types / 412 occurrences, but
**96 % are intentional**:

| token | count | context | verdict |
|---|---|---|---|
| `ฮ่า` | 274 | laughter | intentional |
| `เธอ` | 44 | `...ของเธอ เธอจึง...` (grammar: her ... she therefore ...) | intentional |
| `ลิ`, `ไอ` | 30 | inside names/letter spellings (`ลิลิธ`, `ซีไอไอ`) — tokenizer artefact | not a duplicate |
| `ฮิ`, `ฮึ`, `เหอะ`, `คิก`, `ฟุ`, `ก๊าก`, `หึ`, `เฮ` | ~50 | SFX / laughter | intentional |
| `ไม่`, `อ้าง` | 3 | deliberate stutter in dialogue | intentional |
| `ที่` | 1 | `ณ ที่ที่เจ้าแสวงหา` — legit `ที่ ที่...` | intentional |

A de-duplication pass would corrupt laughter and legitimate grammar for ~1 % gain, so **no duplicate-token guard**.
Only the unambiguous missing-mark tokens from the previous section are normalised.
## Live validation (6 fresh pages, current pipeline)

Ran six real pages through the normal pipeline with the new normalizer active:

- **0 occurrences** of `แล่ว` / `แลว` / `ไมใช่` / `ทำให` / `ขอให` in the fresh outputs (previously present across the
  corpus).
- Gate: **0 violations** on all six pages.
- One guard trigger (a `dropped_question` true positive) — unrelated to this fix.

So the typo normalizer is wired into the live cleanup path, not just the unit tests.
## Formatting probes (round 3): edge whitespace stripped, nothing else

- **3+ consecutive identical Thai tokens** (repetition-loop check outside known laughter/SFX): **0 occurrences** —
  the runaway guard and the model's own behaviour leave nothing to clean.
- **Double spaces / space before punctuation / unbalanced brackets / odd quotes**: **0** in stored outputs.
- **Edge whitespace**: 42 stored regions ended with a trailing space (`'ฮ่า ฮ่า ฮ่า '`). It is never meaningful in a
  bubble line, so the final cleanup now returns `trans.strip()` (test added in the glitch-retry suite).
## Mark-only typo mining (round 4): no new safe mappings

Grouped every recurring OOV token (count >= 3) by its base letters (combining marks stripped) and looked for a
dictionary word with the same base. 11 candidates, all but none safe to auto-correct:

| candidate | count | context | verdict |
|---|---|---|---|
| `ฟึ่ก`, `ปึ่ก`, `ฟึ่บ`, `ซึ๊ง` | 136 | sound effects | intentional SFX |
| `เฮย์`, `ยิ`, `การ์`, `นี`, `บะ`, `นัม` | ~90 | inside names (`เฮย์ระคุ`, `ยามายิ`, `มิดการ์`, `เทลิคานี`, `บะนาซา`, `ปีนัม`) | names/loanwords |
| `เบ` | 39 | SFX | intentional |

No missing/wrong-mark typo beyond the already-normalised `แล่ว/ไม/ให/ไมใช` surfaced, so no further mapping is added.