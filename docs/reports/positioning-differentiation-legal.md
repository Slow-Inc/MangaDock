# MangaDock — Positioning, Differentiation & Legal Report

> Academic-presentation companion. Answers the advisor's questions: who else does this, how we differ,
> why our translation system is the highlight, why the big players haven't fully done it, our pros/cons,
> and the legal posture. Honest framing — claims we can't defend in a viva are flagged, not inflated.
> Bug/engineering case studies live in the sibling doc `bug-case-catalog.md`.

---

## 0. TL;DR (one slide)

- **The field is hot and crowded** — academic (UTokyo's *Towards Fully Automated Manga Translation*, 2021) and commercial (Mantra, Orange/emaqi, INKR/GlobalComix) are all racing on the *raw translation engine*.
- **Our raw MT engine is NOT state-of-the-art** — and we should say so. On pure pipeline quality we trail Mantra/Orange (human-in-the-loop + tuned models) and even our own upstream in places (cross-page context disabled, detection/inpaint downscaled for VRAM). See `mit-vs-upstream-quality-divergence.md`.
- **Our highlight is the *system*, not the *model*** — a self-hostable, **on-demand, reader-integrated, knob-A/B-testable** translation *platform* with 3-tier caching, observability, and a **human-first creator/translator marketplace** layered on top. Nobody in the commercial set ships *that* shape to end-users.
- **Our legal model is a legitimate two-sided marketplace, NOT scanlation** — rights-holders (indie creators *and* major publishers) onboard and **license their own catalogs** to the platform; we provide on-demand AI + human translation and revenue-share. The Webtoon/Tapas/GlobalComix/KDP model. Monetized content is **authorized**; AI translation of authorized content is lawful (§5).
- **Why incumbents don't build our shape** — publishers want to *use* a neutral distribution + localization rail, not *build* one (they already license tooling like Mantra). The opening is to **be that rail** for the long tail, indie creators, and underserved markets (Thai/SEA) — with the publishers as **suppliers, not competitors**.

---

## 1. Who else is doing this (existing research & products)

### 1.1 Academic research
| Work | Year | Contribution | Relevance to us |
|---|---|---|---|
| **Towards Fully Automated Manga Translation** (Hinami et al., UTokyo) [[arXiv 2012.14271]](https://arxiv.org/abs/2012.14271) | 2021 | First **context-aware + multimodal** manga MT; released the **OpenMantra** evaluation dataset; method to auto-build a manga parallel corpus | Defines the two hard problems we also hit: *context* and *multimodality*. Our cross-page context is currently **disabled** (§3.3) — i.e. we are *behind* the 2021 baseline on this axis. |
| **Context-Informed MT of Manga using Multimodal LLMs** [[arXiv 2411.02589]](https://arxiv.org/html/2411.02589v2) · [[COLING 2025]](https://aclanthology.org/2025.coling-main.232.pdf) | 2024–25 | Uses **MLLMs** to inject visual context; shows earlier tag-based context was inconclusive | This is the current research frontier; our Gemini/Qwen3 path is MLLM-capable but we **don't feed page imagery as context** yet. A concrete research-aligned upgrade path. |
| **Manga109 / Manga109-v2026** [[arXiv 2605.21182]](https://arxiv.org/html/2605.21182) | 2017 / 2026 | The foundational annotated manga dataset (detection/OCR/understanding) | The standard benchmark we could evaluate against to make claims *measurable* (we currently have **no quantitative MT benchmark** — a gap for the report). |

> **Honest gap for the viva:** we have **no BLEU/COMET/human-eval numbers** on a public set (OpenMantra/Manga109). If we want to claim "better," we must measure. Right now our evidence is qualitative (`docs/research/*divergence*`).

### 1.2 Commercial / production players
| Player | Model | What it actually is | Source |
|---|---|---|---|
| **Mantra Engine** (UTokyo spin-out, 2020; raised $4.9M Jul-2024) | Proprietary MT + image AI, **human-in-browser editing** | **B2B localization tool** — translators/designers edit in-browser; ~40–50k pages (~250 titles)/month across 10+ publishers | [[Slator/JapanGov]](https://www.japan.go.jp/kizuna/2023/02/manga_translation_service.html) |
| **Orange Inc. / emaqi** ($20M from **Shueisha/Shogakukan**/JIC, 2024) | AI-**assisted**, 20 human translators, **<10% AI at launch** | **Licensed B2C store** — official Shonen Jump+ one-shots, 500 vol/month goal, 50k titles/5yr | [[ComicsBeat]](https://www.comicsbeat.com/orange-inc-exec-clarifies-ai-use-for-emaqi-manga-localization/) [[Anitrendz]](https://anitrendz.net/news/2025/05/28/orange-inc-launches-emaqi-manga-app-in-north-america/) |
| **INKR** (Singapore/Vietnam; acquired by **GlobalComix**, $13M, Mar-2026) | Localization + distribution tech | **B2B + distribution platform** | [[Slator]](https://slator.com/globalcomix-funding-manga-localization-inkr-acquisition/) |
| **zyddnys/manga-image-translator** (open source) | DBNet + 48px OCR + LaMa/Flux + GPT | **Our upstream** — CLI/self-host full-auto pipeline | repo |
| **MangaTranslator** (open-source reference we benchmark against) | Dual-YOLO + SAM + Knuth-Plass render | The render-quality bar we port from | `docs/research/translator-deep-dissection.md` |

**Pattern:** the *funded, legitimate* players are either **B2B tooling** (Mantra, INKR) or **licensed curated catalogs** (Orange). The *open-source* players are full-auto but unmonetized self-host tools. **Nobody ships a consumer, on-demand "translate any chapter as you read" experience monetized through a creator marketplace** — because that requires touching unlicensed content (legal §5).

---

## 2. How MangaDock differs (the differentiation thesis)

MangaDock is **not** "another manga MT engine." It is a **vertically-integrated reading + translation + creator-economy platform** where AI translation is *one accelerant*, not the product. The differentiators:

1. **On-demand, reader-integrated translation.** The user reads a chapter and translates the page in-place (patch overlay), rather than consuming a pre-localized catalog. (Mantra/Orange pre-bake; we do it live + cache.)
2. **Human-first marketplace, AI as fallback.** Architecturally the platform prioritizes human translations and treats MIT as the accelerant/fallback (`Documents/Plan/Plan.md` — "Human translation เป็นสินค้าหลัก; MIT เป็น accelerant/fallback"). This directly answers the JAT/fan critique of *full-auto* AI (§4).
3. **Patch-based overlay with a byte-identical contract** (ADR 004) — per-region PNG over the original page → per-region caching granularity + **safe A/B testing of render knobs** via `renderConfigHash` (ADR 011). This is a genuinely distinctive *engineering* design (§3.2).
4. **Self-hostable, on-demand GPU cost model** — translate only on real traffic (Roadmap Phase 2), vs always-on B2B pipelines.
5. **Community + creator economy + wallet** — forum, unlock economy, 70/30 revenue split, donations. The translation engine feeds a *platform*, not a standalone tool.
6. **Operational maturity unusual for the scale** — 3-tier cache, leader election, webhook HMAC, observability/Dev console, ADR discipline. (See `bug-case-catalog.md` — these are demoable engineering stories.)

> **The honest one-liner:** *"We didn't build a better translation model than Mantra. We built the open, on-demand, community-driven reading platform that a B2B model like Mantra can't be — with AI translation as an integrated accelerant rather than the product."*

---

## 3. The translation system (our highlight) — better how, and the honest pros/cons

### 3.1 Pipeline at a glance
`detection (DBNet; YOLOv8-seg bubbles opt-in) → OCR (48px Roformer; VLM rescue opt-in) → textline-merge → translation (Gemini Flash Lite / local Qwen3) → mask refine → inpaint (LaMa; Flux Klein opt-in) → render (homography warp; clean-layout/narrow-column/4× supersample opt-in) → per-region PNG patch over original`
(Full detail + citations: `MIT/PIPELINE.md`, ADRs 004–011.)

### 3.2 Where we are genuinely BETTER than the open-source baseline
| Strength | Why it matters | Source |
|---|---|---|
| **Patch-based overlay + byte-identical contract** | Output is identical to the original *outside* erased regions → enables per-region caching **and** safe knob A/B testing (turn a lever on without re-encoding the page) | ADR 004 |
| **3-tier translation-patch cache + render-config-hash key** | Re-reads are instant; toggling any `MIT_*` knob automatically busts cache → no stale-render ghosts | ADR 011 |
| **Server-grade reliability** — worker liveness `/ready`, orphan cleanup, port guards | Upstream hangs silently on port collision; we fail loud | ADR 017, `bug-case-catalog.md` #13 |
| **Live observability** — per-stage timing, VRAM-leak flagging, gateway diagnosis, SSE Dev console | The open-source pipeline is a black box | ADR 018/019 |
| **ICC-profile-correct patches** | Fixes the "Dot Gain 20%" darkening seam that a naive overlay shows | `bug-case-catalog.md` #12 |
| **Thai typesetting** — combining-mark-safe wrap + default Thai face | Upstream assumes Latin; we serve a Thai market correctly | `bug-case-catalog.md` (Thai wrap) |
| **Fire-and-forget batch + HMAC webhook + idempotent dedup + SSE streaming** | Scales to chapter-batch; secure; resumable | ADR 017 |

### 3.3 Where we are HONESTLY WORSE (must disclose in the report)
| Weakness | Impact | Fix |
|---|---|---|
| **Cross-page context disabled** (`reset_page_context()` per page, #136/#159) — a multi-tenant-safety trade-off | Terminology/honorifics drift page-to-page — *behind even the 2021 Hinami baseline* | Per-job Translation Session (#140) |
| **Detection downscaled** 2048 (MIT default 2560) for VRAM | ~36% fewer voxels for small text → missed lines | `MIT_DETECTION_SIZE=2560` |
| **Inpaint downscaled** 1536 (tuned 2048) | Blurrier erase on dark art | `MIT_INPAINTING_SIZE=2048` |
| **Render parity off by default** (clean-layout/narrow-column/Knuth-Plass greedy) | EN wraps to wrong width; SFX lost | opt-in knobs / #180 |
| **No quantitative benchmark** | Can't *prove* quality claims | Evaluate on OpenMantra/Manga109 |

> These are mostly **deliberate VRAM trade-offs on a 12 GB card** (`project_render_parity_direction.md`) — a legitimate engineering-constraints story, *if framed as a conscious trade-off rather than a bug.*

### 3.4 The defensible "highlight" claim
We should NOT claim "best translation quality." We **should** claim:
> *"The most complete open, on-demand, reader-integrated translation **system** — where the novel engineering is the patch-based byte-identical knob-A/B framework, the 3-tier render-config-hashed cache, and the human-AI marketplace integration — not the raw model."*

---

## 4. Why the big players haven't done *our* shape (and what they're actually doing)

The premise "big players haven't done this" is **half-true** — they *are* moving, but deliberately *not* into our exact shape:

1. **They ARE doing AI translation — cautiously.** Orange (Shueisha-backed) ships **<10% AI, 20 human translators** [[ComicsBeat]](https://www.comicsbeat.com/orange-inc-exec-clarifies-ai-use-for-emaqi-manga-localization/); Mantra is **human-in-the-loop B2B**; Shogakukan's *Novelous* uses AI but drew complaints. The *full-auto, no-human* path is the part they avoid.
2. **Professional backlash.** The **Japan Association of Translators (June 2024)** called high-volume AI manga translation **"extremely unsuitable"** for high-context, story-centric work [[Slator]](https://slator.com/ai-translation-extremely-unsuitable-for-manga-japan-association-of-translators-says/) [[Anitrendz]](https://anitrendz.net/news/2024/06/04/japan-association-of-translators-expresses-concerns-on-ai-use-for-high-volume-manga-translations/).
3. **Fan/quality backlash.** Documented errors in honorifics, puns, character voice; "enshittification" framing [[Popverse]](https://www.thepopverse.com/comics-manga-anime-popverse-jump-ai-translation-machine-industry-translators-human) [[CBR]](https://www.cbr.com/manga-ai-translation-plan-association-response-slam/). The nuance problem is *unsolved*.
4. **They are vertically-integrated, not neutral.** A publisher's app distributes *its own* catalog; it has no incentive to build a **neutral rail** that also carries rivals' and indie creators' works. That neutral two-sided position is structurally hard for an incumbent to occupy — and is exactly where MangaDock sits.
5. **Brand risk.** A publisher shipping a buggy AI translation damages its own IP; a neutral marketplace (with human-first + per-title quality signals) absorbs that risk differently.

> **Reframed honest answer:** *"Incumbents avoid the full-auto path because it's professionally toxic (translator backlash) and quality-risky to their brand — and they have no reason to build a neutral marketplace that carries competitors. Our opening is to be the neutral distribution + AI-localization rail where publishers are suppliers, not competitors, and indie creators get the same pipeline — with human translation first and AI as the accelerant."*

---

## 5. Legal posture — a legitimate two-sided licensed marketplace (NOT scanlation)

**Positioning (per the presentation plan):** MangaDock is a **neutral distribution + AI-localization marketplace**. Rights-holders — indie creators *and* major publishers — onboard and **license their own catalogs** to the platform, which provides on-demand AI + human translation and shares revenue back. The model is **Webtoon / Tapas / GlobalComix / Amazon-KDP**, not a scanlation reader. We are explicitly **not** in the DMCA-infringing translation business.

### 5.1 Why this model is lawful
- The uploader is the rights-holder (or their authorized licensee) and **grants the platform a licence** to host, translate, and distribute. A translation is a derivative work; **authorized** derivatives are lawful.
- **AI translation of authorized content is fine** — the rights-holder consented; the JAT/fan backlash (§4) is about *unconsented mass-AI*, which we are not.
- Revenue (coin-unlock, 70/30 split, donations) flows on **authorized content only**.

### 5.2 The hard law as backdrop (why authorization is mandatory)
- **Scanlation = copyright infringement** under the **Berne Convention** — reproduction/distribution/translation are exclusive rights, retained even for works unlicensed in a market [[Wikipedia: Scanlation]](https://en.wikipedia.org/wiki/Scanlation) [[Legal Implications of Scanlations]](https://amishasinghrana.medium.com/legal-implications-of-scanlations-navigating-the-gray-areas-of-manga-translation-71e8018e453a). → This is *why* our monetized surface must be licensed-by-the-uploader; it is the line we deliberately stay on the legal side of.
- **Thailand — Copyright Act B.E. 2537 (1994):** adaptation/translation is an **exclusive right** of the owner; no general fair-use shields a commercial reader [[ICLG]](https://iclg.com/practice-areas/copyright-laws-and-regulations/thailand/) [[WIPO Lex]](https://www.wipo.int/wipolex/en/text/129762). → reinforces "authorization-by-upload," not statutory carve-outs, as the basis.

### 5.3 The legal machinery that makes the intermediary model hold
| Instrument | Purpose |
|---|---|
| **Uploader Terms** — rights warranty + licence grant + indemnity | The uploader represents they hold the rights and licenses them to us; liability flows to a bad-faith uploader |
| **Publisher onboarding / KYC** | Verify major-publisher suppliers and their territory rights before catalog goes live |
| **Content-origin policy engine** (`origin: platform_original / indie_creator / publisher_licensed / …`) | Only **authorized** origins are monetizable; enforced in code (`Documents/Plan/Plan.md` §0.2) |
| **DMCA §512 / intermediary safe-harbor + notice-and-takedown + repeat-infringer policy** | As a hosting intermediary (like YouTube/Webtoon), we are shielded from a bad-actor's infringing upload **if** we run proper takedown — this is the standard platform protection, not an excuse for infringement |
| **Territory / region policy** | Honor each licence's territorial scope |
| **Provenance UI** | Every title shows its origin/licence status |

### 5.4 Honest caveats (say these in the viva — they make the model credible, not weaker)
- **The current build demos with MangaDex content** as a *free-reading / traffic* placeholder. That is **not** the monetized model and would be governed by the origin policy (free-only, or replaced) at launch — be explicit that monetization is gated to authorized origins, so no one mistakes the demo for the business.
- **No publisher deals are signed yet.** The two-sided marketplace is the **target model**; onboarding real licensors is a business-development dependency. Present it as the plan with the *legal + technical rails already built* (origin policy, takedown, revenue-split, wallet), not as a closed commercial reality.
- **Net:** the architecture is **compliance-by-design** — the monetized surface is licensed-by-upload with takedown + origin-segmentation + territory policy as first-class systems. The honest framing is *"a legitimate intermediary whose rails are built; the catalog-licensing is the go-to-market work ahead,"* not *"a cleared, fully-licensed product today."*

---

## 6. SWOT (presentation summary)

| | |
|---|---|
| **Strengths** | On-demand reader-integrated translation; patch/knob A/B + 3-tier cache engineering; human-AI marketplace; operational maturity (cache/observability/security); Thai-market fit; full self-hostable stack built by 2–3 undergrads |
| **Weaknesses** | Raw MT below SOTA (context disabled, VRAM-downscaled); no quantitative benchmark; bus-factor; **no licensors signed yet** (two-sided model is a plan); demo still uses MangaDex (must be governed by origin policy at launch); marketplace needs moderation/anti-abuse for bad-actor uploads |
| **Opportunities** | Re-enable cross-page context (#140) → match research baseline; benchmark on OpenMantra/Manga109 for measurable claims; **be the neutral rail** indie + publishers both onboard (the moat incumbents can't occupy); **Thai/SEA** long tail underserved by Orange/Mantra (EN-focused) |
| **Threats** | Incumbents (Orange/Mantra) scaling; **licensor trust / chicken-and-egg** supply onboarding; AI-translation reputational backlash spilling onto authorized AI; model/API cost; takedown/moderation load |

---

## 7. Suggested presentation outline (slides)

1. **Problem** — manga demand >> licensed-translation supply; piracy fills the gap badly.
2. **Landscape** — research (Hinami 2021, COLING 2025) + commercial (Mantra/Orange/INKR) + open-source (zyddnys). *[table §1]*
3. **Our thesis** — not a better model; a better *system* (on-demand, reader-integrated, human-first marketplace). *[§2]*
4. **Translation highlight** — pipeline + the novel patch/knob/cache engineering. *[§3.2]* — **and** an honest "where we trail + why (VRAM)" slide *[§3.3]* (honesty wins vivas).
5. **Why incumbents don't ship our shape** — legal + backlash + quality. *[§4]*
6. **Legal & ethics** — we are a **legitimate two-sided licensed marketplace** (Webtoon/KDP model), not scanlation: authorized-by-upload + DMCA safe-harbor + origin policy. Berne/Thai law is the backdrop that makes authorization mandatory. *[§5]*
7. **Engineering war-stories** — pick 5 from `bug-case-catalog.md` (TOCTOU wallet, 3-tier cache replay, magic-byte upload, worker-orphan, R2 cost-bleed).
8. **Roadmap & ask** — benchmark, re-enable context, marketplace.

---

## Sources (external)
- [Towards Fully Automated Manga Translation (arXiv 2012.14271)](https://arxiv.org/abs/2012.14271)
- [Context-Informed MT of Manga using MLLMs (arXiv 2411.02589)](https://arxiv.org/html/2411.02589v2) · [COLING 2025 PDF](https://aclanthology.org/2025.coling-main.232.pdf)
- [Manga109-v2026 (arXiv 2605.21182)](https://arxiv.org/html/2605.21182)
- [Mantra Engine — Government of Japan feature](https://www.japan.go.jp/kizuna/2023/02/manga_translation_service.html)
- [Orange Inc / emaqi — ComicsBeat](https://www.comicsbeat.com/orange-inc-exec-clarifies-ai-use-for-emaqi-manga-localization/) · [Anitrendz launch](https://anitrendz.net/news/2025/05/28/orange-inc-launches-emaqi-manga-app-in-north-america/)
- [GlobalComix acquires INKR — Slator](https://slator.com/globalcomix-funding-manga-localization-inkr-acquisition/)
- [JAT: AI "extremely unsuitable" for manga — Slator](https://slator.com/ai-translation-extremely-unsuitable-for-manga-japan-association-of-translators-says/)
- [Dear manga publishers, we don't want your AI translations — ComicsBeat](https://www.comicsbeat.com/dear-manga-publishers-we-dont-want-your-ai-translations/)
- [Scanlation — Wikipedia](https://en.wikipedia.org/wiki/Scanlation) · [Legal Implications of Scanlations](https://amishasinghrana.medium.com/legal-implications-of-scanlations-navigating-the-gray-areas-of-manga-translation-71e8018e453a)
- [Copyright Laws & Regulations — Thailand (ICLG)](https://iclg.com/practice-areas/copyright-laws-and-regulations/thailand/) · [WIPO Lex Thailand](https://www.wipo.int/wipolex/en/text/129762) · [Copyright Act B.E. 2537 §6-18 (Siam Legal)](https://library.siam-legal.com/thai-law/copyright-act-b-e-2537-copyright-work-acquisition-and-protection-sections-6-18/)
