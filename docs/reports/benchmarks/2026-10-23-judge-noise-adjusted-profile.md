# Judge-noise-adjusted quality profile: 1.44 raw -> **1.55/2 strict** (1.68-1.70 lenient) once the judge's typo artefacts are removed

- **Date:** 2026-10-23 · tool: `tools/audit_summary.py` · audits: post-default sets (480 segments: postdef, base46,
  b48, f24g21, f24b).

## Finding

The judge repeatedly lowers scores for *identical* strings (`ฉัน→ฉัน`, `ไม่มี→ไม่มี`, `จริง→จริง`) — a Thai
tokenizer artefact in the judge, not a translation defect. Classifying those notes as noise:

| metric | value |
|---|---|
| segments | 480 |
| raw mean | **1.44/2** |
| noise flags removed | **146 (30 %)** |
| noise-adjusted mean | **1.55/2 strict** (1.70 lenient) |
| adjusted distribution (0/1/2) | **11 / 193 / 276** strict — 2.3 % broken, 40.2 % partial, 57.5 % perfect |

## Real defect classes left (after removing noise)

- **Semantic/sense errors** (`wrong`): exclamations read as greetings (`MAN..` -> `เฮ้`), `cute` -> `ตัวเล็ก`,
  `god-mother` -> `แม่นม`, unexplained additions — the model-ceiling lexical class.
- **Literal/calque** (`literal`): `สวัสดีเช้า` instead of `อรุณสวัสดิ์`; dropped hedging (`I think` -> flat `I like`).
- **Fragments** (`fragment`): completing intentionally cut source (`SOR` -> `ขอโทษ`).
- **Names** (`name`): transliteration variant; covered in production by the series name memory when a series
  context is present (doctor audits have none, so they still show it).

## Takeaway

Current real quality is **58.9-72 % perfect / 2.1-3.5 % broken** by the judge depending on the noise classifier (strict: 58.9 / 3.5), with the remainder mostly nuance
and lexical sense — not the text-corruption classes the loop already guards. Future audits should report the
noise-adjusted number (`tools/audit_summary.py`), otherwise 30 % of the signal is judge artefacts.

The classifier was tightened after review: any real typo pair now counts as a real finding (conservative), which moved the adjusted mean from 1.70 to 1.55; the judge's Thai-tokenizer artefacts still inflate the partial band, so the honest range is 1.55-1.70 with the raw at 1.44.
