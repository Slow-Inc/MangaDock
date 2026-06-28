# MIT (Translation System) — Presentation & Defense Pack

> The advisor will focus on MIT (our highlight). This is the deep-dive prep: how it works (slide-ready),
> what is genuinely novel, a **demo script**, and — most importantly — **anticipated hard questions with
> defensible answers**. Honesty-first: the goal is to *not be caught off guard*, especially on the
> "did you measure?" question. Pairs with `positioning-differentiation-legal.md` and `bug-case-catalog.md`.

---

## 1. MIT in 60 seconds (the elevator pitch)

> *"MIT is our manga **image** translation microservice. Given a page image, it runs a 6-stage ML pipeline —
> detect text → OCR → translate (LLM) → erase the original text (inpaint) → typeset the translation back
> into the art (render) → composite. We forked the open-source `manga-image-translator` and turned it from
> a single-user CLI into a **server-grade, on-demand, cache-backed, observable** service that the reader
> calls live. The novel engineering is the **patch-based byte-identical output contract** + a **render-config
> hash cache** that lets us tune render quality safely — not the ML models themselves."*

---

## 2. How it works (slide-ready pipeline)

```
PAGE IMAGE
   │
   ▼
[1] DETECTION ── DBNet (text lines); YOLOv8-seg (speech bubbles, opt-in)
   │
   ▼
[2] OCR ──────── 48px Roformer recognizer; VLM rescue for SFX (opt-in)
   │
   ▼
[3] MERGE ─────── group text lines → regions (graph union-find / bubble-aware)
   │
   ▼
[4] TRANSLATE ── Gemini Flash Lite (cloud) or Qwen3 (local) — LLM, not phrase-MT
   │
   ▼
[5] INPAINT ───── LaMa erases original text (Flux Klein diffusion, opt-in)
   │
   ▼
[6] RENDER ────── typeset translation: font-fit, wrap, supersample, vertical (knobs)
   │
   ▼
PER-REGION PNG PATCHES  ──►  composited over the ORIGINAL page (byte-identical outside text)
```

**The one sentence per stage** (for narration):
1. **Detect** where the text is. 2. **Read** it (OCR). 3. **Group** lines into speech regions. 4. **Translate** with an LLM (context-capable, not word-by-word). 5. **Erase** the original text so it's not double-printed. 6. **Re-typeset** the translation into the cleaned space, then overlay only those patches on the untouched original.

*(Full citations: `MIT/PIPELINE.md`, `MIT/ARCHITECTURE.md`, ADRs 004–011.)*

---

## 3. What is genuinely novel (and what is NOT — say both)

**Novel / our contribution (defensible):**
1. **Patch-based byte-identical contract (ADR 004)** — output is identical to the original *outside* erased text. → enables per-region caching **and** safe A/B testing of render knobs without re-encoding the page.
2. **Render-config-hash cache key (ADR 011)** — toggling any `MIT_*` knob auto-busts the cache → no stale-render ghosts while tuning. Three-tier (L1/L2/L3).
3. **Server-grade reliability + observability (ADR 017/018/019)** — fire-and-forget batch + HMAC webhook + SSE streaming; worker liveness `/ready`, orphan cleanup; live per-stage timing + VRAM-leak telemetry. The upstream is a black-box CLI.
4. **Knob framework (ADR 006/007)** — render-parity features (narrow-column wrap, 4× supersampling, real vertical text, bubble-fit) are opt-in, byte-identical-off → roll-back-safe experimentation.

**NOT novel (be honest — pre-empts the "you just used an open-source repo" jab):**
- The ML models (DBNet, LaMa, Gemini) are off-the-shelf; the base pipeline is forked from `zyddnys/manga-image-translator`.
- → *"We did not invent the models. Our contribution is the **systems engineering** that makes a research-grade CLI into a production, on-demand, tunable, observable service."*

---

## 4. ⚠️ The #1 hard question: "How good is it? Did you measure?"

**This is the question most likely to sink the viva. Prepare it explicitly.**

- **Honest current state:** we have **no quantitative MT benchmark** (no BLEU/COMET/human-eval on a public set). Our evidence is **qualitative** (`docs/research/mit-vs-upstream-quality-divergence.md`) + visual E2E comparisons.
- **The defensible answer:**
  > *"We evaluated qualitatively and by visual A/B against the original page and the upstream reference — and we documented exactly where we trail and why (cross-page context disabled, detection/inpaint downscaled for VRAM). What we have **not** done is a numeric benchmark; the honest next step is to evaluate on the **OpenMantra** and **Manga109** public sets with BLEU/COMET and a small human eval. We scoped it out for this iteration because the engineering (making it a reliable service) was the thesis, but we know it's the missing piece to make a quality claim."*
- **Why this answer works:** it shows you (a) know the standard benchmarks exist, (b) know your own gap, (c) have a concrete plan. Examiners forgive a known, planned gap; they punish a gap you didn't see.
- **Pre-empt it in the slides** — put a "Limitations & Future Work: quantitative benchmark on OpenMantra/Manga109" slide *before* they ask.

---

## 5. Anticipated hard questions + model answers

**Q: What's novel — isn't this just `manga-image-translator`?**
> The models and base pipeline are open-source; our work is the **systems layer**: patch-based byte-identical output, render-config-hash caching, server reliability + observability, and a knob framework for safe render tuning. We turned a CLI into an on-demand service. *(§3)*

