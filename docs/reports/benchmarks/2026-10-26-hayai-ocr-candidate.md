# Hayai OCR v2.5 Nova as MIT's recogniser — first A/B on ch. 6

**Question:** the 48 px line recogniser loses hand-lettered dialogue (ch. 6: `I'm glad.` empty, `Kurose -kun,
you...` as `14`) and every such box needs a vision-gateway rescue. Hayai OCR v2.5 Nova reads crops directly at
native resolution (SigLIP2 NaFlex + 12-layer decoder, ~150M parameters, Apache-2.0, EN/JA/ZH/KO). Is it a better
recogniser for MIT?

**Setup**
- Two arms on the same live stack (`/translate/with-form/patches`, haiku translator, detection untouched):
  `ocr.ocr='48px'` (today) and `ocr.ocr='hayai'` through a new adapter (`manga_translator/ocr/model_hayai.py`).
- Pages 2, 9 and 10 of *Haimiya-senpai wa Kowakute Kawaii* ch. 6 — the pages the Phase-0 defects were found on.
- Plus 8 handpicked crops where the 48 px read is known to fail.

**Crops (budget 512, the model card's max-quality setting)**

| crop | Hayai v2.5 Nova | 48 px today |
|---|---|---|
| hand-lettered | `I'm glad.` | '' (needed the vision rescue) |
| hand-lettered | `Kurose-kun, you...` | `14` (needed the vision rescue) |
| balloon | `SENPAI! GOOD AFTERN...` | `SENPAI! GOOD AFTERN..` |
| printed | `I'M GLAD IT'S BACK TO NORMAL.` | `IM GLAD ITS BACK TO NORMAL.` |
| stutter | `Th- that's...! Th- that's not it!!!` | `Th- thats..! Th- thats not it!!` |

Warm latency 0.07–0.26 s per crop (first call 2.1 s including warm-up).

**Whole pages (live, both arms)**

| page | 48 px | Hayai | verdict |
|---|---|---|---|
| p10 `Kurose -kun, you...` box | `14` → vision rescue | `Kurose-kun, you... Kurose -kun, you...` | **Hayai wins**, without a gateway call |
| p10 stutter | `Th- thats..! …` | `Th- thats...! Th- thats not it!!!` | Hayai wins |
| p9 `I'm glad.` | '' → vision rescue | `Im glad.` (no apostrophe) | Hayai ~equal, no gateway call |
| p2 `HUH ... ?` (hand lettering) | `HUH...?` | `HUH ...?ッ` | equal-ish |
| **art crop** `[0,1033,355,1500]` | `T` (junk, dropped) | `JUMP VALKI-GITNELY CLOSER...` | **Hayai hallucinates English on artwork** |
| art crop `[822,1076,1055,1500]` | `I` | `...I WAS WORIRID THE WHOLE TIME...` | same failure |

The hallucination is not cosmetic — it reached the translator and would have been rendered:
`JUMP VALKI-GITNELY CLOSER...` became `ตอนที่เพิ่งจะเริ่มสนิทกันได้ไม่นาน…` (a fabricated line drawn over the art),
`...I WAS WORIRID THE WHOLE TIME...` duplicated a real line that already sat next to it, and on p10 the
container box came back as `Kurose-kun, you... Kurose -kun, you...` and was translated as a doubled sentence.

**Two engineering findings that decide the integration**
1. **The crop contract matters more than the model.** The pipeline's usual crop warps the quad to a rectangle at a
   fixed height (right for a 48 px line recogniser). Fed that warp, Hayai turned `Kurose -kun, you...` into
   `...mob, whats soomy ...now, s soomy`; fed the plain box crop at native resolution it reads the line exactly.
   The adapter now crops the box unwarped unless the quad is genuinely rotated (> 8°).
2. **The model has no confidence score.** The 48 px recogniser's `prob` is what stops junk reads from being
   translated. Hayai returns text only, so a hallucinated phrase on artwork looks exactly like a read.

**Tuning: three levers tried, one decides it**

| lever | effect on real dialogue crops | effect on the hallucination |
|---|---|---|
| patch budget 384 vs 512 | none (both exact) | changes the invented text, never removes it |
| padding 12 px, upscale to 64 px min side | none | changes the invented text (`SLAM`, `WWWW...`) |
| **mean token log-likelihood of its own answer** | real lettering −0.01 to −0.09 | invented text −0.55 to −2.58; a crop that really contains a neighbouring line scores −0.11 |

The third lever is the fix. `ModelHayaiOCR` now teacher-forces its own answer through the decoder (one extra
forward pass, no second vision call) and accepts the read only when the mean token log-likelihood clears
`MIT_OCR_HAYAI_MIN_CONF` (default −0.35, the gap between the two measured bands). Re-run on pages 2/9/10:

- the artwork reads that were translated in the previous run (`JUMP VALKI-GITNELY CLOSER...`, `...I WAS WORIRID
  THE WHOLE TIME...` on the art box, the `ー`/digit junk) are gone — those regions come back empty;
- every dialogue line still reads: `Im glad.`, `Kurose-kun, you...`, `Th- that's...! Th- that's not it!!!`,
  `SENPAI! GOOD AFTERN...`, `バッ`;
- two leftovers, both merge-level rather than recognition: the nested SENPAI boxes on p2 now both read the line
  (they merged into one patch), and a box overlapping a real neighbour line still reads that line twice
  (confidence −0.11 passes the gate because the text really is there).

**Adopted (2026-10-26): the local reader replaces the gateway in the rescue path**

``manga_translator/local_ocr_rescue.py`` routes the rescue through the on-device Hayai reader, on by default
(`MIT_RESCUE_LOCAL_OCR=0` restores the gateway-only path), with the gateway kept as an automatic fallback — a
worker whose model load fails logs one warning and carries on exactly as before.

Measured on the live stack, 14-page chapter, two runs: **24.7 s / 19.0 s wall, 14/14 pages** (baseline median
25.0 s). `textline_merge` p50 fell from **2,163 ms to 722 ms** (that stage was dominated by waiting on the
gateway), `ocr` p50 stayed at 569 ms (baseline 623 ms). Per-crop cost of the local read, measured under the
same GPU load: 76 ms generate, **131 ms with the confidence pass**. Zero gateway fallbacks in the run, and the
two lines that used to need a rescue are still recovered (`I'm glad.` → ดีใจด้วยนะ, `Kurose -kun, you...` →
container takeover → คุโรเสะคุง เธอนี่นะ...). The artwork junk stays away: `T` and `O` come back empty, and a box
overlapping a real neighbour line is dropped by `resolve_rescue`.

**Decision**
- **Not adopted as the primary recogniser yet.** It wins every dialogue case, but on artwork it invents English
  where the 48 px model produced harmless 1-character junk that the downstream filters dropped. Without a
  confidence signal those invented lines would be translated and rendered over the art — a visible regression.
- **The win is as the hard-crop reader**: the same boxes that today go to the vision gateway (12–15 s and a
  network call each; 98 of 153 calls returned nothing on pages 10–11) would be read locally in ~0.1 s. That is
  strictly better than the gateway and carries no hallucination risk on art, because it only sees boxes the
  48 px read failed to read. Next step.

**Limits**
- One chapter, 3 pages, 8 crops.
- Only the EN side of the model was exercised (it also claims JA/ZH/KO and vertical text).
- The hallucination case is a *classification* problem (is this crop lettering at all?), not a recognition one;
  a cheap lettering/art gate would let the model be primary later.

## Other OCR candidates from the PRD, and why they are not on the bench yet

| candidate | status on this box |
|---|---|
| **manga-ocr** (`Ocr.mocr`, MIT already supports it) | tested — unusable for an English-source pipeline: it is a Japanese recogniser, so it returns full-width mixed garbage (`ｌ＇ｍ９ｌａｄ．`, `ＫＵＲＯＳＥ一ｋｕｎ`), every region drops (p9: **0 patches**), and it took 57.5 s for one page |
| Paddle recognisers (PP-OCRv6/v5), OpenOCR/SVTRv2, PARSeq | not installed (no `paddle`/`paddleocr`); would need a Paddle stack or an ONNX export |
| Thai post-render check (`th_PP-OCRv5`) | same Paddle dependency; no Thai recogniser is on the box today |

**Environment notes**
- Run it on the default CUDA device (`cuda`); moving the weights to `cuda:1` makes the CUDA-graph engine return
  one-character answers.
- The stored HF token on this machine is expired: public downloads need `HF_HUB_DISABLE_IMPLICIT_TOKEN=1`.
