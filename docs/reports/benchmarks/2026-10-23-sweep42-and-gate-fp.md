# Fresh 20-page sweep (post-default): 4 foreign-script glitches all fixed live; a gate false positive found and fixed

- **Date:** 2026-10-23 · 20 corpus pages not re-translated this round, current defaults, `MIT_LOG_GLITCH=1`, gate.

## Live guards

| glitch | injected class | outcome |
|---|---|---|
| `การกลืน融入เข้ากับ...` (CJK) | foreign_script | retried -> `การกลืนตัวเองเข้ากับฝูงชน...` |
| `ชิอينا มูซึกะ` (**Arabic** leak in a name) | foreign_script | retried -> `ชิอิโนะ มูซูกะ` |
| `...ผู้หญิงที่总有ผู้ช...` (CJK) | foreign_script | retried -> clean Thai |
| `...ยากที่จะเข้าหาผู้หญิงที่...` | foreign_script (retry of the same page) | final clean |

**0 foreign-script regions remained** in the final payloads: a CJK leak, an **Arabic** leak (new class for this
corpus) and a second CJK leak were all caught and re-asked to a clean answer. Gate: 1 violation (see below).

## Gate false positive found and fixed (#990)

`inconsistent_name: TSUKUYOMI` was triggered by a **clause** (`ฉันอยากเห็นเธออีก`, 17 chars) being stored as the name's
spelling: `extract_glossary` took the longest Thai run of any region that merely *mentioned* the name. Extraction now
requires a **name-focused** line — the spelling run must be 3-12 chars and the translation no longer than the
spelling + 6 — the same rule the series memory uses. With the fix the sweep reports the true inconsistency
(`สึกุโยมิ` vs `ทสึคุโยมิ` on the Tsuki pair) instead of a fabricated one. This also stops clause text from entering the
batch/series glossary, matching the name-memory learning rule.

## Note

The sweep ran without `series_context` (doctor path), so the series name memory is a no-op there; the production path
with a series context now applies the remembered spelling before rendering (verified earlier: 2 fixes, both pages
`สึกุโยมิ`).