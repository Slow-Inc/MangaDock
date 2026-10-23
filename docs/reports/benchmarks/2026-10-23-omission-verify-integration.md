# Opt-in omission verification pass (`MIT_OMISSION_VERIFY=1`) — wiring landed

- **Date:** 2026-10-23 · `manga_translator/omission_guard.py`, wired after the translation stage in `translate_patches`.

## Why

Clause omission is the one measured defect class with no deterministic predicate: e.g. `ALSO... THIS PIQUED MY
CURIOSITY EARLIER IN THE DINING HALL` shipped as `แล้ว... เมื่อตอนกลางวันในโรงอาหาร` (the curiosity clause gone). The
word-ratio guard was rejected because compact titles share the same ratio (2026-10-23 note). A semantic verifier can
see it: the earlier report-only tool caught it on 2 of 2 clear cases with JSON mode having 0 parse failures.

## Design (off by default)

1. After translation, collect long source lines (>= 8 English words, non-empty Thai answer).
2. One batched verifier call per pass (JSON mode), **two passes required to agree** before a line counts as omitted.
3. Re-ask only the agreed lines with a note naming the missing words; accept the new text only when it is at least
   3 characters longer (a dropped clause means more content) and non-empty.
4. Every failure is caught: the pass can never fail a page; unset flag = byte-identical old path.
5. Retry uses a fresh chatgpt translator (no page context) — the documented tradeoff that keeps this opt-in, same
   shape as `MIT_SEGMENT_RETRY`.

## Status

- Module + 7 pure/injection tests (collect/prompt/parse/distribute/apply/two-pass agreement/flag). Suite **974 passed**.
- Wired into `translate_patches` behind `MIT_OMISSION_VERIFY=1`; logging behind `MIT_LOG_OMISSION_VERIFY`.
- **Pending before any default decision:** natural proof on the Akuyaku page (verifier flags the curiosity clause, the
  re-ask restores it) and a corpus sweeper for false positives/latency; invitation to re-judge the affected pages.
## Natural proof (Akuyaku p0, `MIT_OMISSION_VERIFY=1`)

Default pipeline shipped this line with the clause gone:

- source: `ALSO... THIS PIQUED MY CURIOSITY EARLIER IN THE DINING HALL,`
- default: `แล้ว... เมื่อตอนกลางวันในโรงอาหาร`

With the pass enabled:

- **`แล้วอีกอย่าง... เมื่อสักครู่ในโรงอาหารนี้ ก็จุดประกายความสงสัยของฉัน`** — the curiosity clause is back.

So the verifier + re-ask works on the measured case.

## Cost (measured, this is why it stays opt-in)

The run took **32.5 s wall** on that page (dense page, cold-ish start: detection 6.7 s), versus the ~15 s the same page
takes in the default pipeline: the pass adds **~3 gateway round-trips** (two verifier passes on the page's long lines
plus one re-ask batch), each on the order of seconds. That is acceptable as an opt-in for quality-critical chapters, not
as a default.

Next tuning ideas before any default decision: a single verifier pass (halves the cost; two passes were a stability
cushion), or verify only lines that the content-loss predicate already suspects. Both need a corpus sweep with the
translation judge to prove they keep the win.
## Tuning: the two verifier passes now run concurrently (round 209)

The passes are independent HTTP requests, so they are issued with `asyncio.gather` instead of one after the other.
Same agreement requirement, half the round-trips:

| run | wall (Akuyaku p0) | result |
|---|---|---|
| sequential passes | 32.5 s | clause restored |
| **concurrent passes** | **25.2 s** | clause restored (`แล้ว... เมื่อครู่ในโรงอาหารนี้ ก็ทำให้ฉันสงสัย`) |

Still ~10 s over the default pipeline (one verifier round-trip plus the re-ask call), so it stays opt-in; the next
lever would be a single-pass mode for chapters where the extra confidence is not worth a round-trip.
## Pass count is configurable — single-pass is NOT the default (round 210)

`MIT_OMISSION_VERIFY_PASSES` (1-3, default 2) lets a cost-sensitive run trade confidence for a round-trip. Measured on the
same Akuyaku page:

| passes | wall | clause restored? |
|---|---|---|
| 1 | **21.1 s** | **no** (`แล้วอีกอย่าง... ตอนก่อนหน้าในโรงอาหารนี้` — flagged nowhere, verifier noise) |
| 2 (default) | 25.2 s | yes |
| sequential 2 | 32.5 s | yes |

So the second pass is doing real work: the verifier can miss the clause in a single sample, and the agreement rule is
what keeps the signal stable. **Default stays 2**; single-pass exists only as an explicit cost trade for chapters where
a missed omission is acceptable.
---

