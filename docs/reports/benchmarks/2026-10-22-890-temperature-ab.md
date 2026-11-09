# Sampling temperature A/B — 0.5 stays, 0.0 rejected (#890)

- **Date:** 2026-10-22 · **Issue:** #890 · **Harness:** `tools/translation_ab.py` translate/packet + the chunked
  pairwise judge used in #888.
- **Question:** the shipped custom_openai default is temperature 0.5 (`config_gpt.temperature`, top_p 1). Is
  pinning it to 0 more faithful (fewer random garbles, steadier names)?
- **Setup:** same v2 prompt both arms, only `temperature: 0.0` added (`tools/prompts/thai_manga_v2_t0.yaml`);
  12 pages (audit's lowest + 3 controls), blinded per page (seed 11), segment-level judgement.

## Result — keep 0.5

| arm | pages won |
|---|---|
| **A = 0.5 (shipped)** | **7** |
| B = 0.0 | 4 |
| tie | 1 |

Offline: the two arms are **identical on most segments** (122 segments, only a handful differ) — the gateway's
sampling is already close to deterministic — and the differing lines slightly favour 0.5 under the judge.

## Reading

Together with the prompt-v3 result (#888: v2 won 6-2), prompt and temperature are at a local optimum under
this judge. The judge is the production model (same family as the translator): reliable for meaning-level
differences, noisy on micro-style. Further quality work should use **reference-based (gold) data** rather than
letting the same model grade itself.

## Files

- `tools/prompts/thai_manga_v2_t0.yaml` — the temperature arm, kept as the experiment record.
- Same protocol + 12 pages is reusable for the next candidate knob.