**Q: Why an LLM (Gemini/Qwen3) and not Google Translate / DeepL?**
> Manga is **high-context + multimodal** — honorifics, character voice, puns, SFX. Phrase-based MT (Google/DeepL) drops nuance; this is the exact reason the Japan Association of Translators called *generic* AICMT "unsuitable." An LLM can take series/page context and a glossary, which is the research direction (Hinami 2021; COLING 2025).

**Q: Why LaMa for inpainting, not diffusion (Flux)?**
> VRAM. We target a 12 GB card. LaMa is light and fast; **Flux Klein is implemented as an opt-in inpainter (ADR 003)** — we found it fits in ~5.8 GB with a cached prompt embedding, but it's slower and tight on memory, so it's a knob, not the default. This is a conscious **quality-vs-VRAM trade-off**, documented.

**Q: Why DBNet and not the YOLO/SAM stack the reference uses?**
> Same trade-off — DBNet is a single light pass; YOLOv8-seg (bubbles) and SFX detection are **opt-in** second passes. We chose a lean default with quality knobs rather than a heavy always-on stack. *(ADR 006)*

**Q: What are its limitations / where does it fail?** *(answer this proactively — honesty scores)*
> Four honest ones: (1) **cross-page terminology drift** — we disabled rolling context for multi-tenant safety, so names/honorifics can vary page-to-page (fix: per-job Translation Session #140); (2) **small/faint text** missed — detection downscaled to 2048 for VRAM; (3) **inpaint blur on dark art** — inpaint downscaled to 1536; (4) **stylized SFX** lost by default. All are documented with one-line fixes (`MIT_DETECTION_SIZE=2560`, etc.).

**Q: How does it scale / handle concurrency?**
> GPU work is **semaphore-gated** (default 3 concurrent inpaints); CPU work (PNG encode) runs outside the semaphore in a thread pool. Chapter batches are **fire-and-forget** → MIT processes pages and calls a **webhook per page** (HMAC-signed, retried, idempotent dedup by page index); the frontend streams results via **SSE**. Re-reads hit a **3-tier cache**. *(ADR 017, 011)*

**Q: How is the original text removed cleanly?**
> A **mask** is built from the detected text (connected-components + dilation, optional CRF refine), then **LaMa inpaints** the masked region using surrounding pixels. We carry the source **ICC profile** into each patch so the patch doesn't darken vs the page (a real bug we fixed — #156).

**Q: What was the hardest engineering problem?** *(pick one war story)*
> The **patch composite + cross-page context isolation**. Two examples: a color-management bug where patches rendered ~16 grey-levels darker (ICC "Dot Gain 20%" profile, #156), and **cross-page context bleed** where one manga's translation context leaked into another in the async server — fixed by making the state boundary explicit and resetting per job. *(`bug-case-catalog.md` A4, C3)*

**Q: Why not just call a commercial API (Mantra)?**
> Mantra is a **B2B human-in-the-loop tool**, not an API you embed in a consumer reader for on-demand, any-page translation; and it's a paid pipeline. Our thesis is an **integrated, self-hostable, on-demand** system — a different shape.

**Q: How do you know the translation is correct if you can't read the output language?**
> We don't claim correctness — we surface **quality signals** (the platform is human-first; AI is the accelerant/fallback, and users/translators can override). For evaluation we'd use OpenMantra references + human eval (§4).

**Q: Is the architecture a monolith?**
> No — MIT is a **separate microservice** (FastAPI parent + worker process); the Backend talks to it over HTTP/webhook with an **anti-corruption layer**. Internally MIT was **decomposed from a ~3,000-line god object** into ~21 modules via characterization-first byte-identical seams (ADR 008) — itself a presentable engineering story.

---

## 6. Live demo script (what to show, in order)

1. **Open a chapter** in the reader (MangaDex demo data).
2. **Hit translate** → watch patches stream in over the original page (SSE). Point out: *"only the text regions change; the art is the untouched original — that's the patch contract."*
3. **Show a side-by-side** original vs translated page.
4. **(If safe) toggle a knob** (e.g. show a parity-on vs parity-off render) → *"render quality is tunable and cache-busts automatically."*
5. **Show the Dev console** (`/service/mit`) → live per-stage timing + VRAM → *"the pipeline is observable, not a black box."*
6. **Have a fallback** — a pre-recorded clip / cached result in case the GPU/worker is cold (translation can take 30–40s fresh; mention the cache).

> **Demo risk note:** fresh translation is slow + GPU-dependent; per the cache gotchas (`project_cache_reset_ordering.md`), pre-warm a cached example and have a screen-recording backup.

---

## 7. Slide order for the MIT section (5–7 slides)

1. **What problem** — manga text is baked into the art; translating means detect→read→translate→erase→redraw.
2. **Pipeline diagram** *(§2)* — the 6 stages.
3. **Live demo** *(§6)*.
4. **Our contribution** *(§3)* — patch contract + cache + observability (and "we didn't invent the models").
5. **Engineering depth** — 1 war story (ICC or context bleed) + the god-object decomposition.
6. **Limitations & future work** *(§4)* — the benchmark gap, cross-page context, VRAM trade-offs — *stated before they ask*.
7. **(optional) Trade-off table** — quality vs VRAM knobs.

---

## 8. The three things to never claim (they'll get caught)
1. ❌ "Our translation quality is better than \[Mantra/Orange/upstream\]." → you have no benchmark. Say "comparable engineering, quality not yet benchmarked."
2. ❌ "We invented the translation pipeline." → it's a fork. Say "we engineered the service around an open-source pipeline."
3. ❌ "It's fully production-ready." → cross-page context off, no benchmark, VRAM-bound. Say "prototype with a production-shaped architecture."
