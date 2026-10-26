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

**Environment notes**
- Run it on the default CUDA device (`cuda`); moving the weights to `cuda:1` makes the CUDA-graph engine return
  one-character answers.
- The stored HF token on this machine is expired: public downloads need `HF_HUB_DISABLE_IMPLICIT_TOKEN=1`.