## CORRECTION (round 211): the earlier natural proof was not attributable; three bugs found and fixed

The Akuyaku runs that showed a restored curiosity clause were **translation sampling variance**, not the pass: no
`[omission-verify]` line ever appeared in those runs, and the pipeline verification actually returned nothing. Three
real defects were found while chasing it:

1. **Parser bug.** JSON mode returns a single JSON **object** (`{"i":0,...}`) for one pair; the parser only accepted
   arrays, so every single-line verification silently became "no omissions". Fixed in the module and in
   `tools/omission_verify.py` (accepts array, object, or a dict wrapping a list).
2. **One request per page is unreliable.** With two pairs in one prompt the model returned a single, wrongly-indexed
   item (`{i:1, omitted:false, missing:...}`), so the batched page could never agree. Verification now sends **one
   candidate per request**, fanned out.
3. **Gateway burst throttle.** 12 parallel verifier calls made most calls fail (non-200), so agreement was empty in the
   pipeline while 2-candidate probes worked. Added `Semaphore(3)` plus one retry per call.

### Proof after the fixes (deterministic replay, not sampling)

`doctor_page --replay final121/Akuyaku-p0 --tag _omvreplay` with `MIT_OMISSION_VERIFY=1`:

```
[omission-verify] entered candidates=6
[omission-verify] agreed=[5]
[omission-verify] reasked=1 got=1 first="แล้ว... เรื่องนี้ทำให้ฉันทึ่งมากตอนที่อยู่ในห้องอาหาร"
[omission-verify] "แล้ว... เมื่อตอนกลางวันในโรงอาหาร" -> "แล้ว... เรื่องนี้ทำให้ฉันทึ่งมากตอนที่อยู่ในห้องอาหาร" (missing="THIS PIQUED MY CURIOSITY")
[omission-verify] candidates=6 flagged=1 applied=1
```

Replay pins the baseline translation (the omitted line from the earlier sweep), so the change is caused by the pass.
An independent probe with the per-line verifier flagged the same pair **4/4 runs**.

### Cost of the working version

- The replay page took ~29.6 s wall (translation itself 5 ms because it is replayed): ~2 verifier round-trips (six
  candidates, two passes each, throttled to 3 concurrent) plus one re-ask call.
- Still opt-in, and only runs for the custom_openai gateway translator; other translators skip it.
## Live probe after the fixes (2 pages, no false flags)

Ran two live pages (Akuyaku p0/p1) with the working pass:

- `entered candidates=6, agreed=[]` / `entered candidates=2, agreed=[]` — both pages' live translations were complete, so the
  verifier flagged nothing (no false positives on these two pages).
- Wall 29.5 s / 14.8 s; the first page includes model loading. The added verifier cost is ~8-12 s per page with long
  lines, which is why the pass stays opt-in.

Precision on genuinely omitted lines is proven by the replay test (one flagged line, restored); precision on clean pages
is supported by this probe but needs a wider sweep before any default discussion.
## Wider clean-page sweep (6 pages, 9 long-line candidates)

Ran six more pages across series with the flag on (Boku, Horimiya, Mieruko, Iruma, Mushoku, Dungeon):

| page candidates | agreed |
|---|---|
| 1, 2, 3, 1, 0, 2 (9 total) | **0 on every page** |

Every candidate pair was a complete translation, and the verifier flagged none — **no false positives in 9 candidates**
across six clean pages. Combined with the replay true-positive (one flagged line restored), the evidence is now:
true-positive proven deterministically, false-positive rate on clean pages 0/9 in this sample.

Cost per page stayed in the 14-23 s wall range (verifier adds ~4-8 s when candidates exist; a page with 0 candidates
adds nothing). The pass stays opt-in until a full-corpus sweep and a translation-judge comparison are run.
## Cost cut: schema-enforced batched verification (round 214)

Per-line verification fixed the reliability but cost 12 requests per page. The gateway accepts `response_format:
json_schema`, so the verifier now asks for a single object `{"items":[{i,omitted,missing}, ...]}` in **one request per
pass**; the model must enumerate every pair, and the fast path is taken only when the returned item count matches the
candidate count. If it does not, the pass falls back to the proven per-line path.

| run (Akuyaku replay, deterministic) | wall | outcome |
|---|---|---|
| per-line (round 211) | 29.6 s | clause restored |
| **schema batch (round 214)** | **24.8 s** | clause restored (`...ฉันก็เกิดสงสัยขึ้นมาด้วย`) |

Direct verifier probe with six candidates still flags only the omitted line (`agreed={5: THIS PIQUED MY CURIOSITY}`),
and the unit suite (11 omission tests) covers the fast path, the item-count fallback and the object/array parser.